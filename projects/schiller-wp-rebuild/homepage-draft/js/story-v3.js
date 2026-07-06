/* Schiller Institute — v3 story layer.
   The gold-line motif is punctuation, not a page-long object — and every
   piece of it is scrubbed by the scroll, in both directions:
   · bridge ornaments under section titles draw pier-by-pier with the scroll,
   · the stations connector sweeps across, lighting I → II → III in sequence,
   · plates warm from engraving to color as they reach mid-viewport,
   · the timeline rail draws with the scroll and lights each epoch,
   · the convergence arc draws toward the visitor's ring — which is lit
     only by an action (signup/donate), never by scrolling.
   Loaded by index-v3.html only; main.js still owns nav/video/signup. */
(function () {
  "use strict";

  var story = document.querySelector(".story");
  if (!story) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  /* Progress of p through the sub-range [a, b] */
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  /* 0 → 1 as el's top travels from startF to endF of the viewport height
     (e.g. 0.95 → 0.5: starts as the element enters, completes at center). */
  function progressOf(el, startF, endF) {
    var top = el.getBoundingClientRect().top;
    var vh = window.innerHeight;
    return clamp01((vh * startF - top) / (vh * (startF - endF)));
  }

  /* ---- entrances --------------------------------------------------------- */
  var fxEls = Array.prototype.slice.call(document.querySelectorAll(".fx"));
  if (reduced || !hasIO) {
    fxEls.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
    fxEls.forEach(function (el) { io.observe(el); });
  }

  /* ---- scroll-scrubbed pieces --------------------------------------------
     Each item is a function that reads its own viewport progress and
     applies it; `1` is forced when motion is reduced. ------------------- */
  var scrubs = [];

  /* Bridge ornaments: span I draws, pier II fills, span II draws, pier III */
  Array.prototype.forEach.call(document.querySelectorAll(".head-ornament"), function (orn) {
    var paths = orn.querySelectorAll("path");
    var dots = orn.querySelectorAll("circle");
    var dotAt = [0.04, 0.5, 0.98];
    scrubs.push(function (force) {
      var p = force !== undefined ? force : progressOf(orn, 0.95, 0.55);
      if (paths[0]) paths[0].style.strokeDashoffset = 1 - seg(p, 0.02, 0.5);
      if (paths[1]) paths[1].style.strokeDashoffset = 1 - seg(p, 0.5, 0.98);
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle("is-on", p >= dotAt[i]);
      }
    });
  });

  /* Stations: the connector sweeps with the reading pen (72% of the
     viewport, same as the timeline rail) and each numeral lights when the
     tip reaches its own measured position along the connector's axis —
     horizontal on desktop, vertical on mobile. One rule, both layouts:
     a numeral can only light while it is actually on screen. */
  var stations = document.querySelector(".stations");
  if (stations) {
    var nums = Array.prototype.slice.call(stations.querySelectorAll(".station-numeral"));
    scrubs.push(function (force) {
      var r = stations.getBoundingClientRect();
      var p = force !== undefined
        ? force
        : clamp01((window.innerHeight * 0.72 - r.top) / Math.max(1, r.height));
      stations.style.setProperty("--line-p", p.toFixed(4));
      var horizontal = r.width > r.height;
      for (var i = 0; i < nums.length; i++) {
        var nr = nums[i].getBoundingClientRect();
        var t = horizontal
          ? (nr.left + nr.width / 2 - r.left) / Math.max(1, r.width)
          : (nr.top + nr.height / 2 - r.top) / Math.max(1, r.height);
        nums[i].classList.toggle("is-on", p >= t);
      }
    });
  }

  /* The voyage: port → through the ring (nadir, ~46% of arc length) → the
     star kindles on arrival. The wet-ink tip is a dash window positioned
     just behind the draw front, hidden before departure and on arrival. */
  var you = document.querySelector(".you-node");
  if (you) {
    var yaLine = you.querySelector(".ya-line");
    var yaTip = you.querySelector(".ya-tip");
    var yaPort = you.querySelector(".ya-port");
    var yaStar = you.querySelector(".ya-star");
    var yaYou = you.querySelector(".ya-you");
    scrubs.push(function (force) {
      var p = force !== undefined ? force : progressOf(you, 0.98, 0.6);
      var d = seg(p, 0.06, 0.92);
      if (yaLine) yaLine.style.strokeDashoffset = 1 - d;
      if (yaTip) {
        yaTip.style.strokeDashoffset = 0.045 - d;
        yaTip.style.opacity = d > 0.05 && d < 0.93 ? 1 : 0;
      }
      if (yaPort) yaPort.classList.toggle("is-on", p >= 0.06);
      if (yaStar) yaStar.classList.toggle("is-on", d >= 0.99);
      if (yaYou) yaYou.classList.toggle("is-passed", d >= 0.46);
    });
  }

  /* Timeline rail: drawn a little ahead of the reading line (70% vh),
     lighting each epoch node it passes. */
  var epochs = document.querySelector(".epochs");
  if (epochs) {
    var nodes = Array.prototype.slice.call(epochs.querySelectorAll("[data-node]"));
    scrubs.push(function (force) {
      var top = epochs.getBoundingClientRect().top;
      var pen = force !== undefined
        ? epochs.offsetHeight
        : window.innerHeight * 0.7 - top;
      var p = clamp01(pen / Math.max(1, epochs.offsetHeight));
      epochs.style.setProperty("--rail-p", p.toFixed(4));
      for (var i = 0; i < nodes.length; i++) {
        var nTop = nodes[i].getBoundingClientRect().top - top;
        nodes[i].classList.toggle("is-lit", pen >= nTop + 6);
      }
    });
  }

  function runScrubs(force) {
    for (var i = 0; i < scrubs.length; i++) scrubs[i](force);
  }

  if (reduced) {
    runScrubs(1);
  } else {
    var ticking = false;
    var onScroll = function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(function () {
          ticking = false;
          runScrubs();
        });
      }
    };
    runScrubs();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("load", function () { runScrubs(); });
  }

  /* ---- plates: engraving ⇄ color at mid-viewport (hysteresis) ----------- */
  var plates = Array.prototype.slice.call(document.querySelectorAll(".plate"));
  if (reduced || !hasIO) {
    plates.forEach(function (p) { p.classList.add("is-color"); });
  } else {
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var plate = en.target.parentNode;
        while (plate && plate !== document && !/\bplate\b/.test(plate.className)) {
          plate = plate.parentNode;
        }
        if (!plate || plate === document) return;
        if (en.intersectionRatio >= 0.6) plate.classList.add("is-color");
        else if (en.intersectionRatio <= 0.25) plate.classList.remove("is-color");
      });
    }, { threshold: [0.25, 0.6] });
    plates.forEach(function (p) {
      var media = p.querySelector(".plate-media");
      if (media) pio.observe(media);
    });
  }

  /* ---- the visitor's node: lit by an action, never by scroll ------------
     Acting hides the form (main.js), which shifts layout without a scroll
     event — so re-sync the scrubs on the next frame. */
  function lightYou() {
    if (you) you.classList.add("is-lit");
    window.requestAnimationFrame(function () {
      runScrubs(reduced ? 1 : undefined);
    });
  }
  function watchForm(form) {
    form.addEventListener("submit", function () {
      var input = form.querySelector("input[type=email]");
      if (input && input.value.indexOf("@") > 0) lightYou();
    });
  }
  var ladder = document.getElementById("involved");
  if (ladder) {
    Array.prototype.forEach.call(ladder.querySelectorAll(".js-signup"), watchForm);
    Array.prototype.forEach.call(ladder.querySelectorAll(".js-donate"), function (btn) {
      btn.addEventListener("click", lightYou);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".hero .js-signup"), watchForm);
})();
