import {readFile, writeFile} from 'node:fs/promises';
const read=p=>JSON.parse(await readFile(p,'utf8'));
const base=await read('curation/published-papers.json');
const extra=await read('curation/additional-claims-v0.2.json');
const families=await read('curation/claim-families-v0.2.json');
const directionMap={
  'neural-dynamics':'dynamics-networks','cellular-computation':'cellular-metabolism','causal-neuroscience':'methods-causal','metabolism':'cellular-metabolism','whole-brain-models':'dynamics-networks','complex-systems':'theory-ai','memory-models':'learning-memory','local-learning':'learning-memory','brain-wide-dynamics':'behavior-cognition','neuromorphic-computing':'theory-ai','network-science':'dynamics-networks','human-neuroimaging':'behavior-cognition','developmental-neuroscience':'dynamics-networks','neural-coding':'representation-coding','representation-geometry':'representation-coding','science-and-society':'theory-ai'};
const evidenceType={
  'roxin-2011-firing-rates':'mathematical_and_simulation','zang-2018-climbing-fibres':'computational_model','robinson-2020-place-cells':'causal_experiment','chettih-2020-perturbome':'causal_experiment','chintaluri-2023-metabolic-spiking':'computational_model','shiu-2024-drosophila-model':'model_plus_experiment','zhang-2024-causal-emergence':'computational_experiment','podlaski-2025-context-memory':'mathematical_and_simulation','makkeh-2025-infomorphic-learning':'theory_plus_computation','liu-2025-all-optical':'method_plus_experiment','ibl-2025-brain-wide-map':'large_scale_observation','ding-2025-snn-robustness':'computational_experiment','suzuki-2025-symmetry-breaking':'mathematical_theory','wang-2026-artificial-manifolds':'hardware_plus_computation','fakhar-2026-cortical-reliability':'network_model','shain-2026-language-network':'human_neuroimaging','vander-molen-2026-organoid-sequences':'comparative_experiment','lynn-2026-input-output':'statistical_model','jing-2026-network-predictability':'mathematical_theory','zuckerman-2026-population-geometry':'observation_plus_computation','bla-2026-emotional-geometry':'observation_plus_perturbation','ai-society-2026-machine-organism-language':'conceptual_analysis'};
const directions=[
  {id:'representation-coding',label_zh:'表征与编码',description:'神经活动如何表示变量、结构与信息。'},
  {id:'dynamics-networks',label_zh:'动力学与网络',description:'网络结构、状态与时间演化如何共同产生功能。'},
  {id:'learning-memory',label_zh:'学习、记忆与可塑性',description:'经验与局部规则如何改变存储、访问和适应。'},
  {id:'cellular-metabolism',label_zh:'细胞、代谢与生物机制',description:'细胞过程、能量和生物物理约束如何塑造活动。'},
  {id:'behavior-cognition',label_zh:'行为、认知与脑区功能',description:'群体活动如何关联行为、认知变量和脑区组织。'},
  {id:'methods-causal',label_zh:'测量、干预与因果方法',description:'如何观察、扰动并识别神经系统中的关系。'},
  {id:'theory-ai',label_zh:'理论、复杂系统与人工智能',description:'数学原则、算法和物理实现如何刻画计算。'}
];
const primary=p=>({id:'c1',statement:p.claim,evidence:{type:evidenceType[p.id]||'other',description:p.evidence},conclusion:{positive:p.claim,boundary:p.scope,negative:p.non_claim,unresolved:'Not resolved by this source alone.'},keywords:[],verification:p.status});
const papers=base.papers.map(p=>({...p,direction_ids:[directionMap[p.topic]||'theory-ai'],claims:[primary(p),...(extra.claims_by_paper[p.id]||[])].map(c=>({...c,id:`${p.id}-${c.id}`,verification:c.verification||p.status}))})).map(({topic,claim,evidence,scope,non_claim,...p})=>p);
const claims=papers.flatMap(p=>p.claims.map(c=>({...c,paper_id:p.id,paper_title:p.title,year:p.year,direction_ids:p.direction_ids})));
const out={schema_version:'0.2.0',notice:'Each paper may contribute multiple Claim–Evidence–Conclusion units. Family membership is a navigation aid; it is not evidence of replication.',directions,papers,claims,claim_families:families.families,relations:families.relations};
await writeFile('app/static/data/claim-library-v0.2.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({papers:papers.length,claims:claims.length,directions:directions.length,families:families.families.length}));
