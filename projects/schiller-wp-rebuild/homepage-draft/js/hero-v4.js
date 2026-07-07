/* Schiller Institute homepage draft — hero v4 (scroll-driven WebGL).
 *
 * Changes vs. hero-v3.js (v3 kept intact):
 *  - Denser, more natural starfield: +3,200 faint filler stars and a
 *    Milky-Way belt — 3,000 tiny clustered stars along a tilted great
 *    circle plus ~480 large ultra-faint nebulosity patches that give it
 *    the diffuse milky glow — on top of the v3 population. A scattered
 *    subset (~1 in 4) breathes — slow, irregular dimming/brightening
 *    driven by two incommensurate sine waves per star, so no two pulse
 *    alike and nothing strobes. Sub-pixel stars rasterize at a stable
 *    minimum footprint (alpha-compensated) so camera motion can't make
 *    them pop against the pixel grid.
 *  - Occasional shooting stars: faint short streaks in the upper sky,
 *    1 every ~10–20 s at random positions/angles, peaking well below the
 *    brightest fixed stars. Disabled under prefers-reduced-motion.
 *  - Second corridor wave (tier 2): 23 thinner, quieter links from
 *    secondary cities on every continent. They start drawing mid-act-2
 *    (the pull-back) and complete by the end of act 3 — the network keeps
 *    densifying after the trunk story is told. Rendered at ~1/3 the trunk
 *    opacity, hugging the surface (less arc lift), no pulses — visible
 *    growth without crowding the finale. Five of them are T-junction
 *    branches that leave a trunk corridor mid-span (real networks branch);
 *    the rest are city-to-city arcs.
 *  - Light budget: tier-0/1 lines dim ~15% as the second wave grows, so
 *    the finale reads as light redistributing, not accumulating.
 *  - Day-side masking: all corridor lines render through a small shader
 *    that dims them past the terminator — additive gold over bright
 *    daylight reads as noise; corridors now live mostly in the night,
 *    like real city lights.
 *
 * Inherited from v3: night lights brighten with network completion
 * (uGrowth, now also fed by the tier-2 wave), city flare on connection,
 * feeder maturation. Inherited from v2: correct lat/lon projection, one
 * eastward spin, dark-Pacific opening, glow-point stars/nodes/pulses,
 * NASA cloud layer + sun-glint.
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
  const dayTex = loadTex("assets/images/earth-day.jpg");
  const nightTex = loadTex("assets/images/earth-night.jpg");
  const cloudTex = loadTex("assets/images/clouds.jpg");
  const moonTex = loadTex("assets/images/moon.jpg");

  /* ----- Earth ----- */

  const EARTH_R = 1;
  const earthUniforms = {
    dayTex: { value: dayTex },
    nightTex: { value: nightTex },
    sunDir: { value: new THREE.Vector3(0, 0.25, -1).normalize() },
    /* 1 at the opening close-up → 0 once pulled back; drives the
     * blur-masking grain and the extra night-side cloud presence */
    uDetail: { value: 1 },
    /* 0 → 1+ with corridor completion; brightens civilization lights.
     * v4: the tier-2 wave adds a second, smaller brightening on top. */
    uGrowth: { value: 0 },
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
      uniform float uGrowth;
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

        /* civilization lights: lifted gamma + warm tungsten tint;
         * the world grows brighter as the Land-Bridge completes */
        vec3 lights = pow(night, vec3(0.8)) * vec3(1.5, 1.12, 0.72) * 2.7 * (1.0 + 0.15 * uGrowth);
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

  /* ----- Soft round glow-point shader (stars, city nodes, pulses) -----
   * v4: per-point twinkle speed/amplitude (aTwSpeed/aTwAmp) + a second,
   * incommensurate sine — breathing is slow, irregular and per-star
   * instead of one synchronized pulse. */

  /* Minimum point footprint in device px, shared by all glow materials and
   * kept in sync with the live pixel ratio (see resize). Big enough that a
   * point's soft edge spans several pixels on ANY display — sub-pixel
   * points strobe against the pixel grid as the camera moves (worst on
   * 1x/non-Retina monitors). */
  const glowMinPx = { value: 2.6 };

  const glowVert = /* glsl */ `
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aAlpha;
    attribute float aPhase;
    attribute float aTwSpeed;
    attribute float aTwAmp;
    attribute float aReach;   /* network-progress value at which this point
                                 is connected; -1 = not a network node */
    uniform float uTime;
    uniform float uOpacity;
    uniform float uTwinkle;   /* 0 = steady, 1 = full twinkle/pulse */
    uniform float uAp;        /* current network draw progress */
    uniform float uMinPx;     /* minimum rasterized point size, device px */
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = aColor;
      /* two incommensurate sines → non-repeating, irregular breathing */
      float wave = 0.62 * sin(uTime * aTwSpeed + aPhase)
                 + 0.38 * sin(uTime * aTwSpeed * 2.417 + aPhase * 3.1);
      float tw = 1.0 - uTwinkle * aTwAmp * (0.5 - 0.5 * wave);
      /* flare briefly as the corridor tip arrives — the city joins the network */
      float flare = 0.0;
      if (aReach >= 0.0) {
        float s = clamp((uAp - aReach) / 0.07, 0.0, 1.0);
        flare = sin(3.14159 * s);
      }
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      /* twinkle modulates brightness only — size jitter aliases against
       * the pixel grid and reads as flicker */
      float px = aSize * (280.0 / -mv.z) * (1.0 + 0.22 * flare);
      /* sub-pixel points pop in/out as camera motion slides them across
       * pixel boundaries (scroll flicker). Rasterize at a stable minimum
       * footprint and repay the lost size as transparency: same apparent
       * energy, no popping. Linear (not quadratic) compensation — keeps
       * the tiny stars visible so the sky reads dense, not empty. */
      float stable = max(px, uMinPx);
      float cover = px / stable;
      vAlpha = aAlpha * uOpacity * tw * (1.0 + 0.35 * flare) * cover;
      gl_PointSize = stable;
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

  function glowPoints({ positions, sizes, colors, alphas, phases, twinkle, reaches, speeds, amps }) {
    const count = sizes.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
    geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    geo.setAttribute("aTwSpeed", new THREE.Float32BufferAttribute(
      speeds || new Float32Array(count).fill(1.1), 1));
    geo.setAttribute("aTwAmp", new THREE.Float32BufferAttribute(
      amps || new Float32Array(count).fill(1), 1));
    geo.setAttribute("aReach", new THREE.Float32BufferAttribute(
      reaches || new Float32Array(count).fill(-1), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uTwinkle: { value: twinkle },
        uAp: { value: 0 },
        uMinPx: glowMinPx, // shared — one update per display change
      },
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { points: new THREE.Points(geo, mat), mat };
  }

  /* ----- Starfield: many, mostly tiny, varied color, semi-transparent -----
   * v4: extra faint filler stars everywhere + a Milky-Way band (a tilted
   * belt of densely clustered tiny stars, like the reference night-sky
   * photo), and a scattered ~24% "breather" subset with slow irregular
   * pulsing. */

  const STAR_BASE = 4200;   // the v3 population, unchanged
  const STAR_EXTRA = 3200;  // v4 filler — small and faint, sky-wide
  const STAR_BAND = 3000;   // v4 Milky-Way belt — tiny, dense, clustered
  const STAR_COUNT = STAR_BASE + STAR_EXTRA + STAR_BAND;

  /* Milky-Way belt basis: a great circle tilted diagonally across the sky.
   * Its plane passes ~16° from the camera's view axis, so the belt is
   * always crossing the visible sky. Shared by the belt stars and the
   * nebulosity layer below. */
  const bandN = new THREE.Vector3(0.42, 0.86, 0.28).normalize();
  const bandU = new THREE.Vector3().crossVectors(bandN, new THREE.Vector3(0, 1, 0)).normalize();
  const bandV = new THREE.Vector3().crossVectors(bandN, bandU);
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
    const spd = new Float32Array(STAR_COUNT);
    const amp = new Float32Array(STAR_COUNT);
    const v = new THREE.Vector3();
    for (let i = 0; i < STAR_COUNT; i++) {
      if (i < STAR_BASE + STAR_EXTRA) {
        v.randomDirection();
      } else {
        /* belt stars: scatter around the great circle, gaussian falloff */
        const th = Math.random() * Math.PI * 2;
        const off = (Math.random() + Math.random() + Math.random() - 1.5) * 0.16;
        v.copy(bandU).multiplyScalar(Math.cos(th))
          .addScaledVector(bandV, Math.sin(th))
          .addScaledVector(bandN, off)
          .normalize();
      }
      v.multiplyScalar(55 + Math.random() * 110);
      pos.set([v.x, v.y, v.z], i * 3);
      const r = Math.random();
      if (i < STAR_BASE) {
        /* power-law: overwhelmingly tiny, a handful bright */
        size[i] = 0.35 + Math.pow(r, 6.0) * 4.2;
        alp[i] = 0.16 + Math.pow(Math.random(), 2.2) * 0.6 + (r > 0.985 ? 0.25 : 0);
      } else if (i < STAR_BASE + STAR_EXTRA) {
        /* v4 filler: never bright — background texture only */
        size[i] = 0.34 + Math.pow(r, 3.0) * 1.05;
        alp[i] = 0.15 + Math.pow(Math.random(), 2.0) * 0.34;
      } else {
        /* belt stars: tiny and faint — density does the work */
        size[i] = 0.32 + Math.pow(r, 4.5) * 1.25;
        alp[i] = 0.16 + Math.pow(Math.random(), 2.0) * 0.38;
      }
      let pick = Math.random(), ci = 0;
      while (ci < STAR_WEIGHTS.length - 1 && (pick -= STAR_WEIGHTS[ci]) > 0) ci++;
      col.set(STAR_PALETTE[ci], i * 3);
      pha[i] = Math.random() * Math.PI * 2;
      if (Math.random() < 0.24) {
        /* breathers: deep but very slow — a gradual swell, not a blink */
        amp[i] = 0.55 + Math.random() * 0.45;
        spd[i] = 0.08 + Math.random() * 0.3;
      } else {
        /* everything else holds perfectly steady: with thousands of
         * stars, ANY ambient shimmer reads as flicker while scrolling */
        amp[i] = 0.0;
        spd[i] = 1.0;
      }
    }
    const stars = glowPoints({
      positions: pos, sizes: size, colors: col, alphas: alp, phases: pha,
      twinkle: 0.55, speeds: spd, amps: amp,
    });
    scene.add(stars.points);
    starMat = stars.mat;
  })();

  /* ----- Milky-Way nebulosity: the diffuse glow that makes the belt read
   * as a belt. Large, ultra-faint, additively blended patches clumped
   * along the same great circle — individually invisible, together a
   * soft milky ribbon with patchy structure (star clouds + gaps). ----- */

  let bandGlowMat;
  (function makeBandGlow() {
    const N = 480;
    const GLOW_TINTS = [
      [0.6, 0.66, 0.86],   // cool haze (most)
      [0.72, 0.7, 0.66],   // warm star-cloud core
      [0.55, 0.6, 0.8],    // deep blue
    ];
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const alp = new Float32Array(N);
    const pha = new Float32Array(N);
    /* clump centers give the ribbon its patchy, cloudy structure */
    const clumps = Array.from({ length: 9 }, () => Math.random() * Math.PI * 2);
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const th = clumps[i % clumps.length] + (Math.random() + Math.random() - 1) * 0.55;
      const off = (Math.random() + Math.random() + Math.random() - 1.5) * 0.1;
      v.copy(bandU).multiplyScalar(Math.cos(th))
        .addScaledVector(bandV, Math.sin(th))
        .addScaledVector(bandN, off)
        .normalize().multiplyScalar(70 + Math.random() * 80);
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = 7 + Math.random() * 17;
      alp[i] = 0.016 + Math.random() * 0.022;
      col.set(GLOW_TINTS[i % 3 === 0 ? 1 : (i % 7 === 0 ? 2 : 0)], i * 3);
      pha[i] = 0;
    }
    const glow = glowPoints({
      positions: pos, sizes: size, colors: col, alphas: alp, phases: pha,
      twinkle: 0,
    });
    scene.add(glow.points);
    bandGlowMat = glow.mat;
  })();

  /* ----- Shooting stars: rare, faint, short-lived streaks (v4) -----
   * A pool of 2 line streaks. Each spawns at a random off-center screen
   * position (biased to the upper sky, kept off the Earth/headline zone),
   * travels a random downward diagonal for ~1 s, and fades on a sine
   * envelope. Additive blending with a head→tail color ramp does the
   * trail falloff. Peak opacity stays under the brightest fixed stars. */

  const meteors = [];
  if (!prefersReducedMotion) {
    const MET_SEG = 24;
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position",
        new THREE.Float32BufferAttribute(new Float32Array(MET_SEG * 3), 3));
      const cols = new Float32Array(MET_SEG * 3);
      for (let s = 0; s < MET_SEG; s++) {
        const f = Math.pow(1 - s / (MET_SEG - 1), 1.8); // bright head, long dim tail
        cols.set([0.72 * f, 0.78 * f, 0.9 * f], s * 3);
      }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      meteors.push({
        line,
        active: false,
        t0: 0,
        dur: 1,
        peak: 0.2,
        len: 8,
        start: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        nextAt: 5 + Math.random() * 14, // stagger the first appearances
      });
    }
  }

  const _metNdc = new THREE.Vector3();
  const _metRight = new THREE.Vector3();
  const _metUp = new THREE.Vector3();
  const _metHead = new THREE.Vector3();
  const _metPt = new THREE.Vector3();

  function spawnMeteor(m) {
    /* random screen position, upper-sky bias, off the center (Earth + copy) */
    do {
      _metNdc.set((Math.random() * 2 - 1) * 0.9, Math.random() * 1.5 - 0.55, 0.5);
    } while (Math.hypot(_metNdc.x, _metNdc.y) < 0.45);
    _metNdc.unproject(camera).sub(camera.position).normalize();
    m.start.copy(camera.position).addScaledVector(_metNdc, 55 + Math.random() * 35);
    /* travel a downward diagonal in screen space, random side */
    _metRight.setFromMatrixColumn(camera.matrixWorld, 0);
    _metUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const ang = -(Math.PI * 0.15 + Math.random() * Math.PI * 0.55);
    const side = Math.random() < 0.5 ? 1 : -1;
    m.dir.copy(_metRight).multiplyScalar(Math.cos(ang) * side)
      .addScaledVector(_metUp, Math.sin(ang)).normalize();
    m.len = 5 + Math.random() * 6;
    m.dur = 0.7 + Math.random() * 0.6;
    m.peak = 0.12 + Math.random() * 0.14;
  }

  function updateMeteors(t, skyOpacity) {
    for (const m of meteors) {
      if (!m.active) {
        if (t < m.nextAt) continue;
        spawnMeteor(m);
        m.active = true;
        m.t0 = t;
        m.line.visible = true;
      }
      const u = (t - m.t0) / m.dur;
      if (u >= 1) {
        m.active = false;
        m.line.visible = false;
        m.line.material.opacity = 0;
        m.nextAt = t + 8 + Math.random() * 18;
        continue;
      }
      const attr = m.line.geometry.getAttribute("position");
      _metHead.copy(m.start).addScaledVector(m.dir, m.len * u);
      const tail = Math.min(m.len * 0.4, m.len * u); // trail grows in, then follows
      for (let s = 0; s < attr.count; s++) {
        _metPt.copy(_metHead).addScaledVector(m.dir, -tail * (s / (attr.count - 1)));
        attr.setXYZ(s, _metPt.x, _metPt.y, _metPt.z);
      }
      attr.needsUpdate = true;
      m.line.material.opacity = Math.sin(Math.PI * u) * m.peak * skyOpacity;
    }
  }

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
    tangier:    [35.8, -5.8, 0],   kinshasa:   [-4.3, 15.3, 0],   johannesburg: [-26.2, 28.0, 0],
    addis:      [9.0, 38.7, 0],    bogota:     [4.7, -74.1, 0],   santiago:  [-33.4, -70.7, 0],
  };

  /* v4 second wave: secondary cities the trunk network hasn't reached.
   * All render as small, quiet nodes (no hubs). */
  const CITIES2 = {
    seattle:     [47.6, -122.3],  denver:     [39.7, -105.0],  houston:   [29.8, -95.4],
    montreal:    [45.5, -73.6],   caracas:    [10.5, -66.9],   quito:     [-0.2, -78.5],
    recife:      [-8.05, -34.9],  paris:      [48.85, 2.35],   rome:      [41.9, 12.5],
    stockholm:   [59.3, 18.1],    warsaw:     [52.2, 21.0],    algiers:   [36.75, 3.06],
    accra:       [5.6, -0.2],     luanda:     [-8.8, 13.2],    daressalaam: [-6.8, 39.3],
    karachi:     [24.9, 67.0],    tashkent:   [41.3, 69.2],    bangkok:   [13.75, 100.5],
    seoul:       [37.55, 127.0],  shanghai:   [31.2, 121.5],   perth:     [-31.95, 115.9],
    melbourne:   [-37.8, 145.0],  auckland:   [-36.85, 174.8], sanfrancisco: [37.77, -122.4],
    losangeles:  [34.05, -118.2], rio:        [-22.91, -43.2], venice:    [45.44, 12.33],
  };
  const cityLL = (key) => CITIES[key] || CITIES2[key];

  /* tier 0 = trunk lines (draw first, full brightness);
   * tier 1 = regional feeders (sprout later, slightly quieter) — the network
   * visibly grows outward into every continent as you scroll. */
  const CORRIDORS = [
    { chain: ["rotterdam", "berlin", "moscow", "urumqi", "xian", "beijing"], tier: 0 },             // northern Silk Road
    { chain: ["istanbul", "tehran", "urumqi"], tier: 0 },                                           // middle corridor
    { chain: ["beijing", "vladivostok", "bering", "anchorage", "edmonton", "chicago", "newyork"], tier: 0 }, // Bering Strait link
    { chain: ["madrid", "tangier", "dakar", "lagos"], tier: 0 },                                    // Gibraltar tunnel → W. Africa
    { chain: ["cairo", "khartoum", "nairobi", "capetown"], tier: 0 },                               // East Africa spine
    { chain: ["chicago", "mexico", "panama", "lima", "buenosaires"], tier: 0 },                     // Pan-American
    { chain: ["xian", "delhi", "mumbai"], tier: 0 },                                                // South Asia branch
    { chain: ["cairo", "jerusalem", "riyadh"], tier: 0 },                                           // Oasis Plan
    { chain: ["istanbul", "cairo"], tier: 0 },
    { chain: ["beijing", "tokyo"], tier: 1 },
    { chain: ["singapore", "sydney"], tier: 1 },                                                    // Oceania link
    { chain: ["saopaulo", "buenosaires"], tier: 1 },
    { chain: ["mumbai", "nairobi"], tier: 1 },                                                      // Indian-Ocean link, Asia ↔ Africa
    { chain: ["dakar", "khartoum"], tier: 1 },                                                      // trans-Sahel railway
    { chain: ["lagos", "kinshasa", "johannesburg"], tier: 1 },                                      // Central–Southern Africa spine
    { chain: ["riyadh", "addis", "nairobi"], tier: 1 },                                             // Red Sea crossing → E. Africa
    { chain: ["lima", "saopaulo"], tier: 1 },                                                       // Twin-Ocean railway
    { chain: ["buenosaires", "santiago"], tier: 1 },                                                // trans-Andean
    { chain: ["panama", "bogota"], tier: 1 },                                                       // Darién link
  ];

  /* v4 tier-2 wave: thinner, quieter branch lines from every continent.
   * They start drawing mid-act-2 and finish by the end of act 3.
   * Cities that sit close to an existing trunk route (Warsaw, Tashkent,
   * Accra, Seoul, Quito) are reached by T-junction branches instead —
   * see BRANCHES2 below — so no line parallels a trunk. */
  const CORRIDORS2 = [
    { chain: ["edmonton", "seattle"] },                     // N. America
    { chain: ["seattle", "sanfrancisco", "losangeles"] },   // W. Coast corridor
    { chain: ["losangeles", "mexico"] },
    { chain: ["chicago", "denver", "houston"] },
    { chain: ["newyork", "montreal"] },
    { chain: ["houston", "mexico"] },
    { chain: ["bogota", "caracas"] },                       // S. America
    { chain: ["saopaulo", "recife"] },
    { chain: ["saopaulo", "rio"] },
    { chain: ["rotterdam", "paris", "madrid"] },            // Europe
    { chain: ["berlin", "stockholm"] },
    { chain: ["paris", "rome"] },
    { chain: ["tangier", "algiers", "cairo"] },             // Africa — trans-Maghreb
    { chain: ["kinshasa", "luanda"] },
    { chain: ["nairobi", "daressalaam", "johannesburg"] },  // E. African coastal
    { chain: ["delhi", "karachi", "tehran"] },              // Asia
    { chain: ["beijing", "shanghai"] },
    { chain: ["xian", "bangkok", "singapore"] },            // SE-Asia corridor
    { chain: ["sydney", "melbourne"] },                     // Oceania
    { chain: ["sydney", "auckland"] },
    { chain: ["singapore", "perth"] },
  ];

  /* T-junction branches: leave an existing corridor at a mid-span junction
   * and descend to a secondary city. `on` must be a consecutive city pair
   * of an existing corridor chain; `at` is the fraction along that segment.
   * `lift` must match the host line's lift scale (1 = trunk/feeder, 0.45 =
   * tier-2) so the junction sits exactly on it. `start` (in ap2 units) is
   * explicit: a branch may only sprout after its host has reached the
   * junction — only Venice's host is itself a late-drawing tier-2 line. */
  const BRANCHES2 = [
    { on: ["moscow", "urumqi"], at: 0.62, to: "tashkent", start: 0.07 },  // off the northern Silk Road
    { on: ["berlin", "moscow"], at: 0.38, to: "warsaw", start: 0.19 },
    { on: ["dakar", "lagos"], at: 0.6, to: "accra", start: 0.31 },        // off the W. Africa trunk
    { on: ["beijing", "tokyo"], at: 0.45, to: "seoul", start: 0.43 },
    { on: ["panama", "lima"], at: 0.42, to: "quito", start: 0.0 },        // off the Pan-American
    { on: ["paris", "rome"], at: 0.68, to: "venice", start: 0.55, lift: 0.45 }, // off a tier-2 line
  ];

  function greatCirclePoints(a, b, segments, liftScale = 1) {
    const va = latLon(a[0], a[1], EARTH_R);
    const vb = latLon(b[0], b[1], EARTH_R);
    const angle = va.angleTo(vb);
    const lift = (0.015 + angle * 0.09) * liftScale;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
      p.multiplyScalar(EARTH_R + Math.sin(Math.PI * t) * lift + 0.004);
      pts.push(p);
    }
    return pts;
  }

  /* Branch line: starts at a 3D point ON an existing corridor (junction,
   * possibly lifted mid-span) and descends to a surface city — height
   * eases from the trunk's down to the ground with a mild arc bump. */
  function branchPoints(junction, cityDeg, segments) {
    const vb = latLon(cityDeg[0], cityDeg[1], EARTH_R);
    const dirA = junction.clone().normalize();
    const dirB = vb.normalize();
    const lift = (0.015 + dirA.angleTo(dirB) * 0.09) * 0.45;
    const jr = junction.length();
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = dirA.clone().lerp(dirB, t).normalize();
      const r = jr + (EARTH_R + 0.004 - jr) * t + Math.sin(Math.PI * t) * lift;
      pts.push(p.multiplyScalar(r));
    }
    return pts;
  }

  const arcsGroup = new THREE.Group();
  earthGroup.add(arcsGroup);

  /* Feeders mature from pale (planned) to trunk gold (operational).
   * Hex values are kept raw (no linear conversion): the corridor shader
   * below outputs them unencoded, same as the glow-point shader. */
  const FEEDER_COLD = new THREE.Color().setHex(0xb5a486, THREE.LinearSRGBColorSpace);
  const TRUNK_GOLD = new THREE.Color().setHex(0xe8c87e, THREE.LinearSRGBColorSpace);
  /* Tier-2 branches: dimmer, slightly desaturated gold — reads thinner
   * (WebGL line width is fixed at 1px, so "thin" = quiet, not narrow) */
  const BRANCH_GOLD = new THREE.Color().setHex(0xcfb684, THREE.LinearSRGBColorSpace);

  /* Corridor line material with day-side masking: additive gold over
   * bright daylight reads as noise, so lines dim toward uDayDim past the
   * terminator — corridors live in the night, like real city lights.
   * uSunDir shares the earth material's uniform object (one update/frame). */
  function corridorMat(color, opacity, dayDim) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: color },
        uOpacity: { value: opacity },
        uDayDim: { value: dayDim },
        uSunDir: earthUniforms.sunDir,
      },
      vertexShader: /* glsl */ `
        uniform vec3 uSunDir;
        varying float vNdl;
        void main() {
          /* lines are earth-locked children, so the normalized local
           * position is the surface normal; take it to world space */
          vNdl = dot(normalize(mat3(modelMatrix) * position), normalize(uSunDir));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uDayDim;
        varying float vNdl;
        void main() {
          float dayMix = smoothstep(-0.05, 0.3, vNdl);
          gl_FragColor = vec4(uColor, uOpacity * mix(1.0, uDayDim, dayMix));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  /* city key → earliest network progress (ap) at which a corridor reaches it */
  const cityReach = {};

  const corridorLines = CORRIDORS.map(({ chain, tier }, ci) => {
    const pts = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const segPts = greatCirclePoints(CITIES[chain[i]], CITIES[chain[i + 1]], 42);
      if (i > 0) segPts.shift();
      pts.push(...segPts);
    }
    const baseOpacity = tier === 0 ? 0.9 : 0.62;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo,
      corridorMat(tier === 0 ? TRUNK_GOLD.clone() : FEEDER_COLD.clone(), baseOpacity, 0.5));
    line.geometry.setDrawRange(0, 0);
    arcsGroup.add(line);
    /* trunks draw across the first half of the window, feeders sprout after */
    const delay = tier === 0 ? (ci % 6) * 0.05 : 0.38 + (ci % 5) * 0.055;
    /* the corridor tip reaches city j at fraction j/(n-1) of its draw */
    chain.forEach((key, j) => {
      const reach = delay + (j / (chain.length - 1)) * (1 - delay);
      cityReach[key] = Math.min(cityReach[key] ?? Infinity, reach);
    });
    return { line, total: pts.length, pts, delay, baseOpacity, tier };
  });

  /* Tier-2 lines: separate build — lower lift (hug the surface), dim gold,
   * staggered starts scattered by a 7-mod-23 walk so growth pops up all
   * over the globe at once rather than sweeping in list order. */
  const cityReach2 = {}; /* in ap2 (second-wave progress) domain */

  const corridor2Lines = CORRIDORS2.map(({ chain }, ci) => {
    const pts = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const segPts = greatCirclePoints(cityLL(chain[i]), cityLL(chain[i + 1]), 42, 0.45);
      if (i > 0) segPts.shift();
      pts.push(...segPts);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, corridorMat(BRANCH_GOLD.clone(), 0.32, 0.35));
    line.geometry.setDrawRange(0, 0);
    arcsGroup.add(line);
    const start = ((ci * 7) % 23) / 23 * 0.55;
    const dur = 0.45;
    chain.forEach((key, j) => {
      if (!CITIES2[key]) return; // existing cities already flared in wave one
      const reach = start + (j / (chain.length - 1)) * dur;
      cityReach2[key] = Math.min(cityReach2[key] ?? Infinity, reach);
    });
    return { line, total: pts.length, start, dur, baseOpacity: 0.32 };
  });

  /* T-junction branch lines: same tier-2 treatment, but they grow outward
   * from a point on a trunk corridor. The junction is computed with the
   * same great-circle + lift formula the trunk uses, so the join is exact. */
  BRANCHES2.forEach(({ on, at, to, start, lift = 1 }) => {
    const hostSeg = greatCirclePoints(cityLL(on[0]), cityLL(on[1]), 42, lift);
    const junction = hostSeg[Math.round(at * 42)];
    const pts = branchPoints(junction, CITIES2[to], 28);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, corridorMat(BRANCH_GOLD.clone(), 0.32, 0.35));
    line.geometry.setDrawRange(0, 0);
    arcsGroup.add(line);
    const dur = 0.45;
    cityReach2[to] = Math.min(cityReach2[to] ?? Infinity, start + dur);
    corridor2Lines.push({ line, total: pts.length, start, dur, baseOpacity: 0.32 });
  });

  /* City nodes: round, shiny, varied sizes, gentle pulse */
  let nodeMat;
  (function makeNodes() {
    const entries = Object.entries(CITIES);
    const n = entries.length;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const alp = new Float32Array(n);
    const pha = new Float32Array(n);
    const rch = new Float32Array(n);
    entries.forEach(([key, [lat, lon, hub]], i) => {
      const v = latLon(lat, lon, EARTH_R + 0.008);
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = hub ? 0.16 + Math.random() * 0.05 : 0.09 + Math.random() * 0.04;
      col.set(hub ? [1.0, 0.85, 0.5] : [1.0, 0.9, 0.65], i * 3);
      alp[i] = hub ? 1.0 : 0.8;
      pha[i] = Math.random() * Math.PI * 2;
      rch[i] = cityReach[key] ?? -1;
    });
    const nodes = glowPoints({
      positions: pos, sizes: size, colors: col, alphas: alp, phases: pha,
      twinkle: 0.35, reaches: rch,
    });
    arcsGroup.add(nodes.points);
    nodeMat = nodes.mat;
  })();

  /* Second-wave city nodes: smaller and quieter than wave-one feeders;
   * their flare tracks ap2 via this material's own uAp uniform. */
  let node2Mat;
  (function makeNodes2() {
    const entries = Object.entries(CITIES2);
    const n = entries.length;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const alp = new Float32Array(n);
    const pha = new Float32Array(n);
    const rch = new Float32Array(n);
    entries.forEach(([key, [lat, lon]], i) => {
      const v = latLon(lat, lon, EARTH_R + 0.008);
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = 0.055 + Math.random() * 0.025;
      col.set([1.0, 0.9, 0.68], i * 3);
      alp[i] = 0.55;
      pha[i] = Math.random() * Math.PI * 2;
      rch[i] = cityReach2[key] ?? -1;
    });
    const nodes = glowPoints({
      positions: pos, sizes: size, colors: col, alphas: alp, phases: pha,
      twinkle: 0.3, reaches: rch,
    });
    arcsGroup.add(nodes.points);
    node2Mat = nodes.mat;
  })();

  /* Pulses travelling the corridors (round, warm-white) — trunk/feeder
   * lines only; the tier-2 wave stays traffic-free to keep it quiet. */
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

  /* Small, distant, slightly dimmed: keeps the eye on Earth and avoids the
   * wide-angle edge stretching a large off-axis sphere suffers. */
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 64, 64),
    new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0, color: 0xbfbfbf })
  );
  moon.position.set(4.9, 2.3, -7.2);
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
  const starOpacity = track([[0, 0.62], [0.5, 0.78], [0.84, 1]]);
  const arcProgress = track([[0.2, 0], [0.52, 1]]);
  /* second wave: mid-act-2 (pull-back underway) → end of act 3 */
  const arc2Progress = track([[0.68, 0], [0.985, 1]]);
  const arcFade = track([[0.8, 1], [0.98, 0.35]]);

  /* The finale fades in late so the scene is still visibly completing as
   * the pin releases — no inert stretch of scroll before the handoff. */
  const STAGE_WINDOWS = [
    [-1, -0.5, 0.15, 0.23],
    [0.26, 0.33, 0.47, 0.55],
    [0.58, 0.65, 0.76, 0.83],
    [0.89, 0.975, 2, 3],
  ];
  const STAGE_CENTERS = [0.06, 0.4, 0.7, 0.975];

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

    /* Cinematic easing through the acts, tightening to near-1:1 tracking
     * as the runway ends — so the hero already responds like normal page
     * scroll when the pin releases (no handoff character change). */
    const ease = 0.085 + 0.55 * smooth(0.8, 0.97, targetP);
    displayP += (targetP - displayP) * ease;
    if (Math.abs(targetP - displayP) < 0.0004) displayP = targetP;
    const p = prefersReducedMotion ? 0.999 : displayP;

    camera.position.set(camX(p), camY(p), camZ(p));
    camera.lookAt(0, lookY(p), 0);
    camera.updateMatrixWorld();

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
    const ap2 = arc2Progress(p);
    const fade = arcFade(p);
    const arcsIn = smooth(0.18, 0.3, p);
    const pulseOn = smooth(0.5, 0.56, p) * fade;
    /* the second wave keeps brightening the night side, gently */
    earthUniforms.uGrowth.value = ap + 0.35 * ap2;
    /* light budget: wave one yields ~15% as wave two grows, so the finale
     * reads as light redistributing across the network, not piling up */
    const budget = 1 - 0.15 * ap2;
    corridorLines.forEach(({ line, total, delay, baseOpacity, tier }) => {
      const local = clamp01((ap - delay) / (1 - delay));
      line.geometry.setDrawRange(0, Math.floor(total * local));
      const u = line.material.uniforms;
      if (tier === 1) {
        /* planned → operational once the pulses start flowing */
        u.uColor.value.lerpColors(FEEDER_COLD, TRUNK_GOLD, pulseOn);
        u.uOpacity.value = (baseOpacity + 0.2 * pulseOn) * fade * budget;
      } else {
        u.uOpacity.value = baseOpacity * fade * budget;
      }
    });
    corridor2Lines.forEach(({ line, total, start, dur, baseOpacity }) => {
      const local = clamp01((ap2 - start) / dur);
      line.geometry.setDrawRange(0, Math.floor(total * local));
      line.material.uniforms.uOpacity.value = baseOpacity * fade;
    });
    nodeMat.uniforms.uOpacity.value = arcsIn * fade;
    nodeMat.uniforms.uTime.value = t;
    nodeMat.uniforms.uAp.value = ap;
    node2Mat.uniforms.uOpacity.value = smooth(0.68, 0.74, p) * fade;
    node2Mat.uniforms.uTime.value = t;
    node2Mat.uniforms.uAp.value = ap2;
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

    const skyOp = starOpacity(p);
    starMat.uniforms.uOpacity.value = skyOp;
    starMat.uniforms.uTime.value = prefersReducedMotion ? 1.3 : t;
    bandGlowMat.uniforms.uOpacity.value = skyOp;
    if (meteors.length) updateMeteors(t, skyOp);
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
    /* the canvas is viewport-fixed (parallax handoff), so size to the window */
    const w = window.innerWidth;
    const h = window.innerHeight;
    /* pixel ratio changes when the window moves between displays; the
     * glow minimum footprint tracks it so stars stay flicker-free on
     * 1x monitors without over-fattening on Retina */
    const pr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pr);
    glowMinPx.value = 0.9 + 1.7 * pr;
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
  loadTex("assets/images/earth-night-4k.jpg", (t) => {
    earthUniforms.nightTex.value = t;
    kick();
  });
}
