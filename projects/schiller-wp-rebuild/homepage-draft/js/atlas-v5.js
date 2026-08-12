/* ==========================================================================
   Schiller Institute — homepage draft v5
   THE ATLAS — a scroll-driven engraved plate of the World Land-Bridge.

   Why not WebGL. The hero already spends its budget on a globe; repeating
   the trick below it would be decoration, and the handoff is explicit that
   nothing here decorates. This section wants a different job done: hold two
   registers side by side — what was proposed, dated, and what third parties
   record as built — and let the reader interrogate either one. A flat
   equirectangular plate does that better than a sphere, because on a sphere
   half the evidence is always facing away.

   So: SVG over the two NASA equirectangular textures the hero already
   loads (cached, no new bytes), filtered into a printed plate. Total added
   weight is this file. Everything scrubs in both directions and lands in
   its final state under prefers-reduced-motion.

   Projection: equirectangular, matching the 2048×1024 source plates.
       x = (lon + 180) / 360 * 2048
       y = (90  - lat) / 180 * 1024
   ========================================================================== */

(function () {
  "use strict";

  var D = window.SI_V5;
  if (!D) return;

  var root = document.querySelector(".f-atlas");
  if (!root) return;

  var run = root.querySelector(".f-atlas-run");
  var svg = root.querySelector(".f-atlas-svg");
  var gGrat = svg.querySelector(".f-graticule");
  var gLines = svg.querySelector(".f-lines");
  var gNodes = svg.querySelector(".f-nodes");
  var defs = svg.querySelector("defs");
  var plate = root.querySelector(".f-plate");
  var imgLand = svg.querySelector(".f-plate-land");
  var imgLights = svg.querySelector(".f-plate-lights");
  var dossier = root.querySelector(".f-dossier-body");
  var selBox = root.querySelector(".f-dossier-sel");
  var indexBtns = [].slice.call(root.querySelectorAll(".f-plate-index button"));
  var regBtns = [].slice.call(root.querySelectorAll(".f-plate-reg button"));
  var scaleLabel = root.querySelector(".f-plate-scale");

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var MAP_W = 2048;
  var MAP_H = 1024;
  var ACTS = D.ACTS;

  /* ------------------------------------------------------------------
     Projection + path geometry
     ------------------------------------------------------------------ */
  function project(key) {
    var p = D.PLACES[key];
    if (!p) return null;
    return [((p[1] + 180) / 360) * MAP_W, ((90 - p[0]) / 180) * MAP_H];
  }

  /* A corridor is bowed off its chord, then smoothed. On a flat plate a
     dead-straight line between two capitals reads as a schematic; a slight
     bow reads as a route, which is what these are. */
  function bowed(points, bow) {
    if (points.length < 2 || !bow) return points;
    var a = points[0];
    var b = points[points.length - 1];
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    var amp = bow * len * 0.5;
    return points.map(function (pt, i) {
      var t = i / (points.length - 1);
      var k = Math.sin(Math.PI * t);
      return [pt[0] + nx * amp * k, pt[1] + ny * amp * k];
    });
  }

  /* Catmull-Rom → cubic bezier, so the corridor reads as one drawn line
     rather than a chain of segments. */
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    if (pts.length === 2) {
      return "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1) +
             "L" + pts[1][0].toFixed(1) + "," + pts[1][1].toFixed(1);
    }
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + c1x.toFixed(1) + "," + c1y.toFixed(1) +
           " " + c2x.toFixed(1) + "," + c2y.toFixed(1) +
           " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (var k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* ------------------------------------------------------------------
     Build: graticule
     ------------------------------------------------------------------ */
  (function graticule() {
    var i;
    for (i = -180; i <= 180; i += 20) {
      var x = ((i + 180) / 360) * MAP_W;
      gGrat.appendChild(
        svgEl("line", {
          x1: x, y1: 0, x2: x, y2: MAP_H,
          class: i === 0 ? "is-major" : null,
          "vector-effect": "non-scaling-stroke"
        })
      );
    }
    for (i = -80; i <= 80; i += 20) {
      var y = ((90 - i) / 180) * MAP_H;
      gGrat.appendChild(
        svgEl("line", {
          x1: 0, y1: y, x2: MAP_W, y2: y,
          class: i === 0 ? "is-major" : null,
          "vector-effect": "non-scaling-stroke"
        })
      );
    }
  })();

  /* ------------------------------------------------------------------
     Build: corridors.

     Each corridor gets a mask whose stroked copy of the same path grows
     from 0 to 1. That keeps the *visible* path free to carry its own dash
     pattern (dashed = proposed, solid = built) — a draw animation done with
     the visible path's own dasharray would have to give the pattern up.
     ------------------------------------------------------------------ */
  var actIndexOf = {};
  ACTS.forEach(function (a, i) { actIndexOf[a.id] = i; });

  var corridors = [];

  D.CORRIDORS.forEach(function (c, n) {
    var pts = c.path.map(project).filter(Boolean);
    if (pts.length < 2) return;
    var d = smoothPath(bowed(pts, c.bow || 0));
    var maskId = "atlas-m-" + c.id;

    var mask = svgEl("mask", {
      id: maskId,
      maskUnits: "userSpaceOnUse",
      x: -50, y: -50, width: MAP_W + 100, height: MAP_H + 100
    });
    var maskPath = svgEl("path", {
      d: d, pathLength: 1, fill: "none", stroke: "#fff",
      "stroke-width": 18, "stroke-linecap": "round",
      "stroke-dasharray": 1, "stroke-dashoffset": 1
    });
    mask.appendChild(maskPath);
    defs.appendChild(mask);

    var vis = svgEl("path", {
      d: d,
      class: "f-corr",
      "data-register": c.register,
      "data-act": c.act,
      mask: "url(#" + maskId + ")",
      "vector-effect": "non-scaling-stroke",
      pathLength: 1
    });
    gLines.appendChild(vis);

    var hit = svgEl("path", {
      d: d,
      class: "f-corr-hit",
      "vector-effect": "non-scaling-stroke",
      tabindex: 0,
      role: "button",
      "aria-label": c.name
    });
    gLines.appendChild(hit);

    var entry = {
      def: c, vis: vis, mask: maskPath, hit: hit,
      act: actIndexOf[c.act] != null ? actIndexOf[c.act] : 0,
      order: n
    };
    corridors.push(entry);

    function select() { showSelection(c.name, c.dated, c.datum, c.source, c.register); }
    hit.addEventListener("click", select);
    hit.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); }
    });
    hit.addEventListener("mouseenter", function () { vis.classList.add("is-lit"); });
    hit.addEventListener("mouseleave", function () { vis.classList.remove("is-lit"); });
    hit.addEventListener("focus", function () { vis.classList.add("is-lit"); });
    hit.addEventListener("blur", function () { vis.classList.remove("is-lit"); });
  });

  /* Reveal windows in global scroll progress.
     Proposed lines all draw during Plate I — the proposal stated entire,
     before any of it is answered. Built lines draw inside their own plate,
     so the answer arrives where the reader is looking. */
  var proposedList = corridors.filter(function (c) { return c.def.register === "proposed"; });
  var actSpan = 1 / ACTS.length;

  corridors.forEach(function (c) {
    if (c.def.register === "proposed") {
      var i = proposedList.indexOf(c);
      var step = (actSpan * 0.86) / proposedList.length;
      c.from = actSpan * 0.08 + i * step;
      c.to = c.from + step * 2.4;
    } else {
      var base = c.act * actSpan;
      c.from = base + actSpan * 0.12;
      c.to = base + actSpan * 0.62;
    }
  });

  /* ------------------------------------------------------------------
     Build: nodes. Every corridor waypoint gets a quiet dot; the eleven
     nodes carrying a datum get a ring, a label and a click target.
     ------------------------------------------------------------------ */
  var keyed = {};
  D.NODES.forEach(function (n) { keyed[n.place] = n; });

  var waypoints = {};
  D.CORRIDORS.forEach(function (c) {
    c.path.forEach(function (k) {
      if (!waypoints[k]) waypoints[k] = { key: k, act: actIndexOf[c.act] || 0, register: c.register };
      if (c.register === "built") waypoints[k].register = "built";
    });
  });

  var nodes = [];
  Object.keys(waypoints).forEach(function (k) {
    var pt = project(k);
    if (!pt) return;
    var meta = keyed[k];
    var g = svgEl("g", {
      class: "f-node" + (meta ? "" : " is-quiet"),
      "data-register": meta ? meta.register : waypoints[k].register,
      "data-keyed": meta ? 1 : null,
      transform: "translate(" + pt[0].toFixed(1) + "," + pt[1].toFixed(1) + ")",
      tabindex: meta ? 0 : null,
      role: meta ? "button" : null,
      "aria-label": meta ? meta.label : null
    });
    if (meta) g.appendChild(svgEl("circle", { class: "halo", r: 9, "vector-effect": "non-scaling-stroke" }));
    g.appendChild(svgEl("circle", { class: "dot", r: 3.2, "vector-effect": "non-scaling-stroke" }));
    if (meta) {
      var t = svgEl("text", {
        x: meta.dx || 0,
        y: meta.dy || 0,
        "text-anchor": meta.anchor || "middle"
      });
      t.textContent = meta.label;
      g.appendChild(t);
    }
    gNodes.appendChild(g);

    var entry = {
      g: g, halo: g.querySelector(".halo"), dot: g.querySelector(".dot"),
      text: g.querySelector("text"), meta: meta,
      act: meta ? (actIndexOf[meta.act] || 0) : waypoints[k].act
    };
    nodes.push(entry);

    if (meta) {
      var sel = function () {
        showSelection(meta.label, null, meta.datum, meta.source, meta.register);
        g.classList.add("is-lit");
        window.setTimeout(function () { g.classList.remove("is-lit"); }, 2400);
      };
      g.addEventListener("click", sel);
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sel(); }
      });
    }
  });

  /* ------------------------------------------------------------------
     Dossier
     ------------------------------------------------------------------ */
  function citeHTML(key) {
    var s = D.SOURCES[key];
    if (!s) return "";
    var when = s.date ? " · " + s.date : "";
    if (key === "siarchive") {
      return '<span class="f-pending">Institute document not yet located</span>';
    }
    return (
      '<a class="f-cite" href="' + s.url + '" target="_blank" rel="noopener" ' +
      'title="' + s.detail + '"><b>' + s.label + "</b><i>" + when + "</i></a>"
    );
  }

  function actHTML(act) {
    var facts = act.facts
      .map(function (f) {
        return "<li><p>" + f.text + '</p><div class="f-cites">' + citeHTML(f.source) + "</div></li>";
      })
      .join("");
    return (
      '<p class="f-dossier-kicker">' + act.kicker + "</p>" +
      "<h3>" + act.title + "</h3>" +
      '<p class="f-dossier-lede">' + act.lede + "</p>" +
      '<ul class="f-facts">' + facts + "</ul>"
    );
  }

  function showSelection(title, dated, datum, source, register) {
    if (!selBox) return;
    var reg = register === "built" ? "Recorded as built or financed" : "Proposed, dated";
    selBox.innerHTML =
      "<h4>" + reg + "</h4>" +
      '<p><b style="font-weight:600">' + title + "</b>" +
      (dated ? ' <span class="f-sm">— ' + dated + "</span>" : "") + "</p>" +
      (datum ? "<p>" + datum + "</p>" : '<p class="f-sm">No third-party figure attached to this line in the draft dataset.</p>') +
      '<div class="f-cites">' + (source ? citeHTML(source) : "") + "</div>";
    selBox.hidden = false;
    /* The dossier is a scroll container and the selection lands under the
       plate's facts; without this the reader clicks a line and nothing
       visible happens. */
    if (selBox.scrollIntoView) {
      selBox.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
  }

  var shownAct = -1;
  function setAct(i) {
    if (i === shownAct) return;
    shownAct = i;
    var act = ACTS[i];
    if (dossier) {
      dossier.classList.add("is-fading");
      window.setTimeout(function () {
        dossier.innerHTML = actHTML(act);
        dossier.classList.remove("is-fading");
      }, reduced ? 0 : 180);
    }
    indexBtns.forEach(function (b, n) { b.classList.toggle("is-on", n === i); });
    root.setAttribute("data-act", act.id);
  }

  /* ------------------------------------------------------------------
     Camera. The view is a centre in degrees plus a width in degrees; the
     height comes from the live stage aspect, so the plate never letterboxes
     and a phone gets a genuinely closer view rather than a shrunken one.
     ------------------------------------------------------------------ */
  var cam = { x: 0, y: 0, w: 0 };
  var target = { x: 0, y: 0, w: 0 };
  var camInit = false;

  /* The base plate is clipped to lat +84..-62, i.e. 830 map units tall
     (see #atlas-plate-clip). Anything taller than that in the viewBox is
     empty paper. */
  var PLATE_H = 830;

  function actView(act) {
    var w = (act.view.w / 360) * MAP_W;
    return {
      x: ((act.view.lon + 180) / 360) * MAP_W,
      y: ((90 - act.view.lat) / 180) * MAP_H,
      w: w,
      fill: act.view.fill !== false
    };
  }

  function applyCam() {
    var rect = plate.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var aspect = rect.width / rect.height;
    var w = cam.w;
    var h = w / aspect;
    /* Contain: if the requested width would crop the act's latitude band on
       a portrait viewport, widen instead of cropping. */
    var wantH = cam.w / 2.15;
    if (h < wantH) { h = wantH; w = h * aspect; }
    /* On a portrait viewport a wide plate would letterbox badly — the stage
       is nearly square and the map is 2.5:1. The close plates would rather be
       cropped in longitude than shrunk, so they are; the two world plates
       keep their full width and sit matted inside the neatline instead. */
    if (cam.fill && h > PLATE_H) { h = PLATE_H; w = h * aspect; }
    if (h > MAP_H * 2.6) { h = MAP_H * 2.6; w = h * aspect; }
    svg.setAttribute(
      "viewBox",
      (cam.x - w / 2).toFixed(1) + " " + (cam.y - h / 2).toFixed(1) +
      " " + w.toFixed(1) + " " + h.toFixed(1)
    );

    /* The two base layers trade places as the camera closes in. Black Marble
       is ~20 km per pixel: at world zoom the night lights are the most
       information-dense thing on the plate, and by the Southwest Asia view
       they are four-pixel blobs that read as ink smudges. The landmass runs
       the other way — invisible when small, worth showing when large. */
    var zoom = MAP_W / w;
    if (imgLand) imgLand.style.opacity = (0.30 + Math.min(0.36, (zoom - 1) * 0.11)).toFixed(3);
    if (imgLights) imgLights.style.opacity = (0.74 - Math.min(0.52, (zoom - 1) * 0.13)).toFixed(3);

    /* Node marks are drawn in map units, so they have to be counter-scaled
       or they balloon as the camera closes in. */
    var s = rect.width / w;
    var r = 3.1 / s;
    var inv = 1 / s;
    nodes.forEach(function (n) {
      n.dot.setAttribute("r", r.toFixed(2));
      if (n.halo) n.halo.setAttribute("r", (r * 2.8).toFixed(2));
      if (n.text) {
        /* Counter-scale the label so its type size and its offset from the
           dot stay constant at every zoom. dx/dy in the data are therefore
           in screen pixels, which is the only unit worth reasoning about
           when the job is keeping two labels from colliding. */
        n.text.setAttribute(
          "transform",
          "translate(0," + (-r * 2.6).toFixed(2) + ") scale(" + inv.toFixed(4) + ")"
        );
      }
    });

    if (scaleLabel) {
      /* 5.5rem of bar, converted through the current scale into kilometres
         of longitude at the plate's centre latitude. */
      var barPx = 88;
      var barUnits = barPx / s;
      var barDeg = (barUnits / MAP_W) * 360;
      var latDeg = 90 - (cam.y / MAP_H) * 180;
      var km = barDeg * 111.32 * Math.cos((latDeg * Math.PI) / 180);
      scaleLabel.textContent = km > 1200
        ? Math.round(km / 100) * 100 + " km"
        : Math.round(km / 10) * 10 + " km";
    }
  }

  /* ------------------------------------------------------------------
     Scroll
     ------------------------------------------------------------------ */
  function progress() {
    if (!run) return 0;
    var rect = run.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, -rect.top / total));
  }

  function reveal(p) {
    corridors.forEach(function (c) {
      var t = (p - c.from) / (c.to - c.from);
      t = Math.min(1, Math.max(0, t));
      c.mask.setAttribute("stroke-dashoffset", (1 - t).toFixed(4));
      var near = Math.abs(c.act - shownAct) < 0.5;
      c.vis.style.opacity = t <= 0 ? 0 : near ? "" : "0.34";
    });
    nodes.forEach(function (n) {
      var on = n.act <= shownAct + 0.5;
      n.g.style.opacity = on ? 1 : 0.18;
      if (n.meta) n.g.classList.toggle("is-quiet", n.act !== shownAct);
    });
  }

  var running = false;
  var visible = false;

  function frame() {
    if (!running) return;
    var p = progress();
    var i = Math.min(ACTS.length - 1, Math.floor(p * ACTS.length + 0.0001));
    setAct(i);

    var tv = actView(ACTS[i]);
    /* Each plate holds still for its first four fifths and then travels, so
       the reader gets a settled frame to read against rather than a camera
       that is always mid-move. The copy changes at the act boundary, by
       which point the camera is already most of the way to the next plate. */
    var within = p * ACTS.length - i;
    var HOLD = 0.8;
    if (within > HOLD && i < ACTS.length - 1) {
      var nv = actView(ACTS[i + 1]);
      var k = (within - HOLD) / (1 - HOLD);
      k = k * k * (3 - 2 * k);
      tv = { x: tv.x + (nv.x - tv.x) * k, y: tv.y + (nv.y - tv.y) * k, w: tv.w + (nv.w - tv.w) * k, fill: k > 0.5 ? nv.fill : tv.fill };
    }
    target = tv;

    if (!camInit) { cam = { x: target.x, y: target.y, w: target.w }; camInit = true; }
    var e = reduced ? 1 : 0.11;
    cam.x += (target.x - cam.x) * e;
    cam.y += (target.y - cam.y) * e;
    cam.w += (target.w - cam.w) * e;
    cam.fill = target.fill;

    applyCam();
    reveal(p);
    window.requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    window.requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  /* Only animate while the plate is on screen. */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      },
      { rootMargin: "120px" }
    ).observe(run);
  } else {
    start();
  }

  window.addEventListener("resize", function () { if (!running) applyCam(); }, { passive: true });

  /* Plate index — click to jump. */
  indexBtns.forEach(function (b, i) {
    b.addEventListener("click", function () {
      var rect = run.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var y = window.scrollY + rect.top + total * ((i + 0.35) / ACTS.length);
      window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    });
  });

  /* Register toggle — the juxtaposition made switchable. */
  regBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      regBtns.forEach(function (o) { o.classList.toggle("is-on", o === b); });
      root.classList.remove("reg-both", "reg-proposed", "reg-built");
      root.classList.add("reg-" + b.getAttribute("data-reg"));
    });
  });

  /* ------------------------------------------------------------------
     Reduced motion / no pinning: every line drawn, world view, and the six
     plates' text rendered as a stacked reading instead of a choreography.
     ------------------------------------------------------------------ */
  if (reduced) {
    stop();
    document.querySelector(".folio").classList.add("no-motion");
    corridors.forEach(function (c) { c.mask.setAttribute("stroke-dashoffset", 0); c.vis.style.opacity = ""; });
    nodes.forEach(function (n) { n.g.style.opacity = 1; if (n.meta) n.g.classList.remove("is-quiet"); });
    cam = actView(ACTS[0]); camInit = true;
    applyCam();
    if (dossier) {
      dossier.innerHTML = ACTS.map(actHTML).join('<hr class="f-rule" />');
    }
    indexBtns.forEach(function (b) { b.classList.add("is-on"); });
  } else {
    setAct(0);
    cam = actView(ACTS[0]); camInit = true;
    applyCam();
    reveal(0);
  }

  /* ------------------------------------------------------------------
     The gazetteer — the whole plate as text. Built from the same data, so
     it can never drift from the map. This is what a screen reader, a
     printer and a search engine get, and it is complete.
     ------------------------------------------------------------------ */
  var gaz = root.querySelector(".f-gaz-grid");
  if (gaz) {
    var byAct = {};
    D.CORRIDORS.forEach(function (c) {
      (byAct[c.act] = byAct[c.act] || { lines: [], nodes: [] }).lines.push(c);
    });
    D.NODES.forEach(function (n) {
      (byAct[n.act] = byAct[n.act] || { lines: [], nodes: [] }).nodes.push(n);
    });
    gaz.innerHTML = ACTS.filter(function (a) { return byAct[a.id]; })
      .map(function (a) {
        var g = byAct[a.id];
        var lines = g.lines.map(function (c) {
          return "<li><b>" + c.name + "</b> <span class=\"f-gaz-tag\" data-r=\"" + c.register + "\">" +
            (c.register === "built" ? "built" : "proposed") + "</span><br />" +
            '<span class="f-sm">' + c.dated + (c.datum ? " — " + c.datum : "") + "</span>" +
            (c.source ? '<div class="f-cites">' + citeHTML(c.source) + "</div>" : "") + "</li>";
        }).join("");
        var nds = g.nodes.map(function (n) {
          return "<li><b>" + n.label + "</b><br />" + '<span class="f-sm">' + n.datum + "</span>" +
            '<div class="f-cites">' + citeHTML(n.source) + "</div></li>";
        }).join("");
        return "<div><h4>" + a.kicker + " — " + a.title + "</h4><ul>" + lines + nds + "</ul></div>";
      })
      .join("");
  }
})();
