(function(){
  // Every EN page that has a Spanish twin. A page missing from this map
  // has no pair, and applyLanguageRedirect() then correctly leaves it
  // alone rather than sending a visitor to a 404.
  const enToEs = {
    "index.html": "indexES.html",
    "download.html": "downloadES.html",
    "faq.html": "faqES.html",
    "help.html": "helpES.html",
    "contact.html": "contactES.html",
    "legal.html": "legalES.html"
  };

  const esToEn = Object.fromEntries(Object.entries(enToEs).map(([en, es]) => [es, en]));

  function getFileName(){
    const path = window.location.pathname;
    const last = (path.split("/").pop() || "").trim();
    return last || "index.html";
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

  function currentPageLang(file){
    if (file.endsWith("ES.html")) return "es";
    // connect.html is the QR deep-link landing page. It ships in Spanish
    // only and has no English twin, so it never redirects; it is listed
    // here just so the switcher's active state reads correctly on it.
    if (file === "connect.html") return "es";
    return "en";
  }

  function counterpartFor(file, targetLang){
    if (targetLang === "es") return enToEs[file] || null;
    if (targetLang === "en") return esToEn[file] || null;
    return null;
  }

  function redirectToFile(targetFile){
    if (!targetFile) return;
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/[^/]*$/, targetFile);
    url.searchParams.delete("lang");
    window.location.replace(url.toString());
  }

  function applyLanguageRedirect(){
    const file = getFileName();
    const pageLang = currentPageLang(file);

    const queryLang = getQueryLang();
    if (queryLang === "auto") setStoredLang("auto");
    if (queryLang === "es" || queryLang === "en") setStoredLang(queryLang);

    const stored = getStoredLang();
    const desired = stored === "es" || stored === "en" ? stored : detectBrowserLang();
    const hasPair = Boolean(enToEs[file] || esToEn[file]);

    if (!hasPair) return;
    if (desired === pageLang) return;

    const target = counterpartFor(file, desired);
    if (!target) return;
    redirectToFile(target);
  }

  function applyActiveState(){
    const stored = getStoredLang();
    const currentPref = stored === "es" || stored === "en" ? stored : "auto";
    const file = getFileName();

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
      const target = v === "es" || v === "en" ? counterpartFor(file, v) : null;
      if (target) el.setAttribute("href", target);
    });
  }

  function setLanguagePreference(lang){
    const normalized = normalizeLang(lang);
    if (!normalized) return;

    setStoredLang(normalized);

    const file = getFileName();
    const pageLang = currentPageLang(file);
    const effective = normalized === "auto" ? detectBrowserLang() : normalized;
    const target = counterpartFor(file, effective);

    if (target && effective !== pageLang){
      redirectToFile(target);
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
