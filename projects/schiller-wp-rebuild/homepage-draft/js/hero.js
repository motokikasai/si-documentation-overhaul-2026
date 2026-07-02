/* Schiller Institute homepage draft — scroll-driven WebGL hero.
 *
 * Narrative choreography (scroll progress p ∈ [0,1] across the 520vh runway):
 *   Act 0  (0.00–0.22)  Night Earth, city lights — "a world in crisis".
 *   Act 1  (0.22–0.55)  World Land-Bridge corridors draw in gold across the
 *                       dark planet; dawn sweeps the terminator.
 *   Act 2  (0.55–0.84)  Camera pulls back into space; the Moon and starfield
 *                       enter — the extraterrestrial imperative.
 *   Act 3  (0.84–1.00)  Earth settles low; invitation + email capture.
 *
 * Textures: NASA Blue Marble / Black Marble / LRO moon map (public domain).
 * Three.js is vendored (MIT). No build step — plain ES module.
 */

import * as THREE from "../vendor/three.module.min.js";

const heroEl = document.querySelector(".hero");
const pinEl = document.querySelector(".hero-pin");
const canvas = document.querySelector(".hero-canvas");
const stages = Array.from(document.querySelectorAll(".hero-stage"));
const scrollHint = document.querySelector(".hero-scrollhint");
const chapterBtns = Array.from(document.querySelectorAll(".hero-chapters button"));

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- helpers */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Piecewise keyframe track: keys = [[t, value], ...] sorted by t. */
function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1] = keys[i];
        return v0 + (v1 - v0) * smooth(t0, t1, t);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** lat/lon (degrees) → position on sphere of radius r.
 *  Matches equirectangular texture mapping of THREE.SphereGeometry. */
function latLon(lat, lon, r) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/* ------------------------------------------------------------- renderer */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
} catch (e) {
  heroEl.classList.add("no-webgl");
}

if (renderer) {
  init(renderer);
}

