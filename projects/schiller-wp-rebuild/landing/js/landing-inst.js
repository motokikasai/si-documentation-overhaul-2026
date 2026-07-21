/* Schiller Institute — institutional-wing additions.
   Loaded AFTER main.js / story-v3.js / landing.js. Adds only the wing's
   three small behaviors (everything else is the shared system; the join
   ladder's rail uses the declarative data-scrub grammar in landing.js):

   1. The letter form — prototype submit (no mail is sent; the WordPress
      build wires this to the real form handler).
   2. The patron toggle — once / monthly, prototype state only
      (NationBuilder carries the real transaction).
   3. The 404 search — search ships with the WordPress build; the prototype
      says so honestly and points at the doors.
*/
(function () {
  "use strict";

  /* ---- 1 · the letter form ---------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll(".js-letter"), function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector("input[type=email]");
      var msg = form.querySelector("textarea");
      if (email && (!email.value || email.value.indexOf("@") < 0)) {
        email.focus();
        email.style.borderColor = "#e05252";
        return;
      }
      if (msg && !msg.value.trim()) {
        msg.focus();
        msg.style.borderColor = "#e05252";
        return;
      }
      var note = document.createElement("p");
      note.textContent = "✓ Your letter is on its way — we read everything, and we answer. (Prototype — nothing was sent.)";
      note.style.cssText = "margin-top:1rem;text-align:center;font-size:0.9rem;color:#8a6d2f;";
      form.insertAdjacentElement("afterend", note);
      form.style.display = "none";
    });
  });

  /* ---- 2 · the patron toggle -------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll(".patron-toggle"), function (bar) {
    var btns = bar.querySelectorAll("button");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("click", function () {
        Array.prototype.forEach.call(btns, function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
      });
    });
  });

  /* ---- 3 · the 404 search ------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll(".js-lost-search"), function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = document.createElement("p");
      note.textContent = "Search arrives with the WordPress build — until then, one of the doors below will get you there.";
      note.style.cssText = "margin-top:0.9rem;font-size:0.82rem;color:#8a6d2f;";
      form.insertAdjacentElement("afterend", note);
      form.querySelector("input").value = "";
    });
  });
})();
