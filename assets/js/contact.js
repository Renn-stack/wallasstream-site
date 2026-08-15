/* ============================================================
   contact.js — Support page behaviour
   One job: copy the support address to the clipboard.

   The address is a real mailto: link, so the page works exactly as
   well with this script blocked — the button is the convenience, not
   the mechanism.
   ============================================================ */
(function () {
  "use strict";

  var btn = document.getElementById("copyBtn");
  var address = document.getElementById("emailText");
  if (!btn || !address) return;

  var label = btn.textContent;
  /* contacto.html sets data-copied so the confirmation is not the only
     English word on a Spanish page. */
  var copiedLabel = btn.getAttribute("data-copied") || "Copied";
  var timer;

  function confirmCopy() {
    btn.textContent = copiedLabel;
    btn.classList.add("is-copied");
    clearTimeout(timer);
    timer = setTimeout(function () {
      btn.textContent = label;
      btn.classList.remove("is-copied");
    }, 1800);
  }

  /* Clipboard API needs a secure context, so file:// previews and any
     older browser fall through to the hidden-textarea route. */
  function legacyCopy(value) {
    var ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      confirmCopy();
    } catch (e) {
      /* Nothing to do: the address is still on screen and selectable. */
    }
    document.body.removeChild(ta);
  }

  btn.addEventListener("click", function () {
    var value = address.textContent.trim();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(confirmCopy, function () {
        legacyCopy(value);
      });
    } else {
      legacyCopy(value);
    }
  });
})();
