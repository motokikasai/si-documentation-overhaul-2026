/* =================================================================
   THE SCHILLER INSTITUTE — draft interactions
   Vanilla JS, no dependencies. Each block is self-contained so it
   ports cleanly into a WordPress theme's enqueued script.
   ================================================================= */
(function () {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Sticky header state ---------- */
  const header = $("#siteHeader");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  const hamburger = $("#hamburger");
  const nav = $("#mainnav");
  hamburger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    hamburger.setAttribute("aria-expanded", String(open));
  });
  $$("#mainnav a").forEach(a => a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    hamburger.setAttribute("aria-expanded", "false");
  }));

  /* ---------- Language toggle (cosmetic placeholder for WPML) ---------- */
  $$(".langtoggle__btn").forEach(btn => btn.addEventListener("click", () => {
    $$(".langtoggle__btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  }));

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach(el => io.observe(el));

  /* ---------- Video / email modal (video-as-bait funnel) ---------- */
  const videoModal = $("#videoModal");
  const openModal = () => {
    videoModal.hidden = false;
    document.body.style.overflow = "hidden";
  };
  const closeModal = () => {
    videoModal.hidden = true;
    document.body.style.overflow = "";
  };
  $$("[data-open-video]").forEach(el => el.addEventListener("click", openModal));
  $$("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));

  /* ---------- Search overlay ---------- */
  const searchOverlay = $("#searchOverlay");
  $("#searchOpen").addEventListener("click", () => {
    searchOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $(".search-overlay__form input")?.focus(), 50);
  });
  $$("[data-close-search]").forEach(el => el.addEventListener("click", () => {
    searchOverlay.hidden = true;
    document.body.style.overflow = "";
  }));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!videoModal.hidden) closeModal();
      if (!searchOverlay.hidden) { searchOverlay.hidden = true; document.body.style.overflow = ""; }
    }
  });

  /* ---------- Email forms (front-end demo of double opt-in) ---------- */
  function wireEmailForm(form, onDone) {
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]');
      if (email && !email.checkValidity()) { email.reportValidity(); return; }
      onDone(form);
    });
  }
  wireEmailForm($("#emailForm"), (form) => {
    $("#emailSuccess").hidden = false;
    form.querySelector('button[type="submit"]').textContent = "Sent ✓";
  });
  wireEmailForm($("#modalEmailForm"), (form) => {
    form.innerHTML = '<p class="capture__success" style="margin:0">✓ Check your inbox to confirm — the webcast is on its way.</p>';
  });
  wireEmailForm($("#footMail"), (form) => {
    form.querySelector("button").textContent = "✓ Done";
  });

  /* ---------- Find a chapter ---------- */
  $("#chapterForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    $("#chapterNote").hidden = false;
  });

  /* ---------- Donation panel ---------- */
  (function donate() {
    const form = $("#donateForm");
    if (!form) return;
    const submit = $("#donateSubmit");
    const custom = $("#customAmount");
    let freq = "monthly";
    let amount = 25;

    const render = () => {
      const period = freq === "monthly" ? " / month" : "";
      submit.textContent = `Give $${amount}${period}`;
    };

    $$(".toggle__btn", form).forEach(btn => btn.addEventListener("click", () => {
      $$(".toggle__btn", form).forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      freq = btn.dataset.freq;
      render();
    }));

    $$(".amount[data-amount]", form).forEach(btn => btn.addEventListener("click", () => {
      $$(".amount", form).forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      amount = Number(btn.dataset.amount);
      if (custom) custom.value = "";
      render();
    }));

    custom?.addEventListener("input", () => {
      $$(".amount[data-amount]", form).forEach(b => b.classList.remove("is-active"));
      amount = Number(custom.value) || 0;
      render();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submit.textContent = "Redirecting to secure checkout…";
    });

    render();
  })();

  /* ---------- Explore ideas — faceted filter (demo data) ---------- */
  (function ideas() {
    const grid = $("#ideaGrid");
    if (!grid) return;

    // Demo library standing in for the WP content model
    // (Post / si_video / si_forecast / si_conference / si_document + si_topic).
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
      { title: "Educating the Next Renaissance",              format: "Article",    topic: "Education",           meta: "Article · On-ramp" },
      { title: "No War with Russia or China",                 format: "Article",    topic: "Peace & Strategy",    meta: "Article · Statement" },
      { title: "Fusion Power and the Future of Energy",       format: "Video",      topic: "Science & Discovery", meta: "Video · 28 min" }
    ];

    const empty = $("#ideaEmpty");

    const decode = (s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };

    function render(filter) {
      const list = filter === "all" ? items : items.filter(i => i.topic === decode(filter));
      grid.innerHTML = "";
      empty.hidden = list.length > 0;
      list.forEach((i, idx) => {
        const card = document.createElement("article");
        card.className = "icard";
        card.style.animationDelay = (idx * 45) + "ms";
        card.innerHTML = `
          <div class="icard__top" data-format="${i.format}"></div>
          <div class="icard__body">
            <div class="icard__tags">
              <span class="icard__format">${i.format}</span>
              <span class="icard__topic">· ${i.topic}</span>
            </div>
            <h3 class="icard__title">${i.title}</h3>
            <p class="icard__meta">${i.meta}</p>
          </div>`;
        grid.appendChild(card);
      });
    }

    $$("#ideaFilters .chip").forEach(chip => chip.addEventListener("click", () => {
      $$("#ideaFilters .chip").forEach(c => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      render(chip.dataset.filter);
    }));

    // Persona doors jump here and pre-select a topic
    $$(".door[data-topic]").forEach(door => door.addEventListener("click", () => {
      const topic = door.dataset.topic;
      const chip = $$("#ideaFilters .chip").find(c => c.dataset.filter === topic);
      if (chip) {
        $$("#ideaFilters .chip").forEach(c => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        render(topic);
      }
    }));

    render("all");
  })();

  /* ---------- Count-up stats ---------- */
  (function stats() {
    const section = $("#stats");
    if (!section) return;
    const animate = (el) => {
      const target = Number(el.dataset.count);
      const dur = 1400;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.round(target * eased);
        el.textContent = val >= 1000 ? val.toLocaleString() : val;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const so = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { $$(".stat__num", section).forEach(animate); so.disconnect(); }
      });
    }, { threshold: 0.4 });
    so.observe(section);
  })();

})();
