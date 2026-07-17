/* Schiller Institute — "The Programme" (conferences-playbill.html).
   The GSAP treatment of the archive wing: gsap + ScrollTrigger (vendored,
   3.12.5) drive the playbill deck. Loaded AFTER conf-archive.js, which has
   already rendered the deck into [data-programme].

   What GSAP does here:
     · deck stacking — as each act slides up, the act beneath it recedes
       (scale/fade), scrubbed to the scroll in both directions;
     · programme rows and act headers stagger in as a sheet arrives;
     · cursor tilt — the sheet in hand leans toward the pointer via
       gsap.quickTo (the lerped, buttery follower of the gsap.com demos);
     · index shelf rows cascade in.

   Honors the covenant: everything is scrubbed or entrance-only — the wheel
   is never hijacked. Under prefers-reduced-motion this file does nothing
   and the CSS renders the deck as a plain static sequence. */
(function () {
  "use strict";

  if (!window.gsap || !window.ScrollTrigger) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  var bills = gsap.utils.toArray(".playbill");
  if (!bills.length) return;

  /* ---- 1 · deck stacking: each act recedes as the next covers it -------- */
  bills.forEach(function (bill, i) {
    var sheet = bill.querySelector(".pb-sheet");
    var next = bills[i + 1];
    if (!next || !sheet) return;
    gsap.to(sheet, {
      scale: 0.94,
      autoAlpha: 0.4,
      transformOrigin: "50% 20%",
      ease: "none",
      scrollTrigger: {
        trigger: next,
        start: "top bottom",
        end: "top top",
        scrub: true
      }
    });
  });

  /* ---- 2 · arrivals: head + rows stagger in as each sheet reaches you --- */
  bills.forEach(function (bill) {
    var head = bill.querySelectorAll(".pb-head > *");
    var rows = bill.querySelectorAll(".pb-row, .pb-foot");
    gsap.from(head, {
      y: 26, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease: "power2.out",
      scrollTrigger: { trigger: bill, start: "top 72%" }
    });
    gsap.from(rows, {
      y: 18, autoAlpha: 0, duration: 0.55, stagger: 0.045, ease: "power2.out",
      scrollTrigger: { trigger: bill, start: "top 62%" }
    });
  });

  /* ---- 3 · cursor tilt on the sheet currently in hand ------------------- */
  if (window.matchMedia("(hover: hover)").matches) {
    var deck = document.querySelector(".deck");
    var tilts = bills.map(function (bill) {
      var sheet = bill.querySelector(".pb-sheet");
      gsap.set(sheet, { transformPerspective: 1400 });
      return {
        sheet: sheet,
        rx: gsap.quickTo(sheet, "rotationX", { duration: 0.6, ease: "power3.out" }),
        ry: gsap.quickTo(sheet, "rotationY", { duration: 0.6, ease: "power3.out" })
      };
    });
    var active = -1;

    function activeIndex() {
      /* the sheet "in hand" = the last act whose sticky region has begun */
      var idx = 0;
      for (var i = 0; i < bills.length; i++) {
        if (bills[i].getBoundingClientRect().top <= 1) idx = i;
      }
      return idx;
    }
    deck.addEventListener("pointermove", function (e) {
      var idx = activeIndex();
      if (idx !== active && active >= 0) {
        tilts[active].rx(0);
        tilts[active].ry(0);
      }
      active = idx;
      var nx = e.clientX / window.innerWidth - 0.5;
      var ny = e.clientY / window.innerHeight - 0.5;
      tilts[idx].rx(-ny * 3.2);
      tilts[idx].ry(nx * 4.2);
    });
    deck.addEventListener("pointerleave", function () {
      if (active >= 0) {
        tilts[active].rx(0);
        tilts[active].ry(0);
        active = -1;
      }
    });
  }

  /* ---- 4 · the index cascades (GSAP takes over from the .fx entrances) --- */
  gsap.utils.toArray("[data-index] .shelf-row, [data-index] .shelf-era").forEach(function (row) {
    row.classList.remove("fx", "is-in");
    gsap.from(row, {
      x: -22, autoAlpha: 0, duration: 0.5, ease: "power2.out",
      scrollTrigger: { trigger: row, start: "top 90%" }
    });
  });
})();
