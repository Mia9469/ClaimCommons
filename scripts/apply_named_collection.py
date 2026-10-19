#!/usr/bin/env python3
"""Add a DOI-identified collection, preserving prior archive records and candidates."""
import argparse,hashlib,json,re,shutil,sqlite3
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WORKSPACE=ROOT.parent
ARCHIVE=WORKSPACE.parent.parent/'references/ClaimCommons'
METHOD='claim-commons-fulltext-ai-v1'

def now():return datetime.now(timezone.utc).isoformat()
def dump(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def doi(v):return str(v or '').lower().removeprefix('https://doi.org/').strip()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--manifest',required=True);ap.add_argument('--slug',required=True);args=ap.parse_args()
 if not re.fullmatch(r'[a-z0-9-]+',args.slug):raise ValueError('Invalid collection slug')
 mp=Path(args.manifest).resolve();stage=mp.parent;m=json.loads(mp.read_text());batch=m['batch_id'];collection=m['collection']
 library=json.loads((WORKSPACE/'data/claim-library-v0.2.json').read_text());labels={x['id']:x['label_zh'] for x in library['directions']}
 db=sqlite3.connect(ARCHIVE/'library.sqlite');db.row_factory=sqlite3.Row
 backup=stage/'library-before-import.sqlite'
 if not backup.exists():
  dest=sqlite3.connect(backup);db.backup(dest);dest.close()
 existing=list(db.execute('SELECT * FROM articles'));bydoi={doi(r['doi']):r for r in existing if r['doi']};byid={r['id']:r for r in existing};idmap={};new=0;processed=0;claim_count=0
 outputs={}
 for p in m['papers']:
  output=stage/'extractions'/(p['id']+'.json')
  if output.exists():outputs[p['id']]=json.loads(output.read_text())
 with db:
  db.execute('CREATE TABLE IF NOT EXISTS structured_claim_revisions(claim_id TEXT NOT NULL, content_hash TEXT NOT NULL, record_json TEXT NOT NULL, extraction_method TEXT NOT NULL, review_status TEXT NOT NULL, archived_at TEXT NOT NULL, PRIMARY KEY(claim_id,content_hash))')
  for p in m['papers']:
   if not p.get('metadata_checked'):continue
   previous=bydoi.get(doi(p.get('doi')))
   if previous is None and p['id'] in byid:
    candidate=byid[p['id']]
    if doi(candidate['doi'])==doi(p.get('doi')) or doi(candidate['doi'])==p.get('correction_expected_doi'):previous=candidate
    else:raise ValueError('Article identity conflict: '+p['id'])
   pid=previous['id'] if previous else p['id'];idmap[p['id']]=pid
   old=json.loads(previous['metadata_json']) if previous else {}
   meta={**old,**{k:v for k,v in p.items() if k not in ('source','metadata_error','requested_title')},'id':pid}
   meta['collections']=sorted(set(old.get('collections',[])+p.get('collections',[])))
   meta['metadata_sources']=list(dict.fromkeys(old.get('metadata_sources',[])+p.get('metadata_sources',[])))
   meta['recommended_by_review']={'doi':m['seed_review_doi'],'reference_number':p['reference_number'],'reason':p['selection_reason'],'relation':'citation_only_not_support'}
   result=outputs.get(p['id']);base_ids=list(dict.fromkeys(v for c in (result or {}).get('claims',[]) for v in c.get('broad_directions',[]) if v in labels)) or [v for v in p.get('broad_directions',[]) if v in labels]
   if not base_ids and p['selection_reason']!='reference_inventory':base_ids=['learning-memory','behavior-cognition']
   if p['selection_reason'] in ('classical_model','supervised_learning_review','learning_models_review','review'):base_ids+=['theory-ai']
   if p['selection_reason'] in ('prediction_error','reward_representation','reinforcement_learning_recording'):base_ids+=['representation-coding']
   if p['selection_reason'] in ('causal_circuit','causal_learning','human_boundary','human_reward_learning'):base_ids+=['methods-causal']
   fibres={x['fibre_id']:x for x in old.get('fibre_memberships',[])}
   fibres.update({k:{'fibre_id':k,'label':labels[k]} for k in base_ids})
   meta['fibre_memberships']=list(fibres.values())
   source=p.get('source',{});available=source.get('status') in ('pdf_archived','html_archived')
   status=source.get('status','pdf_unavailable');extract_status=previous['extraction_status'] if previous else 'pending'
   if available:meta.update({'fulltext_source_url':source['source_url'],'fulltext_reading_mode':'text_only','fulltext_kind':source.get('kind','pdf'),'figure_pixels_inspected':False})
   elif previous and previous['acquisition_status'] in ('pdf_archived','html_archived'):status=previous['acquisition_status']
   if previous:
    db.execute('UPDATE articles SET title=?,doi=?,year=?,metadata_json=?,acquisition_status=?,updated_at=? WHERE id=?',(meta['title'],meta['doi'],meta.get('publication_year'),json.dumps(meta,ensure_ascii=False),status,now(),pid))
   else:
    db.execute('INSERT INTO articles(id,title,doi,year,source_id,metadata_json,abstract,acquisition_status,extraction_status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',(pid,meta['title'],meta['doi'],meta.get('publication_year'),'collection-'+args.slug,json.dumps(meta,ensure_ascii=False),'',status,extract_status,now()));new+=1
   if p.get('reassign_documents_from'):
    db.execute('UPDATE documents SET article_id=? WHERE article_id=? AND sha256=?',(pid,p['reassign_documents_from'],source['sha256']))
   if available:
    src=Path(source['path']);folder=ARCHIVE/('pdfs' if source.get('kind','pdf')=='pdf' else 'html')/str(meta.get('publication_year') or 'unknown');folder.mkdir(parents=True,exist_ok=True)
    dest=folder/(pid+'--'+source['sha256'][:10]+src.suffix)
    if not dest.exists() and not source.get('source_pdf_offline'):shutil.copyfile(src,dest)
    tp=ARCHIVE/'texts'/(pid+('.json' if source.get('kind','pdf')=='pdf' else '.sections.json'))
    if Path(source['text_path']).resolve()!=tp.resolve():shutil.copyfile(source['text_path'],tp)
    docid='doc-'+source['sha256'][:16]+'-'+hashlib.sha256(pid.encode()).hexdigest()[:8]
    archive_path=dest if dest.exists() else src
    db.execute('INSERT OR IGNORE INTO documents(id,article_id,path,sha256,kind,status,page_count,text_path,error,source_url,checked_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(docid,pid,str(archive_path),source['sha256'],source.get('kind','pdf'),'available',source.get('page_count'),str(tp),None,source.get('source_url'),now()))
   if result is not None:
    if not result.get('provenance',{}).get('source_audit_complete'):raise ValueError('Unaudited extraction: '+pid)
    processed+=1;active=set()
    for i,c in enumerate(result['claims'],1):
     cid='structured-'+pid+'-'+str(i);active.add(cid);ev=c['evidence'];con=c['conclusion'];loc=ev[0].get('source_locator',{}) if ev else {}
     dirs=[k for k in c.get('broad_directions',[]) if k in labels] or base_ids
     record={'id':cid,'paper_id':pid,'statement':c['statement'],'role':c.get('role','result'),'evidence':{'type':c['claim_type'],'description':' '.join(str(e['method']) for e in ev),'page':loc.get('pdf_page'),'source_url':source.get('source_url'),'items':ev},'conclusion':{'positive':con.get('positive'),'boundary':con.get('boundary'),'negative':con.get('negative_result'),'non_inference':con.get('non_inference'),'unresolved':con.get('unresolved'),'unresolved_attribution':con.get('unresolved_attribution')},'scientific_questions':c.get('scientific_questions',[]),'shared_evidence_with':['structured-'+pid+'-'+v[1:] for v in c.get('shared_evidence_with',[]) if re.fullmatch(r'C[1-9][0-9]*',v)],'review_notes':c.get('review_notes',[]),'directions':[{'id':k,'label':labels[k]} for k in dirs],'verification':'machine_candidate_fulltext','review_status':'unreviewed','extraction_method':METHOD,'source_locator':{'page':loc.get('pdf_page'),'section':loc.get('section'),'source_url':source.get('source_url')},'batch_id':batch,'provenance':result['provenance'],'source_check':c.get('review',{}),'audit':result.get('audit',{}),'collections':meta['collections']}
     # Preserve additive source-context fields; do not backfill them on old records.
     for key in ('source_statement','assessment_frame','terms','ambiguities'):
      if key in c:record[key]=c[key]
     previous_claim=db.execute('SELECT * FROM paper_claims WHERE id=?',(cid,)).fetchone()
     value=json.dumps(record,ensure_ascii=False)
     if previous_claim and previous_claim['record_json']!=value:
      digest=hashlib.sha256(previous_claim['record_json'].encode()).hexdigest();db.execute('INSERT OR IGNORE INTO structured_claim_revisions VALUES(?,?,?,?,?,?)',(cid,digest,previous_claim['record_json'],previous_claim['extraction_method'],previous_claim['review_status'],now()))
     db.execute('INSERT OR REPLACE INTO paper_claims VALUES(?,?,?,?,?)',(cid,pid,value,METHOD,'unreviewed'));claim_count+=1
    for old_claim in db.execute('SELECT * FROM paper_claims WHERE article_id=? AND extraction_method=?',(pid,METHOD)).fetchall():
     if old_claim['id'] not in active and json.loads(old_claim['record_json']).get('batch_id')==batch:
      digest=hashlib.sha256(old_claim['record_json'].encode()).hexdigest();db.execute('INSERT OR IGNORE INTO structured_claim_revisions VALUES(?,?,?,?,?,?)',(old_claim['id'],digest,old_claim['record_json'],old_claim['extraction_method'],old_claim['review_status'],now()));db.execute("UPDATE paper_claims SET review_status='superseded_candidate' WHERE id=?",(old_claim['id'],))
    for heuristic in db.execute("SELECT * FROM paper_claims WHERE article_id=? AND extraction_method='heuristic_fulltext_v1' AND review_status<>'superseded_candidate'",(pid,)).fetchall():
     digest=hashlib.sha256(heuristic['record_json'].encode()).hexdigest();db.execute('INSERT OR IGNORE INTO structured_claim_revisions VALUES(?,?,?,?,?,?)',(heuristic['id'],digest,heuristic['record_json'],heuristic['extraction_method'],heuristic['review_status'],now()));db.execute("UPDATE paper_claims SET review_status='superseded_candidate' WHERE id=?",(heuristic['id'],))
    extract_status='structured_candidates' if result['claims'] else 'source_assessed_no_claims'
    meta.update({'reading_report_url':'data/'+args.slug+'/'+p['id']+'.html','structured_metadata_url':'data/'+args.slug+'/'+p['id']+'.json','reading_summary':result.get('reading_summary'),'extraction_coverage':result['coverage'],'contribution_inventory':result['contribution_inventory'],'source_document_type':result['document_type'],'structured_extraction_provenance':result['provenance']})
   elif available and extract_status=='pending':extract_status='awaiting_structured_extraction'
   meta['semantic_extraction_status']=extract_status
   db.execute('UPDATE articles SET metadata_json=?,extraction_status=? WHERE id=?',(json.dumps(meta,ensure_ascii=False),extract_status,pid))
  db.execute('INSERT OR REPLACE INTO library_meta VALUES(?,?)',('collection:'+batch,json.dumps({'collection':collection,'review_doi':m['seed_review_doi'],'id_map':idmap,'updated_at':now()},ensure_ascii=False)))
  papers=[]
  for r in db.execute('SELECT * FROM articles ORDER BY year DESC,title'):
   meta=json.loads(r['metadata_json']);doc=db.execute("SELECT * FROM documents WHERE article_id=? AND status='available' ORDER BY checked_at DESC LIMIT 1",(r['id'],)).fetchone()
   paper={'id':r['id'],'title':r['title'],'doi':r['doi'],'year':r['year'],'authors':meta.get('authors',[]),'authors_truncated':meta.get('authors_truncated',False),'acquisition_status':r['acquisition_status'],'semantic_extraction_status':meta.get('semantic_extraction_status',r['extraction_status']),'fulltext_source_url':doc['source_url'] if doc else meta.get('fulltext_source_url'),'fulltext_kind':doc['kind'] if doc else meta.get('fulltext_kind'),'directions':[{'id':x['fibre_id'],'label':labels.get(x['fibre_id'],x['fibre_id'])} for x in meta.get('fibre_memberships',[])]}
   for key in ('url','venue','open_access','work_type','collections','project_memberships','metadata_sources','versions','reading_summary','reading_report_url','structured_metadata_url','source_document_type','extraction_coverage','contribution_inventory','recommended_by_review'):paper[key]=meta.get(key,[] if key in ('collections','project_memberships','metadata_sources','versions') else None)
   papers.append(paper)
  claims=[json.loads(r[0]) for r in db.execute("SELECT record_json FROM paper_claims WHERE review_status<>'superseded_candidate'")]
 prior=json.loads((WORKSPACE/'data/fulltext-candidates-v0.3.json').read_text());counts={}
 for c in claims:counts[c['paper_id']]=counts.get(c['paper_id'],0)+1
 for p in papers:p['candidate_count']=counts.get(p['id'],0)
 prior.update({'generated_at':now(),'papers':papers,'claims':claims,'summary':{'metadata_records':len(papers),'pdf_archived':sum(p['acquisition_status']=='pdf_archived' for p in papers),'html_archived':sum(p['acquisition_status']=='html_archived' for p in papers),'fulltext_processed':len({c['paper_id'] for c in claims}),'pdf_unavailable':sum(p['acquisition_status']=='pdf_unavailable' for p in papers),'candidate_claims':len(claims),'awaiting_structured_extraction':sum(p['semantic_extraction_status']=='awaiting_structured_extraction' for p in papers)}})
 collections=prior.setdefault('collections',[])
 if not any(x['id']==args.slug for x in collections):collections.append({'id':args.slug,'label':collection,'source':'https://doi.org/'+m['seed_review_doi'] if m.get('seed_review_doi') else None})
 for base in (WORKSPACE,ROOT/'app/static',ROOT/'sites-public'):dump(base/'data/fulltext-candidates-v0.3.json',prior)
 corpus=json.loads((WORKSPACE/'data/literature-corpus-v1.json').read_text());records={p['id']:p for p in corpus['records']}
 for p in m['papers']:
  if p['id'] not in idmap:continue
  pid=idmap[p['id']];records[pid]={**records.get(pid,{}),**{k:v for k,v in p.items() if k not in ('source','metadata_error','requested_title')},'id':pid}
 corpus['records']=list(records.values());corpus['corpus']['record_count']=len(records);batches=corpus['corpus'].setdefault('supplemental_batches',[]);batches[:]=[x for x in batches if x.get('id')!=batch];batches.append({'id':batch,'count':len(idmap),'scope':m['selection_scope'],'as_of':'2026-10-07'})
 for base in (WORKSPACE,ROOT/'app/static',ROOT/'sites-public'):dump(base/'data/literature-corpus-v1.json',corpus)
 public_manifest={**{k:v for k,v in m.items() if k!='papers'},'papers':[{**{k:v for k,v in p.items() if k not in ('source','metadata_error','requested_title')},'id':idmap[p['id']],'source_status':p.get('source',{}).get('status'),'source_url':p.get('source',{}).get('source_url')} for p in m['papers'] if p['id'] in idmap]}
 dump(ROOT/'curation/imports'/(batch+'.json'),public_manifest)
 dump(stage/'pipeline-queue.json',{'batch_id':batch,'papers':[{**p,'database_id':idmap.get(p['id']),'status':'structured_candidates' if (stage/'extractions'/(p['id']+'.json')).exists() else 'awaiting_structured_extraction' if p.get('source',{}).get('status') in ('pdf_archived','html_archived') else 'metadata_only'} for p in m['papers']]})
 summary={'batch_id':batch,'papers':len(idmap),'new_articles':new,'pdf_sources':sum(p.get('source',{}).get('status')=='pdf_archived' for p in m['papers']),'html_sources':sum(p.get('source',{}).get('status')=='html_archived' for p in m['papers']),'processed_sources':processed,'batch_candidate_claims':claim_count,'total_articles':len(papers),'total_candidate_claims':len(claims)};dump(stage/'import-summary.json',summary)
 import build_collection_reports as reports
 reports.STAGING=stage;reports.BATCH_ID=batch;reports.main(args.slug)
 print(json.dumps(summary),flush=True);db.close()

if __name__=='__main__':main()
