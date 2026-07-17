/* Schiller Institute — "The Firmament" (conferences-firmament.html).
   The conference archive as a night sky: every conference is a fixed gold
   star on a slowly winding time-thread; scrolling the voyage track flies
   the camera back from tonight to 1984. The page never hijacks the wheel —
   the camera eases toward wherever the visitor's scroll already is, and
   the cursor only breathes parallax into the frame.

   Module script (three.js from the homepage vendor dir). If WebGL, the
   module, or motion itself is unavailable, the page simply never gets
   body.is-3d: the voyage track stays collapsed and the always-present
   ivory index carries the archive. */

import * as THREE from "../../homepage-draft/vendor/three.module.min.js";

(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const CONFS = window.SI_CONFERENCES || [];
  const ERAS = window.SI_ERAS || [];
  const canvas = document.getElementById("fir-canvas");
  const voyage = document.querySelector(".voyage");
  const hud = document.querySelector(".fir-hud");
  if (!CONFS.length || !canvas || !voyage || !hud) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    return; /* no WebGL → the static index carries the page */
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const N = CONFS.length;
  const eraName = {};
  ERAS.forEach((e) => { eraName[e.key] = e.name; });

  /* ---- scene ------------------------------------------------------------ */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060d1f, 0.011);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);

  /* The time-thread: one star position per conference, newest first */
  const starPos = [];
  for (let i = 0; i < N; i++) {
    const theta = i * 0.62;
    const r = 9 + 2.2 * Math.sin(i * 1.7);
    starPos.push(new THREE.Vector3(
      Math.cos(theta) * r,
      Math.sin(theta) * r * 0.45,
      -i * 24
    ));
  }

  /* Glow sprite texture, drawn once */
  function glowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.12, "rgba(255,244,214,0.95)");
    grad.addColorStop(0.3, "rgba(232,200,126,0.4)");
    grad.addColorStop(0.6, "rgba(232,200,126,0.08)");
    grad.addColorStop(1, "rgba(232,200,126,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glow = glowTexture();

  const stars = CONFS.map((c, i) => {
    const color = c.next ? 0xdfe9ff : c.print ? 0xc89e60 : 0xe8c87e;
    const mat = new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.copy(starPos[i]);
    const base = c.next ? 1.9 : c.pl ? 1.5 : 1.15;
    s.scale.setScalar(base);
    s.userData.base = base;
    scene.add(s);
    return s;
  });

  /* The thread that strings the years together */
  const thread = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(starPos),
    new THREE.LineBasicMaterial({ color: 0xd4a94c, transparent: true, opacity: 0.3 })
  );
  scene.add(thread);

  /* Ambient dust — two populations, blue and faint gold */
  function dust(count, color, size, opacity) {
    const pos = new Float32Array(count * 3);
    const span = N * 24 + 200;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.pow(Math.random(), 0.6) * 60;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.7;
      pos[i * 3 + 2] = 40 - Math.random() * span;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: glow, color, size, transparent: true, opacity, depthWrite: false
    });
    scene.add(new THREE.Points(geo, mat));
  }
  dust(2400, 0x9db8e8, 0.7, 0.55);
  dust(420, 0xe8c87e, 1.0, 0.35);

  /* ---- HUD -------------------------------------------------------------- */
  const yearEl = hud.querySelector(".fir-year");
  const eraEl = hud.querySelector(".fir-eralabel");
  const card = hud.querySelector(".fir-card");
  const fcWhen = card.querySelector(".fc-when");
  const fcTitle = card.querySelector(".fc-title");
  const fcPlace = card.querySelector(".fc-place");
  const fcNote = card.querySelector(".fc-note");
  const fcAct = card.querySelector(".fc-act");

  let curIdx = -1;
  function showConf(i) {
    if (i === curIdx) return;
    curIdx = i;
    const c = CONFS[i];
    yearEl.textContent = c.next ? "Next" : String(c.yl || c.y);
    eraEl.textContent = eraName[c.era] || "";
    fcWhen.textContent = c.when;
    fcTitle.textContent = c.title;
    fcPlace.textContent = c.place || "";
    fcNote.textContent = c.note || "";
    fcAct.innerHTML = "";
    const a = document.createElement("a");
    if (c.next) {
      a.href = "#involved";
      a.textContent = "Register free →";
    } else if (c.pl) {
      a.href = "https://www.youtube.com/playlist?list=" + c.pl;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Watch the sessions →";
    } else {
      a.href = "#index";
      a.textContent = c.print ? "Proceedings in print · see the index →" : "Reel in restoration · see the index →";
    }
    fcAct.appendChild(a);
    card.classList.remove("is-swap");
    void card.offsetWidth;
    card.classList.add("is-swap");
  }

  /* ---- scroll → progress, cursor → parallax ------------------------------ */
  voyage.style.height = (N * 62) + "vh";
  let targetF = 0, curF = 0;
  let mx = 0, my = 0, pmx = 0, pmy = 0;

  function readScroll() {
    const rect = voyage.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    targetF = p * (N - 1);
  }
  window.addEventListener("scroll", readScroll, { passive: true });

  const hoverable = window.matchMedia("(hover: hover)").matches;
  if (hoverable) {
    window.addEventListener("pointermove", (e) => {
      mx = (e.clientX / window.innerWidth) - 0.5;
      my = (e.clientY / window.innerHeight) - 0.5;
    });
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => hud.classList.toggle("is-live", entry.isIntersecting));
    }, { threshold: 0 });
    io.observe(voyage);
  } else {
    hud.classList.add("is-live");
  }

  function pathPoint(f, out) {
    const i = Math.min(N - 2, Math.max(0, Math.floor(f)));
    const t = Math.min(1, Math.max(0, f - i));
    return out.lerpVectors(starPos[i], starPos[i + 1], t);
  }

  /* ---- render loop -------------------------------------------------------- */
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();
  readScroll();

  function frame(t) {
    curF += (targetF - curF) * 0.07;
    pmx += (mx - pmx) * 0.05;
    pmy += (my - pmy) * 0.05;

    pathPoint(curF, eye);
    eye.x += pmx * 3.2;
    eye.y += 1.6 - pmy * 2.2;
    eye.z += 15;
    camera.position.copy(eye);
    pathPoint(Math.min(N - 1, curF + 1.4), aim);
    camera.lookAt(aim);

    const active = Math.round(curF);
    showConf(Math.min(N - 1, Math.max(0, active)));
    const tt = t * 0.001;
    stars.forEach((s, i) => {
      const base = s.userData.base;
      if (i === active) {
        s.scale.setScalar(base * 1.25 + Math.sin(tt * 2.4) * 0.12);
      } else if (CONFS[i].next) {
        s.scale.setScalar(base + Math.sin(tt * 1.6) * 0.2);
      } else {
        s.scale.setScalar(base);
      }
    });

    renderer.render(scene, camera);
    window.requestAnimationFrame(frame);
  }

  document.body.classList.add("is-3d");
  showConf(0);
  window.requestAnimationFrame(frame);
})();
