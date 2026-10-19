#!/usr/bin/env python3
"""Readable reports and public metadata for source-assessed collection outputs."""
import argparse,csv,html,json,re
from pathlib import Path
from ingest_research_collection import ROOT,WORKSPACE,STAGING,BATCH_ID,dump,now

def text(v):return '未报告 / 不适用' if v is None else str(v)
def main(collection='chicca-swims'):
 if not re.fullmatch(r'[a-z0-9-]+',collection):raise ValueError('Invalid collection slug')
 output=ROOT/'app/static/data'/collection;output.mkdir(parents=True,exist_ok=True);records=[]
 (STAGING/'reports').mkdir(parents=True,exist_ok=True)
 for file in sorted((STAGING/'extractions').glob('*.json')):
  d=json.loads(file.read_text());p=d['paper'];pid=file.stem
  if not d.get('provenance',{}).get('source_audit_complete'):continue
  report=['# '+p['title'],'','Claim Commons · AI 提取候选，尚待人工核对。','',d.get('reading_summary',''),'','## 阅读范围','',json.dumps(d['coverage'],ensure_ascii=False),'','## 贡献清单','']
  for x in d['contribution_inventory']:report.append('- '+x['summary']+'（'+x['decision']+'）：'+x['reason'])
  for c in d['claims']:
   report.extend(['','## '+c['id']+' · '+c['statement'],'','类型：'+c['claim_type']+'；角色：'+c.get('role','result'),''])
   for e in c['evidence']:
    loc=e['source_locator'];report.extend(['**Evidence**：'+e['method'],'','设计：'+text(e['design'])+'；独立单位：'+text(e['unit_of_analysis'])+'；n：'+text(e['sample_size_as_reported']),'','原文位置：PDF '+str(loc['pdf_page'])+'；'+text(loc.get('figure') or loc.get('section')),''])
   for key,label in [('positive','实际支持'),('boundary','边界'),('negative_result','实际负结果'),('non_inference','不能推出'),('unresolved','未解决')]:report.extend(['**'+label+'**：'+text(c['conclusion'].get(key)),''])
  report.extend(['## 待核对项','',json.dumps(d['audit'],ensure_ascii=False,indent=2),'','## 来源与流程','',json.dumps({'source':d['source'],'provenance':d['provenance']},ensure_ascii=False,indent=2)])
  md='\n'.join(report)+'\n';(STAGING/'reports'/(pid+'.md')).write_text(md)
  esc=lambda x:html.escape(text(x))
  role_labels={'result':'直接结果','interpretation':'解释','hypothesis':'假说 / 预测','review_synthesis':'综述整理','correction':'更正'}
  articles=[]
  for c in d['claims']:
   evidence=[]
   for e in c['evidence']:
    loc=e['source_locator'];evidence.append('<p>'+esc(e['method'])+'</p><dl><dt>设计 / 对照</dt><dd>'+esc(e.get('design'))+'；'+esc(e.get('comparator'))+'</dd><dt>独立单位与 n</dt><dd>'+esc(e.get('unit_of_analysis'))+'；'+esc(e.get('sample_size_as_reported'))+'</dd><dt>不确定性</dt><dd>'+esc(e.get('uncertainty'))+'</dd><dt>原文位置</dt><dd>PDF '+str(loc['pdf_page'])+' · '+esc(loc.get('figure') or loc.get('section') or loc.get('equation'))+'</dd></dl>')
   fields=''.join('<dt>'+label+'</dt><dd>'+esc(c['conclusion'].get(key))+'</dd>' for key,label in [('positive','实际支持'),('boundary','适用边界'),('negative_result','实际负结果'),('non_inference','不能推出'),('unresolved','未解决')])
   questions=''.join('<li>'+esc(x)+'</li>' for x in c.get('scientific_questions',[]))
   articles.append('<article><small>'+esc(c['id'])+' / '+esc(role_labels.get(c.get('role'),c.get('role')))+' · '+esc(c['claim_type'])+'</small><h2>'+esc(c['statement'])+'</h2><h3>Evidence</h3>'+''.join(evidence)+'<h3>Conclusion</h3><dl>'+fields+'</dl>'+('<h3>相关问题</h3><ul>'+questions+'</ul>' if questions else '')+'</article>')
  inventory=''.join('<li><b>'+esc(x['summary'])+'</b><br>'+esc(x['decision'])+' · '+esc(x['reason'])+'</li>' for x in d['contribution_inventory'])
  source_link='<a href="'+html.escape(d['source'].get('source_url') or p.get('url') or '',quote=True)+'" rel="noreferrer">查看所读原文版本 ↗</a>'
  details='<details><summary>核对记录与来源信息</summary><pre>'+html.escape(json.dumps({'coverage':d['coverage'],'audit':d['audit'],'source':d['source'],'provenance':d['provenance']},ensure_ascii=False,indent=2))+'</pre></details>'
  page='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(p['title'])+'</title><style>body{max-width:940px;margin:40px auto;padding:0 24px;background:#fffdf7;color:#12372f;font:16px/1.8 Georgia,serif}h1{font-size:26px;line-height:1.4}h2{font-size:20px;line-height:1.5}h3{font-size:16px}article{padding:26px 0;border-top:1px solid #bec4b8}small{color:#68766e}dl{display:grid;grid-template-columns:120px 1fr;gap:8px 20px}dt{font-weight:bold}dd{margin:0}li{padding:8px 0}p,dd{overflow-wrap:anywhere}.note{background:#eef2e2;padding:14px;border-left:3px solid #738968}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 monospace}@media(max-width:600px){body{margin:24px auto;padding:0 18px}dl{grid-template-columns:1fr;gap:3px}dd{margin-bottom:12px}}@media print{body{margin:0;background:white}details{display:block}}</style></head><body><small>CLAIM COMMONS / 阅读报告</small><h1>'+html.escape(p['title'])+'</h1><p class="note">AI 文本提取候选，尚待人工核对。图像像素未读取；PDF 页码指文件中的页序。</p><p>'+html.escape(d.get('reading_summary',''))+'</p>'+source_link+'<details><summary>贡献清单与处理决定</summary><ul>'+inventory+'</ul></details>'+''.join(articles)+details+'</body></html>'
  report_assets='<link rel="stylesheet" href="../../commons-v02.css?v=20261020-2"><link rel="stylesheet" href="../../examples.css?v=20260928-2"><link rel="stylesheet" href="../../site.css?v=20261020-2"><script defer src="../../site.js?v=20261020-2"></script><script defer src="../../report-ui.js?v=20261020-2"></script>'
  report_body='<body class="portal-page report-page" data-cc-report-shell="1" data-page="library" data-site-prefix="../../" data-library-paper="'+html.escape(pid,quote=True)+'" data-report-language="zh"><header></header><main id="report-content"><div id="report-tools"></div>'
  page=page.replace('</head>',report_assets+'</head>').replace('<body>',report_body).replace('</body>','</main><footer></footer></body>')
  (STAGING/'reports'/(pid+'.html')).write_text(page)
  # No PDF text or local paths are published. Candidate metadata and reports retain evidence provenance.
  dump(output/(pid+'.json'),d);(output/(pid+'.html')).write_text(page)
  records.append({'id':pid,'title':p['title'],'doi':p.get('doi'),'document_type':d.get('document_type'),'claims':len(d['claims']),'status':'ai_candidate','report_url':'data/'+collection+'/'+pid+'.html','metadata_url':'data/'+collection+'/'+pid+'.json'})
 dump(output/'index.json',{'batch_id':BATCH_ID,'generated_at':now(),'papers':records,'notice':'AI candidates; source text assessed, not human verification or independent reproduction.'})
 for base in [WORKSPACE/'data'/collection,ROOT/'sites-public/data'/collection]:
  base.mkdir(parents=True,exist_ok=True)
  for f in output.iterdir():(base/f.name).write_bytes(f.read_bytes())
 print(json.dumps({'reports':len(records),'claims':sum(r['claims'] for r in records)}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--collection',default='chicca-swims');parser.add_argument('--staging');parser.add_argument('--batch-id');args=parser.parse_args()
 if args.staging:STAGING=Path(args.staging).resolve()
 if args.batch_id:BATCH_ID=args.batch_id
 main(args.collection)
