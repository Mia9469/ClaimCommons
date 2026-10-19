/* A reading aid, not a formal proof language or a scientific validity score. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const plain = value => value == null ? '' : Array.isArray(value) ? value.map(plain).filter(Boolean).join('; ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const frames = [
    ['system','研究对象 / 模型','System / model'],
    ['conditions','条件、状态与尺度','Conditions, state and scale'],
    ['intervention_or_exposure','干预 / 输入 / 暴露','Intervention / input / exposure'],
    ['comparator','比较基准','Comparator'],
    ['outcome','测量指标与操作','Outcome and measurement'],
    ['relation','所判断的关系','Relationship assessed'],
    ['quantifier','量词与覆盖范围','Quantifier and coverage'],
    ['assumptions','共同成立的假设','Joint assumptions']
  ];
  const statuses = {
    explicit:['原文明确给出定义','Explicit source definition'],
    operational_only:['仅报告测量或操作定义','Operational description only'],
    not_reported:['所读材料未明确报告','Not reported in the supplied source'],
    ambiguous:['存在歧义，待核对','Ambiguous; needs inspection']
  };
  const array = value => Array.isArray(value) ? value : [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function parts(record, language) {
    const pick = (zh,en) => language === 'en' ? en : zh;
    const frame = object(record.assessment_frame) ? record.assessment_frame : null;
    const terms = array(record.terms).filter(object), ambiguities = array(record.ambiguities).filter(object);
    return {pick,frame,terms,ambiguities,present:Boolean(frame || terms.length || ambiguities.length)};
  }
  function locator(location, pick) {
    if (!object(location)) return '';
    return [location.pdf_page != null ? pick('PDF 页 ','PDF page ') + plain(location.pdf_page) : '', location.section, location.figure, location.equation].filter(Boolean).join(' · ');
  }
  function renderHTML(record, language = 'zh', legacyNotice = false) {
    const {pick,frame,terms,ambiguities,present} = parts(record,language);
    if (!present) return legacyNotice ? `<p class="semantic-legacy-note">${pick('这条旧记录尚未单独整理定义与判断条件。请回查证据和原文；这不表示原论文没有定义。','Definitions and assessment context have not been separately recorded for this legacy entry. Inspect its evidence and source; this does not mean the paper lacks definitions.')}</p>` : '';
    const missing = pick('未明确报告 / 不适用时需说明','Unreported / explain if not applicable');
    const rows = frame ? frames.map(([key,zh,en]) => `<div><dt>${pick(zh,en)}</dt><dd>${escape(plain(frame[key]) || missing)}</dd></div>`).join('') : '';
    const termHTML = terms.map(term => {
      const status = statuses[term.definition_status];
      const label = status ? pick(...status) : pick('定义状态待核对','Definition status pending');
      const location = locator(term.source_locator,pick);
      return `<article class="semantic-term"><h5>${escape(plain(term.term) || pick('未命名术语','Unnamed term'))}</h5><small>${escape(label)}</small><p><b>${pick('原文定义：','Source definition: ')}</b>${escape(plain(term.source_definition) || missing)}</p><p><b>${pick('如何测量 / 操作：','Measurement / operation: ')}</b>${escape(plain(term.operationalization) || missing)}</p>${location ? `<small>${escape(location)}</small>` : ''}${term.source_locator?.quote ? `<blockquote>${escape(plain(term.source_locator.quote))}</blockquote>` : ''}</article>`;
    }).join('');
    return `<section class="claim-semantics"><h4>${pick('先明确这条命题在说什么','Make the proposition explicit')}</h4><p class="result-note">${pick('这是对原文的结构化整理，不是形式证明；字段齐全也不表示命题正确。','This structures the source; it is not a formal proof. Complete fields do not certify a correct claim.')}</p>${record.source_statement ? `<details><summary>${pick('作者原始表述','Original author wording')}</summary><blockquote>${escape(plain(record.source_statement))}</blockquote></details>` : ''}${rows ? `<dl class="semantic-frame">${rows}</dl>` : `<p>${missing}</p>`}${termHTML ? `<h5>${pick('关键术语与操作定义','Key terms and operational definitions')}</h5>${termHTML}` : `<p class="result-note">${pick('未单独整理术语；不能据此认为术语已无歧义。','No separate term entries were retained; this does not establish that the terminology is unambiguous.')}</p>`}${ambiguities.length ? `<div class="semantic-ambiguities"><h5>${pick('定义缺口与歧义','Definition gaps and ambiguities')}</h5><ul>${ambiguities.map(item => `<li>${escape(plain(item.issue))}${item.affects_assessment ? `<p>${escape(plain(item.affects_assessment))}</p>` : ''}${item.source_locator ? `<small>${escape(locator(item.source_locator,pick))}</small>${item.source_locator.quote ? `<blockquote>${escape(plain(item.source_locator.quote))}</blockquote>` : ''}` : ''}</li>`).join('')}</ul></div>` : ''}</section>`;
  }
  function renderMarkdown(record, language = 'zh') {
    const {pick,frame,terms,ambiguities,present} = parts(record,language);
    if (!present) return '';
    const missing = pick('未明确报告 / 待确认','Unreported / pending');
    let output = `### ${pick('命题的定义与条件','Definitions and assessment context')}\n\n${pick('结构化整理不等于形式证明或科学验证。','A structured representation is not a formal proof or scientific verification.')}\n\n`;
    if (record.source_statement) output += `**${pick('作者原始表述','Original author wording')}**: ${plain(record.source_statement)}\n\n`;
    if (frame) for (const [key,zh,en] of frames) output += `**${pick(zh,en)}**: ${plain(frame[key]) || missing}\n\n`;
    for (const term of terms) {
      output += `#### ${plain(term.term) || pick('术语','Term')}\n\n${pick('定义状态','Definition status')}: ${term.definition_status || 'unknown'}\n\n${pick('原文定义','Source definition')}: ${plain(term.source_definition) || missing}\n\n${pick('测量 / 操作','Measurement / operation')}: ${plain(term.operationalization) || missing}\n\n${locator(term.source_locator,pick)}\n\n`;
      if (term.source_locator?.quote) output += `${plain(term.source_locator.quote)}\n\n`;
    }
    if (ambiguities.length) output += `**${pick('定义缺口与歧义','Definition gaps and ambiguities')}**\n\n` + ambiguities.map(item => `- ${plain(item.issue)} ${plain(item.affects_assessment)} ${locator(item.source_locator,pick)}${item.source_locator?.quote ? '\n  ' + plain(item.source_locator.quote) : ''}\n`).join('') + '\n';
    return output;
  }
  window.CCClaimSemantics = {version:'claim-context-v1',renderHTML,renderMarkdown};
})();
