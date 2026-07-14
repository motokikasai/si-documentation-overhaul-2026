/* Schiller Institute — landing pages, v4x series behaviors (the experimental
   wing). Loaded AFTER main.js, story-v3.js, landing.js and landing-v4.js.
   Selector-gated modules, one file for all five pages:

   1. Year scrub — [data-yearslider]: a range input drags a cursor across the
      Triple Curve; the annotation card swaps to the last event ≤ that year.
   2. Flip-gloss — .gloss lines toggle German ⇄ English on tap (hover/focus
      are pure CSS).
   3. Language bar — .langbar buttons re-render the hero line in six
      languages with a fade.
   4. The hall — [data-hall]: generates a fan of seats and lights them (in a
      shuffled, organic order) as the panel scrolls through the viewport;
      the last gold seat stays open. Reduced motion: fully lit, seat open.
   5. Ribbon — [data-ribbon]: sticky register bar after the hero, dismissable.
   6. Dawn scrub — [data-dawnslider]: a range input (2026 → 2050) draws
      corridors, lights cities and lerps the readout numbers. User-driven —
      no scroll listener at all.
*/
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }

  /* ---- 1 · year scrub (the Triple Curve) --------------------------------- */
  var ys = document.querySelector("[data-yearslider]");
  if (ys) {
    var input = ys.querySelector("input[type=range]");
    var cursor = ys.querySelector(".chart-cursor");
    var cLine = cursor && cursor.querySelector("line");
    var cText = cursor && cursor.querySelector("text");
    var noteT = ys.querySelector(".chart-note strong");
    var noteP = ys.querySelector(".chart-note p");
    var x0 = parseFloat(ys.getAttribute("data-x0"));
    var x1 = parseFloat(ys.getAttribute("data-x1"));
    var events = [];
    var src = ys.querySelector("script[type='application/json']");
    if (src) { try { events = JSON.parse(src.textContent); } catch (e) {} }

    var applyYear = function () {
      var year = parseInt(input.value, 10);
      var t = (year - input.min) / (input.max - input.min);
      var x = x0 + t * (x1 - x0);
      if (cLine) { cLine.setAttribute("x1", x); cLine.setAttribute("x2", x); }
      if (cText) {
        cText.setAttribute("x", x);
        cText.setAttribute("text-anchor", t > 0.9 ? "end" : t < 0.1 ? "start" : "middle");
        cText.textContent = year;
      }
      input.style.setProperty("--fill", (t * 100).toFixed(1) + "%");
      var active = null;
      for (var i = 0; i < events.length; i++) {
        if (events[i].y <= year) active = events[i];
      }
      if (active && noteT && noteP) {
        noteT.textContent = active.y + " — " + active.t;
        noteP.textContent = active.n;
      }
    };
    input.addEventListener("input", applyYear);
    applyYear();
  }

  /* ---- 2 · flip-gloss tap -------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll(".gloss"), function (g) {
    g.addEventListener("click", function () { g.classList.toggle("is-flipped"); });
  });

  /* ---- 3 · language bar ----------------------------------------------------- */
  var langbar = document.querySelector(".langbar");
  if (langbar) {
    var target = document.querySelector("[data-lang-target]");
    langbar.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-line]");
      if (!btn || !target) return;
      Array.prototype.forEach.call(langbar.querySelectorAll("button"), function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      target.classList.add("is-fading");
      window.setTimeout(function () {
        target.textContent = btn.getAttribute("data-line");
        var lang = btn.getAttribute("data-langcode");
        if (lang) target.setAttribute("lang", lang);
        target.classList.remove("is-fading");
      }, reduced ? 0 : 300);
    });
  }

  /* ---- 4 · the hall ---------------------------------------------------------- */
  var hall = document.querySelector("[data-hall]");
  if (hall) {
    var svg = hall.querySelector("svg");
    var NS = "http://www.w3.org/2000/svg";
    var CX = 400, CY = 442;
    var seats = [];
    for (var row = 0; row < 7; row++) {
      var r = 158 + row * 38;
      var step = 24 / r;              /* constant arc spacing */
      var span = 1.16;                /* ± radians */
      for (var a = -span; a <= span + 1e-6; a += step) {
        var c = document.createElementNS(NS, "circle");
        c.setAttribute("class", "seat");
        c.setAttribute("cx", (CX + r * Math.sin(a)).toFixed(1));
        c.setAttribute("cy", (CY - r * Math.cos(a)).toFixed(1));
        c.setAttribute("r", 4.6);
        svg.appendChild(c);
        seats.push(c);
      }
    }
    /* shuffle so the hall fills organically, not row by row */
    for (var i = seats.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = seats[i]; seats[i] = seats[j]; seats[j] = tmp;
    }
    /* the open seat: front row, just right of center */
    var you = document.createElementNS(NS, "circle");
    you.setAttribute("class", "seat-you");
    you.setAttribute("cx", CX + 158 * Math.sin(0.18));
    you.setAttribute("cy", CY - 158 * Math.cos(0.18));
    you.setAttribute("r", 6);
    svg.appendChild(you);

    var applyHall = function (force) {
      var p = force;
      if (p === undefined) {
        var rect = hall.getBoundingClientRect();
        var vh = window.innerHeight;
        p = clamp01((vh * 0.92 - rect.top) / (vh * 0.62));
      }
      var lit = Math.round(seats.length * p);
      for (var i = 0; i < seats.length; i++) {
        seats[i].classList.toggle("is-lit", i < lit);
      }
      you.classList.toggle("is-open", p >= 0.97);
    };
    if (reduced) {
      applyHall(1);
    } else {
      var hTick = false;
      window.addEventListener("scroll", function () {
        if (!hTick) {
          hTick = true;
          window.requestAnimationFrame(function () { hTick = false; applyHall(); });
        }
      }, { passive: true });
      applyHall();
    }
  }

  /* ---- 5 · the ribbon ---------------------------------------------------------- */
  var ribbon = document.querySelector("[data-ribbon]");
  if (ribbon) {
    var dismissed = false;
    var close = ribbon.querySelector(".ribbon-close");
    if (close) {
      close.addEventListener("click", function () {
        dismissed = true;
        ribbon.classList.remove("is-up");
      });
    }
    var rTick = false;
    var applyRibbon = function () {
      if (dismissed) return;
      var past = window.pageYOffset > window.innerHeight * 0.9;
      var nearAction = false;
      var action = document.querySelector(".lp-action");
      if (action) {
        nearAction = action.getBoundingClientRect().top < window.innerHeight;
      }
      ribbon.classList.toggle("is-up", past && !nearAction);
    };
    window.addEventListener("scroll", function () {
      if (!rTick) {
        rTick = true;
        window.requestAnimationFrame(function () { rTick = false; applyRibbon(); });
      }
    }, { passive: true });
    applyRibbon();
  }

  /* ---- 6 · dawn scrub (2026 → 2050) ---------------------------------------- */
  var ds = document.querySelector("[data-dawnslider]");
  if (ds) {
    var dInput = ds.querySelector("input[type=range]");
    var corridors = Array.prototype.slice.call(ds.querySelectorAll("[data-t-draw]")).map(function (el) {
      var r = el.getAttribute("data-t-draw").split(/\s+/).map(parseFloat);
      return { el: el, a: r[0] || 0, b: r[1] || 1 };
    });
    var ons = Array.prototype.slice.call(ds.querySelectorAll("[data-t]")).map(function (el) {
      return { el: el, t: parseFloat(el.getAttribute("data-t")) || 0 };
    });
    var lerps = Array.prototype.slice.call(ds.querySelectorAll("[data-lerp-from]")).map(function (el) {
      return {
        el: el,
        from: parseFloat(el.getAttribute("data-lerp-from")),
        to: parseFloat(el.getAttribute("data-lerp-to"))
      };
    });
    var yearOut = ds.querySelector("[data-dawn-year]");

    var applyDawn = function () {
      var p = clamp01((dInput.value - dInput.min) / (dInput.max - dInput.min));
      dInput.style.setProperty("--fill", (p * 100).toFixed(1) + "%");
      if (yearOut) yearOut.textContent = Math.round(2026 + p * 24);
      corridors.forEach(function (c) {
        c.el.style.strokeDashoffset = 1 - seg(p, c.a, c.b);
      });
      ons.forEach(function (o) {
        o.el.classList.toggle("is-on", p >= o.t);
      });
      lerps.forEach(function (l) {
        var v = Math.round(l.from + (l.to - l.from) * p);
        l.el.textContent = v.toLocaleString("en-US");
      });
    };
    dInput.addEventListener("input", applyDawn);
    applyDawn();
  }
})();
