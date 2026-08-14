(function(){
  // Every EN page that has a Spanish twin, keyed by clean URL. A page
  // missing from this map has no pair, and applyLanguageRedirect() then
  // correctly leaves it alone rather than sending a visitor to a 404.
  const enToEs = {
    "/": "/es",
    "/download": "/descargar",
    "/faq": "/preguntas",
    "/help": "/ayuda",
    "/contact": "/contacto",
    "/legal": "/aviso-legal"
  };

  const esToEn = Object.fromEntries(Object.entries(enToEs).map(([en, es]) => [es, en]));

  // The old .html URLs stay indexed and bookmarked for a long time. The
  // host redirects them, but that redirect lands after this script has
  // already run on the first response, so map them here too rather than
  // treat a legacy URL as an unpaired page.
  const legacy = {
    "/index.html": "/",
    "/indexES.html": "/es",
    "/download.html": "/download",
    "/downloadES.html": "/descargar",
    "/faq.html": "/faq",
    "/faqES.html": "/preguntas",
    "/help.html": "/help",
    "/helpES.html": "/ayuda",
    "/contact.html": "/contact",
    "/contactES.html": "/contacto",
    "/legal.html": "/legal",
    "/legalES.html": "/aviso-legal",
    "/connect.html": "/connect"
  };

  /* THE PAGE'S OWN CLEAN PATH.
     Trailing slashes are stripped so /ayuda/ and /ayuda are one page,
     and legacy .html paths are folded onto their clean equivalent. */
  function getPath(){
    let path = window.location.pathname || "/";
    if (legacy[path]) return legacy[path];
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return path || "/";
  }

  function normalizeLang(lang){
    if (!lang) return null;
    const v = String(lang).toLowerCase();
    if (v === "es" || v.startsWith("es-")) return "es";
    if (v === "en" || v.startsWith("en-")) return "en";
    if (v === "auto") return "auto";
    return null;
  }

  function detectBrowserLang(){
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    return normalizeLang(nav) === "es" ? "es" : "en";
  }

  function getStoredLang(){
    try{
      return normalizeLang(localStorage.getItem("lang"));
    }catch{
      return null;
    }
  }

  function setStoredLang(lang){
    try{
      if (lang === "auto") localStorage.removeItem("lang");
      else localStorage.setItem("lang", lang);
    }catch{
    }
  }

  function getQueryLang(){
    const q = new URLSearchParams(window.location.search);
    return normalizeLang(q.get("lang"));
  }

  function currentPageLang(path){
    if (esToEn[path]) return "es";
    // /connect is the QR deep-link landing page. It ships in Spanish
    // only and has no English twin, so it never redirects; it is listed
    // here just so the switcher's active state reads correctly on it.
    if (path === "/connect") return "es";
    return "en";
  }

  function counterpartFor(path, targetLang){
    if (targetLang === "es") return enToEs[path] || null;
    if (targetLang === "en") return esToEn[path] || null;
    return null;
  }

  function redirectToPath(targetPath){
    if (!targetPath) return;
    const url = new URL(window.location.href);
    url.pathname = targetPath;
    url.searchParams.delete("lang");
    window.location.replace(url.toString());
  }

  function applyLanguageRedirect(){
    const path = getPath();
    const pageLang = currentPageLang(path);

    const queryLang = getQueryLang();
    if (queryLang === "auto") setStoredLang("auto");
    if (queryLang === "es" || queryLang === "en") setStoredLang(queryLang);

    const stored = getStoredLang();
    const desired = stored === "es" || stored === "en" ? stored : detectBrowserLang();
    const hasPair = Boolean(enToEs[path] || esToEn[path]);

    if (!hasPair) return;
    if (desired === pageLang) return;

    const target = counterpartFor(path, desired);
    if (!target) return;
    redirectToPath(target);
  }

  function applyActiveState(){
    const stored = getStoredLang();
    const currentPref = stored === "es" || stored === "en" ? stored : "auto";
    const path = getPath();

    document.querySelectorAll("[data-lang]").forEach((el) => {
      const v = normalizeLang(el.getAttribute("data-lang"));
      const active = v === currentPref;
      el.classList.toggle("active", active);

      if (el.tagName !== "A") return;

      /* POINT THE SWITCH AT THIS PAGE'S OWN TWIN.
         The switch lives in a shared partial, so its authored href can
         only be one thing, and that is the home page in the other
         language: a sane no-JavaScript fallback that always exists.
         Here we know which page we are on, so we can upgrade it to the
         real counterpart, which is what someone reading the FAQ in
         English actually wants when they press "Español".

         Pages with no twin keep the authored href and simply cross over
         at the home page. */
      const target = v === "es" || v === "en" ? counterpartFor(path, v) : null;
      if (target) el.setAttribute("href", target);
    });
  }

  function setLanguagePreference(lang){
    const normalized = normalizeLang(lang);
    if (!normalized) return;

    setStoredLang(normalized);

    const path = getPath();
    const pageLang = currentPageLang(path);
    const effective = normalized === "auto" ? detectBrowserLang() : normalized;
    const target = counterpartFor(path, effective);

    if (target && effective !== pageLang){
      redirectToPath(target);
      return;
    }

    applyActiveState();
  }

  window.WallasLang = {
    set: setLanguagePreference,
    get: () => getStoredLang() || "auto"
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-lang]");
    if (!el) return;
    e.preventDefault();

    const lang = el.getAttribute("data-lang");
    setLanguagePreference(lang);

    const details = el.closest("details");
    if (details) details.open = false;
  });

  applyLanguageRedirect();
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", applyActiveState);
  }else{
    applyActiveState();
  }
})();