function init(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x060d1f, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  const texLoader = new THREE.TextureLoader();
  const loadTex = (url) => {
    const t = texLoader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const dayTex = loadTex("assets/earth-day.jpg");
  const nightTex = loadTex("assets/earth-night.jpg");
  const moonTex = loadTex("assets/moon.jpg");

  /* ----- Earth (custom day/night shader with dawn terminator + rim) ----- */

  const EARTH_R = 1;
  const earthUniforms = {
    dayTex: { value: dayTex },
    nightTex: { value: nightTex },
    sunDir: { value: new THREE.Vector3(0, 0.25, -1).normalize() },
  };

  const earthMat = new THREE.ShaderMaterial({
    uniforms: earthUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D dayTex;
      uniform sampler2D nightTex;
      uniform vec3 sunDir;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vPosW);
        float ndl = dot(n, normalize(sunDir));

        vec3 day = texture2D(dayTex, vUv).rgb;
        vec3 night = texture2D(nightTex, vUv).rgb;

        float dayMix = smoothstep(-0.12, 0.32, ndl);
        vec3 nightSide = night * vec3(1.35, 1.05, 0.72) * 1.9 + vec3(0.012, 0.02, 0.045);
        vec3 color = mix(nightSide, day * (0.35 + 0.75 * clamp(ndl, 0.0, 1.0)), dayMix);

        /* warm dawn band along the terminator */
        float dawn = smoothstep(0.28, 0.0, abs(ndl));
        color += vec3(0.85, 0.38, 0.12) * dawn * 0.22;

        /* atmospheric rim */
        float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.6);
        color += vec3(0.22, 0.42, 0.85) * fres * (0.35 + 0.65 * dayMix);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const tiltGroup = new THREE.Group();          // axial tilt container
  tiltGroup.rotation.z = -0.2;
  scene.add(tiltGroup);

  const earthGroup = new THREE.Group();          // spins; arcs ride along
  tiltGroup.add(earthGroup);

  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 96), earthMat);
  earthGroup.add(earth);

  /* Atmosphere glow shell */
  const atmoMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosW);
        float rim = pow(0.72 + dot(viewDir, normalize(vNormalW)), 3.2);
        gl_FragColor = vec4(vec3(0.25, 0.5, 1.0), 1.0) * rim * 0.55;
      }
    `,
  });
  earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.045, 64, 64), atmoMat));

  /* ----- World Land-Bridge corridors ----- */

  const CITIES = {
    rotterdam:  [51.9, 4.5],    berlin:     [52.5, 13.4],   istanbul:  [41.0, 28.9],
    tehran:     [35.7, 51.4],   urumqi:     [43.8, 87.6],   xian:      [34.3, 108.9],
    beijing:    [39.9, 116.4],  vladivostok:[43.1, 131.9],  bering:    [65.8, -169.5],
    anchorage:  [61.2, -149.9], edmonton:   [53.5, -113.5], chicago:   [41.9, -87.6],
    newyork:    [40.7, -74.0],  mexico:     [19.4, -99.1],  panama:    [9.0, -79.5],
    lima:       [-12.0, -77.0], buenosaires:[-34.6, -58.4], cairo:     [30.0, 31.2],
    khartoum:   [15.6, 32.5],   nairobi:    [-1.3, 36.8],   capetown:  [-33.9, 18.4],
    lagos:      [6.5, 3.4],     dakar:      [14.7, -17.5],  delhi:     [28.6, 77.2],
    mumbai:     [19.1, 72.9],   jerusalem:  [31.8, 35.2],   riyadh:    [24.7, 46.7],
  };

  const CORRIDORS = [
    ["rotterdam", "berlin", "istanbul", "tehran", "urumqi", "xian", "beijing"], // New Silk Road
    ["beijing", "vladivostok", "bering", "anchorage", "edmonton", "chicago", "newyork"], // Bering Strait link
    ["istanbul", "cairo", "khartoum", "nairobi", "capetown"],                   // East Africa spine
    ["cairo", "lagos", "dakar"],                                                // Trans-African west
    ["chicago", "mexico", "panama", "lima", "buenosaires"],                     // Pan-American
    ["xian", "delhi", "mumbai"],                                                // South Asia branch
    ["cairo", "jerusalem", "riyadh"],                                           // Oasis Plan
  ];

  function greatCirclePoints(a, b, segments) {
    const va = latLon(a[0], a[1], EARTH_R);
    const vb = latLon(b[0], b[1], EARTH_R);
    const angle = va.angleTo(vb);
    const lift = 0.015 + angle * 0.09; // longer hops arc higher
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
      p.multiplyScalar(EARTH_R + Math.sin(Math.PI * t) * lift + 0.004);
      pts.push(p);
    }
    return pts;
  }

  const arcsGroup = new THREE.Group();
  earthGroup.add(arcsGroup);

  const corridorLines = CORRIDORS.map((chain, ci) => {
    const pts = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const a = CITIES[chain[i]];
      const b = CITIES[chain[i + 1]];
      const segPts = greatCirclePoints(a, b, 42);
      if (i > 0) segPts.shift();
      pts.push(...segPts);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xe8c87e,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.geometry.setDrawRange(0, 0);
    arcsGroup.add(line);
    return { line, total: pts.length, pts, delay: ci * 0.06 };
  });

  /* City nodes */
  const nodePositions = [];
  Object.values(CITIES).forEach(([lat, lon]) => {
    const v = latLon(lat, lon, EARTH_R + 0.006);
    nodePositions.push(v.x, v.y, v.z);
  });
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.Float32BufferAttribute(nodePositions, 3));
  const nodeMat = new THREE.PointsMaterial({
    color: 0xf0c568,
    size: 0.026,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  arcsGroup.add(new THREE.Points(nodeGeo, nodeMat));

  /* Pulses travelling along the corridors once they are drawn */
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(corridorLines.length * 2 * 3), 3)
  );
  const pulseMat = new THREE.PointsMaterial({
    color: 0xfff3d0,
    size: 0.03,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pulses = new THREE.Points(pulseGeo, pulseMat);
  arcsGroup.add(pulses);

  /* ----- Moon ----- */

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 48, 48),
    new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 })
  );
  moon.position.set(4.6, 1.7, -4.2);
  scene.add(moon);

  const sunLight = new THREE.DirectionalLight(0xfff2dd, 2.6);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x223355, 0.5));

  /* ----- Starfield ----- */

  function makeStars(count, color, size) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(60 + Math.random() * 100);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const p = new THREE.Points(g, m);
    scene.add(p);
    return m;
  }
  const starsA = makeStars(1700, 0xcfe0f5, 0.55);
  const starsB = makeStars(180, 0xe8c87e, 0.8);

  /* ------------------------------------------------------ choreography */

  const camZ = track([[0, 2.08], [0.3, 2.34], [0.55, 3.1], [0.84, 6.9], [1, 7.5]]);
  const camY = track([[0, 0.12], [0.4, 0.2], [0.84, 0.85], [1, 1.05]]);
  const camX = track([[0, 0], [0.5, 0.15], [1, -0.35]]);
  const lookY = track([[0, 0.05], [0.32, 0.24], [0.55, 0.24], [0.7, 0.0], [0.88, 0.45], [1, 0.62]]);
  const earthRotY = track([[0, 2.9], [0.28, 1.35], [0.58, 0.25], [0.9, -0.35]]);
  const sunAzimuth = track([[0, 3.5], [0.3, 3.1], [0.5, 2.2], [0.72, 0.8], [1, 0.65]]);
  const starOpacity = track([[0.4, 0.12], [0.62, 0.55], [0.84, 1]]);
  const arcProgress = track([[0.2, 0], [0.52, 1]]);
  const arcFade = track([[0.8, 1], [0.98, 0.35]]);

  /* Text stage windows: [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] */
  const STAGE_WINDOWS = [
    [-1, -0.5, 0.15, 0.23],
    [0.26, 0.33, 0.47, 0.55],
    [0.58, 0.65, 0.76, 0.83],
    [0.86, 0.93, 2, 3],
  ];
  const STAGE_CENTERS = [0.06, 0.4, 0.7, 0.95];

  /* Debug/QA: ?p=0.42 pins the choreography at a fixed progress. */
  const debugParam = new URLSearchParams(location.search).get("p");
  const debugP = debugParam !== null ? clamp01(parseFloat(debugParam) || 0) : null;

  let targetP = debugP ?? 0;
  let displayP = prefersReducedMotion ? 0.999 : (debugP ?? 0);
  let heroVisible = true;
  let rafId = null;

  function readScroll() {
    if (debugP !== null) { targetP = debugP; return; }
    const rect = heroEl.getBoundingClientRect();
    const runway = rect.height - window.innerHeight;
    targetP = runway > 0 ? clamp01(-rect.top / runway) : 0;
  }

  function updateStages(p) {
    stages.forEach((el, i) => {
      const [a0, a1, b0, b1] = STAGE_WINDOWS[i];
      const op = smooth(a0, a1, p) * (1 - smooth(b0, b1, p));
      const mid = (a1 + b0) / 2;
      const shift = (p < mid ? 1 : -1) * 26 * (1 - op);
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translateY(${shift.toFixed(1)}px)`;
      el.classList.toggle("is-active", op > 0.6);
    });
    if (scrollHint) scrollHint.style.opacity = p < 0.03 ? 1 : 0;

    let chapter = 0;
    for (let i = 0; i < STAGE_CENTERS.length; i++) {
      if (Math.abs(p - STAGE_CENTERS[i]) < Math.abs(p - STAGE_CENTERS[chapter])) chapter = i;
    }
    chapterBtns.forEach((b, i) => b.classList.toggle("is-active", i === chapter));
  }

  const clock = new THREE.Clock();

  function renderFrame() {
    const t = clock.getElapsedTime();
    displayP += (targetP - displayP) * 0.085;
    if (Math.abs(targetP - displayP) < 0.0004) displayP = targetP;
    const p = prefersReducedMotion ? 0.999 : displayP;

    /* camera */
    camera.position.set(camX(p), camY(p), camZ(p));
    camera.lookAt(0, lookY(p), 0);

    /* earth spin: keyframed framing + gentle idle drift at the bookends */
    const idle = 0.02 * Math.sin(t * 0.22) * (1 - smooth(0.1, 0.3, p));
    earthGroup.rotation.y = earthRotY(p) + idle + t * 0.006 * smooth(0.86, 1, p);

    /* sun sweep (dawn breaks as the Land-Bridge is built) */
    const az = sunAzimuth(p);
    const sun = new THREE.Vector3(Math.sin(az), 0.28, Math.cos(az)).normalize();
    earthUniforms.sunDir.value.copy(sun);
    sunLight.position.copy(sun).multiplyScalar(30);

    /* corridors draw in staggered */
    const ap = arcProgress(p);
    const fade = arcFade(p);
    const arcsIn = smooth(0.18, 0.3, p);
    corridorLines.forEach(({ line, total, delay }) => {
      const local = clamp01((ap - delay) / (1 - delay));
      line.geometry.setDrawRange(0, Math.floor(total * local));
      line.material.opacity = 0.95 * fade;
    });
    nodeMat.opacity = 0.9 * arcsIn * fade;

    /* pulses ride the corridors once drawn */
    const pulseOn = smooth(0.5, 0.56, p) * fade;
    pulseMat.opacity = 0.9 * pulseOn;
    if (pulseOn > 0.01) {
      const attr = pulseGeo.getAttribute("position");
      corridorLines.forEach(({ pts }, ci) => {
        for (let k = 0; k < 2; k++) {
          const u = (t * 0.07 + ci * 0.19 + k * 0.5) % 1;
          const v = pts[Math.floor(u * (pts.length - 1))];
          attr.setXYZ(ci * 2 + k, v.x, v.y, v.z);
        }
      });
      attr.needsUpdate = true;
    }

    /* deep space */
    const so = starOpacity(p);
    starsA.opacity = 0.35 + 0.65 * so;
    starsB.opacity = so;
    moon.rotation.y = 2.4 + t * 0.01;

    renderer.render(scene, camera);
    updateStages(p);
  }

  function loop() {
    rafId = null;
    renderFrame();
    const settled = Math.abs(targetP - displayP) < 0.0004;
    /* keep animating while visible (idle drift + pulses are time-based) */
    if (heroVisible && !document.hidden) rafId = requestAnimationFrame(loop);
    else if (!settled) rafId = requestAnimationFrame(loop);
  }
  function kick() {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function resize() {
    const w = pinEl.clientWidth;
    const h = pinEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    kick();
  }

  window.addEventListener("scroll", () => { readScroll(); kick(); }, { passive: true });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", kick);

  new IntersectionObserver(
    ([entry]) => { heroVisible = entry.isIntersecting; kick(); },
    { rootMargin: "10% 0px" }
  ).observe(heroEl);

  /* chapter dot navigation */
  chapterBtns.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const runway = heroEl.offsetHeight - window.innerHeight;
      const top = heroEl.offsetTop + runway * STAGE_CENTERS[i];
      window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  });

  readScroll();
  resize();
}
