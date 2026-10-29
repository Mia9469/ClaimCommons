/* Reader-first presentation. Complete scientific records remain in metadata. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const text=value=>value==null?'':Array.isArray(value)?value.map(text).filter(Boolean).join('; '):typeof value==='object'?JSON.stringify(value):String(value);
  const list=value=>Array.isArray(value)?value:[];
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const useful=value=>Boolean(text(value).trim());
  const tr=(language,zh,en)=>language==='en'?en:zh;
  function ordered(data){
    const claims=list(data.claims),byID=new Map(claims.map(c=>[c.id,c])),seen=new Set(),out=[];
    const ids=[...list(data.reading_overview?.claim_order),...list(data.reading_overview?.logical_outline).flatMap(stage=>list(stage.claim_ids)),...claims.map(c=>c.id)];
    for(const id of ids)if(byID.has(id)&&!seen.has(id)){seen.add(id);out.push(byID.get(id));}
    return out;
  }
  function role(c,language){
    if(c.role==='interpretation')return tr(language,'作者解释','Author interpretation');
    if(c.role==='prediction')return tr(language,'预测','Prediction');
    if(c.epistemic_layer==='model_assisted_estimate'||c.claim_type==='theoretical')return tr(language,'理论 / 估计','Theory / estimate');
    if(c.claim_type==='model_demonstration')return tr(language,'模型结果','Model result');
    return tr(language,'结果','Result');
  }
  function locator(value,language){
    if(!object(value))return typeof value==='string'?value:'';
    return [value.pdf_page!=null?tr(language,'PDF 页 ','PDF page ')+value.pdf_page:'',value.figure?'Fig. '+value.figure:'',value.equation?'Eq. '+value.equation:'',value.section].filter(Boolean).join(' · ');
  }
  function field(label,value){return useful(value)?`<div><dt>${esc(label)}</dt><dd>${esc(text(value))}</dd></div>`:'';}
  function evidenceHTML(c,language){
    return list(c.evidence).map(e=>`<div class="ccr-evidence">${field(tr(language,'方法','Method'),e.method)}${field(tr(language,'设计与对照','Design and comparator'),[e.design,e.comparator].filter(useful))}${field(tr(language,'测量指标','Measure'),e.measure)}${field(tr(language,'独立单位与样本','Unit and sample'),[e.unit_of_analysis,e.sample_size_as_reported].filter(useful))}${field(tr(language,'统计与不确定性','Statistics and uncertainty'),e.uncertainty)}${field(tr(language,'来源','Source'),locator(e.source_locator,language))}${e.source_locator?.quote?`<blockquote>${esc(e.source_locator.quote)}</blockquote>`:''}</div>`).join('')||`<p>${tr(language,'尚未附上证据，不能据此判断该命题。','No evidence is attached; the proposition cannot yet be assessed.')}</p>`;
  }
  function contextHTML(c,language){
    const f=object(c.assessment_frame)?c.assessment_frame:{};
    const fields=[['system','对象','System'],['conditions','条件与尺度','Conditions and scale'],['intervention_or_exposure','干预 / 输入','Intervention / input'],['comparator','比较基准','Comparator'],['outcome','测量','Outcome'],['relation','关系','Relationship'],['quantifier','覆盖范围','Coverage'],['assumptions','假设','Assumptions']];
    const frame=fields.map(([key,zh,en])=>field(tr(language,zh,en),f[key])).join('');
    const terms=list(c.terms).map(term=>`<div class="ccr-term"><b>${esc(term.term)}</b><dl>${field(tr(language,'原文定义','Source definition'),term.source_definition)}${field(tr(language,'测量 / 操作方式','Measurement / operation'),term.operationalization)}${field(tr(language,'来源','Source'),locator(term.source_locator,language))}${field(tr(language,'定义状态','Definition status'),term.definition_status)}</dl></div>`).join('');
    return frame||terms||c.source_statement?`<details class="ccr-context"><summary>${tr(language,'术语、条件与原始表述','Terms, conditions and original wording')}</summary>${c.source_statement?`<blockquote>${esc(c.source_statement)}</blockquote>`:''}<dl>${frame}</dl>${terms}</details>`:'';
  }
  function card(c,index,language){
    const boundary=c.reading_summary?.boundary||c.conclusion?.boundary;
    const title=c.short_title||c.statement;
    const result=c.reading_summary?.result||(c.short_title?c.statement:'');
    const conclusions=c.conclusion||{};
    const remaining=[['negative_result','负结果 / 未检出','Negative / undetected result'],['non_inference','不能推出','Non-inference'],['unresolved','未解决','Unresolved']].map(([key,zh,en])=>field(tr(language,zh,en),conclusions[key])).join('');
    const ambiguities=list(c.ambiguities).filter(a=>useful(a.issue));
    const label=c.reading_summary?.evidence_label||tr(language,'证据与方法','Evidence and methods');
    return `<article class="ccr-claim" id="claim-${index+1}"><div class="ccr-meta"><span>${esc(c.id)}</span><span>${role(c,language)}</span></div><h3>${esc(title)}</h3>${result?`<p class="ccr-result">${esc(result)}</p>`:''}${useful(boundary)?`<p class="ccr-boundary"><b>${tr(language,'边界：','Scope: ')}</b>${esc(text(boundary))}</p>`:''}<details class="ccr-evidence-details"><summary>${esc(label)}</summary><dl>${evidenceHTML(c,language)}</dl>${contextHTML(c,language)}${remaining?`<details class="ccr-limits"><summary>${tr(language,'负结果与其他限制','Negative results and further limits')}</summary><dl>${remaining}</dl></details>`:''}${ambiguities.length?`<details class="ccr-limits"><summary>${tr(language,'定义歧义','Definition ambiguities')}</summary><ul>${ambiguities.map(a=>`<li>${esc(a.issue)}${useful(a.affects_assessment)?' '+esc(text(a.affects_assessment)):''}</li>`).join('')}</ul></details>`:''}</details></article>`;
  }
  function renderBody(data,language='zh'){
    const overview=data.reading_overview||{},claims=ordered(data);
    const question=overview.primary_question||list(claims[0]?.scientific_questions)[0]||tr(language,'这篇论文具体回答了什么问题？','What question does this paper address?');
    const stages=list(overview.logical_outline).filter(stage=>useful(stage.label));
    const audit=list(data.audit?.model_findings),checks=list(data.audit?.source_match_checks);
    return `<div class="cc-report"><section class="ccr-question"><p class="ccr-label">${tr(language,'主要科学问题','SCIENTIFIC QUESTION')}</p><h2>${esc(question)}</h2>${overview.summary?`<p class="ccr-abstract">${esc(overview.summary)}</p>`:`<p class="ccr-muted">${tr(language,'概括尚未提供，可直接阅读下面的命题。','An overview is not available; read the propositions below.')}</p>`}</section>${stages.length?`<nav class="ccr-framework" aria-label="${tr(language,'论证框架','Argument outline')}"><p class="ccr-label">${tr(language,'论证框架','ARGUMENT OUTLINE')}</p><ol>${stages.map(stage=>{const c=claims.find(item=>list(stage.claim_ids).includes(item.id)),index=claims.indexOf(c);return `<li>${index>=0?`<a href="#claim-${index+1}">${esc(stage.label)}</a>`:esc(stage.label)}</li>`;}).join('')}</ol></nav>`:''}<section class="ccr-records"><h2>${tr(language,'沿着论证读下去','Follow the argument')}</h2>${claims.map((c,index)=>card(c,index,language)).join('')||`<p>${tr(language,'当前没有保留的命题。','No propositions have been retained.')}</p>`}</section><details class="ccr-audit"><summary>${tr(language,'来源、提取范围与核对记录','Source, coverage and review notes')}</summary><p>${tr(language,'以下是审阅资料，不是额外的科学结论。','These are review records, not additional scientific findings.')}</p><dl>${field(tr(language,'来源文件','Source file'),data.source?.filename)}${field(tr(language,'已读页码','Pages read'),data.coverage?.pdf_pages_read)}${field(tr(language,'阅读模式','Reading mode'),data.coverage?.reading_mode||data.source?.read_mode)}${field(tr(language,'缺失材料','Missing material'),data.coverage?.missing_material)}${field(tr(language,'覆盖说明','Coverage notes'),data.coverage?.notes)}</dl>${audit.length?`<ul>${audit.map(a=>`<li>${a.claim_ids?.length?esc(a.claim_ids.join(', '))+' · ':a.claim_id?esc(a.claim_id)+' · ':''}${esc(text(a.issue))}${useful(a.suggested_correction)?' '+esc(text(a.suggested_correction)):''}</li>`).join('')}</ul>`:''}${checks.length?`<p>${tr(language,'自动文字定位待查项：','Text-location checks to resolve: ')}${checks.length}</p>`:''}<details><summary>${tr(language,'完整来源记录','Full provenance')}</summary><pre>${esc(JSON.stringify({source:data.source,coverage:data.coverage,contribution_inventory:data.contribution_inventory,shared_evidence:data.shared_evidence,audit:data.audit,provenance:data.provenance},null,2))}</pre></details></details></div>`;
  }
  const css=`.cc-report{color:var(--ccr-ink,#173d34);font:16px/1.8 Georgia,'Songti SC',serif;overflow-wrap:anywhere}.cc-report *{box-sizing:border-box}.cc-report h2{font-size:22px;line-height:1.5;letter-spacing:0;margin:0 0 16px}.cc-report h3{font-size:18px;line-height:1.6;letter-spacing:0;margin:4px 0 8px}.cc-report p{margin:10px 0}.cc-report section{padding:0;margin:0;border:0;background:none}.cc-report .ccr-question{padding-bottom:24px}.cc-report .ccr-label{font:12px/1.6 -apple-system,sans-serif;letter-spacing:.08em;color:#687a70;margin:0 0 10px}.cc-report .ccr-abstract{font-size:16px;line-height:1.9}.cc-report .ccr-framework{display:block;margin:0 0 30px;padding:18px 20px;background:#eef1e6;border:1px solid #ccd3c6}.cc-report .ccr-framework ol{margin:0;padding-left:22px;display:block}.cc-report .ccr-framework li{padding:4px 0}.cc-report a{color:inherit;text-underline-offset:4px}.cc-report .ccr-claim{padding:22px 0;border:0;border-top:1px solid #cbd3c7;scroll-margin-top:95px}.cc-report .ccr-meta{display:flex;gap:12px;font:12px/1.6 -apple-system,sans-serif;color:#687a70}.cc-report .ccr-meta span:first-child{font-weight:700;color:#173d34}.cc-report .ccr-result{font-size:16px}.cc-report .ccr-boundary{font-size:14px;color:#61746a}.cc-report details{margin:12px 0}.cc-report summary{cursor:pointer;font:600 14px/1.8 -apple-system,sans-serif;color:#27594b;padding:7px 0}.cc-report .ccr-evidence-details[open]{padding:0 16px 12px;border-left:2px solid #b9c9ad}.cc-report dl{display:block!important;margin:10px 0}.cc-report dt{font-weight:600;font-size:14px;margin-top:10px}.cc-report dd{margin:0;font-size:14px}.cc-report .ccr-evidence{padding:0 0 16px;margin-bottom:14px;border-bottom:1px solid #dbe0d4}.cc-report blockquote{border-left:2px solid #b5c4ae;padding:8px 12px;margin:12px 0;background:#f1f3eb;font-size:14px}.cc-report .ccr-term{padding:12px 0;border-top:1px solid #dbe0d4}.cc-report .ccr-muted{color:#687a70;font-size:14px}.cc-report .ccr-audit{margin-top:28px;padding:14px 18px;background:#f1f2eb;border:1px solid #ccd3c6;font-size:14px}.cc-report .ccr-audit li{margin:10px 0}.cc-report pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,monospace;background:#e8ede1;padding:14px}.ccr-page{margin:0;background:#f6f4ec;color:#173d34}.ccr-page>header,.ccr-page>main,.ccr-page>footer{max-width:900px;margin:auto;padding:28px 26px}.ccr-page>header{background:none;position:static;height:auto;display:block;border-bottom:1px solid #cbd3c7}.ccr-page h1{font:600 25px/1.5 Georgia,'Songti SC',serif;margin:12px 0}.ccr-page .ccr-topline{font:12px/1.7 -apple-system,sans-serif;color:#687a70;letter-spacing:.06em}.ccr-page .ccr-paper{font:14px/1.7 -apple-system,sans-serif;color:#687a70}.ccr-page .ccr-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.ccr-page .ccr-button{border:1px solid #819783;background:none;border-radius:20px;padding:7px 13px;color:inherit;font:13px/1.6 -apple-system,sans-serif;text-decoration:none;cursor:pointer}.ccr-page>footer{font:12px/1.8 -apple-system,sans-serif;color:#687a70}@media(max-width:600px){.ccr-page>header,.ccr-page>main,.ccr-page>footer{padding:22px 18px}.ccr-page h1{font-size:22px}.cc-report h2{font-size:20px}.cc-report .ccr-framework{padding:15px}.cc-report .ccr-evidence-details[open]{padding-left:12px}.cc-report .ccr-audit{padding:12px}}@media print{.ccr-page{background:white}.ccr-page .ccr-actions{display:none}.ccr-page>header,.ccr-page>main,.ccr-page>footer{max-width:none;padding:16px 0}.cc-report .ccr-audit{break-before:page}.cc-report h3{break-after:avoid}.cc-report .ccr-evidence{break-inside:avoid}.cc-report pre{font-size:10px}}`;
  function renderHTML(data,language='zh',options={}){
    const title=data.paper?.title||data.source?.filename||'Claim Commons';
    const print=tr(language,'打印 / 保存 PDF','Print / save PDF');
    const links=[options.metadataHref?`<a class="ccr-button" href="${esc(options.metadataHref)}" download>${tr(language,'下载 metadata','Download metadata')}</a>`:'',options.markdownHref?`<a class="ccr-button" href="${esc(options.markdownHref)}" download>Markdown</a>`:''].join('');
    return `<!doctype html><html lang="${language==='en'?'en':'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Claim Commons</title><style>${css}</style></head><body class="ccr-page"><header><div class="ccr-topline">CLAIM COMMONS · ${tr(language,'阅读报告 · AI 整理，待人工复核','READING REPORT · AI extraction, human review pending')}</div><h1>${esc(title)}</h1><p class="ccr-paper">${esc(list(data.paper?.authors).map(text).join(', '))}${data.paper?.year?' · '+esc(data.paper.year):''}${data.paper?.journal?' · '+esc(data.paper.journal):''}</p><div class="ccr-actions"><button class="ccr-button" type="button" onclick="window.print()">${print}</button>${links}</div></header><main>${renderBody(data,language)}</main><footer>${tr(language,'完整字段保留在 metadata；提取不等于验证，不会自动入库或发布。','Complete fields remain in metadata. Extraction is not verification and does not automatically update or publish the library.')}</footer><script>(()=>{let opened=[];addEventListener('beforeprint',()=>{opened=[...document.querySelectorAll('details:not([open])')];opened.forEach(el=>el.open=true)});addEventListener('afterprint',()=>opened.forEach(el=>el.open=false));})();</script></body></html>`;
  }
  function renderMarkdown(data,language='zh'){
    const o=data.reading_overview||{},claims=ordered(data),pick=(zh,en)=>tr(language,zh,en);
    let out='# '+(data.paper?.title||data.source?.filename||'Claim Commons')+'\n\n'+pick('AI 整理，待人工复核。','AI extraction; human review pending.')+'\n\n## '+pick('主要科学问题','Scientific question')+'\n\n'+(o.primary_question||list(claims[0]?.scientific_questions)[0]||'')+'\n\n'+(o.summary||'')+'\n\n';
    if(list(o.logical_outline).length)out+='## '+pick('论证框架','Argument outline')+'\n\n'+o.logical_outline.map((stage,i)=>(i+1)+'. '+stage.label).join('\n')+'\n\n';
    for(const c of claims){out+='## '+c.id+' · '+(c.short_title||c.statement)+'\n\n'+(c.reading_summary?.result||(c.short_title?c.statement:''))+'\n\n';const boundary=c.reading_summary?.boundary||c.conclusion?.boundary;if(useful(boundary))out+='**'+pick('边界','Scope')+'：**'+text(boundary)+'\n\n';out+='<details>\n<summary>'+pick('证据与方法','Evidence and methods')+'</summary>\n\n';for(const e of list(c.evidence)){for(const [label,value] of [[pick('方法','Method'),e.method],[pick('设计','Design'),e.design],[pick('对照','Comparator'),e.comparator],[pick('测量','Measure'),e.measure],[pick('独立单位','Unit'),e.unit_of_analysis],[pick('样本','Sample'),e.sample_size_as_reported],[pick('不确定性','Uncertainty'),e.uncertainty],[pick('来源','Source'),locator(e.source_locator,language)]])if(useful(value))out+='**'+label+'：**'+text(value)+'\n\n';if(e.source_locator?.quote)out+='> '+text(e.source_locator.quote)+'\n\n';}for(const [key,zh,en] of [['negative_result','负结果 / 未检出','Negative / undetected result'],['non_inference','不能推出','Non-inference'],['unresolved','未解决','Unresolved']])if(useful(c.conclusion?.[key]))out+='**'+pick(zh,en)+'：**'+text(c.conclusion[key])+'\n\n';out+='</details>\n\n';}
    out+='<details>\n<summary>'+pick('来源与核对记录','Source and review notes')+'</summary>\n\n```json\n'+JSON.stringify({coverage:data.coverage,audit:data.audit,provenance:data.provenance},null,2)+'\n```\n\n</details>\n';return out;
  }
  window.CCReadingReport={renderBody,renderHTML,renderMarkdown,css};
})();

/* Optional author-facing appendix. Proposals are separate from source claims. */
(function (global) {
  'use strict';
  const reader = global.CCReadingReport;
  if (!reader) return;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const array = value => Array.isArray(value) ? value : [];
  const text = value => value == null ? '' : Array.isArray(value) ? value.join('; ') : typeof value === 'object' ? '' : String(value);
  const t = (lang, zh, en) => String(lang || 'zh').startsWith('en') ? en : zh;
  const has = value => Boolean(text(value).trim());
  const css = `
.cc-report .ccr-author-view { margin: 28px 0 20px; padding: 16px 18px; border: 1px solid #c3cbbf; background: #f6f5ee; }
.cc-report .ccr-author-view > summary { font-size: 16px; font-weight: 650; line-height: 1.6; cursor: pointer; }
.cc-report .ccr-author-view .ccr-author-notice { font-size: 13px; line-height: 1.7; color: #58635a; margin: 10px 0; }
.cc-report .ccr-author-view h3 { font-size: 17px; line-height: 1.6; margin: 22px 0 10px; }
.cc-report .ccr-author-view h4 { font-size: 16px; line-height: 1.6; margin: 0 0 6px; }
.cc-report .ccr-author-item { margin: 10px 0; padding: 14px 0; border-top: 1px solid #d4d9cf; }
.cc-report .ccr-author-item p { margin: 7px 0; font-size: 14px; line-height: 1.8; }
.cc-report .ccr-author-item .ccr-author-tags { font-size: 12px; color: #58635a; }
.cc-report .ccr-author-item a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
.cc-report .ccr-author-item details { margin: 8px 0 0; }
.cc-report .ccr-author-item summary { font-size: 13px; cursor: pointer; }
.cc-report .ccr-author-item dl { margin: 10px 0 0; }
.cc-report .ccr-author-item dt { font-size: 12px; font-weight: 650; margin-top: 10px; }
.cc-report .ccr-author-item dd { font-size: 14px; line-height: 1.75; margin: 3px 0 0; }
.cc-report .ccr-author-first { padding-top: 12px; border-top: 1px solid #c3cbbf; font-size: 14px; line-height: 1.8; }
@media (max-width: 600px) { .cc-report .ccr-author-view { padding: 12px; } }
@media print { .cc-report .ccr-author-item h4 { break-after: avoid; } }
`;
  function claimOrder(data) {
    const claims = array(data.claims);
    const byId = new Map(claims.map(c => [c.id, c]));
    const overview = data.reading_overview || {};
    const ids = [...array(overview.claim_order), ...array(overview.logical_outline).flatMap(step => array(step.claim_ids)), ...claims.map(c => c.id)];
    const seen = new Set();
    return ids.filter(id => byId.has(id) && !seen.has(id) && seen.add(id));
  }
  function necessity(value, lang) {
    const labels = {
      verify_materials_first: t(lang, '先核查已有材料', 'Check existing materials first'),
      only_for_stronger_claim: t(lang, '仅在加强结论时需要', 'Needed only for a stronger claim'),
      core_claim_check: t(lang, '可能影响当前主张，需核查', 'Potentially affects the current claim'),
      optional_follow_up: t(lang, '可选后续问题', 'Optional follow-up'),
      separate_study: t(lang, '适合独立研究', 'A separate study')
    };
    return labels[value] || t(lang, '必要性尚需判断', 'Necessity not yet established');
  }
  function basis(value, lang) {
    const labels = {
      source_reported_limit: t(lang, '原文已说明的边界；下一步为提取者建议', 'Source-reported limit; next step proposed by the extractor'),
      missing_supplied_material: t(lang, '当前输入缺少材料，不等于原研究缺失', 'Material absent from this input, not necessarily from the study'),
      extractor_inference: t(lang, '提取者提出的推理检查，不是作者原话', 'Extractor-proposed inference check, not an author statement')
    };
    return labels[value] || t(lang, '提取者建议，未经作者确认', 'Extractor proposal, not author-endorsed');
  }
  function field(label, value) {
    return has(value) ? `<dt>${esc(label)}</dt><dd>${esc(text(value))}</dd>` : '';
  }
  function itemHTML(item, data, lang) {
    const order = claimOrder(data);
    const ids = array(item.claim_ids);
    const links = ids.map(id => {
      const index = order.indexOf(id);
      return index < 0 ? esc(id) : `<a href="#claim-${index + 1}">${esc(id)}</a>`;
    }).join(' / ');
    const detail = field(t(lang, '依据与归属', 'Basis and attribution'), basis(item.basis_type, lang)) +
      field(t(lang, '具体依据', 'Specific basis'), item.basis_note) +
      field(t(lang, '若支持', 'If supported'), item.if_supported) +
      field(t(lang, '若不支持', 'If not supported'), item.if_not_supported) +
      field(t(lang, '范围提醒', 'Scope reminder'), item.scope_note);
    return `<article class="ccr-author-item"><h4>${esc(text(item.title))}</h4><p class="ccr-author-tags">${links}${links ? ' · ' : ''}${esc(necessity(item.necessity, lang))}</p>` +
      (has(item.why_open || item.question) ? `<p><strong>${esc(t(lang, '待厘清', 'Open point'))}</strong> ${esc(text(item.why_open || item.question))}</p>` : '') +
      (has(item.minimum_next_step) ? `<p><strong>${esc(t(lang, '最小下一步', 'Smallest next step'))}</strong> ${esc(text(item.minimum_next_step))}</p>` : '') +
      (detail ? `<details><summary>${esc(t(lang, '依据、可能结果与范围', 'Basis, possible outcomes and scope'))}</summary><dl>${detail}</dl></details>` : '') + '</article>';
  }
  function appendixHTML(data, lang) {
    const view = data && data.author_view;
    if (!view || typeof view !== 'object') return '';
    const closure = array(view.closure_points);
    const follow = array(view.follow_up_questions);
    if (!closure.length && !follow.length) return '';
    const notice = t(lang,
      '附加分析，不属于论文已建立的结论，也不是作者待办清单。建议仅依据当前输入；未核查后续文献，不能据此认定问题至今未解决。',
      'Additional analysis, not an established result or an author to-do list. Suggestions use the supplied material only. Later literature has not been checked, so these are not claims of currently open problems.');
    return `<style>${css}</style><details class="ccr-author-view"><summary>${esc(t(lang, '作者视角：尚未闭合的环节与可深挖的问题', 'Author view: open links and questions to explore'))}</summary><p class="ccr-author-notice">${esc(notice)}</p>` +
      (has(view.basis_scope) ? `<p class="ccr-author-notice">${esc(text(view.basis_scope))}</p>` : '') +
      (has(view.summary) ? `<p>${esc(text(view.summary))}</p>` : '') +
      (closure.length ? `<h3>${esc(t(lang, '尚未闭合的环节', 'Links that need closer examination'))}</h3>${closure.map(item => itemHTML(item, data, lang)).join('')}` : '') +
      (follow.length ? `<h3>${esc(t(lang, '可继续深挖，不是当前结论的必做项', 'Optional deeper questions, not requirements for the current claim'))}</h3>${follow.map(item => itemHTML(item, data, lang)).join('')}` : '') +
      (has(view.suggested_first_step) ? `<p class="ccr-author-first"><strong>${esc(t(lang, '如果只先做一件事', 'If you start with just one thing'))}</strong><br>${esc(text(view.suggested_first_step))}</p>` : '') + '</details>';
  }
  function insertHTML(html, appendix) {
    if (!appendix) return html;
    const marker = /<details\b[^>]*\bclass=["'][^"']*\bccr-audit\b/.exec(html);
    let index = marker ? marker.index : html.lastIndexOf('</main>');
    if (index < 0) index = html.lastIndexOf('</div>');
    return index < 0 ? html + appendix : html.slice(0, index) + appendix + html.slice(index);
  }
  function itemMarkdown(item, lang) {
    const lines = [`#### ${text(item.title)}`, '', `${array(item.claim_ids).join(' / ')} · ${necessity(item.necessity, lang)}`, ''];
    const add = (label, value) => { if (has(value)) lines.push(`**${label}** ${text(value)}`, ''); };
    add(t(lang, '待厘清', 'Open point'), item.why_open || item.question);
    add(t(lang, '最小下一步', 'Smallest next step'), item.minimum_next_step);
    lines.push(`<details><summary>${t(lang, '依据、可能结果与范围', 'Basis, possible outcomes and scope')}</summary>`, '');
    add(t(lang, '依据与归属', 'Basis and attribution'), basis(item.basis_type, lang));
    add(t(lang, '具体依据', 'Specific basis'), item.basis_note);
    add(t(lang, '若支持', 'If supported'), item.if_supported);
    add(t(lang, '若不支持', 'If not supported'), item.if_not_supported);
    add(t(lang, '范围提醒', 'Scope reminder'), item.scope_note);
    lines.push('</details>', '');
    return lines.join('\n');
  }
  function appendixMarkdown(data, lang) {
    const view = data && data.author_view;
    if (!view || !array(view.closure_points).length && !array(view.follow_up_questions).length) return '';
    const lines = ['', `<details><summary>${t(lang, '作者视角：尚未闭合的环节与可深挖的问题', 'Author view: open links and questions to explore')}</summary>`, '',
      t(lang, '附加分析，不属于论文结论，也不是作者待办清单。未核查后续文献，不代表这些问题至今未解决。', 'Additional analysis, not a paper result or an author to-do list. Later literature has not been checked; current novelty is not established.'), '', text(view.basis_scope), '', text(view.summary), ''];
    if (array(view.closure_points).length) lines.push(`### ${t(lang, '尚未闭合的环节', 'Links that need closer examination')}`, '', ...view.closure_points.map(item => itemMarkdown(item, lang)));
    if (array(view.follow_up_questions).length) lines.push(`### ${t(lang, '可继续深挖，不是当前结论的必做项', 'Optional deeper questions, not requirements for the current claim')}`, '', ...view.follow_up_questions.map(item => itemMarkdown(item, lang)));
    if (has(view.suggested_first_step)) lines.push(`**${t(lang, '如果只先做一件事', 'If you start with just one thing')}** ${text(view.suggested_first_step)}`, '');
    lines.push('</details>', '');
    return lines.join('\n');
  }
  global.CCReadingReport = Object.assign({}, reader, {
    css: reader.css + css,
    renderBody(data, lang) { return insertHTML(reader.renderBody(data, lang), appendixHTML(data, lang)); },
    renderHTML(data, lang, options) { return insertHTML(reader.renderHTML(data, lang, options), appendixHTML(data, lang)); },
    renderMarkdown(data, lang) {
      const base = reader.renderMarkdown(data, lang);
      const extra = appendixMarkdown(data, lang);
      if (!extra) return base;
      const marker = /<details(?:\s[^>]*)?>\s*<summary>[^<]*(?:来源|核查|source|audit)/i.exec(base);
      return marker ? base.slice(0, marker.index) + extra + '\n' + base.slice(marker.index) : base + extra;
    }
  });
})(window);
