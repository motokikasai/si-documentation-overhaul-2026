/* Schiller Institute — archive wing, shared layer.
   Loaded AFTER main.js / story-v3.js / landing.js and conferences-data.js.
   One record set (window.SI_CONFERENCES) → three renderings:

     [data-rooms]      the gallery's era rooms with framed engravings
     [data-programme]  the playbill deck (acts oldest-first)
     [data-index]      the utility index on the stock shelf pattern

   Plus the vanilla behaviors: the cursor-lantern + frame heat (gallery),
   the fixed year spine, touch/reduced-motion equivalents, and the vitals
   count-up. WebGL lives in conf-firmament.js; GSAP in conf-playbill.js. */
(function () {
  "use strict";

  var ERAS = window.SI_ERAS || [];
  var CONFS = window.SI_CONFERENCES || [];
  if (!CONFS.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var noHover = window.matchMedia("(hover: none)").matches;
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function watchUrl(c) {
    return c.pl ? "https://www.youtube.com/playlist?list=" + c.pl : null;
  }
  function byEra(key) {
    return CONFS.filter(function (c) { return c.era === key; });
  }

  /* ---- entrances for generated .fx elements (story-v3 ran already) ------- */
  function armFx(scope) {
    var els = Array.prototype.slice.call(scope.querySelectorAll(".fx:not(.is-in)"));
    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ======================================================================
     Rendering
     ====================================================================== */

  function makeFrame(c) {
    var art = el("article", "frame fx");
    if (c.next) art.classList.add("frame--next");
    if (c.print) art.classList.add("frame--print");
    art.setAttribute("data-year", c.y);

    var url = watchUrl(c);
    var canvas = el(url ? "a" : "span", "frame-canvas");
    if (url) {
      canvas.href = url;
      canvas.target = "_blank";
      canvas.rel = "noopener";
      canvas.setAttribute("aria-label", "Watch “" + c.title + "” on YouTube");
    }
    if (c.next) {
      canvas.appendChild(el("span", "frame-reserved", "Reserved · the next conference"));
    } else {
      var laurel = el("img", "frame-laurel");
      laurel.src = "assets/img/laurel-divider.svg";
      laurel.alt = "";
      laurel.loading = "lazy";
      canvas.appendChild(laurel);
    }
    canvas.appendChild(el("span", "frame-year", String(c.yl || c.y)));
    canvas.appendChild(el("span", "frame-glint"));
    art.appendChild(canvas);

    var placard = el("div", "placard");
    placard.appendChild(el("p", "placard-when", c.when + (c.place ? " · " + c.place : "")));
    var h = el("h3", "placard-title");
    if (url) {
      var ta = el("a", null, c.title);
      ta.href = url; ta.target = "_blank"; ta.rel = "noopener";
      h.appendChild(ta);
    } else {
      h.textContent = c.title;
    }
    placard.appendChild(h);
    if (c.note) placard.appendChild(el("p", "placard-note", c.note));
    var act = el("p", "placard-act");
    if (c.next) {
      var reg = el("a", null, "Register free →");
      reg.href = "#involved";
      act.appendChild(reg);
    } else if (url) {
      var wa = el("a", null, "Watch the sessions →");
      wa.href = url; wa.target = "_blank"; wa.rel = "noopener";
      act.appendChild(wa);
    } else {
      act.appendChild(el("span", "placard-held", c.print ? "Proceedings in print" : "Reel in restoration"));
    }
    placard.appendChild(act);
    art.appendChild(placard);
    return art;
  }

  function buildRooms(host) {
    ERAS.forEach(function (era, i) {
      var confs = byEra(era.key);
      if (!confs.length) return;
      var room = el("section", "room" + (era.key === "print" ? " room--print" : ""));
      room.setAttribute("data-era", era.key);
      room.appendChild(el("span", "room-lantern")).setAttribute("aria-hidden", "true");

      var wrap = el("div", "wrap");
      var head = el("header", "room-head fx");
      var eraLine = el("p", "room-era");
      eraLine.appendChild(document.createTextNode("Room"));
      eraLine.appendChild(el("span", "room-numeral", ROMAN[i] || String(i + 1)));
      head.appendChild(eraLine);
      head.appendChild(el("h2", "room-name", era.name));
      head.appendChild(el("p", "room-range", era.range));
      head.appendChild(el("p", "room-line", era.line));
      wrap.appendChild(head);

      var frames = el("div", "frames");
      confs.forEach(function (c) { frames.appendChild(makeFrame(c)); });
      wrap.appendChild(frames);
      room.appendChild(wrap);
      host.appendChild(room);
    });
  }

  function buildIndex(host) {
    ERAS.forEach(function (era) {
      var confs = byEra(era.key);
      if (!confs.length) return;
      var head = el("div", "shelf-era fx");
      var h3 = el("h3", null, era.name);
      head.appendChild(h3);
      head.appendChild(el("span", null, era.range));
      host.appendChild(head);

      confs.forEach(function (c) {
        var url = c.next ? "#involved" : watchUrl(c);
        var row = el(url ? "a" : "div", "shelf-row fx");
        if (url) {
          row.href = url;
          if (!c.next) { row.target = "_blank"; row.rel = "noopener"; }
        }
        row.appendChild(el("span", "shelf-type", c.next ? "Next" : String(c.y)));
        var body = el("span", "shelf-body");
        body.appendChild(el("strong", null, c.title));
        var meta = c.when + (c.place ? " · " + c.place : "");
        if (!url) meta += c.print ? " · proceedings in print" : " · reel in restoration";
        body.appendChild(el("em", null, meta));
        row.appendChild(body);
        host.appendChild(row);
      });
    });
  }

  function buildProgramme(host) {
    var acts = ERAS.slice().reverse(); /* a programme reads forward in time */
    acts.forEach(function (era, i) {
      var confs = byEra(era.key).slice().reverse();
      if (!confs.length) return;
      var bill = el("section", "playbill");
      bill.setAttribute("data-era", era.key);
      var sheet = el("div", "pb-sheet");

      var head = el("header", "pb-head");
      head.appendChild(el("p", "pb-act", "Act " + (ROMAN[i] || i + 1)));
      head.appendChild(el("h2", "pb-era", era.name));
      head.appendChild(el("p", "pb-range", era.range));
      head.appendChild(el("p", "pb-line", era.line));
      sheet.appendChild(head);

      var rows = el("div", "pb-rows" + (confs.length > 6 ? " pb-rows--2col" : ""));
      confs.forEach(function (c, j) {
        var url = c.next ? "#involved" : watchUrl(c);
        var row = el(url ? "a" : "div", "pb-row");
        if (url) {
          row.href = url;
          if (!c.next) { row.target = "_blank"; row.rel = "noopener"; }
        }
        row.appendChild(el("span", "pb-no", String(j + 1) + "."));
        var body = el("span", "pb-body");
        body.appendChild(el("strong", null, c.title));
        body.appendChild(el("em", null, c.when + (c.place ? " · " + c.place : "")));
        row.appendChild(body);
        if (url) row.appendChild(el("span", "pb-go", c.next ? "Register →" : "→"));
        rows.appendChild(row);
      });
      sheet.appendChild(rows);

      if (era.key === "print") {
        sheet.appendChild(el("p", "pb-foot", "The season is longer than the film archive — digitization queued"));
      }
      if (era.key === "paradigm") {
        sheet.appendChild(el("p", "pb-foot", "The programme continues · your seat is row one"));
      }
      bill.appendChild(sheet);
      host.appendChild(bill);
    });
  }

  var roomsHost = document.querySelector("[data-rooms]");
  var indexHost = document.querySelector("[data-index]");
  var progHost = document.querySelector("[data-programme]");
  if (roomsHost) { buildRooms(roomsHost); armFx(roomsHost); }
  if (indexHost) { buildIndex(indexHost); armFx(indexHost); }
  if (progHost) buildProgramme(progHost); /* entrances are GSAP's job there */

  /* ======================================================================
     The lantern + frame heat (gallery, pointer devices)
     ====================================================================== */
  if (roomsHost && !reduced && !noHover) {
    Array.prototype.forEach.call(roomsHost.querySelectorAll(".room"), function (room) {
      var lantern = room.querySelector(".room-lantern");
      var frames = Array.prototype.slice.call(room.querySelectorAll(".frame"));
      var raf = null, px = 0, py = 0;

      function paint() {
        raf = null;
        var r = room.getBoundingClientRect();
        lantern.style.setProperty("--lx", (px - r.left) + "px");
        lantern.style.setProperty("--ly", (py - r.top) + "px");
        frames.forEach(function (f) {
          var fr = f.getBoundingClientRect();
          var cx = fr.left + fr.width / 2;
          var cy = fr.top + fr.height / 2;
          var d = Math.hypot(px - cx, py - cy);
          var heat = Math.pow(clamp01(1 - d / 360), 1.25);
          f.style.setProperty("--heat", heat.toFixed(3));
        });
      }
      room.addEventListener("pointermove", function (e) {
        px = e.clientX; py = e.clientY;
        if (!raf) raf = window.requestAnimationFrame(paint);
      });
      room.addEventListener("pointerenter", function () { room.classList.add("is-lit"); });
      room.addEventListener("pointerleave", function () {
        room.classList.remove("is-lit");
        frames.forEach(function (f) { f.style.setProperty("--heat", "0"); });
      });
    });
  }
  /* Touch: light each frame as it passes the center band of the screen */
  if (roomsHost && !reduced && noHover && "IntersectionObserver" in window) {
    var lightIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("is-lit", entry.isIntersecting);
      });
    }, { rootMargin: "-32% 0px -32% 0px" });
    Array.prototype.forEach.call(roomsHost.querySelectorAll(".frame"), function (f) {
      lightIO.observe(f);
    });
  }

  /* ======================================================================
     The year spine (gallery, wide screens)
     ====================================================================== */
  var spine = document.querySelector(".yearspine");
  if (roomsHost && spine && !reduced) {
    var ysYear = spine.querySelector(".ys-year");
    var ysNode = spine.querySelector(".ys-node");
    var framesAll = Array.prototype.slice.call(roomsHost.querySelectorAll(".frame[data-year]"));
    var spineTick = false;

    function spinePaint() {
      spineTick = false;
      var vh = window.innerHeight;
      var rect = roomsHost.getBoundingClientRect();
      var live = rect.top < vh * 0.55 && rect.bottom > vh * 0.45;
      spine.classList.toggle("is-live", live);
      if (!live) return;
      var p = clamp01((vh * 0.5 - rect.top) / rect.height);
      ysNode.style.top = (p * 100) + "%";
      var best = null, bestD = Infinity;
      framesAll.forEach(function (f) {
        var fr = f.getBoundingClientRect();
        var d = Math.abs(fr.top + fr.height / 2 - vh * 0.5);
        if (d < bestD) { bestD = d; best = f; }
      });
      if (best) ysYear.textContent = best.getAttribute("data-year");
    }
    window.addEventListener("scroll", function () {
      if (!spineTick) { spineTick = true; window.requestAnimationFrame(spinePaint); }
    }, { passive: true });
    window.addEventListener("resize", spinePaint);
    spinePaint();
  }

  /* ======================================================================
     Vitals count-up
     ====================================================================== */
  var tallies = Array.prototype.slice.call(document.querySelectorAll("[data-tally]"));
  if (tallies.length) {
    var run = function (n) {
      var target = parseInt(n.getAttribute("data-tally"), 10) || 0;
      if (reduced) { n.textContent = target; return; }
      var t0 = null;
      var step = function (t) {
        if (!t0) t0 = t;
        var p = clamp01((t - t0) / 1300);
        n.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window && !reduced) {
      var tio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { run(entry.target); tio.unobserve(entry.target); }
        });
      }, { threshold: 0.6 });
      tallies.forEach(function (n) { tio.observe(n); });
    } else {
      tallies.forEach(run);
    }
  }
})();
