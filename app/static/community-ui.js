/* Build a correction draft locally. Nothing is submitted or imported here. */
(() => {
  'use strict';
  const form = document.getElementById('correction-form');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const search = new URLSearchParams(location.search);
  const say = (zh,en) => document.documentElement.lang === 'en' ? en : zh;
  for (const [parameter,id] of [['paper','correction-paper'],['claim','correction-claim'],['version','correction-version'],['source_record','correction-source-record']]) $(id).value = search.get(parameter) || '';
  function sourceURL() {
    const url = new URL('library.html',location.href); url.searchParams.set('lang',document.documentElement.lang === 'en' ? 'en' : 'zh'); url.searchParams.set('mode','papers');
    if ($('correction-claim').value.trim()) url.searchParams.set('claim',$('correction-claim').value.trim()); else if ($('correction-paper').value.trim()) url.searchParams.set('paper',$('correction-paper').value.trim());
    return url.href;
  }
  function draft() {
    return [say('# Claim Commons 更正 / 更新建议','# Claim Commons correction / update proposal'),'',
      'Paper ID: ' + ($('correction-paper').value.trim() || 'not specified'),
      'Claim ID: ' + ($('correction-claim').value.trim() || 'not specified'),
      'Source-local ID: ' + ($('correction-source-record').value.trim() || 'not specified'),
      'Record version: ' + ($('correction-version').value.trim() || 'not specified'),
      'Record link: ' + sourceURL(),'',say('## 发现的问题','## Issue'),$('correction-issue').value.trim(),'',say('## 建议修正及其依据','## Proposed correction and evidence'),$('correction-evidence').value.trim(),'',say('草稿未自动提交，未更新数据库。请保留来源位置、条件和不确定性。','This draft has not been submitted or imported. Preserve source locations, conditions and uncertainty.')].join('\n');
  }
  function render() {
    const body = draft();
    $('correction-preview').textContent = body;
    $('correction-record-link').href = sourceURL();
    const issue = new URL('https://github.com/Mia9469/ClaimCommons/issues/new');
    issue.searchParams.set('title','[Record correction] ' + ($('correction-claim').value.trim() || $('correction-paper').value.trim() || 'Proposal').slice(0,150));
    issue.searchParams.set('body',body);
    $('correction-github').href = issue.href;
    $('correction-email').href = 'mailto:tongtonghmy@gmail.com?subject=' + encodeURIComponent('Claim Commons correction / update proposal') + '&body=' + encodeURIComponent(body);
  }
  form.addEventListener('submit',event => event.preventDefault());
  form.addEventListener('input',render);
  $('correction-download').onclick = () => { const url = URL.createObjectURL(new Blob([draft()],{type:'text/plain;charset=utf-8'})); const link = document.createElement('a'); link.href = url; link.download = 'claim-commons-correction-draft.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000); };
  window.addEventListener('cc-language-change',render);
  render();
})();
