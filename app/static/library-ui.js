/* One retrieval contract for directions, papers, questions and the provenance map. */
(() => {
  'use strict';
  const root = document.getElementById('library');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const text = value => value == null ? '' : Array.isArray(value) ? value.map(text).join('; ') : typeof value === 'object' ? Object.values(value).map(text).join(' ') : String(value);
  const fold = value => text(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams(location.search);
  const modes = ['directions', 'papers', 'questions', 'graph'];
  const pageSize = 24;
  const state = {
    language: document.documentElement.lang === 'en' ? 'en' : 'zh',
    mode: modes.includes(params.get('mode')) ? params.get('mode') : 'directions',
    query: params.get('q') || '', direction: params.get('dir') || 'all', status: params.get('status') || 'all',
    sort: ['relevance','newest','oldest','title'].includes(params.get('sort')) ? params.get('sort') : 'relevance',
    page: Math.max(1, Number.parseInt(params.get('page'), 10) || 1), questionLimit: pageSize,
    selected: null, graphFocus: params.get('focus') || '', zoom: 1, data: null,
    cacheKey: null, filtered: null, notice: ''
  };
  const say = (zh, en) => state.language === 'zh' ? zh : en;
  const copy = key => I[state.language][key] || key;
  const splitRecord = key => { const index = String(key || '').indexOf(':'); return index < 0 ? ['', ''] : [key.slice(0, index), key.slice(index + 1)]; };
  const paper = id => state.data.paperMap.get(state.data.aliases.get(id) || id);
  const claim = id => state.data.claimMap.get(id);
  const direction = id => state.data.directions.find(item => item.id === id);
  const label = item => item ? (state.language === 'en' ? (directionEN[item.id]?.[0] || item.label_en || item.id) : item.label_zh || item.id) : say('待分类', 'Unclassified');
  const description = item => item ? (state.language === 'en' ? directionEN[item.id]?.[1] || item.description_en || '' : item.description || '') : '';
  const familyLabel = family => state.language === 'zh' ? questionZH[family.id] || family.question : family.question;
  const statusLabel = value => ({curated:say('人工策展','Curated'),candidate:say('全文候选','Full-text candidate'),metadata:say('仅元数据','Metadata only')})[value] || value;
  const badge = value => `<span class="status-badge ${escape(value)}">${escape(statusLabel(value))}</span>`;
  const code = item => item.record_status === 'candidate' && /-(\d+)$/.test(item.id) ? 'C' + item.id.match(/-(\d+)$/)[1] : say('策展记录', 'Curated record');
  const safeURL = value => {
    if (!value) return '';
    try { const url = new URL(value, location.href); return ['https:','http:'].includes(url.protocol) || (location.protocol === 'file:' && url.protocol === 'file:') ? url.href : ''; }
    catch { return ''; }
  };
  const sourceLink = (url, zh, en, download = false) => {
    const href = safeURL(url);
    return href ? `<a class="source" href="${escape(href)}" ${download ? 'download' : 'target="_blank" rel="noopener noreferrer"'}>${escape(say(zh,en))} ${download ? '↧' : '↗'}</a>` : '';
  };

  function readSelection(search) {
    for (const kind of ['claim','paper','family','question','direction']) if (search.has(kind)) return kind + ':' + search.get(kind);
    return null;
  }
  state.selected = readSelection(params);

  function merge(curated, expanded) {
    const known = new Set(curated.directions.map(item => item.id));
    const resolveDirections = values => [...new Set((values || []).map(item => typeof item === 'string' ? item : item?.id).map(id => known.has(id) ? id : fibreToDirection[id]).filter(Boolean))];
    const papers = expanded.papers.map(item => ({...item, direction_ids:resolveDirections([...(item.direction_ids || []), ...(item.directions || [])]), claims:[]}));
    const doi = value => fold(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '');
    const byDOI = new Map(papers.filter(item => item.doi).map(item => [doi(item.doi), item]));
    const byTitle = new Map();
    for (const item of papers) { const key = fold(item.title); if (!byTitle.has(key)) byTitle.set(key, []); byTitle.get(key).push(item); }
    const aliases = new Map();
    for (const original of curated.papers) {
      let target = original.doi ? byDOI.get(doi(original.doi)) : null;
      if (!target) {
        const options = (byTitle.get(fold(original.title)) || []).filter(item => !original.doi || !item.doi);
        if (options.length === 1) target = options[0];
      }
      if (!target) {
        target = {...original, claims:[], direction_ids:resolveDirections(original.direction_ids), acquisition_status:'curated_source'};
        papers.push(target);
      } else target.direction_ids = [...new Set([...target.direction_ids, ...resolveDirections(original.direction_ids)])];
      if (!target.url && original.doi) target.url = 'https://doi.org/' + original.doi;
      aliases.set(original.id, target.id);
    }
    const paperMap = new Map(papers.map(item => [item.id, item]));
    const curatedClaims = curated.claims.map(item => ({...item, paper_id:aliases.get(item.paper_id) || item.paper_id, direction_ids:resolveDirections(item.direction_ids), record_status:'curated'}));
    const candidates = expanded.claims.map(item => ({...item, direction_ids:resolveDirections([...(item.direction_ids || []), ...(item.directions || []), ...(item.broad_directions || [])]), record_status:'candidate'}));
    const claims = [...curatedClaims, ...candidates];
    for (const item of claims) {
      const owner = paperMap.get(item.paper_id);
      if (!owner) continue;
      if (!item.direction_ids.length) {
        item.direction_ids = [...owner.direction_ids];
        item.direction_basis = item.direction_ids.length ? 'paper_scope_inherited' : 'unclassified';
      } else item.direction_basis = 'source_record';
      if (!item.direction_ids.length) item.direction_ids = ['unclassified'];
      owner.claims.push(item);
      item.searchText = fold([item.statement, item.source_statement, item.evidence, item.conclusion, item.assessment_frame, item.terms, item.ambiguities, item.scientific_questions, item.keywords]);
    }
    for (const item of papers) {
      item.direction_ids = [...new Set([...item.direction_ids, ...item.claims.flatMap(entry => entry.direction_ids)])];
      if (!item.direction_ids.length) item.direction_ids = ['unclassified'];
      item.record_status = item.claims.some(entry => entry.record_status === 'curated') ? 'curated' : item.claims.length ? 'candidate' : 'metadata';
      item.searchText = fold([item.title, item.authors, item.collections, item.doi, item.venue, item.reading_summary]);
    }
    const directions = [...curated.directions];
    if (papers.some(item => item.direction_ids.includes('unclassified'))) directions.push({id:'unclassified',label_zh:'待分类',label_en:'Unclassified',description:'缺少分类依据的记录仍然可查，不强行归入某个方向。',description_en:'Records without a classification remain discoverable; no research direction is invented.'});
    const questions = new Map();
    for (const item of candidates) for (const question of item.scientific_questions || []) {
      if (typeof question !== 'string' || !question.trim()) continue;
      const key = question.trim();
      if (!questions.has(key)) questions.set(key, []);
      questions.get(key).push(item.id);
    }
    return {...curated, papers, claims, directions, aliases, paperMap, claimMap:new Map(claims.map(item => [item.id,item])), questions};
  }

  function filtered() {
    const key = JSON.stringify([state.query, state.direction, state.status]);
    if (key === state.cacheKey) return state.filtered;
    const query = fold(state.query);
    const familyHits = new Set(state.data.claim_families.filter(item => query && fold([item.question,questionZH[item.id]]).includes(query)).flatMap(item => item.members.map(member => member.claim_id)));
    const claims = state.data.claims.filter(item => {
      const owner = paper(item.paper_id);
      return owner && (state.status === 'all' || item.record_status === state.status) && (state.direction === 'all' || item.direction_ids.includes(state.direction)) && (!query || owner.searchText.includes(query) || item.searchText.includes(query) || familyHits.has(item.id));
    });
    const byPaper = new Map();
    for (const item of claims) { if (!byPaper.has(item.paper_id)) byPaper.set(item.paper_id, []); byPaper.get(item.paper_id).push(item); }
    const papers = state.data.papers.filter(item => byPaper.has(item.id) || (!item.claims.length && ['all','metadata'].includes(state.status) && (state.direction === 'all' || item.direction_ids.includes(state.direction)) && (!query || item.searchText.includes(query))));
    state.cacheKey = key;
    state.filtered = {papers,claims,byPaper,ids:new Set(claims.map(item => item.id))};
    return state.filtered;
  }

  function recordURL(selection = state.selected) {
    const url = new URL(location.href);
    for (const key of ['mode','q','dir','status','sort','page','claim','paper','family','question','direction','focus']) url.searchParams.delete(key);
    url.hash = '';
    url.searchParams.set('lang', state.language);
    url.searchParams.set('mode', state.mode);
    if (state.query) url.searchParams.set('q', state.query);
    if (state.direction !== 'all') url.searchParams.set('dir', state.direction);
    if (state.status !== 'all') url.searchParams.set('status', state.status);
    if (state.sort !== 'relevance') url.searchParams.set('sort', state.sort);
    if (state.page > 1) url.searchParams.set('page', String(state.page));
    if (state.graphFocus) url.searchParams.set('focus', state.graphFocus);
    const [kind,id] = splitRecord(selection);
    if (kind && id) url.searchParams.set(kind, id);
    return url;
  }
  function syncURL(push = false) {
    const url = recordURL();
    if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null, '', url);
  }
  function languageNote(value) {
    const content = /[\u3400-\u9fff]/u.test(text(value)) ? 'zh' : /[a-z]/i.test(text(value)) ? 'en' : null;
    if (!content || content === state.language) return '';
    return `<p class="content-language-note">${escape(say('本条内容为英文，尚未提供中文译文。界面切换不会改写原记录。','This record is in Chinese; an English translation is not available. Switching the interface does not translate the source record.'))}</p>`;
  }
  function countText(items) {
    return `${items.filter(item => item.record_status === 'curated').length} ${say('策展','curated')} · ${items.filter(item => item.record_status === 'candidate').length} ${say('候选','candidates')}`;
  }
  function counts(owner) {
    return owner.claims.length ? countText(owner.claims) : say('仅元数据，无 claim','Metadata only; no claims');
  }
  function intro(eyebrow, heading, body) { return `<div class="intro"><span>${escape(eyebrow)}</span><h3>${heading}</h3><p>${body}</p></div>`; }
  function emptyState() {
    return `<div class="search-empty"><h3>${say('当前条件下没有找到记录。','No records match the current filters.')}</h3><p>${say('这不表示相关证据不存在。可以清除筛选，或改用论文、作者及方法关键词。','This does not establish that the evidence does not exist. Clear filters or try a paper, author or method keyword.')}</p><button class="button" data-action="clear">${say('清除全部筛选','Clear all filters')}</button></div>`;
  }
  function matchSnippet(owner) {
    const query = fold(state.query);
    if (!query) return '';
    const matches = filtered().byPaper.get(owner.id) || [];
    const item = matches.find(entry => entry.searchText.includes(query));
    if (!item) return `<small class="match-snippet">${say('命中论文信息或问题索引','Matched paper metadata or a question index')}</small>`;
    const fields = [item.statement, text(item.assessment_frame), text(item.terms), text(item.ambiguities), text(item.evidence), text(item.conclusion), text(item.scientific_questions)];
    const field = fields.find(value => fold(value).includes(query)) || item.statement;
    const index = fold(field).indexOf(query), start = Math.max(0,index - 45);
    return `<small class="match-snippet">${escape(code(item))}: ${start ? '…' : ''}${escape(field.slice(start,start + 170))}${field.length > start + 170 ? '…' : ''}</small>`;
  }
  function sortedPapers(items) {
    const query = fold(state.query);
    const score = owner => query ? (fold(owner.title).includes(query) ? 100 : 0) + (fold(owner.authors).includes(query) ? 60 : 0) + (filtered().byPaper.get(owner.id) || []).reduce((best,item) => Math.max(best,item.searchText.includes(query) ? 40 : 0),0) : 0;
    return [...items].sort((a,b) => (state.sort === 'title' ? 0 : state.sort === 'oldest' ? (a.year || 9999) - (b.year || 9999) : state.sort === 'relevance' && query ? score(b) - score(a) : 0) || (state.sort === 'title' ? 0 : (b.year || 0) - (a.year || 0)) || String(a.title).localeCompare(String(b.title)));
  }
  function paperRow(owner) {
    const matches = filtered().byPaper.get(owner.id) || [];
    return `<button class="paper-row" data-open="paper:${escape(owner.id)}"><span>${escape(owner.year || '—')}</span><div><strong>${escape(owner.title)}</strong><small>${escape(owner.direction_ids.map(id => label(direction(id))).join(' · '))}</small><small>${escape(counts(owner))}</small>${matchSnippet(owner)}</div><b aria-label="${escape(say('当前筛选匹配记录数','Records matching the current filters'))}">${matches.length}</b></button>`;
  }
  function claimCard(item) {
    const owner = paper(item.paper_id);
    return `<button class="claim-link" data-open="claim:${escape(item.id)}"><span>${escape(code(item))} · ${escape(statusLabel(item.record_status))} · ${escape(owner?.year || '—')}</span><strong>${escape(item.statement)}</strong><small>${escape(owner?.title || '')}</small></button>`;
  }
  function pageControls(count) {
    const total = Math.max(1,Math.ceil(count / pageSize));
    return total > 1 ? `<div class="pagination"><button class="button" data-action="previous" ${state.page <= 1 ? 'disabled' : ''}>${say('上一页','Previous')}</button><span>${state.page} / ${total} · ${count} ${say('篇论文','papers')}</span><button class="button" data-action="next" ${state.page >= total ? 'disabled' : ''}>${say('下一页','Next')}</button></div>` : '';
  }

  function render() {
    if (!state.data) return;
    const data = filtered(), results = $('results');
    $('search').value = state.query;
    $('direction').value = state.direction;
    $('record-status').value = state.status;
    $('result-sort').value = state.sort;
    root.querySelectorAll('[data-mode]').forEach(button => { const active = button.dataset.mode === state.mode; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
    root.querySelector('.workspace').classList.toggle('graph-mode',state.mode === 'graph');
    $('search-summary').innerHTML = `<span>${say('当前筛选：','Current filters: ')}<b>${data.papers.length}</b> ${say('篇论文','papers')} · <b>${data.claims.length}</b> ${say('条记录','records')} · ${escape(countText(data.claims))}</span><button class="text-button" data-action="clear">${say('清除筛选','Clear filters')}</button>`;
    if (state.mode === 'directions') {
      results.innerHTML = intro('BROAD NAVIGATION',say('从宽方向进入同一个知识库。','Broad directions, one shared library.'),say('以下数字使用当前筛选。记录可以属于多个方向，不能相加当作独立总数；继承论文分类只用于检索。','Counts use the current filters. Directions can overlap, so their counts are not an independent total. Inherited paper categories are retrieval aids only.')) + (data.papers.length ? `<div class="grid">${state.data.directions.map(item => {
        const entries = data.claims.filter(entry => entry.direction_ids.includes(item.id));
        const owners = data.papers.filter(owner => (data.byPaper.get(owner.id) || []).some(entry => entry.direction_ids.includes(item.id)) || (!owner.claims.length && owner.direction_ids.includes(item.id)));
        return `<button class="card" data-open="direction:${escape(item.id)}"><span>${entries.length} ${say('条记录','records')} / ${owners.length} ${say('篇论文','papers')}</span><strong>${escape(label(item))}</strong><small>${escape(countText(entries))}</small><p>${escape(description(item))}</p><i>${say('查看记录','Inspect records')} →</i></button>`;
      }).join('')}</div>` : emptyState());
    }
    if (state.mode === 'papers') {
      const owners = sortedPapers(data.papers);
      state.page = Math.min(state.page, Math.max(1,Math.ceil(owners.length / pageSize)));
      results.innerHTML = intro('PAPER AS CONTAINER',say('论文保留全部记录，状态逐条保存。','Keep papers whole; preserve each record’s status.'),say('右侧数字是当前筛选匹配数。论文可以同时含有策展记录和未核验候选。','The number at the right counts matching records. A paper can contain both curated records and unverified candidates.')) + (owners.length ? `<div class="list">${owners.slice((state.page - 1) * pageSize, state.page * pageSize).map(paperRow).join('')}</div>${pageControls(owners.length)}` : emptyState());
    }
    if (state.mode === 'questions') renderQuestions(data,results);
    if (state.mode === 'graph') renderGraph(data,results);
    detail();
    syncURL();
  }

  function renderQuestions(data, results) {
    const families = state.data.claim_families.map(item => ({...item,members:item.members.filter(member => data.ids.has(member.claim_id))})).filter(item => item.members.length);
    const groups = [...state.data.questions].map(([question,ids]) => ({question,claims:ids.map(claim).filter(item => data.ids.has(item.id))})).filter(item => item.claims.length);
    const candidates = data.claims.filter(item => item.record_status === 'candidate');
    results.innerHTML = intro('QUESTION-FIRST SEARCH',say('先发现相关证据，再核验关系。','Discover related evidence; check relations separately.'),say(`全库有 ${state.data.claims.filter(item => item.record_status === 'curated').length} 条策展记录。候选也可在下面按其记录的问题找到，但不会自动形成支持、反驳或复现关系。`,`The library has ${state.data.claims.filter(item => item.record_status === 'curated').length} curated records. Candidates are discoverable below by their recorded questions, without automatic support, contradiction or replication relations.`)) +
      `<h4 class="subsection-title">${say('人工策展的问题索引','Curated question index')}</h4><div class="list">${families.map(item => `<button class="question-card" data-open="family:${escape(item.id)}"><span>${escape(label(direction(item.direction_id)))}</span><strong>${escape(familyLabel(item))}</strong><small>${item.members.length} ${say('条策展记录','curated records')} · ${new Set(item.members.map(member => claim(member.claim_id)?.paper_id)).size} ${say('篇论文','papers')}</small></button>`).join('') || `<p class="metadata-note">${say('当前条件下没有匹配的策展问题；这不表示下方候选中没有相关证据。','No curated question matches these filters; relevant evidence may still appear among candidates below.')}</p>`}</div>` +
      `<h4 class="subsection-title">${say('候选中的相关问题：检索归组，不是核验关系','Related candidate questions: retrieval groups, not verified relations')}</h4><p class="result-note">${groups.length} ${say('个原文问题分组','recorded question groups')} · ${candidates.length} ${say('条匹配候选；内容可能尚未翻译。','matching candidates; content may not yet be translated.')}</p><div class="list">${groups.slice(0,state.questionLimit).map(item => `<button class="question-card candidate-question" data-open="question:${escape(item.question)}"><span>${say('尚待人工核对','Human checking pending')}</span><strong>${escape(item.question)}</strong><small>${item.claims.length} ${say('条候选','candidates')} · ${new Set(item.claims.map(entry => entry.paper_id)).size} ${say('篇论文','papers')}</small></button>`).join('')}</div>${groups.length > state.questionLimit ? `<button class="button" data-action="more-questions">${say('显示更多问题','Show more questions')}</button>` : ''}` +
      (!families.length && !groups.length ? candidates.length ? `<div class="list">${candidates.slice(0,pageSize).map(claimCard).join('')}</div><p class="result-note">${say('这些候选尚无结构化问题索引；可按论文查看其完整记录。','These candidates have no structured question index yet. Open their papers for the full records.')}</p>` : emptyState() : '');
  }

  function wrapped(value, maxUnits) {
    const lines = []; let line = '', units = 0;
    for (const ch of String(value || '').replace(/\s+/g,' ')) {
      const width = /[\u3400-\u9fff]/u.test(ch) ? 1 : .56;
      if (units + width > maxUnits && line) { lines.push(line.trim()); line = ''; units = 0; }
      line += ch; units += width;
    }
    if (line) lines.push(line.trim());
    return lines.length ? lines : ['—'];
  }
  function renderGraph(data, results) {
    const available = data.claims.filter(item => item.record_status === 'curated');
    if (!available.length) {
      results.innerHTML = intro('SOURCE → CLAIM → QUESTION',say('当前筛选没有策展图节点。','No curated map nodes match these filters.'),say('候选仍可按论文或问题找到；关键词相似不会自动形成知识关系。','Candidates remain available through papers and questions. Keyword similarity never creates a knowledge relation.')) + `<button class="button" data-action="show-questions">${say('查看相关问题与候选','Explore questions and candidates')}</button>`;
      return;
    }
    const ids = new Set(available.map(item => item.id));
    const families = state.data.claim_families.map(item => ({...item,members:item.members.filter(member => ids.has(member.claim_id))})).filter(item => item.members.length);
    const owners = [...new Set(available.map(item => item.paper_id))].map(paper);
    const focusOptions = new Set(['all', ...owners.map(item => 'paper:' + item.id), ...families.map(item => 'family:' + item.id)]);
    if (!focusOptions.has(state.graphFocus)) state.graphFocus = 'paper:' + owners[0].id;
    const [focusKind,focusID] = splitRecord(state.graphFocus);
    const selectedFamily = families.find(item => item.id === focusID);
    const subset = state.graphFocus === 'all' ? available : focusKind === 'family' ? available.filter(item => selectedFamily?.members.some(member => member.claim_id === item.id)) : available.filter(item => item.paper_id === focusID);
    const subsetIDs = new Set(subset.map(item => item.id));
    const shownFamilies = families.filter(item => item.members.some(member => subsetIDs.has(member.claim_id)));
    const shownOwners = [...new Set(subset.map(item => item.paper_id))].map(paper);
    const columns = [shownOwners.map(item => ({key:'paper:' + item.id,label:(item.year || '—') + ' · ' + item.title,type:'paper',item})),subset.map(item => ({key:'claim:' + item.id,label:item.statement,type:'claim',item})),shownFamilies.map(item => ({key:'family:' + item.id,label:familyLabel(item),type:'family',item}))];
    const widths = [280,400,280], xs = [20,380,860];
    columns.forEach((entries,col) => entries.forEach(entry => { entry.lines = wrapped(entry.label, widths[col] / 14 - 2); entry.height = Math.max(64, entry.lines.length * 20 + 30); }));
    const height = Math.max(330,...columns.map(entries => entries.reduce((sum,item) => sum + item.height + 30,0) + 90));
    const positions = new Map();
    columns.forEach((entries,col) => { let y = 64; for (const entry of entries) { positions.set(entry.key,{...entry,x:xs[col],y,width:widths[col],center:y + entry.height / 2}); y += entry.height + 30; } });
    const active = state.selected;
    const edge = (from,to,related) => {
      const a = positions.get(from), b = positions.get(to); if (!a || !b) return '';
      return `<path class="edge ${related ? 'is-related' : active ? 'is-dimmed' : ''}" d="M${a.x + a.width} ${a.center} C${a.x + a.width + 50} ${a.center} ${b.x - 50} ${b.center} ${b.x} ${b.center}"/>`;
    };
    let edges = '';
    for (const item of subset) edges += edge('paper:' + item.paper_id,'claim:' + item.id,active === 'paper:' + item.paper_id || active === 'claim:' + item.id);
    for (const item of shownFamilies) for (const member of item.members) if (subsetIDs.has(member.claim_id)) edges += edge('claim:' + member.claim_id,'family:' + item.id,active === 'claim:' + member.claim_id || active === 'family:' + item.id);
    const nodes = [...positions.values()].map(entry => `<g class="node ${entry.type} ${active === entry.key ? 'is-selected' : ''}" data-open="${escape(entry.key)}" role="button" tabindex="0" aria-label="${escape(say('查看：','Inspect: ') + entry.label)}" transform="translate(${entry.x} ${entry.y})"><title>${escape(entry.label)}</title><rect width="${entry.width}" height="${entry.height}" rx="${entry.type === 'claim' ? 14 : 4}"/><text x="14" y="26">${entry.lines.map((line,index) => `<tspan x="14" dy="${index ? 20 : 0}">${escape(line)}</tspan>`).join('')}</text></g>`).join('');
    results.innerHTML = intro('SOURCE → CLAIM → QUESTION',say('论文、观点与问题之间的结构。','The structure linking papers, claims and questions.'),say('保留三列来源结构，默认聚焦一篇论文。连线只表示来源与问题归组；选择节点后可在下方检查完整证据。','The original three-column provenance structure, focused on one paper by default. Edges indicate sources and question grouping only. Select a node to inspect its full evidence below.')) +
      `<div class="graph-toolbar"><label>${say('当前焦点','Current focus')}<select id="graph-focus"><option value="all">${say('全部匹配的策展记录','All matching curated records')} (${available.length})</option><optgroup label="${say('按论文聚焦','Focus on a paper')}">${owners.map(item => `<option value="paper:${escape(item.id)}">${escape((item.year || '—') + ' · ' + item.title)}</option>`).join('')}</optgroup><optgroup label="${say('按问题聚焦','Focus on a question')}">${families.map(item => `<option value="family:${escape(item.id)}">${escape(familyLabel(item))}</option>`).join('')}</optgroup></select></label><div class="graph-zoom"><button class="button" data-action="zoom-out" aria-label="${say('缩小逻辑图','Zoom out')}">−</button><button class="button" data-action="zoom-in" aria-label="${say('放大逻辑图','Zoom in')}">+</button><button class="button" data-action="zoom-reset">100%</button></div></div>` +
      `<p class="result-note">${shownOwners.length} ${say('篇论文','papers')} → ${subset.length} ${say('条策展记录','curated records')} → ${shownFamilies.length} ${say('个问题','questions')} · ${say('候选不进入此关系层，可在问题入口检索。可横向与纵向滚动，或用 Tab / Enter 操作节点。','Candidates are discoverable in Questions, not this relation layer. Scroll horizontally/vertically, or use Tab and Enter on nodes.')}</p><div class="logic" tabindex="0" aria-label="${say('可滚动的逻辑图','Scrollable logic map')}"><svg viewBox="0 0 1160 ${height}" style="width:${1160 * state.zoom}px;height:${height * state.zoom}px" role="group" aria-label="Paper to claim to question logic map"><desc>${say('三列为论文、观点和问题，节点可键盘操作。','Three columns: papers, claims and questions. Nodes support keyboard activation.')}</desc><text class="graph-column" x="20" y="28">${say('论文','PAPERS')}</text><text class="graph-column" x="380" y="28">CLAIMS</text><text class="graph-column" x="860" y="28">${say('科学问题','QUESTIONS')}</text>${edges}${nodes}</svg></div>`;
    $('graph-focus').value = state.graphFocus;
    $('graph-focus').onchange = event => { state.graphFocus = event.target.value; state.selected = null; syncURL(true); render(); };
  }

  function field(title,value,style='') { return `<div class="block ${style}"><label>${escape(title)}</label><p>${escape(text(value) || say('本来源未明确报告。','Not explicitly reported by this source.'))}</p></div>`; }
  function correctionURL(owner,item) {
    const url = new URL('community.html',location.href);
    url.searchParams.set('lang',state.language); url.searchParams.set('paper',owner.id);
    if (item) { url.searchParams.set('claim',item.id); url.searchParams.set('version',item.provenance?.prompt_version || item.batch_id || item.verification || 'source_reported'); }
    url.hash = 'correction';
    return url.href;
  }
  function shareTools(owner,item) {
    return `<div class="record-tools"><label>${say('可分享的稳定定位','Shareable record link')}<input class="record-url" readonly value="${escape(recordURL().href)}" aria-label="${say('记录链接','Record link')}"></label><div class="actions"><button class="button" data-action="copy-record">${say('复制链接','Copy link')}</button><a class="button" href="${escape(correctionURL(owner,item))}">${say('带定位提出更正','Suggest a located correction')}</a></div><p id="copy-status" role="status"></p></div>`;
  }
  function reportLink(owner,item) {
    const url = safeURL(owner.reading_report_url); if (!url) return '';
    const result = new URL(url); result.searchParams.set('lang',state.language);
    if (item?.record_status === 'candidate' && code(item).startsWith('C')) result.hash = code(item);
    return sourceLink(result.href,'阅读提取报告','Read extraction report');
  }
  function coverage(owner) {
    const details = owner.extraction_coverage;
    if (!details) return `<p class="metadata-note">${say('此容器尚无完整的结构化阅读覆盖记录；请回查来源。','This container has no complete structured reading-coverage record yet; inspect the source.')}</p>`;
    return `<div class="coverage-note"><b>${say('阅读覆盖，不是科学验证','Reading coverage, not scientific verification')}</b><p>${escape(details.text_pass_complete ? say('已处理所提供的全文文字。','The supplied full text has been processed.') : say('文字处理范围以报告为准。','Consult the report for text coverage.'))} ${escape(details.figure_images_read ? say('来源记录声明包含图像阅读。','The source record reports image reading.') : say('未读取图像像素。','Figure pixels were not read.'))} ${say('候选仍待人工核对，不代表独立复现。','Candidates still require human checking; this is not independent reproduction.')}</p>${details.pdf_pages_read?.length ? `<small>${details.pdf_pages_read.length} ${say('页文字','text pages')}</small>` : ''}${details.missing_material?.length ? `<details><summary>${say('缺失材料与覆盖限制','Missing material and coverage limitations')}</summary><ul>${details.missing_material.map(item => `<li>${escape(text(item))}</li>`).join('')}</ul></details>` : ''}</div>`;
  }
  function detail() {
    const panel = $('detail');
    panel.classList.toggle('has-record',Boolean(state.selected));
    if (!state.selected) { panel.innerHTML = `<div class="empty"><span>SELECT A RECORD</span><h3>${copy('emptyTitle')}</h3><p>${copy('emptyText')}</p></div>`; return; }
    const [kind,id] = splitRecord(state.selected);
    let html = `<button class="text-button detail-back" data-action="back-results">← ${say('返回结果','Back to results')}</button>`;
    if (kind === 'claim') {
      const item = claim(id), owner = item && paper(item.paper_id);
      if (!item || !owner) { panel.innerHTML = html + `<p>${say('没有找到这个记录编号。记录可能已修订；请通过论文查找。','This record ID was not found. It may have been revised; search by paper.')}</p>`; return; }
      html += `<div class="meta">CLAIM / ${escape(owner.year || '—')}</div>${badge(item.record_status)}<h3>${escape(item.statement)}</h3>${languageNote(item.statement)}<p class="record-id">${say('稳定 ID','Stable ID')}: ${escape(item.id)}</p>`;
      if (item.record_status === 'candidate') html += `<div class="candidate-note">${escape(item.provenance?.source_audit_complete || /structured|fulltext-ai/.test(item.extraction_method || '') ? say('AI 文本提取与原文核对候选，尚未逐条人工核验；未独立复现。','AI text-extraction and source-audit candidate; not individually human-checked or independently reproduced.') : say('机器提名候选，仍需逐条回查来源。','Machine-nominated candidate; inspect its source individually.'))}</div>`;
      html += (window.CCClaimSemantics?.renderHTML(item,state.language,true) || '') + shareTools(owner,item) + field(say('记录角色','Record role'),item.role || (item.record_status === 'curated' ? 'source_reported' : null)) + field(say('证据类型','Evidence type'),item.evidence?.type) + field(say('证据','Evidence'),item.evidence?.description);
      for (const evidence of item.evidence?.items || []) {
        const loc = evidence.source_locator || {};
        html += field(say('原文定位','Source locator'),`PDF ${loc.pdf_page || '—'} · ${[loc.figure,loc.section,loc.equation].filter(Boolean).join(' · ')}`) + field(say('方法与对照','Method and comparator'),[evidence.method,evidence.design,evidence.comparator].filter(Boolean).join(' · ')) + field(say('独立证据单位','Evidence unit'),evidence.unit_of_analysis) + field(say('原文报告的 n','N as reported'),evidence.sample_size_as_reported) + field(say('不确定性','Uncertainty'),evidence.uncertainty);
        if (loc.quote) html += `<blockquote>${escape(loc.quote)}</blockquote>`;
      }
      html += field(say('实际支持','Supported conclusion'),item.conclusion?.positive,'positive') + field(say('适用边界','Boundary'),item.conclusion?.boundary,'boundary');
      if (Object.hasOwn(item.conclusion || {},'non_inference')) html += field(say('实际负结果','Negative result'),item.conclusion?.negative_result ?? item.conclusion?.negative,'negative') + field(say('不能推出','Non-inference'),item.conclusion.non_inference,'negative');
      else html += field(say('旧记录字段：负结果 / 不可推论（未拆分）','Legacy field: negative / non-inference (not separated)'),item.conclusion?.negative,'negative');
      html += field(say('未解决','Unresolved'),item.conclusion?.unresolved,'unresolved');
      if (item.shared_evidence_with?.length) html += field(say('共享证据，不是独立复现','Shared evidence, not independent replication'),item.shared_evidence_with);
      html += reportLink(owner,item) + sourceLink(owner.structured_metadata_url,'下载完整 metadata','Download full metadata',true) + sourceLink(owner.fulltext_source_url || owner.url,'回查所读来源','Inspect the source') + `<button class="claim-link" data-open="paper:${escape(owner.id)}"><span>${say('所属论文','Paper container')}</span><strong>${escape(owner.title)}</strong></button>`;
    } else if (kind === 'paper') {
      const owner = paper(id); if (!owner) { panel.innerHTML = html + emptyState(); return; }
      const matches = filtered().byPaper.get(owner.id) || [];
      const matchIDs = new Set(matches.map(item => item.id));
      html += `<div class="meta">PAPER / ${escape(owner.year || '—')}</div><h3>${escape(owner.title)}</h3><p>${escape(Array.isArray(owner.authors) ? owner.authors.join(', ') : text(owner.authors))}</p><div class="warning"><b>${owner.claims.length} ${say('条总记录','total records')} · ${matches.length} ${say('条匹配当前筛选','matching these filters')}</b><span>${escape(counts(owner))}</span></div>` + shareTools(owner,null) + coverage(owner);
      if (owner.reading_summary) html += `<details><summary>${say('阅读摘要（保留原记录语言）','Reading summary (original record language)')}</summary>${languageNote(owner.reading_summary)}<p>${escape(owner.reading_summary)}</p></details>`;
      html += reportLink(owner) + sourceLink(owner.structured_metadata_url,'下载结构化 metadata','Download structured metadata',true);
      if (owner.fulltext_source_url) html += sourceLink(owner.fulltext_source_url,'打开实际读取的全文版本','Open the full-text version actually read');
      if (owner.url && owner.url !== owner.fulltext_source_url) html += sourceLink(owner.url,'查看论文书目来源','Open bibliographic source');
      if (owner.doi) html += `<p class="record-id">DOI: ${escape(owner.doi)}</p>`;
      if (owner.source_document_type) html += `<p class="result-note">${say('所读文档类型（AI 判断）','Read document type (AI assessment)')}: ${escape(owner.source_document_type)}</p>`;
      if (owner.fulltext_source_url) html += `<p class="result-note">${say('书目版本与所读全文版本可能不同，请分别回查。','The bibliographic and read full-text versions can differ; inspect both.')}</p>`;
      html += matches.map(claimCard).join('');
      const remaining = owner.claims.filter(item => !matchIDs.has(item.id));
      if (remaining.length) html += `<details><summary>${remaining.length} ${say('条未匹配当前筛选的同文记录','records from this paper outside the current filters')}</summary>${remaining.map(claimCard).join('')}</details>`;
      if (!owner.claims.length) html += `<p class="metadata-note">${owner.semantic_extraction_status === 'source_assessed_no_claims' ? say('所供来源已评估，未保留独立结果；请查看贡献清单。','The supplied source was assessed without retaining independent results; inspect the inventory.') : say('目前没有结构化 claim；保留文献信息不表示已完成提取。','No structured claims are available. A bibliographic record does not imply completed extraction.')}</p>`;
    } else if (kind === 'direction') {
      const item = direction(id); if (!item) { panel.innerHTML = html + emptyState(); return; }
      const matches = filtered().claims.filter(entry => entry.direction_ids.includes(id));
      const owners = sortedPapers(filtered().papers.filter(owner => matches.some(entry => entry.paper_id === owner.id) || (!owner.claims.length && owner.direction_ids.includes(id))));
      html += `<div class="meta">BROAD DIRECTION</div><h3>${escape(label(item))}</h3><p>${escape(description(item))}</p><p>${owners.length} ${say('篇论文','papers')} · ${matches.length} ${say('条匹配记录','matching records')} · ${escape(countText(matches))}</p><button class="button" data-action="browse-direction" data-direction="${escape(id)}">${say('在论文列表中浏览此方向','Browse this direction in Papers')}</button>${owners.slice(0,pageSize).map(paperRow).join('')}`;
      if (owners.length > pageSize) html += `<p>${say('更多结果请使用上方论文列表入口。','Use the paper-list button above for the remaining results.')}</p>`;
    } else if (kind === 'family') {
      const item = state.data.claim_families.find(entry => entry.id === id);
      if (!item) { panel.innerHTML = html + emptyState(); return; }
      html += `<div class="meta">CURATED QUESTION INDEX</div><h3>${escape(familyLabel(item))}</h3><p class="candidate-note">${say('共同问题只表示值得比较；不自动构成支持、反驳或独立复现。','A shared question invites comparison; it does not automatically establish support, contradiction or independent replication.')}</p>${item.members.filter(member => filtered().ids.has(member.claim_id)).map(member => claim(member.claim_id)).filter(Boolean).map(claimCard).join('') || emptyState()}`;
    } else if (kind === 'question') {
      const items = (state.data.questions.get(id) || []).map(claim).filter(item => filtered().ids.has(item.id));
      html += `<div class="meta">CANDIDATE DISCOVERY</div><h3>${escape(id)}</h3>${languageNote(id)}<p class="candidate-note">${say('这些候选仅按相同的记录问题归组。尚未核验它们是否回答同一命题，也未建立任何科学关系。','These candidates share a recorded question only. Their scope and propositions have not been reconciled and no scientific relation has been established.')}</p>${items.map(claimCard).join('') || emptyState()}`;
    } else html += emptyState();
    panel.innerHTML = html;
  }

  function openRecord(key) {
    state.selected = key;
    const [kind,id] = splitRecord(key);
    if (state.mode === 'graph' && ['paper','family'].includes(kind)) state.graphFocus = kind + ':' + (kind === 'paper' ? paper(id)?.id || id : id);
    syncURL(true);
    if (state.mode === 'graph') render(); else detail();
    const panel = $('detail'); panel.setAttribute('tabindex','-1'); panel.focus({preventScroll:true});
    if (state.mode === 'graph' || matchMedia('(max-width:760px)').matches) panel.scrollIntoView({block:'start',behavior:'auto'});
  }
  function reset() { state.query = ''; state.direction = 'all'; state.status = 'all'; state.selected = null; state.graphFocus = ''; state.page = 1; syncURL(true); render(); }

  root.addEventListener('click', async event => {
    const opened = event.target.closest('[data-open]');
    if (opened) { openRecord(opened.dataset.open); return; }
    const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'copy-record') {
      const input = root.querySelector('.record-url'), message = $('copy-status');
      try { await navigator.clipboard.writeText(input.value); message.textContent = say('已复制记录链接。','Record link copied.'); }
      catch { input.focus(); input.select(); message.textContent = say('请复制已选中的链接。','Copy the selected link.'); }
      return;
    }
    if (action === 'clear') { reset(); return; }
    if (action === 'back-results') { state.selected = null; syncURL(true); detail(); $('results').setAttribute('tabindex','-1'); $('results').focus({preventScroll:true}); $('results').scrollIntoView({block:'start'}); return; }
    if (action === 'browse-direction') { state.direction = button.dataset.direction; state.mode = 'papers'; state.page = 1; state.selected = null; }
    if (action === 'show-questions') { state.mode = 'questions'; state.selected = null; }
    if (action === 'more-questions') state.questionLimit += pageSize;
    if (action === 'previous') state.page = Math.max(1,state.page - 1);
    if (action === 'next') state.page += 1;
    if (action === 'zoom-in') state.zoom = Math.min(1.8,state.zoom + .2);
    if (action === 'zoom-out') state.zoom = Math.max(.6,state.zoom - .2);
    if (action === 'zoom-reset') state.zoom = 1;
    syncURL(true); render();
    if (['previous','next'].includes(action)) $('results').scrollIntoView({block:'start'});
  });
  root.addEventListener('keydown', event => {
    const node = event.target.closest('g[data-open]');
    if (node && ['Enter',' '].includes(event.key)) { event.preventDefault(); openRecord(node.dataset.open); }
  });
  function fillControls() {
    $('direction').innerHTML = `<option value="all">${say('全部方向','All directions')}</option>` + state.data.directions.map(item => `<option value="${escape(item.id)}">${escape(label(item))}</option>`).join('');
    $('record-status').innerHTML = [['all',say('全部记录','All records')],['curated',statusLabel('curated')],['candidate',statusLabel('candidate')],['metadata',statusLabel('metadata')]].map(([value,title]) => `<option value="${value}">${escape(title)}</option>`).join('');
    $('result-sort').innerHTML = [['relevance',say('相关性','Relevance')],['newest',say('年份：新到旧','Newest first')],['oldest',say('年份：旧到新','Oldest first')],['title',say('标题','Title')]].map(([value,title]) => `<option value="${value}">${escape(title)}</option>`).join('');
  }
  root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click',() => { state.mode = button.dataset.mode; state.selected = null; state.page = 1; syncURL(true); render(); }));
  $('search').oninput = event => { state.query = event.target.value; state.page = 1; state.selected = null; render(); };
  $('direction').onchange = event => { state.direction = event.target.value; state.page = 1; state.selected = null; syncURL(true); render(); };
  $('record-status').onchange = event => { state.status = event.target.value; state.page = 1; state.selected = null; syncURL(true); render(); };
  $('result-sort').onchange = event => { state.sort = event.target.value; state.page = 1; syncURL(true); render(); };
  window.addEventListener('cc-language-change',event => { state.language = event.detail.lang; if (state.data) { fillControls(); render(); } });
  window.addEventListener('popstate',() => {
    const search = new URLSearchParams(location.search);
    state.mode = modes.includes(search.get('mode')) ? search.get('mode') : 'directions'; state.query = search.get('q') || ''; state.direction = search.get('dir') || 'all'; state.status = ['all','curated','candidate','metadata'].includes(search.get('status')) ? search.get('status') : 'all'; state.sort = ['relevance','newest','oldest','title'].includes(search.get('sort')) ? search.get('sort') : 'relevance'; state.page = Math.max(1,Number.parseInt(search.get('page'),10) || 1); state.graphFocus = search.get('focus') || ''; state.selected = readSelection(search); state.language = search.get('lang') === 'en' ? 'en' : 'zh';
    document.querySelector(`[data-site-lang="${state.language}"]`)?.click();
  });
  const load = window.__CC_LIBRARY_DATA__ ? Promise.resolve(window.__CC_LIBRARY_DATA__) : Promise.all(['data/claim-library-v0.2.json','data/fulltext-candidates-v0.3.json'].map(async url => { const response = await fetch(url); if (!response.ok) throw new Error('Library data unavailable'); return response.json(); }));
  load.then(([curated,expanded]) => {
    state.data = merge(curated,expanded);
    if (!direction(state.direction)) state.direction = 'all';
    if (!['all','curated','candidate','metadata'].includes(state.status)) state.status = 'all';
    const [kind,id] = splitRecord(state.selected); if (kind === 'paper' && paper(id)) state.selected = 'paper:' + paper(id).id;
    $('papers').textContent = state.data.papers.length; $('claims').textContent = state.data.claims.length; $('curated').textContent = state.data.claims.filter(item => item.record_status === 'curated').length;
    fillControls(); render();
  }).catch(() => { $('results').innerHTML = `<div class="search-empty"><h3>${say('知识库暂时未能加载。','The library could not load.')}</h3><p>${say('请通过 HTTP 本地预览或公开网站打开；记录没有被删除。','Use the HTTP preview or public website. This does not mean records have been deleted.')}</p><a class="button" href="${escape(location.href)}">${say('重新加载','Reload')}</a></div>`; });
})();
