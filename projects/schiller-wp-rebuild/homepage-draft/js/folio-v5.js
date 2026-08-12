/* ==========================================================================
   Schiller Institute — homepage draft v5
   THE FOLIO — everything below the hero.

   Every section that makes a claim renders from js/data-v5.js rather than
   from markup, so a claim cannot appear on the page without passing through
   the provenance fields. Where a Schiller Institute document has not been
   located for this draft, the template prints a visible badge instead of
   quietly omitting the citation. That is the point (handoff §2, §7.1).
   ========================================================================== */

(function () {
  "use strict";

  var D = window.SI_V5;
  if (!D) return;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return [].slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ------------------------------------------------------------------
     Citations
     ------------------------------------------------------------------ */
  var usedSources = {};

  function cite(key) {
    var s = D.SOURCES[key];
    if (!s) return "";
    usedSources[key] = true;
    if (key === "siarchive") {
      return '<span class="f-pending" title="' + esc(s.detail) + '">Source required</span>';
    }
    return (
      '<a class="f-cite" href="' + s.url + '" target="_blank" rel="noopener" title="' +
      esc(s.detail) + '"><b>' + esc(s.label) + "</b><i>" +
      (s.date ? " · " + s.date : "") + "</i></a>"
    );
  }

  /* ==================================================================
     Masthead handoff — the navy hero header retires at the seam and the
     classical masthead takes over. One swap, at one place on the page.
     ================================================================== */
  (function masthead() {
    var folio = $(".folio");
    if (!folio) return;
    if (!("IntersectionObserver" in window)) {
      document.body.classList.add("is-folio");
      return;
    }
    var sentinel = $(".f-seam");
    new IntersectionObserver(
      function (entries) {
        document.body.classList.toggle("is-folio", !entries[0].isIntersecting);
      },
      { rootMargin: "-72px 0px 0px 0px", threshold: 0 }
    ).observe(sentinel || folio);
  })();

  /* ==================================================================
     I. The fork — choosing a path annotates the page rather than
     rearranging it. Reordering would break the reading; marking the
     relevant sections keeps both paths available to both readers.
     ================================================================== */
  (function fork() {
    var paths = $$(".f-path");
    if (!paths.length) return;
    paths.forEach(function (p) {
      p.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        var id = p.getAttribute("data-path");
        var already = p.classList.contains("is-chosen");
        paths.forEach(function (o) { o.classList.remove("is-chosen"); });
        if (already) {
          document.documentElement.removeAttribute("data-path");
          return;
        }
        p.classList.add("is-chosen");
        document.documentElement.setAttribute("data-path", id);
      });
    });
  })();

  /* ==================================================================
     II. The Record — ledger and genealogy over one dataset
     ================================================================== */
  (function record() {
    var host = $(".f-record");
    if (!host) return;
    var ledger = $(".f-ledger", host);
    var gen = $(".f-gen", host);

    ledger.innerHTML = D.RECORD.map(function (r) {
      var doc = r.claimSource;
      var docLine =
        "<b>" + esc(doc.title) + "</b>, " + esc(doc.author) + ", " + esc(doc.date) +
        (doc.note ? "<br />" + esc(doc.note) : "");
      var claimCites = doc.status === "pending" ? cite("siarchive") : cite(doc.source);
      var outCites = cite(r.followed.source) + (r.followed.source2 ? cite(r.followed.source2) : "");
      return (
        '<article class="f-entry" data-domain="' + r.domain + '">' +
          '<div class="f-entry-year">' + r.year + "</div>" +
          '<div class="f-side f-side-claim">' +
            '<p class="f-side-h">What was written</p>' +
            "<p>" + esc(r.claim) + "</p>" +
            '<div class="f-doc">' + docLine + "</div>" +
            '<div class="f-cites">' + claimCites + "</div>" +
          "</div>" +
          '<div class="f-side f-side-out">' +
            '<p class="f-side-h">What followed' + (r.followed.year ? " · " + r.followed.year : "") + "</p>" +
            "<p>" + esc(r.followed.text) + "</p>" +
            '<div class="f-cites">' + outCites + "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");

    gen.innerHTML =
      '<div class="f-gen-head"><span></span><span>Proposed</span><span>Dismissed</span><span>Adopted</span></div>' +
      D.RECORD.map(function (r) {
        return (
          '<div class="f-gen-row" data-domain="' + r.domain + '">' +
            '<div class="f-gen-y">' + r.year + "</div>" +
            '<div class="f-gen-cell" data-stage="proposed"><span class="f-gen-label">Proposed</span>' + esc(r.genealogy.proposed) + "</div>" +
            '<div class="f-gen-cell" data-stage="dismissed"><span class="f-gen-label">Dismissed</span>' + esc(r.genealogy.dismissed) + "</div>" +
            '<div class="f-gen-cell" data-stage="adopted"><span class="f-gen-label">Adopted</span>' + esc(r.genealogy.adopted) + "</div>" +
          "</div>"
        );
      }).join("");

    var domain = "all";

    function applyFilter() {
      $$("[data-domain]", host).forEach(function (el) {
        el.classList.toggle("is-hidden", domain !== "all" && el.getAttribute("data-domain") !== domain);
      });
    }

    $$("[data-record-domain]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        domain = b.getAttribute("data-record-domain");
        $$("[data-record-domain]", host).forEach(function (o) {
          o.setAttribute("aria-pressed", String(o === b));
        });
        applyFilter();
      });
    });

    $$("[data-record-view]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-record-view");
        host.classList.toggle("is-gen", v === "genealogy");
        $$("[data-record-view]", host).forEach(function (o) {
          o.setAttribute("aria-pressed", String(o === b));
        });
      });
    });
  })();

  /* ==================================================================
     IV. Method — the steelman spread and the glossary
     ================================================================== */
  (function method() {
    var host = $(".f-steel");
    if (host) {
      host.innerHTML = D.STEELMAN.map(function (s, i) {
        function col(side, label, cls) {
          return (
            '<div class="f-col ' + cls + '">' +
              '<p class="f-col-h">' + label + "</p>" +
              "<p>" + esc(side.text) + "</p>" +
              (side.cites.length
                ? '<div class="f-cites">' + side.cites.map(cite).join("") + "</div>"
                : "") +
            "</div>"
          );
        }
        return (
          '<div class="f-pair">' +
            '<p class="f-pair-q" data-n="' + (i + 1) + '">' + esc(s.question) + "</p>" +
            col(s.orthodox, "What the orthodox account holds", "f-col-orthodox") +
            col(s.physical, "What physical economy proposes", "f-col-physical") +
          "</div>"
        );
      }).join("");
    }

    var gloss = $(".f-gloss");
    if (gloss) {
      gloss.innerHTML = Object.keys(D.GLOSSARY).map(function (term) {
        return (
          "<details><summary>" + esc(term) + "</summary><p>" +
          esc(D.GLOSSARY[term]) + "</p></details>"
        );
      }).join("");
    }
  })();

  /* ==================================================================
     V. The Library — collections, facets, and the honest migration state
     of every item held in the legacy archive
     ================================================================== */
  (function library() {
    var host = $(".f-library");
    if (!host) return;

    var colls = $(".f-collections", host);
    if (colls) {
      colls.innerHTML = D.COLLECTIONS.map(function (c) {
        return (
          '<a class="f-collection" href="#library" data-collection="' + c.id + '">' +
            "<h4>" + esc(c.name) + "</h4><p>" + esc(c.note) + "</p>" +
          "</a>"
        );
      }).join("");
    }

    var shelf = $(".f-shelf", host);
    var MIG = { typeset: "re-typeset", scanned: "scan only", "not-migrated": "not yet migrated" };

    shelf.innerHTML = D.LIBRARY.slice()
      .sort(function (a, b) { return b.year - a.year; })
      .map(function (it) {
        return (
          '<article class="f-item" data-collection="' + it.collection +
            '" data-decade="' + it.decade + '" data-type="' + it.type + '">' +
            '<h4 class="f-item-t">' + esc(it.title) +
              '<span class="f-mig" data-m="' + it.migration + '">' + MIG[it.migration] + "</span>" +
            "</h4>" +
            '<span class="f-item-y">' + it.year + "</span>" +
            '<p class="f-item-m">' + esc(it.author) + " · " + esc(it.type) + "</p>" +
          "</article>"
        );
      }).join("");

    var state = { collection: "all", decade: "all", type: "all" };

    function decades() {
      var seen = {};
      D.LIBRARY.forEach(function (i) { seen[i.decade] = 1; });
      return Object.keys(seen).sort();
    }
    function types() {
      var seen = {};
      D.LIBRARY.forEach(function (i) { seen[i.type] = 1; });
      return Object.keys(seen).sort();
    }

    function facet(name, label, values) {
      return (
        '<div class="f-facet"><h4>' + label + '</h4><div class="f-chips">' +
        ['<button class="f-chip is-on" data-facet="' + name + '" data-v="all">All</button>']
          .concat(values.map(function (v) {
            return '<button class="f-chip" data-facet="' + name + '" data-v="' + esc(v) + '">' + esc(v) + "</button>";
          }))
          .join("") +
        "</div></div>"
      );
    }

    var facets = $(".f-facets", host);
    if (facets) {
      facets.innerHTML =
        facet("collection", "Collection",
          D.COLLECTIONS.map(function (c) { return c.id; })) +
        facet("decade", "Decade", decades()) +
        facet("type", "Type", types());
      /* Collection chips read better with their proper names. */
      $$('[data-facet="collection"]', facets).forEach(function (b) {
        var id = b.getAttribute("data-v");
        var c = D.COLLECTIONS.filter(function (x) { return x.id === id; })[0];
        if (c) b.textContent = c.name;
      });
    }

    var empty = $(".f-empty", host);

    function apply() {
      var shown = 0;
      $$(".f-item", shelf).forEach(function (el) {
        var ok =
          (state.collection === "all" || el.getAttribute("data-collection") === state.collection) &&
          (state.decade === "all" || el.getAttribute("data-decade") === state.decade) &&
          (state.type === "all" || el.getAttribute("data-type") === state.type);
        el.classList.toggle("is-hidden", !ok);
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }

    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-facet]");
      if (b) {
        var f = b.getAttribute("data-facet");
        state[f] = b.getAttribute("data-v");
        $$('[data-facet="' + f + '"]', host).forEach(function (o) {
          o.classList.toggle("is-on", o === b);
        });
        apply();
        return;
      }
      var c = e.target.closest("[data-collection].f-collection");
      if (c) {
        e.preventDefault();
        state.collection = c.getAttribute("data-collection");
        $$('[data-facet="collection"]', host).forEach(function (o) {
          o.classList.toggle("is-on", o.getAttribute("data-v") === state.collection);
        });
        apply();
        shelf.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      }
    });

    apply();
  })();

  /* ==================================================================
     VI. Conferences — the shelf of proceedings.
     Past events as book spines: the archive given a shape you can scan
     along, rather than a paginated list nobody reaches the end of.
     ================================================================== */
  (function spines() {
    var shelf = $(".f-spines");
    var read = $(".f-spine-read");
    if (!shelf || !read) return;
    var items = D.LIBRARY.filter(function (i) { return i.collection === "proceedings"; });
    /* Fill the shelf out with the rest of the corpus so it reads as a run of
       volumes; in the build this is a query loop over si_conference. */
    var all = items.concat(D.LIBRARY.filter(function (i) { return i.collection !== "proceedings"; }));
    shelf.innerHTML = all.map(function (i, n) {
      return '<button class="f-spine" data-n="' + n + '"><span>' + esc(i.title) + "</span></button>";
    }).join("");
    var MIG = { typeset: "re-typeset for the new library", scanned: "held as a scan only", "not-migrated": "not yet migrated from the legacy archive" };
    shelf.addEventListener("click", function (e) {
      var b = e.target.closest(".f-spine");
      if (!b) return;
      var i = all[+b.getAttribute("data-n")];
      $$(".f-spine", shelf).forEach(function (o) { o.classList.toggle("is-on", o === b); });
      read.innerHTML =
        '<p class="f-kicker f-kicker-mute">' + esc(i.type) + " · " + i.year + "</p>" +
        '<h4 class="f-h-sm">' + esc(i.title) + "</h4>" +
        "<p>" + esc(i.author) + " — " + MIG[i.migration] + ".</p>";
    });
  })();

  /* ==================================================================
     Colophon — every external authority the page cited, listed once.
     Generated from what actually rendered, so it cannot overstate.
     ================================================================== */
  (function colophon() {
    var host = $(".f-colophon ol");
    if (!host) return;
    window.setTimeout(function () {
      var keys = Object.keys(usedSources).filter(function (k) { return k !== "siarchive"; });
      host.innerHTML = keys.map(function (k) {
        var s = D.SOURCES[k];
        return (
          "<li>" + esc(s.label) + ", <i>" + esc(s.detail) + "</i>" +
          (s.via && s.via !== s.label ? " (" + esc(s.via) + ")" : "") +
          (s.date ? ", " + s.date : "") +
          ' — <a href="' + s.url + '" target="_blank" rel="noopener">link</a></li>'
        );
      }).join("");
      var n = $(".f-colophon-count");
      if (n) n.textContent = keys.length;
    }, 0);
  })();

  /* ==================================================================
     Reveals, forms, year
     ================================================================== */
  (function reveals() {
    var els = $$(".f-rev");
    if (!("IntersectionObserver" in window) || reduced) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach(function (el) { io.observe(el); });
  })();

  /* Prototype stubs. In the build these are NationBuilder embeds on the
     join. subdomain (handoff §4) — do not replace with a WP donation
     plugin, it would split the five-country supporter database. */
  $$(".f-signup").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type=email]");
      if (!input.value || input.value.indexOf("@") < 0) {
        input.focus();
        input.style.borderColor = "#7c1d2b";
        return;
      }
      var note = document.createElement("p");
      note.className = "f-form-note";
      note.textContent = "Check your inbox to confirm. (Prototype — no email was sent.)";
      form.insertAdjacentElement("afterend", note);
      form.remove();
    });
  });

  $$(".js-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
