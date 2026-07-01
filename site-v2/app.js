/* =================================================================
   THE SCHILLER INSTITUTE — v2 motion engine
   Vanilla JS, no dependencies. One rAF loop drives the smooth stuff
   (cursor parallax, scroll parallax, cursor glow, progress bar);
   IntersectionObservers drive the discrete reveals.
   ================================================================= */
(function () {
  "use strict";
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer  = matchMedia("(pointer: fine)").matches;

  /* ---------------- Nav: solid on scroll + mobile menu ---------------- */
  const nav = $("#nav");
  const setNav = () => nav.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.72);
  setNav();
  const burger = $("#burger"), navLinks = $("#navLinks");
  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  $$("#navLinks a").forEach(a => a.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }));

  /* ---------------- Hero entrance ---------------- */
  const hero = $("#hero");
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("is-ready")));

  /* ---------------- Custom cursor ---------------- */
  const cursor = $("#cursor"), cursorDot = $("#cursorDot");
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };   // raw
  const eased = { x: mouse.x, y: mouse.y };                  // lerped (glow)
  const heroParallax = { x: 0, y: 0 }, heroTarget = { x: 0, y: 0 };

  if (finePointer && !reduceMotion) {
    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      document.body.classList.add("has-cursor");
      // hero cursor-parallax target: -0.5..0.5 from centre
      heroTarget.x = (e.clientX / innerWidth - 0.5);
      heroTarget.y = (e.clientY / innerHeight - 0.5);
    }, { passive: true });
    window.addEventListener("mouseleave", () => document.body.classList.remove("has-cursor"));
  }

  /* ---------------- Parallax background layers ---------------- */
  const parallaxers = $$("[data-parallax]").map(el => ({
    el, section: el.parentElement, speed: parseFloat(el.dataset.parallax)
  }));
  const heroArt = $(".hero__art"), heroInner = $(".hero__inner");

  /* ---------------- The single rAF loop ---------------- */
  function frame() {
    // glow follows with easing; dot is snappy
    eased.x = lerp(eased.x, mouse.x, 0.12);
    eased.y = lerp(eased.y, mouse.y, 0.12);
    if (cursor)    cursor.style.transform    = `translate3d(${eased.x}px, ${eased.y}px, 0)`;
    if (cursorDot) cursorDot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;

    // scroll progress bar
    const sp = $("#scrollprogress");
    const max = document.documentElement.scrollHeight - innerHeight;
    if (sp) sp.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";

    // hero: combine cursor drift + scroll parallax
    heroParallax.x = lerp(heroParallax.x, heroTarget.x, 0.08);
    heroParallax.y = lerp(heroParallax.y, heroTarget.y, 0.08);
    if (scrollY < innerHeight * 1.1) {
      const prog = clamp(scrollY / innerHeight, 0, 1);           // 0 at top → 1 one screen down
      if (heroArt) {
        const tx = -heroParallax.x * 26;
        const ty = -heroParallax.y * 26 + scrollY * 0.38;        // rises slower than scroll
        heroArt.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${1.06 + prog * 0.12})`;
      }
      if (heroInner) {
        const tx = heroParallax.x * 14;
        const ty = heroParallax.y * 14 + scrollY * 0.18;         // drifts up faster
        heroInner.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        heroInner.style.opacity = String(clamp(1 - prog * 1.25, 0, 1));
      }
    }

    // parallax bands
    for (const p of parallaxers) {
      const r = p.section.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) continue;
      const centre = r.top + r.height / 2 - innerHeight / 2;
      p.el.style.transform = `translate3d(0, ${-centre * p.speed}px, 0)`;
    }

    setNav();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------- Hero motes (drifting light particles) ---------------- */
  (function motes() {
    const canvas = $("#motes");
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    let w, h, parts = [];
    const DPR = Math.min(devicePixelRatio || 1, 2);
    function size() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * DPR; canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.round(clamp(w / 22, 28, 70));
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.8 + 0.5,
        a: Math.random() * 0.4 + 0.1,
        vy: -(Math.random() * 0.28 + 0.06),
        vx: (Math.random() - 0.5) * 0.18,
        tw: Math.random() * Math.PI * 2
      }));
    }
    function draw() {
      if (scrollY > innerHeight) { requestAnimationFrame(draw); return; } // pause off-screen
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y += p.vy; p.x += p.vx; p.tw += 0.02;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        const alpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(227,197,119,${alpha})`;   // soft gold light
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    size(); window.addEventListener("resize", size); draw();
  })();

  /* ---------------- Reveal on scroll ---------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  $$(".reveal").forEach(el => io.observe(el));

  /* ---------------- Paradigm: draw arcs when in view ---------------- */
  (function arcs() {
    const section = $("#paradigm");
    if (!section) return;
    $$("#arcs path").forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    });
    const ao = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { section.classList.add("is-drawn"); ao.disconnect(); } });
    }, { threshold: 0.3 });
    ao.observe(section);
  })();

  /* ---------------- Card tilt (cursor 3D) ---------------- */
  if (finePointer && !reduceMotion) {
    $$(".tilt").forEach(tilt => {
      const card = tilt.firstElementChild;
      tilt.addEventListener("mousemove", (e) => {
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateZ(0)`;
      });
      tilt.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (finePointer && !reduceMotion) {
    $$(".magnetic").forEach(el => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.3;
        const y = (e.clientY - r.top - r.height / 2) * 0.4;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------------- Video / email modal ---------------- */
  const modal = $("#videoModal");
  const open = () => { modal.hidden = false; document.body.style.overflow = "hidden"; };
  const close = () => { modal.hidden = true; document.body.style.overflow = ""; };
  $$("[data-open-video]").forEach(el => el.addEventListener("click", open));
  $$("[data-close-modal]").forEach(el => el.addEventListener("click", close));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  /* ---------------- Forms (front-end demo) ---------------- */
  function wireEmail(form, done) {
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]');
      if (email && !email.checkValidity()) { email.reportValidity(); return; }
      done(form);
    });
  }
  wireEmail($("#emailForm"), (f) => { $("#emailSuccess").hidden = false; f.querySelector('button[type="submit"] span').textContent = "Sent ✓"; });
  wireEmail($("#modalEmailForm"), (f) => { f.innerHTML = '<p style="font-family:var(--ui);font-weight:600;color:var(--blue-deep);margin:0">✓ Check your inbox to confirm — the film is on its way.</p>'; });
  wireEmail($("#footMail"), (f) => { f.querySelector("button").textContent = "✓ Done"; });
  $("#chapterForm")?.addEventListener("submit", (e) => { e.preventDefault(); $("#chapterNote").hidden = false; });

  /* ---------------- Donation panel ---------------- */
  (function donate() {
    const form = $("#donateForm"); if (!form) return;
    const submit = $("#donateSubmit").querySelector("span") || $("#donateSubmit");
    const custom = $("#customAmount");
    let freq = "monthly", amount = 25;
    const render = () => { submit.textContent = `Give $${amount}${freq === "monthly" ? " / month" : ""}`; };
    $$(".toggle__btn", form).forEach(b => b.addEventListener("click", () => {
      $$(".toggle__btn", form).forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active"); freq = b.dataset.freq; render();
    }));
    $$(".amount[data-amount]", form).forEach(b => b.addEventListener("click", () => {
      $$(".amount", form).forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active"); amount = +b.dataset.amount; if (custom) custom.value = ""; render();
    }));
    custom?.addEventListener("input", () => {
      $$(".amount[data-amount]", form).forEach(x => x.classList.remove("is-active"));
      amount = +custom.value || 0; render();
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); submit.textContent = "Redirecting to secure checkout…"; });
    render();
  })();

  /* ---------------- Explore ideas — faceted filter ---------------- */
  (function ideas() {
    const grid = $("#ideaGrid"); if (!grid) return;
    const empty = $("#ideaEmpty");
    const items = [
      { title: "The New Paradigm: A Community of Principle", format: "Article",    topic: "New Paradigm",        meta: "Article · Helga Zepp-LaRouche" },
      { title: "Why Physical Economy Beats Monetarism",       format: "Forecast",   topic: "Physical Economy",    meta: "Forecast · 2026–2030" },
      { title: "The World Land-Bridge, Explained",            format: "Video",      topic: "World Land-Bridge",   meta: "Video · 22 min" },
      { title: "Schiller's Aesthetic Education of Man",       format: "Article",    topic: "Classical Culture",   meta: "Article · Essay" },
      { title: "A Security Architecture for All Nations",     format: "Conference", topic: "Peace & Strategy",    meta: "Conference · Berlin" },
      { title: "The Science of Kepler's Harmony",             format: "Video",      topic: "Science & Discovery", meta: "Video · 34 min" },
      { title: "The Oasis Plan for Southwest Asia",           format: "Document",   topic: "World Land-Bridge",   meta: "Document · PDF" },
      { title: "Beethoven and the Sublime",                   format: "Video",      topic: "Classical Culture",   meta: "Video · Concert" },
      { title: "Credit, Not Debt: A Hamiltonian Recovery",    format: "Forecast",   topic: "Physical Economy",    meta: "Forecast · Report" },
      { title: "No War with Russia or China",                 format: "Article",    topic: "Peace & Strategy",    meta: "Article · Statement" },
      { title: "Fusion Power and the Future of Energy",       format: "Video",      topic: "Science & Discovery", meta: "Video · 28 min" },
      { title: "The Coincidence of Opposites",                format: "Article",    topic: "New Paradigm",        meta: "Article · Essay" }
    ];
    const decode = (s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
    function render(filter) {
      const list = filter === "all" ? items : items.filter(i => i.topic === decode(filter));
      grid.innerHTML = "";
      empty.hidden = list.length > 0;
      list.forEach((i, idx) => {
        const c = document.createElement("article");
        c.className = "icard"; c.style.animationDelay = (idx * 45) + "ms";
        c.innerHTML = `<div class="icard__top" data-format="${i.format}"></div>
          <div class="icard__body">
            <div class="icard__tags"><span class="icard__format">${i.format}</span><span class="icard__topic">· ${i.topic}</span></div>
            <h3 class="icard__title">${i.title}</h3>
            <p class="icard__meta">${i.meta}</p>
          </div>`;
        grid.appendChild(c);
      });
    }
    $$("#ideaFilters .chip").forEach(chip => chip.addEventListener("click", () => {
      $$("#ideaFilters .chip").forEach(c => c.classList.remove("is-active"));
      chip.classList.add("is-active"); render(chip.dataset.filter);
    }));
    render("all");
  })();

  /* ---------------- Count-up stats ---------------- */
  (function stats() {
    const section = $("#stats"); if (!section) return;
    const run = (el) => {
      const target = +el.dataset.count, dur = 1500, start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = v >= 1000 ? v.toLocaleString() : v;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const so = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { $$(".stat__num", section).forEach(run); so.disconnect(); } });
    }, { threshold: 0.4 });
    so.observe(section);
  })();

})();
