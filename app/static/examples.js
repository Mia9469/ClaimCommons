(() => {
  'use strict';
  const page = document.body.classList.contains('example-page');
  const supported = value => value === 'zh' || value === 'en';
  let stored;
  try { stored = localStorage.getItem('cc-lang'); } catch (_) { /* Browsing without storage is supported. */ }
  const requested = new URLSearchParams(location.search).get('lang');
  const initial = supported(requested) ? requested : supported(stored) ? stored : 'zh';
  function syncLinks() {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
    document.querySelectorAll('a[data-example-link]').forEach(link => {
      const url = new URL(link.getAttribute('href'), location.href);
      url.searchParams.set('lang', lang);
      link.href = url.href;
    });
  }
  function setLanguage(lang) {
    if (!supported(lang)) return;
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-example-lang]').forEach(button => {
      const active = button.dataset.exampleLang === lang;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    try { localStorage.setItem('cc-lang', lang); } catch (_) { /* Optional persistence. */ }
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
    syncLinks();
  }
  if (page) {
    setLanguage(initial);
    document.querySelectorAll('[data-example-lang]').forEach(button => {
      button.addEventListener('click', () => setLanguage(button.dataset.exampleLang));
    });
    const reveal = id => {
      const target = document.getElementById(id);
      if (target?.matches('details.ex-claim')) target.open = true;
    };
    document.querySelectorAll('[data-claim-jump]').forEach(link => {
      link.addEventListener('click', () => reveal(link.dataset.claimJump));
    });
    document.querySelectorAll('[data-expand]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('details.ex-claim').forEach(record => { record.open = button.dataset.expand === 'true'; });
      });
    });
    reveal(location.hash.slice(1));
    window.addEventListener('hashchange', () => reveal(location.hash.slice(1)));
  }
  new MutationObserver(syncLinks).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  syncLinks();
})();
