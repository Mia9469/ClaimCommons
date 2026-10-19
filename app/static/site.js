(() => {
 'use strict';
 const b=(zh,en)=>`<span class="ex-zh">${zh}</span><span class="ex-en">${en}</span>`;
 const deep=/\/examples\/[^/]+\.html$/.test(location.pathname),prefix=document.body.dataset.sitePrefix||(deep?'../':'');
 const page=document.body.dataset.page||(document.body.classList.contains('method-page')?'method':deep?'examples':'home');
 const links=[['home','index.html','理念','Idea'],['method','method.html','使用方法','Method'],['extract','extract.html','提取工具','Extract'],['examples','examples.html','示例','Examples'],['library','library.html','知识库','Library'],['community','community.html','策展与留言','Curation & guestbook']];
 const header=document.querySelector('header');
 header.classList.add('site-header');
 header.innerHTML=`<a class="brand" data-example-link href="${prefix}index.html"><b>C∴E</b><span>Claim Commons<small>${b('观点与证据公共库','The Claim–Evidence Commons')}</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation">${b('菜单','Menu')}</button><nav id="site-navigation" aria-label="Main navigation">${links.map(([id,href,zh,en])=>`<a data-example-link href="${prefix+href}" ${id===page?'aria-current="page"':''}>${b(zh,en)}</a>`).join('')}</nav><div class="lang-switch" aria-label="Language"><button type="button" data-site-lang="zh">中文</button><button type="button" data-site-lang="en">EN</button></div>`;
 document.querySelector('footer').classList.add('site-footer');
 document.querySelector('footer').innerHTML=`<span>Claim Commons · ${b('让每条结论保留证据与边界','Evidence and boundaries stay with each conclusion')}<small class="visit-counter" id="visit-label"></small></span><div><a href="https://github.com/Mia9469/ClaimCommons">GitHub ↗</a><a href="mailto:tongtonghmy@gmail.com">${b('联系 Mia','Contact Mia')}</a></div>`;
 let stored;try{stored=localStorage.getItem('cc-lang')}catch{}
 const q=new URLSearchParams(location.search).get('lang');
 let lang=['zh','en'].includes(q)?q:['zh','en'].includes(stored)?stored:'zh';
 function setLanguage(next){lang=next;document.documentElement.lang=next==='zh'?'zh-CN':'en';try{localStorage.setItem('cc-lang',next)}catch{}const u=new URL(location);u.searchParams.set('lang',next);history.replaceState(null,'',u);document.querySelectorAll('[data-site-lang]').forEach(x=>{x.classList.toggle('active',x.dataset.siteLang===next);x.setAttribute('aria-pressed',String(x.dataset.siteLang===next))});document.querySelectorAll('a[data-example-link]').forEach(a=>{const url=new URL(a.getAttribute('href'),location.href);url.searchParams.set('lang',next);a.href=url.href});document.querySelectorAll('option[data-option-zh]').forEach(option=>{option.textContent=next==='zh'?option.dataset.optionZh:option.dataset.optionEn});window.dispatchEvent(new CustomEvent('cc-language-change',{detail:{lang:next}}));renderCounter();}
 document.querySelectorAll('[data-site-lang]').forEach(x=>x.addEventListener('click',()=>setLanguage(x.dataset.siteLang)));
 document.querySelector('.menu-toggle').onclick=e=>{const open=document.querySelector('#site-navigation').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open))};
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('#site-navigation').classList.remove('open');document.querySelector('.menu-toggle').setAttribute('aria-expanded','false')}});
 document.querySelectorAll('#site-navigation a').forEach(link=>link.addEventListener('click',()=>{document.querySelector('#site-navigation').classList.remove('open');document.querySelector('.menu-toggle').setAttribute('aria-expanded','false')}));
 const main=document.querySelector('main');if(main&&!main.id)main.id='content';if(main&&!document.querySelector('a[href="#'+main.id+'"]')){const skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.innerHTML=b('跳到正文','Skip to content');document.body.prepend(skip);}
 let counts=null;function renderCounter(){const el=document.querySelector('#visit-label');if(!counts)return;el.textContent=lang==='zh'?`总访问 ${counts[0]} · 今日 ${counts[1]}`:`${counts[0]} total visits · ${counts[1]} today`;}
 setLanguage(lang);
 if(page==='home'&&['#library','#examples','#workflow','#join','#guestbook'].includes(location.hash)){const target={'#library':'library.html','#examples':'examples.html','#workflow':'method.html','#join':'community.html#join','#guestbook':'community.html#guestbook'}[location.hash];const u=new URL(prefix+target,location.href);u.searchParams.set('lang',lang);location.replace(u.href);}
 if(location.protocol!=='file:'){const base='https://api.counterapi.dev/v1/claim-commons-public',day=new Date().toISOString().slice(0,10);Promise.all([fetch(base+'/all/up').then(r=>r.json()),fetch(base+'/'+day+'/up').then(r=>r.json())]).then(v=>{if(v.every(x=>Number.isFinite(x.count))){counts=v.map(x=>new Intl.NumberFormat().format(x.count));renderCounter()}}).catch(()=>{});}
})();
