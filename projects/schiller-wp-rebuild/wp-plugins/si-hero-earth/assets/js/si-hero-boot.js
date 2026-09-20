/* si/hero-earth — boot gate.
 *
 * This file is printed inline, immediately after the hero's own markup (the
 * block emits a marker and si_hero_earth_inject_boot() swaps this in once
 * the content filters are done), for two reasons:
 *
 *   - a visitor who is never going to get the WebGL scene downloads NOTHING
 *     extra at all: no module, no vendor bundle, no textures, not even this
 *     file as a request;
 *   - and, decisively, IT RUNS BEFORE THE HERO IS FIRST PAINTED. The gate's
 *     answer decides the hero's LAYOUT, so it has to be known before the
 *     browser paints, or the visitor watches the static hero for a second
 *     and a half and then watches it turn into something else. It used to be
 *     printed in the footer: measured on si-v4, `is-live` landed 1.87 s after
 *     first contentful paint and took the document from 1,743 px to 5,304 px
 *     with it. That was the flash, and that was the layout shift.
 *
 * So the gate now does its work in two beats:
 *
 *   ARM  — synchronously, before paint: if the visitor is getting the scene,
 *          add `.is-live` now. The first paint is then already the live
 *          composition (pinned runway, act 0, the poster holding the frame).
 *   LOAD — at idle, as before: import the module, hand it the textures. The
 *          scene fades its canvas in over the poster when it has a complete
 *          frame (`.is-scene`, added by si-hero-scene.js). Nothing moves.
 *
 * If the load beat fails, `fail()` disarms — the hero drops back to the
 * static layout the server rendered. That reflow is the price of guessing
 * early, and it is only paid on a broken page.
 *
 * It is deliberately ES5 and dependency-free. It runs on browsers that
 * cannot parse the scene module, and its whole job on those browsers is to
 * decide "no" and get out of the way.
 *
 * THE GATE. The scene costs ~464 KB (156 KB of gzipped JS and CSS, ~300 KB
 * of textures, 9 KB of poster) and a sustained animation frame budget. That
 * is the right trade on a desktop over fibre and the wrong one on a 3G
 * handset with 1 GB of RAM — and the Schiller Institute's audience includes
 * a great many of the latter.
 * So the default answer is "no" and each check has to be passed, not failed:
 *
 *   1. author opt-out on the block
 *   2. prefers-reduced-motion          — a scrubbed camera is motion
 *   3. Save-Data header / 2G           — never spend a metered megabyte
 *   4. deviceMemory / hardwareConcurrency floors
 *   5. viewport floor                  — below it the globe is thumb-sized
 *      and the static hero says the same thing for 9 KB
 *   6. a real WebGL probe BEFORE arming, so we never commit the layout to a
 *      scene the GPU is going to refuse — and never download 150 KB of
 *      module and vendor bundle to find out. This probe is the one expensive
 *      thing the gate does before paint, and it is why the cheap checks run
 *      first: a refused visitor never reaches it.
 */
