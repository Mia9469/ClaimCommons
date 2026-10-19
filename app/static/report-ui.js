/* Navigation around a preserved, untranslated reading report. */
(() => {
  'use strict';
  const body = document.body, host = document.getElementById('report-tools');
  if (!host) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const say = (zh,en) => document.documentElement.lang === 'en' ? en : zh;
  const prefix = body.dataset.sitePrefix || '../../';
  const paperID = body.dataset.libraryPaper || '';
  let mapping = {};
  try { mapping = JSON.parse(body.dataset.claimRecords || '{}'); } catch {}
  const articles = [...document.querySelectorAll('#report-content article')];
  const metadata = new URL(location.href); metadata.search = ''; metadata.hash = ''; metadata.pathname = metadata.pathname.replace(/\.html$/,'.json');
  const atLibrary = record => { const url = new URL(prefix + 'library.html',location.href); url.searchParams.set('lang',document.documentElement.lang === 'en' ? 'en' : 'zh'); url.searchParams.set('mode','papers'); url.searchParams.set(record && mapping[record] ? 'claim' : 'paper',record && mapping[record] ? mapping[record] : paperID); return url.href; };
  const correction = record => { const url = new URL(prefix + 'community.html',location.href); url.searchParams.set('lang',document.documentElement.lang === 'en' ? 'en' : 'zh'); url.searchParams.set('paper',paperID); if (mapping[record]) url.searchParams.set('claim',mapping[record]); if (record) url.searchParams.set('source_record',record); url.searchParams.set('report',(()=>{const source=new URL(location.href);source.search='';source.hash='';return source.href})()); url.hash = 'correction'; return url.href; };
  const codes = new Map();
  for (const article of articles) {
    const match = article.querySelector('small')?.textContent.match(/^\s*(C\d+)\b/) || article.querySelector('h2')?.textContent.match(/^\s*(C\d+)\b/);
    if (!match) continue;
    const id = match[1]; article.id = id; codes.set(article,id);
    article.querySelector('h2').setAttribute('tabindex','-1');
    const actions = document.createElement('div'); actions.className = 'report-record-actions'; article.append(actions);
  }
  function render() {
    const originalLanguage = body.dataset.reportLanguage || 'zh';
    host.innerHTML = `<nav class="report-toolbar" aria-label="${say('报告操作','Report actions')}"><a class="button" href="${esc(atLibrary())}">← ${say('返回论文容器','Back to the paper')}</a><a class="button" href="${esc(metadata.href)}" download>${say('下载 metadata JSON','Download metadata JSON')}</a><button class="button" id="report-print">${say('打印 / 保存 PDF','Print / save PDF')}</button></nav><p class="content-language-note">${originalLanguage === 'zh' ? say('报告正文保留中文提取版本。导航可切换语言；尚未提供英文译文。','The report body preserves its Chinese extraction. Navigation is bilingual; an English translation is not available.') : say('报告正文保留英文提取版本，界面切换不会翻译记录。','The report body preserves its English extraction; interface changes do not translate records.')}</p><details class="report-toc"><summary>${say('记录目录','Record contents')} (${codes.size})</summary><ol>${[...codes].map(([article,id]) => `<li><a href="#${esc(id)}">${esc(id)} · ${esc(article.querySelector('h2').textContent)}</a></li>`).join('')}</ol></details>`;
    document.getElementById('report-print').onclick = () => window.print();
    for (const [article,id] of codes) article.querySelector('.report-record-actions').innerHTML = `<small>${say('来源内编号','Source-local ID')}: ${esc(id)}${mapping[id] ? ' · ' + esc(mapping[id]) : ''}</small><div class="actions"><a class="button" href="${esc(atLibrary(id))}">${say('在知识库中查看','View in library')}</a><a class="button" href="${esc(correction(id))}">${say('更正这一条','Correct this record')}</a><button class="button" data-report-copy="${esc(id)}">${say('复制定位链接','Copy located link')}</button></div><span class="report-copy-status" role="status"></span>`;
  }
  document.addEventListener('click',async event => {
    const button = event.target.closest('[data-report-copy]'); if (!button) return;
    const url = new URL(location.href); url.hash = button.dataset.reportCopy;
    const result = button.closest('.report-record-actions').querySelector('.report-copy-status');
    try { await navigator.clipboard.writeText(url.href); result.textContent = say('已复制。','Copied.'); }
    catch { result.textContent = url.href; }
  });
  window.addEventListener('cc-language-change',render);
  render();
  if (/^#C\d+$/.test(location.hash)) document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start'});
})();
