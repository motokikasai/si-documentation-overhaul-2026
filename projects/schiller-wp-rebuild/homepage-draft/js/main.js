/* Schiller Institute homepage draft — page interactions (non-hero). */
(function () {
  "use strict";

  /* Header state */
  var header = document.querySelector(".site-header");
  var onScroll = function () {
    header.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile nav */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Scroll-reveal */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 0.08 + "s";
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Click-to-load YouTube (nocookie). Empty data-video-id → open the channel. */
  document.querySelectorAll(".js-video").forEach(function (frame) {
    var activate = function () {
      var id = frame.getAttribute("data-video-id");
      if (!id) {
        window.open("https://www.youtube.com/@SchillerInstitute", "_blank", "noopener");
        return;
      }
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
      iframe.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.title = "Schiller Institute video";
      frame.innerHTML = "";
      frame.appendChild(iframe);
    };
    frame.addEventListener("click", activate);
    frame.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  /* Signup forms — prototype only: NationBuilder embed replaces this later. */
  document.querySelectorAll(".js-signup").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type=email]");
      if (!input.value || input.validity.typeMismatch || input.value.indexOf("@") < 0) {
        input.focus();
        input.style.borderColor = "#e05252";
        return;
      }
      var note = document.createElement("p");
      note.textContent = "✓ Check your inbox to confirm your subscription. (Prototype — no email was sent.)";
      note.style.cssText = "margin-top:0.8rem;font-size:0.85rem;color:#e8c87e;";
      form.insertAdjacentElement("afterend", note);
      form.style.display = "none";
    });
  });

  /* Footer year */
  document.querySelectorAll(".js-year").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
