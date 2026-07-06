/* Schiller Institute — landing-page additions.
   Loaded AFTER ../homepage-draft/js/main.js (header/nav/forms/video) and
   ../homepage-draft/js/story-v3.js (entrances, ornaments, plates, timeline
   rail, signature arc). Adds only the landing-only behaviors:

   1. Declarative SVG scrub — any [data-scrub] container: child paths with
      data-draw="a b" (and pathLength="1") draw across that share of the
      container's viewport progress; elements with data-on="t" appear at
      that threshold. Scrubbed both directions, like everything else.
   2. The score player — play/pause, gold hairline progress, click-to-seek.
*/
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }

  /* ---- 1 · declarative SVG scrub ---------------------------------------- */
  var scrubbed = Array.prototype.slice.call(document.querySelectorAll("[data-scrub]"));
  if (scrubbed.length) {
    var items = scrubbed.map(function (el) {
      /* optional data-scrub="startFrac endFrac" (of viewport height) */
      var range = (el.getAttribute("data-scrub") || "").split(/\s+/).map(parseFloat);
      return {
        el: el,
        startF: isFinite(range[0]) ? range[0] : 0.92,
        endF: isFinite(range[1]) ? range[1] : 0.42,
        draws: Array.prototype.slice.call(el.querySelectorAll("[data-draw]")).map(function (d) {
          var r = d.getAttribute("data-draw").split(/\s+/).map(parseFloat);
          return { el: d, a: r[0] || 0, b: r[1] || 1 };
        }),
        ons: Array.prototype.slice.call(el.querySelectorAll("[data-on]")).map(function (o) {
          return { el: o, t: parseFloat(o.getAttribute("data-on")) || 0 };
        })
      };
    });

    var apply = function (item, force) {
      var p = force;
      if (p === undefined) {
        var top = item.el.getBoundingClientRect().top;
        var vh = window.innerHeight;
        p = clamp01((vh * item.startF - top) / (vh * (item.startF - item.endF)));
      }
      item.draws.forEach(function (d) {
        d.el.style.strokeDashoffset = 1 - seg(p, d.a, d.b);
      });
      item.ons.forEach(function (o) {
        o.el.classList.toggle("is-on", p >= o.t);
      });
    };

    if (reduced) {
      items.forEach(function (it) { apply(it, 1); });
    } else {
      var ticking = false;
      var onScroll = function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(function () {
            ticking = false;
            items.forEach(function (it) { apply(it); });
          });
        }
      };
      items.forEach(function (it) { apply(it); });
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      window.addEventListener("load", onScroll);
    }
  }

  /* ---- 2 · the score player --------------------------------------------- */
  function fmt(s) {
    if (!isFinite(s)) return "0:00";
    var m = Math.floor(s / 60);
    var r = Math.floor(s % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }
  Array.prototype.forEach.call(document.querySelectorAll(".js-score"), function (box) {
    var audio = box.querySelector("audio");
    var btn = box.querySelector(".score-btn");
    var rail = box.querySelector(".score-rail");
    var bar = box.querySelector(".score-progress");
    var time = box.querySelector(".js-time");
    if (!audio || !btn) return;

    btn.addEventListener("click", function () {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    audio.addEventListener("play", function () { box.classList.add("is-playing"); });
    audio.addEventListener("pause", function () { box.classList.remove("is-playing"); });
    audio.addEventListener("ended", function () {
      box.classList.remove("is-playing");
      audio.currentTime = 0;
    });
    audio.addEventListener("timeupdate", function () {
      if (bar && audio.duration) {
        bar.style.width = (audio.currentTime / audio.duration) * 100 + "%";
      }
      if (time) time.textContent = fmt(audio.currentTime);
    });
    if (rail) {
      rail.addEventListener("click", function (e) {
        if (!audio.duration) return;
        var r = rail.getBoundingClientRect();
        audio.currentTime = clamp01((e.clientX - r.left) / r.width) * audio.duration;
      });
    }
  });
})();
