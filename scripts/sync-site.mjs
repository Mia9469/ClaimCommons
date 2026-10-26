import {cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=['index.html','method.html','extract.html','examples.html','library.html','community.html','site.css','site.js','claim-semantics.js','claim-reading-report.js','library-ui.js','report-ui.js','community-ui.js','extractor.js','library-snapshot.js','commons-v02.js','commons-v02.css','examples.css','examples.js','examples','vendor','data/claim-extraction-template.json','data/extraction-examples-v1.json'];
for(const destination of ['claim-commons-mvp/app/static','claim-commons-mvp/sites-public']){
 for(const name of assets){await mkdir(path.dirname(path.join(root,destination,name)),{recursive:true});await cp(path.join(root,name),path.join(root,destination,name),{recursive:true});}
}
for(const name of ['sync-site.mjs','build-site.mjs','site-sections.json','build-extraction-method.mjs','build-extraction-examples.mjs','enhance-reports.mjs','extractor-ux.inc.js'])await cp(path.join(root,'scripts',name),path.join(root,'claim-commons-mvp/scripts',name));
