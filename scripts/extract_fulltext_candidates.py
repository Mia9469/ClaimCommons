#!/usr/bin/env python3
"""Build a public, explicitly unreviewed claim-candidate layer from archived open PDFs."""
from __future__ import annotations
import hashlib, json, os, re, sqlite3, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
ARCHIVE = Path(os.environ.get("CLAIM_COMMONS_ARCHIVE", Path.home()/"Library/Mobile Documents/com~apple~CloudDocs/GitHub/references/ClaimCommons"))
DB = ARCHIVE/"library.sqlite"
CORPUS = ROOT/"app/static/data/literature-corpus-v1.json"
OUTPUTS = [ROOT/"app/static/data/fulltext-candidates-v0.3.json", REPO/"data/fulltext-candidates-v0.3.json"]
METHOD = "heuristic_fulltext_v1"

CLAIM_PATTERNS = [
 (re.compile(r"\bwe (?:show|find|found|demonstrate|report|observe|reveal|establish|discover)\b", re.I), 8),
 (re.compile(r"\b(?:our|these) results (?:show|indicate|suggest|demonstrate|reveal)\b", re.I), 8),
 (re.compile(r"\bwe (?:propose|introduce|develop|present)\b", re.I), 5),
 (re.compile(r"\b(?:results?|analys(?:is|es)|experiments?) (?:show|indicate|suggest|demonstrate|reveal)\b", re.I), 6),
 (re.compile(r"\b(?:increases?|decreases?|predicts?|improves?|impairs?|enables?|drives?|depends on|is associated with)\b", re.I), 2),
]
METHOD_RE = re.compile(r"\b(using|by |we (?:recorded|measured|trained|simulated|derived|analysed|analyzed|tested)|participants?|mice|rats?|neurons?|dataset|model|network|simulation|imaging|electrophysiolog|fMRI|calcium)\b", re.I)
BAD_RE = re.compile(r"\b(?:we aim|we sought|we review|future work|et al\.|copyright|all rights reserved|references)\b", re.I)


def clean(s): return re.sub(r"\s+", " ", s).strip()
def split_sentences(page):
    text=clean(page.replace("•", ". "))
    return [clean(x) for x in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text) if 55 <= len(clean(x)) <= 650]
def tokens(s): return set(re.findall(r"[a-z]{4,}", s.lower()))
def similarity(a,b):
    x,y=tokens(a),tokens(b)
    return len(x&y)/max(1,len(x|y))
def evidence_type(text):
    s=text.lower()
    if re.search(r"\b(theorem|proof|derive|analytical|mathematical)\b",s): return "theory_or_derivation"
    if re.search(r"\b(simulat|computational model|neural network|trained model|algorithm)\b",s): return "computational_model_or_simulation"
    if re.search(r"\b(recorded|measured|participants|mice|rats|in vivo|imaging|electrophysiolog|fmri)\b",s): return "empirical_measurement_or_experiment"
    return "method_or_analysis_reported_by_source"
def score_sentence(s,page_i,n_pages):
    if BAD_RE.search(s): return -99
    score=sum(w for p,w in CLAIM_PATTERNS if p.search(s))
    if page_i <= 1 or page_i >= max(0,n_pages-4): score += 2
    if 90 <= len(s) <= 380: score += 1
    if s.count(";") > 4 or len(re.findall(r"\[[0-9, –-]+\]",s)) > 3: score -= 3
    return score

