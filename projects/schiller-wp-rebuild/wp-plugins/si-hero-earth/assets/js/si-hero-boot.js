/* si/hero-earth — boot gate.
 *
 * This file is printed inline in the footer (it is ~2 KB) so that a visitor
 * who is never going to get the WebGL scene downloads NOTHING extra at all:
 * no module, no vendor bundle, no textures, not even this file as a request.
 *
 * It is deliberately ES5 and dependency-free. It runs on browsers that
 * cannot parse the scene module, and its whole job on those browsers is to
 * decide "no" and get out of the way.
 *
 * THE GATE. The scene costs ~433 KB (133 KB gzipped JS + ~300 KB textures)
 * and a sustained animation frame budget. That is the right trade on a
 * desktop over fibre and the wrong one on a 3G handset with 1 GB of RAM —
 * and the Schiller Institute's audience includes a great many of the latter.
 * So the default answer is "no" and each check has to be passed, not failed:
 *
 *   1. author opt-out on the block
 *   2. prefers-reduced-motion          — a scrubbed camera is motion
 *   3. Save-Data header / 2G           — never spend a metered megabyte
 *   4. deviceMemory / hardwareConcurrency floors
 *   5. viewport floor                  — below it the globe is thumb-sized
 *      and the static hero says the same thing for 9 KB
 *   6. a real WebGL probe BEFORE the import, so we never download 133 KB to
 *      discover the context was refused
 *
 * Then, having said yes, it still waits for idle so the scene never competes
 * with the poster for LCP, and it still degrades to the static hero if the
 * import or the context fails late.
 */
(function () {
  "use strict";

  var roots = document.querySelectorAll(".si-hero[data-si-hero]");
  if (!roots.length) return;

  function conn() {
    return (
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null
    );
  }

  /* Why: a WebGLRenderer constructor that throws costs a 133 KB download
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

  function upgrade(root) {
    var cfgEl = root.querySelector(".si-hero__config");
    if (!cfgEl) return;
    var cfg;
    try {
      cfg = JSON.parse(cfgEl.textContent);
    } catch (e) {
      return;
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
     * different answers for the same config. WordPress passes an absolute
     * URL and would not have noticed; the preview harness does, and so
     * would any future move of this file. */
    var moduleUrl = cfg.module;
    try {
      moduleUrl = new URL(cfg.module, document.baseURI).href;
    } catch (e) {
      /* keep cfg.module as-is */
    }

    import(moduleUrl)
      .then(function (m) {
        if (!m.initHero(root, cfg)) {
          root.dataset.siHeroFallback = "context-refused";
        }
      })
      .catch(function () {
        /* Module blocked, 404, or a parse error on an older engine. The
         * static hero is already on screen and stays there. */
        root.dataset.siHeroFallback = "module-failed";
      });
  }

  Array.prototype.forEach.call(roots, function (root) {
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
    whenNear(root, function () {
      whenIdle(function () {
        upgrade(root);
      });
    });
  });
})();
