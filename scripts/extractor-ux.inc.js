 // Included inside extractor.js by the UX source migration; no credentials are persisted.
 function inspectTextQuality(pages) {
  const findings=pages.map(page=>{
   const count=regex=>(page.text.match(regex)||[]).length;
   const control=count(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g),replacement=count(/\ufffd/g),privateUse=count(/[\ue000-\uf8ff]/g),cid=count(/\(cid:\d+\)/g);
   return {pdf_page:page.pdf_page,characters:page.text.length,control_characters:control,replacement_characters:replacement,private_use_characters:privateUse,cid_placeholders:cid,little_text:page.text.trim().length<40,needs_review:Boolean(control||replacement||privateUse||cid||page.text.trim().length<40)};
  });
  return {version:'2026-10-18.1',heuristic_only:true,not_a_transcription_guarantee:true,needs_review:findings.some(page=>page.needs_review),pages:findings,flagged_pages:findings.filter(page=>page.needs_review).map(page=>page.pdf_page)};
 }
 function renderQuality() {
  const element=$('text-quality'),quality=state.source?.text_quality;
  if(!element)return;
  element.hidden=!state.source;
  $('quality-consent-row').hidden=!quality?.needs_review;
  if(!quality)return;
  const flagged=quality.pages.filter(page=>page.needs_review);
  element.innerHTML=`<strong>${t('读取质量检查','Source text quality check')}</strong><p>${flagged.length?t(`有 ${flagged.length} 页需要检查。文件可读不表示公式、字体和符号已正确转写。`,`Inspect ${flagged.length} flagged pages. A readable file does not guarantee correct formulas, fonts or symbols.`):t('未检测到明显的缺字或控制字符；这不是公式正确性的保证。','No obvious missing glyphs or control characters were detected. This does not guarantee correct mathematical transcription.')}</p><p class="quality-pages">${flagged.map(page=>`<button type="button" class="text-button" data-review-page="${page.pdf_page}">${t('第 '+page.pdf_page+' 页','Page '+page.pdf_page)}: ${page.little_text?t('文字很少','little text'):t('异常字符 ','suspicious characters ')+(page.control_characters+page.replacement_characters+page.private_use_characters+page.cid_placeholders)}</button>`).join('')}</p><p class="result-note">${t('预览中的 [U+0001] 等标记表示原提取文本的控制字符，不是修正结果。图像像素未读取；请对照 PDF，不要让模型猜回公式。','Markers such as [U+0001] expose control characters in the extracted text; they are not corrections. Figure pixels were not read. Inspect the PDF instead of asking the model to reconstruct missing formulas.')}</p>${state.fileURL?`<a class="source" href="${esc(state.fileURL)}" target="_blank" rel="noopener noreferrer">${t('打开本地 PDF 对照（不上传）','Compare with the local PDF (no upload)')} ↗</a>`:''}`;
 }
 function updateConfiguration() {
  if(!$('configuration-help'))return;
  let destination='';
  try{destination=new URL($('api-endpoint').value).origin;}catch{}
  $('provider-destination').textContent=t('接收论文文字的服务：','Paper text will be sent to: ')+(destination||t('请填写有效服务地址','enter a valid endpoint'));
  const requirements=[];
  if(!state.source||state.source.text_character_count<150)requirements.push(t('读取可用 PDF 文字','read usable PDF text'));
  if(!$('api-key').value.trim())requirements.push(t('填写 API key','enter an API key'));
  if(!$('model-name').value.trim())requirements.push(t('填写模型 ID','enter a model ID'));
  if(!$('send-consent').checked)requirements.push(t('同意向所示服务发送论文文字','consent to sending paper text to the shown service'));
  if(state.source?.text_quality?.needs_review&&!$('quality-consent').checked)requirements.push(t('确认已看到读取质量风险','acknowledge the source-quality warning'));
  if(!destination)requirements.push(t('填写服务地址','enter the endpoint'));
  $('configuration-help').textContent=requirements.length?t('开始前还需要：','Before starting: ')+requirements.join('；'):t('配置齐全。开始后会调用所示服务，并由你的账号计费。','Configuration complete. Starting calls the shown service and bills your provider account.');
  $('run-extraction').disabled=state.busy||requirements.length>0;
  $('test-api').disabled=state.busy||!$('api-key').value.trim()||!$('model-name').value.trim()||!$('test-consent').checked||!destination;
 }
 async function testConnection() {
  if(state.busy||!$('test-consent').checked)return;
  $('tool-error').hidden=true;
  let endpoint;try{endpoint=safeEndpoint();}catch(problem){error(problem.message);return;}
  if(!$('api-key').value.trim()||!$('model-name').value.trim()){error(t('先填写 API key 与模型 ID。','Enter an API key and model ID first.'));return;}
  const settings={endpoint,key:$('api-key').value.trim(),model:$('model-name').value.trim(),phase:'connection'};
  state.controller=new AbortController();busy(true);status('正在测试连接，不发送论文文字…','Testing the connection without sending paper text…');
  try{await request('Return one JSON object: {"connected":true}. This is a connection test. No paper is supplied.',settings);status('服务已接受测试请求。完整提取仍需单独开始，候选仍待人工核对。','The service accepted the test request. Start full extraction separately; candidates still require human checking.');}
  catch(problem){if(problem.name==='AbortError')status('连接测试已停止，已发出的请求可能仍会计费。','Connection test stopped; dispatched requests may still be billed.');else{error(String(problem.message).replaceAll(settings.key,'[redacted]'));status('连接测试未完成。','Connection test did not complete.');}}
  finally{settings.key='';state.controller=null;busy(false);}
 }
 function wireExtractionUX() {
  const providers={openai:{endpoint:'https://api.openai.com/v1/chat/completions',model:'',docs:'https://platform.openai.com/docs/api-reference/chat/create'},deepseek:{endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-flash',docs:'https://api-docs.deepseek.com/'},custom:{endpoint:'',model:'',docs:''}};
  const invalidate=clearKey=>{if(clearKey)$('api-key').value='';$('send-consent').checked=false;$('test-consent').checked=false;updateConfiguration();};
  $('provider-select').onchange=()=>{const provider=providers[$('provider-select').value];if(provider.endpoint)$('api-endpoint').value=provider.endpoint;$('model-name').value=provider.model;$('provider-documentation').href=provider.docs||'method.html';invalidate(true);};
  $('api-endpoint').addEventListener('change',()=>{$('provider-select').value='custom';invalidate(true);});
  $('model-name').addEventListener('change',()=>invalidate(false));
  $('extraction-form').addEventListener('input',updateConfiguration);
  $('clear-key').addEventListener('click',updateConfiguration);
  $('test-api').onclick=testConnection;
  $('text-quality').addEventListener('click',event=>{const button=event.target.closest('[data-review-page]');if(!button)return;$('source-details').open=true;$('source-page').value=button.dataset.reviewPage;showSource(button.dataset.reviewPage);$('source-details').scrollIntoView({block:'start'});});
  window.addEventListener('cc-language-change',()=>{renderQuality();updateConfiguration();});
  window.addEventListener('pagehide',()=>{if(state.fileURL)URL.revokeObjectURL(state.fileURL);});
  updateConfiguration();
 }
