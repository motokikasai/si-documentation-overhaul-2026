/* Schiller Institute homepage draft — hero v2 (scroll-driven WebGL).
 *
 * Changes vs. hero.js (v1 kept intact):
 *  - Fixed lat/lon → sphere projection (v1 was mirrored 180° in longitude,
 *    which floated the city nodes in the oceans). Nodes now sit on real
 *    major cities across five continents.
 *  - One consistent eastward spin across all acts (v1 rotated backwards
 *    and reversed direction in the final act).
 *  - Opens over the dark Pacific so the headline reads against night;
 *    daylight is revealed progressively as you scroll.
 *  - Round, softly glowing stars (custom point shader) — more of them,
 *    mostly tiny and semi-transparent, in varied sizes and colors.
 *  - Round shiny city nodes in varied sizes, gently pulsing.
 *  - Night-side civilization lights boosted; NASA cloud layer + ocean
 *    sun-glint for realism.
 *
 * Narrative acts are unchanged: crisis night Earth → Land-Bridge corridors
 * + dawn → pull-back to Moon and stars → invitation.
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

/** lat/lon (deg) → sphere position, matching THREE.SphereGeometry's
 *  equirectangular UV layout: x = cos(lat)cos(lon), z = -cos(lat)sin(lon). */
function latLon(lat, lon, r) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    r * Math.cos(la) * Math.cos(lo),
    r * Math.sin(la),
    -r * Math.cos(la) * Math.sin(lo)
  );
}

/* With this mapping, the camera (+z) faces longitude λ when
 * earth rotation.y = -90° - λ (mod 360). Rotation.y INCREASES over the
 * journey: the camera-facing longitude drifts westward, exactly like the
 * subsolar point on the real, eastward-spinning Earth. */
const faceLon = (lonDeg) => THREE.MathUtils.degToRad(-90 - lonDeg);

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

if (renderer) init(renderer);