def extract(article,pages,topic_map):
    ranked=[]; n=len(pages)
    per_page=[]
    for pi,page in enumerate(pages):
        ss=split_sentences(page); per_page.append(ss)
        for si,s in enumerate(ss):
            sc=score_sentence(s,pi,n)
            if sc>=6: ranked.append((sc,pi,si,s))
    ranked.sort(key=lambda x:(-x[0], x[1]))
    chosen=[]
    for item in ranked:
        if any(similarity(item[3],x[3])>.52 for x in chosen): continue
        chosen.append(item)
        if len(chosen)==2: break
    meta=json.loads(article["metadata_json"])
    memberships=meta.get("fibre_memberships",[])
    directions=[{"id":m.get("fibre_id"),"label":topic_map.get(m.get("fibre_id"),m.get("fibre_id")),"role":m.get("role")} for m in memberships]
    out=[]
    for k,(sc,pi,si,s) in enumerate(chosen,1):
        nearby=per_page[pi][max(0,si-3):si]
        method=next((x for x in reversed(nearby) if METHOD_RE.search(x)), nearby[-1] if nearby else "No separate method sentence was identified automatically.")
        cid=f"ft-{article['id'].replace('paper-','')}-{k}"
        out.append({
          "id":cid,"paper_id":article["id"],"statement":s,
          "evidence":{"type":evidence_type(method+" "+s),"description":method,"source_sentence":s,"page":pi+1,"source_url":article["source_url"]},
          "conclusion":{"positive":s,"boundary":"Limited to the models, data, species, tasks, and protocols reported in this paper; exact scope requires human full-text review.","negative":"This machine candidate does not establish generality beyond the reported conditions, causal mechanism unless directly tested, or independent replication.","unresolved":"The precise evidential scope, alternative explanations, and relation to other claims remain to be reviewed by a human curator."},
          "directions":directions,"verification":"machine_candidate_fulltext","review_status":"unreviewed","extraction_method":METHOD,"score":sc,
          "source_locator":{"page":pi+1,"document_path":article["path"],"text_record":article["text_path"]}
        })
    return out,directions

def main():
    corpus=json.loads(CORPUS.read_text())
    topic_map={x["id"]:x.get("label_zh",x["id"]) for x in corpus.get("fibres",[])}
    with sqlite3.connect(DB) as db:
        db.row_factory=sqlite3.Row
        rows=db.execute("""SELECT a.*,d.path,d.text_path,d.source_url,d.page_count FROM articles a
          LEFT JOIN documents d ON d.id=(
            SELECT d2.id FROM documents d2
            WHERE d2.article_id=a.id AND d2.status='available'
            ORDER BY d2.checked_at DESC,d2.id LIMIT 1
          )
          ORDER BY a.year DESC,a.title""").fetchall()
        db.execute("DELETE FROM paper_claims WHERE extraction_method=?",(METHOD,))
        papers=[]; claims=[]; processed=0; unavailable=0; awaiting_local=0
        for row in rows:
            meta=json.loads(row["metadata_json"])
            paper={"id":row["id"],"title":row["title"],"authors":meta.get("authors",[]),"year":row["year"],"doi":row["doi"],"url":meta.get("url"),"venue":meta.get("venue"),"open_access":meta.get("open_access"),"acquisition_status":row["acquisition_status"],"fulltext_source_url":row["source_url"],"directions":[{"id":m.get("fibre_id"),"label":topic_map.get(m.get("fibre_id"),m.get("fibre_id"))} for m in meta.get("fibre_memberships",[])]}
            generated=[]
            if row["text_path"]:
                tp=Path(row["text_path"])
                if tp.exists() and tp.stat().st_blocks>0:
                    try:
                        pages=json.loads(tp.read_text())["pages"]
                        generated,_=extract(row,pages,topic_map); processed+=1
                    except Exception as e: paper["processing_error"]=str(e)[:180]
                else: awaiting_local+=1
            else: unavailable+=1
            paper["candidate_count"]=len(generated); papers.append(paper); claims.extend(generated)
            for c in generated:
                db.execute("INSERT OR REPLACE INTO paper_claims VALUES(?,?,?,?,?)",(c["id"],row["id"],json.dumps(c,ensure_ascii=False),METHOD,"unreviewed"))
            if generated: db.execute("UPDATE articles SET extraction_status='fulltext_candidates',updated_at=? WHERE id=?",(time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),row["id"]))
        db.commit()
    out={"schema_version":"0.3.0","generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"notice_zh":"全文候选由规则辅助提取，保留原句与页码，尚未经人工逐条核验；它们不是已确认的 Claim Commons 知识记录。","notice_en":"Full-text candidates are rule-assisted extractions with source sentences and page locators. They have not been individually human-verified and are not validated Claim Commons records.","summary":{"metadata_records":len(papers),"pdf_archived":sum(p["acquisition_status"]=="pdf_archived" for p in papers),"fulltext_processed":processed,"awaiting_local_text":awaiting_local,"pdf_unavailable":unavailable,"candidate_claims":len(claims)},"directions":[{"id":x["id"],"label_zh":x.get("label_zh",x["id"]),"question":x.get("question","")} for x in corpus.get("fibres",[])],"papers":papers,"claims":claims}
    for path in OUTPUTS:
        path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(out["summary"],ensure_ascii=False))
if __name__=="__main__": main()