(function () {
  "use strict";

  function conn() {
    return (
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null
    );
  }

  /* Why: a WebGLRenderer constructor that throws costs a 150 KB download
   * first. A throwaway 1x1 canvas costs nothing and answers the same
   * question. The context is explicitly released afterwards — some drivers
   * cap the number of live contexts at 8 or 16. */
  function hasWebGL() {
    try {
      var c = document.createElement("canvas");
      var gl =
        c.getContext("webgl2") ||
        c.getContext("webgl") ||
        c.getContext("experimental-webgl");
      if (!gl) return false;
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Read a query param without URLSearchParams, which this file cannot
   * assume on the browsers it exists to serve. */
  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(
      window.location.search
    );
    return m ? decodeURIComponent(m[1]) : null;
  }

  var forced = param("si-hero");

  /* Why an override exists: every check below is a property of the visitor's
   * device, connection or OS settings, so there is no way to exercise the
   * other branch from a developer's own machine short of changing Windows
   * accessibility settings — which is exactly how a first run of this block
   * came back "no animation at all" with nothing obviously wrong.
   *
   *   ?si-hero=live     run the scene, whatever the gate thinks
   *   ?si-hero=static   force the static hero
   *   ?si-hero=debug    log the decision without changing it
   *
   * WebGL is still probed under `live` — forcing cannot conjure a context. */
  function decide(root) {
    var d = root.dataset;

    if (forced === "static") return "forced static (?si-hero=static)";
    if (forced === "live") {
      return hasWebGL() ? null : "no WebGL context (forced live)";
    }

    if (d.siHeroMode === "static") return "author opted out";

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return "prefers-reduced-motion";
    }

    var c = conn();
    if (c) {
      if (c.saveData) return "Save-Data";
      var et = c.effectiveType || "";
      if (et === "slow-2g" || et === "2g") return "effectiveType " + et;
      if (et === "3g" && (navigator.deviceMemory || 8) < 4) {
        return "3g on a low-memory device";
      }
    }

    /* Both are undefined on Safari/Firefox, where we give the benefit of the
     * doubt — the floors exist to catch devices that self-report as weak. */
    if ((navigator.deviceMemory || 8) < 2) return "deviceMemory < 2";
    if ((navigator.hardwareConcurrency || 8) < 4) return "< 4 cores";

    var minW = parseInt(d.siHeroMinWidth, 10) || 768;
    if (window.innerWidth < minW) return "viewport < " + minW + "px";

    if (!hasWebGL()) return "no WebGL context";

    return null; // run it
  }

  /* Wait for the main thread to be free. The poster is the LCP element; the
   * scene must not compete with it. timeout keeps us honest on browsers
   * without requestIdleCallback and on pages that never go idle. */
  function whenIdle(fn) {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 200);
    }
  }

  /* Only upgrade a hero that is actually on screen or about to be. Normally
   * that is immediate (it is the hero), but the block is allowed anywhere. */
  function whenNear(el, fn) {
    if (!window.IntersectionObserver) return fn();
    var io = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          io.disconnect();
          fn();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
  }

  /* WebP is ~60% smaller than JPEG across this texture set, but three.js
   * loads textures through <img>, so the URL has to be chosen here rather
   * than negotiated by the server. Everything with WebGL2 has WebP; Safari
   * 13 and some older Android stock browsers do not, hence the probe. */
  var webpCache = null;
  function hasWebP() {
    if (webpCache !== null) return webpCache;
    try {
      var c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      webpCache = c.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (e) {
      webpCache = false;
    }
    return webpCache;
  }

  /* Commit the layout to the scene, before first paint. From here on the
   * hero is 520vh of pinned runway showing act 0 over the poster — which is
   * what the scene's opening frame looks like, so when the canvas dissolves
   * in nothing on screen moves. */
  function arm(root) {
    root.classList.add("is-live");
    root.dataset.siHeroArmed = "1";
  }

  /* Record why the scene did not start, on the element and (when asked) in
   * the console, and give the static hero back — an armed hero with no scene
   * shows one act out of four and pins 520vh of runway to do it, which is
   * precisely the animation-first failure this block exists to avoid.
   *
   * Every failure path below used to `return` silently, which is how a
   * broken import came back indistinguishable from a healthy page: the gate
   * had already logged "running the scene" before any of this ran. A
   * decision log that stops before the decisive step is worse than none. */
  function fail(root, reason, detail) {
    root.dataset.siHeroFallback = reason;
    if (root.dataset.siHeroArmed) {
      delete root.dataset.siHeroArmed;
      root.classList.remove("is-live", "is-scene");
    }
    if (forced && window.console && console.error) {
      console.error("[si-hero] scene did not start: " + reason, detail || "");
    }
  }

  /* Under ?si-hero=..., say plainly whether the two files are reachable and
   * being served as JavaScript. A module that 404s, or that arrives as
   * text/html because a rewrite rule swallowed it, fails in exactly the same
   * silent way — and the difference decides what to go and fix. */
  function probeUrl(url) {
    if (!window.fetch) return;
    fetch(url, { method: "GET" })
      .then(function (r) {
        console.info(
          "[si-hero] " + r.status + " " +
            (r.headers.get("content-type") || "?") + "  " + url
        );
      })
      .catch(function (e) {
        console.error("[si-hero] could not fetch " + url, e);
      });
  }

  function upgrade(root) {
    var cfgEl = root.querySelector(".si-hero__config");
    if (!cfgEl) {
      return fail(root, "config element missing");
    }
    var cfg;
    try {
      cfg = JSON.parse(cfgEl.textContent);
    } catch (e) {
      return fail(root, "config unparseable", e);
    }

    cfg.tex = hasWebP() ? cfg.texWebp : cfg.texJpg;

    /* The high-res night map is a second 171 KB. Only fast, unmetered,
     * wide viewports are offered it; everyone else keeps the 2K map, which
     * is what the scene paints with from the first frame anyway. */
    var c = conn();
    var fast = !c || (c.effectiveType === "4g" && !c.saveData);
    if (!fast || window.innerWidth < 1200) cfg.tex.nightHi = null;

    /* Resolve against the DOCUMENT, not against whatever file this code is
     * running from. A bare import() resolves relative URLs against the
     * importing script's base, which is the plugin's /assets/js/ directory
     * when this runs as a file and the page when it runs inlined — two
     * different answers for the same config. */
    var moduleUrl = cfg.module;
    try {
      moduleUrl = new URL(cfg.module, document.baseURI).href;
    } catch (e) {
      /* keep cfg.module as-is */
    }

    if (forced && window.console && console.info) {
      console.info("[si-hero] importing " + moduleUrl);
      probeUrl(moduleUrl);
      probeUrl(moduleUrl.replace(/\/js\/[^/?]+/, "/vendor/three-slim.js"));
    }

    /* A request that hangs neither resolves nor rejects, and the browser's
     * own timeout is minutes away. Since we armed the layout on a guess, we
     * have to be able to take the guess back: if the scene is not running by
     * then, the visitor gets the static hero. A very late success is still
     * allowed to arm again — two reflows on a broken network beat a hero
     * stuck at one act out of four. */
    var started = false;
    var watchdog = setTimeout(function () {
      if (!started) fail(root, "scene did not start within 12s");
    }, 12000);

    import(moduleUrl)
      .then(function (m) {
        if (typeof m.initHero !== "function") {
          return fail(root, "module has no initHero export");
        }
        if (!m.initHero(root, cfg)) {
          return fail(root, "WebGL context refused by the scene");
        }
        started = true;
        clearTimeout(watchdog);
        if (forced && window.console && console.info) {
          console.info("[si-hero] scene running");
        }
      })
      .catch(function (e) {
        /* Module blocked, 404, wrong MIME type, or a parse error on an
         * older engine. Disarm: the static hero is what the server rendered
         * and it is complete. */
        fail(root, "module failed: " + (e && e.message ? e.message : e), e);
      });
  }

  function start(root) {
    /* This file runs once per page but is printed by the first hero on it,
     * so it also sweeps at DOMContentLoaded for any hero further down. */
    if (root.dataset.siHeroDecided) return;
    root.dataset.siHeroDecided = "1";

    var no = decide(root);
    /* Quiet by default: the reason is always on the element as
     * data-si-hero-fallback, which is enough to debug from the DOM. Only
     * speak up when someone has asked, so a production page stays silent. */
    if (forced && window.console && console.info) {
      console.info(
        "[si-hero] " +
          (no ? "static: " + no : "running the scene") +
          " | " + window.innerWidth + "px" +
          " | mem " + (navigator.deviceMemory || "?") +
          " | cores " + (navigator.hardwareConcurrency || "?") +
          " | conn " + ((conn() || {}).effectiveType || "?") +
          " | webp " + hasWebP()
      );
    }
    if (no) {
      root.dataset.siHeroFallback = no;
      return;
    }

    arm(root);
    whenNear(root, function () {
      whenIdle(function () {
        upgrade(root);
      });
    });
  }

  function boot() {
    var roots = document.querySelectorAll(".si-hero[data-si-hero]");
    Array.prototype.forEach.call(roots, start);
  }

  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
