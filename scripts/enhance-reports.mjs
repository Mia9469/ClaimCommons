/* Add shared navigation without rewriting report claims or scientific metadata. */
import fs from 'node:fs/promises';
import path from 'node:path';
const version = '20261020-1';
const escape = value => String(value ?? '').replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export async function enhanceReports(root, expanded) {
  const byPaper = new Map();
  for (const claim of expanded.claims) {
    const match = claim.id.match(/^structured-.+-(\d+)$/);
    if (!match) continue;
    if (!byPaper.has(claim.paper_id)) byPaper.set(claim.paper_id,{});
    byPaper.get(claim.paper_id)['C' + match[1]] = claim.id;
  }
  const reportAssets = new Set();
  for (const paper of expanded.papers) {
    if (!/^data\/[a-z0-9-]+\/[^/]+\.html$/.test(paper.reading_report_url || '')) continue;
    const file = path.resolve(root,paper.reading_report_url);
    if (!file.startsWith(path.resolve(root) + path.sep)) continue;
    let html;
    try { html = await fs.readFile(file,'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const prefix = path.relative(path.dirname(file),root).split(path.sep).join('/') + '/';
    const attributes = `data-cc-report-shell="1" data-page="library" data-site-prefix="${escape(prefix)}" data-library-paper="${escape(paper.id)}" data-report-language="zh" data-claim-records="${escape(JSON.stringify(byPaper.get(paper.id) || {}))}"`;
    if (!html.includes('data-cc-report-shell="1"')) {
      html = html.replace('</head>',`<link rel="stylesheet" href="${prefix}commons-v02.css?v=${version}"><link rel="stylesheet" href="${prefix}examples.css?v=20260928-2"><link rel="stylesheet" href="${prefix}site.css?v=${version}"><script defer src="${prefix}site.js?v=${version}"></script><script defer src="${prefix}report-ui.js?v=${version}"></script></head>`)
        .replace(/<body\s*>/,`<body class="portal-page report-page" ${attributes}><header></header><main id="report-content"><div id="report-tools"></div>`)
        .replace('</body>','</main><footer></footer></body>');
    } else {
      html = html.replace(/data-claim-records="[^"]*"/,`data-claim-records="${escape(JSON.stringify(byPaper.get(paper.id) || {}))}"`);
      if (!html.includes('data-claim-records=')) html = html.replace('data-cc-report-shell="1"',`data-cc-report-shell="1" data-claim-records="${escape(JSON.stringify(byPaper.get(paper.id) || {}))}"`);
    }
    html=html.replace(/((?:site|commons-v02|report-ui)\.(?:css|js))\?v=[0-9-]+/g,'$1?v='+version);
    await fs.writeFile(file,html);
    reportAssets.add(path.dirname(paper.reading_report_url));
  }
  for (const destination of ['claim-commons-mvp/app/static','claim-commons-mvp/sites-public']) for (const relative of reportAssets) {
    await fs.mkdir(path.dirname(path.join(root,destination,relative)),{recursive:true});
    await fs.cp(path.join(root,relative),path.join(root,destination,relative),{recursive:true});
  }
}
