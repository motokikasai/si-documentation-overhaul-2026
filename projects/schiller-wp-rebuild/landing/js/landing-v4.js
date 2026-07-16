/* Schiller Institute — landing pages, v4 series behaviors.
   Loaded AFTER main.js (nav/forms/video), story-v3.js (entrances, ornaments,
   plates, rail, arc) and landing.js (declarative scrub, score player).
   Everything here is declarative and page-agnostic: a module activates only
   if its selector exists, so all five pages share this one file.

   1. Audio director + nowbar — one voice at a time; a persistent gold
      hairline player rises when anything sings. `.is-singing` is mirrored
      onto [data-sing-target] so notation can shimmer with the recording.
   2. Tuning fork — WebAudio tones, no assets (A=440 vs Verdi C=256 ⇒ A≈430.5).
   3. Countdown — [data-countdown] ticks to the next Friday 15:00 UTC.
   4. Tally — [data-count] numbers count up when they arrive (once).
   5. Altimeter — fixed gauge; the dot rides overall page progress.
   6. Starscape — [data-starfield] gets three parallax layers of stars.
   7. Torch — pointer-driven spotlight vars; "strike" button lights it all.
   8. Transit tips — [data-tip] stops raise an engraved tooltip card.
   All motion respects prefers-reduced-motion. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function fmt(s) {
    if (!isFinite(s)) return "0:00";
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  /* ---- 1 · audio director + nowbar -------------------------------------- */
  var nowbar = document.querySelector(".nowbar");
  var audios = Array.prototype.slice.call(
    document.querySelectorAll(".js-score audio, .program-row audio")
  );
  if (audios.length) {
    var nbBtn = nowbar && nowbar.querySelector(".nowbar-btn");
    var nbTitle = nowbar && nowbar.querySelector(".nowbar-title");
    var nbTime = nowbar && nowbar.querySelector(".nowbar-time");
    var nbProg = nowbar && nowbar.querySelector(".nowbar-progress");
    var current = null;

    function boxOf(a) {
      var el = a.parentNode;
      while (el && el !== document &&
             !/\b(js-score|program-row)\b/.test(el.className)) {
        el = el.parentNode;
      }
      return el === document ? null : el;
    }

    audios.forEach(function (audio) {
      var box = boxOf(audio);
      audio.addEventListener("play", function () {
        audios.forEach(function (other) { if (other !== audio) other.pause(); });
        current = audio;
        if (box) box.classList.add("is-playing");
        var singSel = box && box.getAttribute("data-sing-target");
        if (singSel) {
          var t = document.querySelector(singSel);
          if (t) t.classList.add("is-singing");
        }
        if (nowbar) {
          nowbar.classList.add("is-up", "is-playing");
          if (nbTitle && box) {
            var t2 = box.getAttribute("data-title") || "Now playing";
            nbTitle.innerHTML = "";
            nbTitle.appendChild(document.createTextNode(t2));
          }
        }
      });
      audio.addEventListener("pause", function () {
        if (box) box.classList.remove("is-playing");
        var singSel = box && box.getAttribute("data-sing-target");
        if (singSel) {
          var t = document.querySelector(singSel);
          if (t) t.classList.remove("is-singing");
        }
        if (nowbar && current === audio) nowbar.classList.remove("is-playing");
      });
      audio.addEventListener("ended", function () { audio.currentTime = 0; });
      audio.addEventListener("timeupdate", function () {
        if (current !== audio || !nowbar) return;
        if (nbProg && audio.duration) {
          nbProg.style.width = (audio.currentTime / audio.duration) * 100 + "%";
        }
        if (nbTime) {
          nbTime.textContent = fmt(audio.currentTime) +
            (audio.duration ? " / " + fmt(audio.duration) : "");
        }
      });
    });

    if (nbBtn) {
      nbBtn.addEventListener("click", function () {
        if (!current) return;
        if (current.paused) current.play();
        else current.pause();
      });
    }

    /* program rows: the round button drives the row's audio */
    Array.prototype.forEach.call(document.querySelectorAll(".program-row"), function (row) {
      var btn = row.querySelector(".program-btn");
      var audio = row.querySelector("audio");
      if (!btn) return;
      if (row.classList.contains("is-ph") || !audio) {
        btn.setAttribute("aria-disabled", "true");
        return;
      }
      btn.addEventListener("click", function () {
        if (audio.paused) audio.play();
        else audio.pause();
      });
    });
  }

  /* ---- 2 · the tuning fork ---------------------------------------------- */
  var forks = Array.prototype.slice.call(document.querySelectorAll(".tuning-card[data-freq]"));
  if (forks.length && (window.AudioContext || window.webkitAudioContext)) {
    var ctx = null, live = null;
    function stopLive() {
      if (!live) return;
      var l = live;
      live = null;
      l.gain.gain.cancelScheduledValues(ctx.currentTime);
      l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      window.setTimeout(function () { try { l.osc.stop(); } catch (e) {} }, 500);
      l.card.classList.remove("is-sounding");
    }
    forks.forEach(function (card) {
      var btn = card.querySelector(".tuning-btn");
      if (!btn) return;
      btn.addEventListener("click", function () {
        if (live && live.card === card) { stopLive(); return; }
        stopLive();
        if (!ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          ctx = new AC();
        }
        if (ctx.state === "suspended") ctx.resume();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "triangle";  /* softer than sine's lab beep */
        osc.frequency.value = parseFloat(card.getAttribute("data-freq"));
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        live = { osc: osc, gain: gain, card: card };
        card.classList.add("is-sounding");
        window.setTimeout(function () {
          if (live && live.card === card) stopLive();
        }, 3200);
      });
    });
  }

  /* ---- 3 · countdown to Friday 15:00 UTC (11 AM New York, most of the year) */
  var cd = document.querySelector("[data-countdown]");
  if (cd) {
    var segs = {
      d: cd.querySelector("[data-cd=d]"),
      h: cd.querySelector("[data-cd=h]"),
      m: cd.querySelector("[data-cd=m]"),
      s: cd.querySelector("[data-cd=s]")
    };
    var nextFriday = function () {
      var now = new Date();
      var t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
      var add = (5 - t.getUTCDay() + 7) % 7;  /* 5 = Friday */
      t.setUTCDate(t.getUTCDate() + add);
      if (t <= now) t.setUTCDate(t.getUTCDate() + 7);
      return t;
    };
    var target = nextFriday();
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    var tick = function () {
      var ms = target - new Date();
      if (ms < 0) { target = nextFriday(); ms = target - new Date(); }
      var s = Math.floor(ms / 1000);
      if (segs.d) segs.d.textContent = pad(Math.floor(s / 86400));
      if (segs.h) segs.h.textContent = pad(Math.floor(s / 3600) % 24);
      if (segs.m) segs.m.textContent = pad(Math.floor(s / 60) % 60);
      if (segs.s) segs.s.textContent = pad(s % 60);
    };
    tick();
    window.setInterval(tick, 1000);
  }

  /* ---- 4 · tally count-up ------------------------------------------------ */
  var counts = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  if (counts.length) {
    var setFinal = function (el) {
      el.textContent = el.getAttribute("data-count");
    };
    if (reduced || !("IntersectionObserver" in window)) {
      counts.forEach(setFinal);
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          cio.unobserve(en.target);
          var el = en.target;
          var raw = el.getAttribute("data-count");
          var num = parseFloat(raw.replace(/[^0-9.]/g, ""));
          var t0 = null;
          var step = function (ts) {
            if (!t0) t0 = ts;
            var p = clamp01((ts - t0) / 1400);
            var eased = 1 - Math.pow(1 - p, 3);
            var v = Math.round(num * eased);
            el.textContent = raw.replace(/[0-9][0-9,\.]*/, v.toLocaleString("en-US"));
            if (p < 1) window.requestAnimationFrame(step);
            else setFinal(el);
          };
          window.requestAnimationFrame(step);
        });
      }, { threshold: 0.6 });
      counts.forEach(function (el) { cio.observe(el); });
    }
  }

  /* ---- 5 · altimeter ------------------------------------------------------ */
  var alt = document.querySelector(".altimeter");
  if (alt) {
    var dot = alt.querySelector(".alt-dot");
    var labels = Array.prototype.slice.call(alt.querySelectorAll(".alt-label"));
    var railH = function () { return alt.querySelector(".alt-rail").offsetHeight; };
    var updateAlt = function () {
      var doc = document.documentElement;
      var p = clamp01(doc.scrollTop / Math.max(1, doc.scrollHeight - window.innerHeight));
      if (dot) dot.style.top = (p * railH()).toFixed(1) + "px";
      labels.forEach(function (l) {
        var at = parseFloat(l.getAttribute("data-at") || "0");
        l.classList.toggle("is-passed", p >= at - 0.02);
      });
    };
    if (reduced) {
      updateAlt();
      window.addEventListener("scroll", updateAlt, { passive: true });
    } else {
      var altTick = false;
      window.addEventListener("scroll", function () {
        if (!altTick) {
          altTick = true;
          window.requestAnimationFrame(function () { altTick = false; updateAlt(); });
        }
      }, { passive: true });
      updateAlt();
    }
  }

  /* ---- 6 · starscape ------------------------------------------------------ */
  var fields = Array.prototype.slice.call(document.querySelectorAll("[data-starfield]"));
  fields.forEach(function (host) {
    var scape = document.createElement("div");
    scape.className = "starscape";
    scape.setAttribute("aria-hidden", "true");
    var layers = [];
    [{ n: 70, s: 1, v: 0.12 }, { n: 45, s: 1.6, v: 0.28 }, { n: 22, s: 2.2, v: 0.5 }]
      .forEach(function (spec, li) {
        var layer = document.createElement("div");
        layer.className = "star-layer";
        for (var i = 0; i < spec.n; i++) {
          var st = document.createElement("span");
          st.className = "star" + (li === 2 && i % 3 === 0 ? " star--tw" : "");
          var size = spec.s * (0.6 + Math.random() * 0.8);
          st.style.width = st.style.height = size.toFixed(1) + "px";
          st.style.left = (Math.random() * 100).toFixed(2) + "%";
          st.style.top = (Math.random() * 140).toFixed(2) + "%";
          st.style.opacity = (0.25 + Math.random() * 0.6).toFixed(2);
          if (st.className.indexOf("star--tw") >= 0) {
            st.style.animationDelay = (Math.random() * 5).toFixed(2) + "s";
          }
          layer.appendChild(st);
        }
        scape.appendChild(layer);
        layers.push({ el: layer, v: spec.v });
      });
    host.insertBefore(scape, host.firstChild);
    if (!reduced) {
      var sTick = false;
      var drift = function () {
        var y = window.pageYOffset || 0;
        layers.forEach(function (l) {
          l.el.style.transform = "translateY(" + (-y * l.v).toFixed(1) + "px)";
        });
      };
      window.addEventListener("scroll", function () {
        if (!sTick) {
          sTick = true;
          window.requestAnimationFrame(function () { sTick = false; drift(); });
        }
      }, { passive: true });
      drift();
    }
  });

  /* ---- 7 · the torch ------------------------------------------------------ */
  var torch = document.querySelector(".torchlight");
  if (torch) {
    var stage = torch.querySelector(".torch-stage");
    if (stage && !reduced) {
      torch.addEventListener("pointermove", function (e) {
        var r = stage.getBoundingClientRect();
        stage.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        stage.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      });
    }
    var strike = torch.querySelector(".torch-strike");
    if (strike) {
      strike.addEventListener("click", function () {
        torch.classList.toggle("is-lit");
        strike.textContent = torch.classList.contains("is-lit")
          ? "Douse the torch" : "Strike the torch";
      });
    }
  }

  /* ---- 8 · transit tooltips ----------------------------------------------- */
  var panel = document.querySelector(".transit-panel");
  if (panel) {
    var tip = document.createElement("div");
    tip.className = "tr-tipbox";
    tip.setAttribute("role", "status");
    panel.appendChild(tip);
    var stops = Array.prototype.slice.call(panel.querySelectorAll("[data-tip]"));
    var show = function (stop) {
      var strong = document.createElement("strong");
      strong.textContent = stop.getAttribute("data-tip-title") || "";
      tip.innerHTML = "";
      tip.appendChild(strong);
      tip.appendChild(document.createTextNode(stop.getAttribute("data-tip")));
      var status = stop.getAttribute("data-tip-status");
      if (status) {
        var em = document.createElement("em");
        em.textContent = status;
        tip.appendChild(em);
      }
      var pr = panel.getBoundingClientRect();
      var sr = stop.getBoundingClientRect();
      tip.classList.add("is-on");
      var x = sr.left - pr.left + sr.width / 2 + panel.scrollLeft;
      var y = sr.top - pr.top;
      /* place above the stop, clamped to the panel */
      tip.style.left = Math.max(8, Math.min(x - 110, panel.scrollWidth - 260)) + "px";
      tip.style.top = Math.max(8, y - tip.offsetHeight - 16) + "px";
    };
    var hide = function () { tip.classList.remove("is-on"); };
    stops.forEach(function (stop) {
      stop.setAttribute("tabindex", "0");
      stop.addEventListener("mouseenter", function () { show(stop); });
      stop.addEventListener("mouseleave", hide);
      stop.addEventListener("focus", function () { show(stop); });
      stop.addEventListener("blur", hide);
      stop.addEventListener("click", function () { show(stop); });
    });
  }
})();