function init(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x04070f, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  const texLoader = new THREE.TextureLoader();
  const loadTex = (url, onLoad) => {
    const t = texLoader.load(url, onLoad);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const dayTex = loadTex("assets/earth-day.jpg");
  const nightTex = loadTex("assets/earth-night.jpg");
  const cloudTex = loadTex("assets/clouds.jpg");
  const moonTex = loadTex("assets/moon.jpg");

  /* ----- Earth ----- */

  const EARTH_R = 1;
  const earthUniforms = {
    dayTex: { value: dayTex },
    nightTex: { value: nightTex },
    sunDir: { value: new THREE.Vector3(0, 0.25, -1).normalize() },
    /* 1 at the opening close-up → 0 once pulled back; drives the
     * blur-masking grain and the extra night-side cloud presence */
    uDetail: { value: 1 },
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
      uniform float uDetail;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vPosW);
        vec3 sun = normalize(sunDir);
        float ndl = dot(n, sun);

        /* negative LOD bias = sharper mip selection up close */
        vec3 day = texture2D(dayTex, vUv, -0.5).rgb;
        vec3 night = texture2D(nightTex, vUv, -0.5).rgb;

        /* civilization lights: lifted gamma + warm tungsten tint */
        vec3 lights = pow(night, vec3(0.8)) * vec3(1.5, 1.12, 0.72) * 2.7;
        vec3 nightSide = lights + vec3(0.012, 0.024, 0.05);

        float dayMix = smoothstep(-0.1, 0.35, ndl);
        vec3 dayLit = day * (0.32 + 0.85 * clamp(ndl, 0.0, 1.0));

        /* mild contrast lift on the day side */
        dayLit = pow(dayLit, vec3(1.08)) * 1.12;

        vec3 color = mix(nightSide, dayLit, dayMix);

        /* lights linger a little past the terminator into dusk */
        color += lights * smoothstep(0.25, -0.05, ndl) * 0.35 * (1.0 - dayMix);

        /* ocean sun-glint (blue-dominant pixels are water) */
        float oceanMask = smoothstep(0.04, 0.2, day.b - day.r);
        float spec = pow(clamp(dot(reflect(-sun, n), viewDir), 0.0, 1.0), 26.0);
        color += vec3(1.0, 0.92, 0.72) * spec * oceanMask * 0.4 * dayMix;

        /* warm dawn band along the terminator */
        float dawn = smoothstep(0.26, 0.0, abs(ndl));
        color += vec3(0.85, 0.4, 0.13) * dawn * 0.2;

        /* atmospheric rim */
        float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.6);
        color += vec3(0.2, 0.4, 0.85) * fres * (0.32 + 0.68 * dayMix);

        /* surface-locked micro-grain masks texture softness up close;
         * fades out with uDetail as the camera pulls back */
        float grain = fract(sin(dot(floor(vUv * 3400.0), vec2(12.9898, 78.233))) * 43758.5453);
        color *= 1.0 + (grain - 0.5) * 0.09 * uDetail * (1.0 - dayMix * 0.5);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = -0.2;
  scene.add(tiltGroup);

  const earthGroup = new THREE.Group();
  tiltGroup.add(earthGroup);

  earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 96), earthMat));

  /* Cloud shell — lit by the sun, faint on the night side */
  const cloudUniforms = {
    cloudTex: { value: cloudTex },
    sunDir: earthUniforms.sunDir,
    uDetail: earthUniforms.uDetail, // shared — one update per frame
  };
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.012, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        void main() {
          vUv = uv;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D cloudTex;
        uniform vec3 sunDir;
        uniform float uDetail;
        varying vec2 vUv;
        varying vec3 vNormalW;
        void main() {
          float cl = texture2D(cloudTex, vUv, -0.5).r;
          float lit = clamp(dot(normalize(vNormalW), normalize(sunDir)), 0.0, 1.0);
          /* moonlit clouds carry extra weight during the close-up */
          float moonlit = 0.12 + 0.16 * uDetail;
          vec3 col = vec3(0.9, 0.93, 1.0) * (moonlit + 1.0 * lit);
          gl_FragColor = vec4(col, cl * (0.16 + 0.14 * uDetail * (1.0 - lit) + 0.5 * lit));
        }
      `,
    })
  );
  earthGroup.add(clouds);

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

  /* ----- Soft round glow-point shader (stars, city nodes, pulses) ----- */

  const glowVert = /* glsl */ `
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aAlpha;
    attribute float aPhase;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uTwinkle;   /* 0 = steady, 1 = full twinkle/pulse */
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = aColor;
      float tw = 1.0 - uTwinkle * (0.5 - 0.5 * sin(uTime * 1.1 + aPhase));
      vAlpha = aAlpha * uOpacity * tw;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (280.0 / -mv.z) * (0.9 + 0.1 * tw);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const glowFrag = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c) * 2.0;
      float core = smoothstep(0.42, 0.0, d);      /* round center */
      float halo = exp(-d * 3.2) * 0.55;          /* soft shine   */
      float a = (core + halo) * vAlpha;
      if (a < 0.004) discard;
      gl_FragColor = vec4(vColor + core * 0.35, a);
    }
  `;

  function glowPoints({ positions, sizes, colors, alphas, phases, twinkle }) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
    geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uTwinkle: { value: twinkle },
      },
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { points: new THREE.Points(geo, mat), mat };
  }

  /* ----- Starfield: many, mostly tiny, varied color, semi-transparent ----- */

  const STAR_COUNT = 4200;
  const STAR_PALETTE = [
    [0.78, 0.84, 1.0],   // cool white-blue (most)
    [0.92, 0.94, 1.0],   // near white
    [1.0, 0.92, 0.78],   // warm
    [0.62, 0.72, 1.0],   // blue
    [0.78, 0.66, 1.0],   // violet
  ];
  const STAR_WEIGHTS = [0.38, 0.3, 0.14, 0.12, 0.06];

  let starMat;
  (function makeStars() {
    const pos = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const col = new Float32Array(STAR_COUNT * 3);
    const alp = new Float32Array(STAR_COUNT);
    const pha = new Float32Array(STAR_COUNT);
    const v = new THREE.Vector3();
    for (let i = 0; i < STAR_COUNT; i++) {
      v.randomDirection().multiplyScalar(55 + Math.random() * 110);
      pos.set([v.x, v.y, v.z], i * 3);
      /* power-law: overwhelmingly tiny, a handful bright */
      const r = Math.random();
      size[i] = 0.35 + Math.pow(r, 6.0) * 4.2;
      alp[i] = 0.16 + Math.pow(Math.random(), 2.2) * 0.6 + (r > 0.985 ? 0.25 : 0);
      let pick = Math.random(), ci = 0;
      for (let w = 0; ci < STAR_WEIGHTS.length - 1; ci++) {
        w += 0; pick -= STAR_WEIGHTS[ci];
        if (pick <= 0) break;
      }
      col.set(STAR_PALETTE[ci], i * 3);
      pha[i] = Math.random() * Math.PI * 2;
    }
    const stars = glowPoints({
      positions: pos, sizes: size, colors: col, alphas: alp, phases: pha,
      twinkle: 0.55,
    });
    scene.add(stars.points);
    starMat = stars.mat;
  })();

  /* ----- World Land-Bridge: cities on five continents + corridors ----- */

  /* [lat, lon, hub] — hub cities render larger */
  const CITIES = {
    newyork:    [40.7, -74.0, 1],  chicago:    [41.9, -87.6, 0],  edmonton:  [53.5, -113.5, 0],
    anchorage:  [61.2, -149.9, 0], mexico:     [19.4, -99.1, 1],  panama:    [9.0, -79.5, 0],
    lima:       [-12.0, -77.0, 0], saopaulo:   [-23.55, -46.6, 1],buenosaires:[-34.6, -58.4, 0],
    bering:     [65.8, -169.5, 0], vladivostok:[43.1, 131.9, 0],  tokyo:     [35.68, 139.7, 1],
    beijing:    [39.9, 116.4, 1],  xian:       [34.3, 108.9, 0],  urumqi:    [43.8, 87.6, 0],
    delhi:      [28.6, 77.2, 1],   mumbai:     [19.1, 72.9, 0],   singapore: [1.35, 103.8, 0],
    sydney:     [-33.87, 151.2, 1],tehran:     [35.7, 51.4, 1],   riyadh:    [24.7, 46.7, 0],
    jerusalem:  [31.8, 35.2, 0],   istanbul:   [41.0, 28.9, 0],   moscow:    [55.8, 37.6, 1],
    berlin:     [52.5, 13.4, 1],   rotterdam:  [51.9, 4.5, 0],    madrid:    [40.4, -3.7, 0],
    cairo:      [30.0, 31.2, 1],   khartoum:   [15.6, 32.5, 0],   nairobi:   [-1.3, 36.8, 0],
    capetown:   [-33.9, 18.4, 1],  lagos:      [6.5, 3.4, 0],     dakar:     [14.7, -17.5, 0],
    tangier:    [35.8, -5.8, 0],
  };

  const CORRIDORS = [
    ["rotterdam", "berlin", "moscow", "urumqi", "xian", "beijing"],             // northern Silk Road
    ["istanbul", "tehran", "urumqi"],                                           // middle corridor
    ["beijing", "vladivostok", "bering", "anchorage", "edmonton", "chicago", "newyork"], // Bering Strait link
    ["madrid", "tangier", "dakar", "lagos"],                                    // Gibraltar tunnel → W. Africa
    ["cairo", "khartoum", "nairobi", "capetown"],                               // East Africa spine
    ["chicago", "mexico", "panama", "lima", "buenosaires"],                     // Pan-American
    ["saopaulo", "buenosaires"],
    ["xian", "delhi", "mumbai"],                                                // South Asia branch
    ["singapore", "sydney"],                                                    // Oceania link
    ["beijing", "tokyo"],
    ["cairo", "jerusalem", "riyadh"],                                           // Oasis Plan
    ["istanbul", "cairo"],
  ];

  function greatCirclePoints(a, b, segments) {
    const va = latLon(a[0], a[1], EARTH_R);
    const vb = latLon(b[0], b[1], EARTH_R);
    const angle = va.angleTo(vb);
    const lift = 0.015 + angle * 0.09;
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
      const segPts = greatCirclePoints(CITIES[chain[i]], CITIES[chain[i + 1]], 42);
      if (i > 0) segPts.shift();
      pts.push(...segPts);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xe8c87e,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.geometry.setDrawRange(0, 0);
    arcsGroup.add(line);
    return { line, total: pts.length, pts, delay: (ci % 6) * 0.05 };
  });

  /* City nodes: round, shiny, varied sizes, gentle pulse */
  let nodeMat;
  (function makeNodes() {
    const entries = Object.values(CITIES);
    const n = entries.length;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const alp = new Float32Array(n);
    const pha = new Float32Array(n);
    entries.forEach(([lat, lon, hub], i) => {
      const v = latLon(lat, lon, EARTH_R + 0.008);
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = hub ? 0.16 + Math.random() * 0.05 : 0.09 + Math.random() * 0.04;
      col.set(hub ? [1.0, 0.85, 0.5] : [1.0, 0.9, 0.65], i * 3);
      alp[i] = hub ? 1.0 : 0.8;
      pha[i] = Math.random() * Math.PI * 2;
    });
    const nodes = glowPoints({
      positions: pos, sizes: size, colors: col, alphas: alp, phases: pha,
      twinkle: 0.35,
    });
    arcsGroup.add(nodes.points);
    nodeMat = nodes.mat;
  })();

  /* Pulses travelling the corridors (round, warm-white) */
  let pulseMat, pulseGeo;
  (function makePulses() {
    const n = corridorLines.length * 2;
    const pulses = glowPoints({
      positions: new Float32Array(n * 3),
      sizes: new Float32Array(n).fill(0.07),
      colors: new Float32Array(Array.from({ length: n }, () => [1, 0.96, 0.85]).flat()),
      alphas: new Float32Array(n).fill(0.95),
      phases: new Float32Array(n).fill(0),
      twinkle: 0,
    });
    arcsGroup.add(pulses.points);
    pulseMat = pulses.mat;
    pulseGeo = pulses.points.geometry;
  })();

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

  /* ------------------------------------------------------ choreography */

  /* Camera-facing longitude (see faceLon): Pacific night → Asia while the
   * corridors draw → Europe/Africa in daylight. rotation.y only increases. */
  const rotKeys = [
    [0, faceLon(-160)],   // dark Pacific
    [0.3, faceLon(140)],  // Japan enters
    [0.55, faceLon(75)],  // Silk Road heart
    [0.9, faceLon(15)],   // Europe/Africa in daylight
  ];
  /* unwrap angles so the track is strictly increasing — one spin direction */
  for (let i = 1; i < rotKeys.length; i++) {
    while (rotKeys[i][1] < rotKeys[i - 1][1]) rotKeys[i][1] += Math.PI * 2;
  }
  const earthRotY = track(rotKeys);

  const camZ = track([[0, 2.08], [0.3, 2.34], [0.55, 3.1], [0.84, 6.9], [1, 7.5]]);
  const camY = track([[0, 0.12], [0.4, 0.2], [0.84, 0.85], [1, 1.05]]);
  const camX = track([[0, 0], [0.5, 0.15], [1, -0.35]]);
  const lookY = track([[0, 0.05], [0.32, 0.24], [0.55, 0.24], [0.7, 0.0], [0.88, 0.45], [1, 0.62]]);

  /* Sun stays behind the Earth longer: night lights carry acts 0–1,
   * dawn arrives with the finished Land-Bridge, day by the pull-back. */
  const sunAzimuth = track([[0, 3.6], [0.38, 3.3], [0.58, 2.45], [0.8, 0.95], [1, 0.7]]);
  const starOpacity = track([[0, 0.5], [0.5, 0.68], [0.84, 1]]);
  const arcProgress = track([[0.2, 0], [0.52, 1]]);
  const arcFade = track([[0.8, 1], [0.98, 0.35]]);

  const STAGE_WINDOWS = [
    [-1, -0.5, 0.15, 0.23],
    [0.26, 0.33, 0.47, 0.55],
    [0.58, 0.65, 0.76, 0.83],
    [0.86, 0.93, 2, 3],
  ];
  const STAGE_CENTERS = [0.06, 0.4, 0.7, 0.95];

  const debugParam = new URLSearchParams(location.search).get("p");
  const debugP = debugParam !== null ? clamp01(parseFloat(debugParam) || 0) : null;

  let targetP = debugP ?? 0;
  let displayP = prefersReducedMotion ? 0.999 : (debugP ?? 0);

  /* Idle spin accumulators — only ever increase, so the globe never
   * changes direction (scrubbing backwards excepted). */
  let idleSpin = 0;
  let lastT = 0;

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
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;

    displayP += (targetP - displayP) * 0.085;
    if (Math.abs(targetP - displayP) < 0.0004) displayP = targetP;
    const p = prefersReducedMotion ? 0.999 : displayP;

    camera.position.set(camX(p), camY(p), camZ(p));
    camera.lookAt(0, lookY(p), 0);

    /* eastward spin only: keyframed framing + accumulated idle drift at
     * the bookends (accumulator is monotonic, so no direction flips) */
    const idleWeight = (1 - smooth(0.06, 0.24, p)) + smooth(0.86, 1, p);
    idleSpin += dt * 0.014 * Math.min(idleWeight, 1);
    earthGroup.rotation.y = earthRotY(p) + idleSpin;
    clouds.rotation.y = t * 0.005; // clouds drift the same direction, slightly faster

    const az = sunAzimuth(p);
    const sun = new THREE.Vector3(Math.sin(az), 0.28, Math.cos(az)).normalize();
    earthUniforms.sunDir.value.copy(sun);
    sunLight.position.copy(sun).multiplyScalar(30);
    earthUniforms.uDetail.value = 1 - smooth(0.12, 0.45, p);

    const ap = arcProgress(p);
    const fade = arcFade(p);
    const arcsIn = smooth(0.18, 0.3, p);
    corridorLines.forEach(({ line, total, delay }) => {
      const local = clamp01((ap - delay) / (1 - delay));
      line.geometry.setDrawRange(0, Math.floor(total * local));
      line.material.opacity = 0.9 * fade;
    });
    nodeMat.uniforms.uOpacity.value = arcsIn * fade;
    nodeMat.uniforms.uTime.value = t;

    const pulseOn = smooth(0.5, 0.56, p) * fade;
    pulseMat.uniforms.uOpacity.value = pulseOn;
    if (pulseOn > 0.01) {
      const attr = pulseGeo.getAttribute("position");
      corridorLines.forEach(({ pts }, ci) => {
        for (let k = 0; k < 2; k++) {
          const u = (t * 0.07 + ci * 0.17 + k * 0.5) % 1;
          const v = pts[Math.floor(u * (pts.length - 1))];
          attr.setXYZ(ci * 2 + k, v.x, v.y, v.z);
        }
      });
      attr.needsUpdate = true;
    }

    starMat.uniforms.uOpacity.value = starOpacity(p);
    starMat.uniforms.uTime.value = prefersReducedMotion ? 1.3 : t;
    moon.rotation.y = 2.4 + t * 0.01;

    renderer.render(scene, camera);
    updateStages(p);
  }

  function loop() {
    rafId = null;
    renderFrame();
    const settled = Math.abs(targetP - displayP) < 0.0004;
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

  chapterBtns.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const runway = heroEl.offsetHeight - window.innerHeight;
      const top = heroEl.offsetTop + runway * STAGE_CENTERS[i];
      window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  });

  readScroll();
  resize();

  /* Progressive detail: the 2K night map paints instantly; the 4K version
   * swaps in when it arrives (the close-up is entirely night side). */
  loadTex("assets/earth-night-4k.jpg", (t) => {
    earthUniforms.nightTex.value = t;
    kick();
  });
}
