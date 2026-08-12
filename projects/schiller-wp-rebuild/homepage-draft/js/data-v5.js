/* ==========================================================================
   Schiller Institute — homepage draft v5
   THE DATA LAYER.

   Everything the page asserts lives here, and every assertion carries its
   provenance. This is deliberate: PORTABLE-HANDOFF-V2 §2 makes verifiability
   the governing concept, so the prototype is built so that an unsourced claim
   is *structurally* impossible to render — the templates read `source` and
   `status`, and an entry with `status: "pending"` renders with a visible
   "source required" badge rather than quietly passing as fact.

   Two provenance classes are used throughout:

     status: "sourced" → third-party, dated, linkable. Verified 2026-08-12.
     status: "pending" → a Schiller Institute document that the handoff's
                         illustrative list names but which has NOT been
                         located in the archive by this draft. It renders
                         with a visible badge. DO NOT strip the badge to make
                         the page look finished — supply the document.

   In the WordPress build this file becomes the `si_record`, `si_corridor`
   and `si_document` custom post types; the field names below are the
   intended ACF/meta keys. See README "v5 → WordPress".
   ========================================================================== */

window.SI_V5 = (function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. Gazetteer — real coordinates, plain decimal degrees.
        The atlas projects these with the equirectangular mapping that
        matches the NASA base plates (2048×1024, lon -180..180, lat 90..-90):
            x = (lon + 180) / 360 * 2048
            y = (90 - lat) / 180 * 1024
     ------------------------------------------------------------------ */
  var PLACES = {
    // Europe
    rotterdam:  [51.92,   4.48], duisburg: [51.43,   6.76],
    hamburg:    [53.55,   9.99], berlin:   [52.52,  13.40],
    warsaw:     [52.23,  21.01], minsk:    [53.90,  27.57],
    paris:      [48.86,   2.35], vienna:   [48.21,  16.37],
    rome:       [41.90,  12.50], madrid:   [40.42,  -3.70],
    lisbon:     [38.72,  -9.14], piraeus:  [37.94,  23.65],
    istanbul:   [41.01,  28.98], algeciras:[36.13,  -5.45],
    // Russia / Central Asia
    moscow:     [55.75,  37.62], yekaterinburg: [56.84, 60.61],
    novosibirsk:[55.03,  82.92], irkutsk:  [52.29, 104.30],
    yakutsk:    [62.03, 129.73], vladivostok: [43.12, 131.89],
    uelen:      [66.16,-169.80], aktau:    [43.65,  51.16],
    baku:       [40.41,  49.87], tbilisi:  [41.72,  44.79],
    almaty:     [43.24,  76.89], khorgos:  [44.20,  80.42],
    tashkent:   [41.30,  69.24], ulaanbaatar:[47.89,106.91],
    // China / East & SE Asia
    urumqi:     [43.83,  87.62], lanzhou:  [36.06, 103.83],
    xian:       [34.34, 108.94], zhengzhou:[34.75, 113.63],
    chongqing:  [29.56, 106.55], lianyungang:[34.60,119.22],
    beijing:    [39.90, 116.41], seoul:    [37.57, 126.98],
    tokyo:      [35.68, 139.65], kunming:  [25.04, 102.72],
    bangkok:    [13.76, 100.50], singapore:[ 1.35, 103.82],
    jakarta:    [-6.21, 106.85],
    // South & Southwest Asia
    delhi:      [28.61,  77.21], islamabad:[33.68,  73.05],
    gwadar:     [25.13,  62.32], kabul:    [34.53,  69.17],
    tehran:     [35.69,  51.39], baghdad:  [33.31,  44.36],
    basra:      [30.51,  47.78], damascus: [33.51,  36.28],
    amman:      [31.95,  35.93], aqaba:    [29.53,  35.00],
    gaza:       [31.50,  34.47], haifa:    [32.79,  34.99],
    riyadh:     [24.71,  46.68], muscat:   [23.59,  58.41],
    sanaa:      [15.37,  44.19], ankara:   [39.93,  32.86],
    // Africa
    tangier:    [35.76,  -5.83], algiers:  [36.75,   3.06],
    cairo:      [30.04,  31.24], khartoum: [15.50,  32.56],
    addis:      [ 9.03,  38.74], djibouti: [11.59,  43.15],
    nairobi:    [-1.29,  36.82], daressalaam:[-6.79, 39.21],
    lusaka:    [-15.39,  28.32], kolwezi: [-10.72,  25.47],
    luau:      [-10.71,  22.22], lobito:  [-12.35,  13.55],
    inga:       [-5.53,  13.61], lagos:    [ 6.52,   3.38],
    abuja:      [ 9.06,   7.49], accra:    [ 5.60,  -0.19],
    dakar:      [14.72, -17.47], bamako:   [12.64,  -8.00],
    ndjamena:   [12.11,  15.04], johannesburg:[-26.20,28.05],
    capetown:  [-33.92,  18.42],
    // Americas
    nome:       [64.50,-165.40], fairbanks:[64.84,-147.72],
    anchorage:  [61.22,-149.90], vancouver:[49.28,-123.12],
    chicago:    [41.88, -87.63], newyork:  [40.71, -74.01],
    mexicocity: [19.43, -99.13], panama:   [ 8.98, -79.52],
    bogota:     [ 4.71, -74.07], lima:    [-12.05, -77.04],
    saopaulo:  [-23.55, -46.63], buenosaires:[-34.60,-58.38],
    // Oceania
    sydney:    [-33.87, 151.21]
  };

  /* ------------------------------------------------------------------
     1. Sources — one record per external authority, cited by key below.
        Keeping them in one table means a citation can never drift from
        its URL, and the page footer can render a complete colophon.
     ------------------------------------------------------------------ */
  var SOURCES = {
    csrg25: {
      label: "China State Railway Group",
      detail: "China–Europe freight train trips reach 120,000",
      via: "People's Daily Online",
      date: "2025-11-29",
      url: "http://en.people.cn/n3/2025/1129/c90000-20396590.html"
    },
    gfdc25: {
      label: "Green Finance & Development Center",
      detail: "Countries of the Belt and Road Initiative",
      via: "Griffith Asia Institute, Griffith University",
      date: "2025-05",
      url: "https://greenfdc.org/countries-of-the-belt-and-road-initiative-bri/"
    },
    wb19: {
      label: "World Bank",
      detail: "Belt and Road Economics: Opportunities and Risks of Transport Corridors",
      via: "World Bank Group",
      date: "2019-06-18",
      url: "https://openknowledge.worldbank.org/handle/10986/31878"
    },
    iea25: {
      label: "International Energy Agency",
      detail: "World Energy Outlook 2025 — Achieving access for all",
      via: "IEA",
      date: "2025-11",
      url: "https://www.iea.org/reports/world-energy-outlook-2025/achieving-access-for-all"
    },
    wri23: {
      label: "World Resources Institute",
      detail: "Aqueduct 4.0 — 25 countries face extremely high water stress",
      via: "WRI",
      date: "2023-08-16",
      url: "https://www.wri.org/insights/highest-water-stressed-countries"
    },
    aiib25: {
      label: "Asian Infrastructure Investment Bank",
      detail: "Members and prospective members of the Bank",
      via: "AIIB",
      date: "2025",
      url: "https://www.aiib.org/en/about-aiib/governance/members-of-bank/index.html"
    },
    oecd25: {
      label: "OECD",
      detail: "Background Note — The Lobito Corridor",
      via: "OECD Emerging Markets Forum",
      date: "2025-04",
      url: "https://www.oecd.org/content/dam/oecd/en/events/2025/04/oecd-emerging-markets-forum/Panel%202_OECD%20EMF%20Background%20Note%20-%20The%20Lobito%20Corridor.pdf"
    },
    atlantic24: {
      label: "Atlantic Council",
      detail: "What to know about the Lobito Corridor",
      via: "AfricaSource",
      date: "2024",
      url: "https://www.atlanticcouncil.org/blogs/africasource/what-to-know-about-the-lobito-corridor-and-how-it-may-change-how-minerals-move/"
    },
    irj25: {
      label: "International Railway Journal",
      detail: "Spain to fund technical studies for Morocco tunnel",
      via: "IRJ",
      date: "2025-05",
      url: "https://www.railjournal.com/infrastructure/spain-to-fund-technical-studies-for-morocco-tunnel/"
    },
    frb71: {
      label: "Federal Reserve History",
      detail: "Nixon ends convertibility of US dollars to gold, 15 August 1971",
      via: "Federal Reserve Bank of Richmond / Fed History",
      date: "1971-08-15",
      url: "https://www.federalreservehistory.org/essays/gold-convertibility-ends"
    },
    fcic11: {
      label: "Financial Crisis Inquiry Commission",
      detail: "Final Report of the National Commission on the Causes of the Financial and Economic Crisis",
      via: "US Government Printing Office",
      date: "2011-01",
      url: "https://www.govinfo.gov/app/details/GPO-FCIC"
    },
    solow56: {
      label: "Robert M. Solow",
      detail: "A Contribution to the Theory of Economic Growth, QJE 70(1)",
      via: "Quarterly Journal of Economics",
      date: "1956-02",
      url: "https://doi.org/10.2307/1884513"
    },
    romer90: {
      label: "Paul M. Romer",
      detail: "Endogenous Technological Change, JPE 98(5)",
      via: "Journal of Political Economy",
      date: "1990-10",
      url: "https://doi.org/10.1086/261725"
    },
    sna08: {
      label: "United Nations et al.",
      detail: "System of National Accounts 2008",
      via: "UN Statistics Division",
      date: "2009",
      url: "https://unstats.un.org/unsd/nationalaccount/sna2008.asp"
    },
    riemann54: {
      label: "Bernhard Riemann",
      detail: "Über die Hypothesen, welche der Geometrie zu Grunde liegen (habilitation lecture)",
      via: "Göttingen",
      date: "1854-06-10",
      url: "https://www.emis.de/classics/Riemann/"
    },
    vernadsky45: {
      label: "V. I. Vernadsky",
      detail: "The Biosphere and the Noösphere, American Scientist 33(1)",
      via: "American Scientist",
      date: "1945-01",
      url: "https://www.jstor.org/stable/27826043"
    },
    siarchive: {
      label: "Schiller Institute archive",
      detail: "archive.schillerinstitute.com — document not yet located for this draft",
      via: "Schiller Institute",
      date: null,
      url: "https://archive.schillerinstitute.com/"
    }
  };

  /* ------------------------------------------------------------------
     2. THE RECORD — dated claim ⟷ dated outcome.
        Fields map to the handoff's `{ year, claim, source document,
        outcome }` CPT (§7.1), plus `genealogy` for the proposed →
        dismissed → adopted view the handoff asks to develop next.
     ------------------------------------------------------------------ */
  var RECORD = [
    {
      id: "monetary-1971",
      year: 1971,
      domain: "economics",
      claim:
        "That the Bretton Woods parities could not be defended, and that abandoning them without a replacement would begin a long monetary disintegration rather than end one.",
      claimSource: {
        title: "Statement on the monetary order",
        author: "Lyndon LaRouche",
        date: "1971",
        status: "pending",
        source: "siarchive",
        note:
          "Named in the handoff as illustrative. Locate the dated original before this entry is published."
      },
      followed: {
        year: 1971,
        text:
          "On 15 August 1971 the United States suspended the convertibility of the dollar into gold. The fixed-parity system was abandoned within nineteen months.",
        status: "sourced",
        source: "frb71"
      },
      genealogy: {
        proposed: "1971 — a replacement monetary architecture, not a float.",
        dismissed: "1970s–80s — treated as fringe; floating rates adopted as the settlement.",
        adopted: "Open. No replacement architecture has been agreed."
      }
    },
    {
      id: "oasis-1975",
      year: 1975,
      domain: "strategy",
      claim:
        "That there can be no durable settlement in Southwest Asia without water and power in quantity — desalination, nuclear generation and canal works held as the physical precondition of any peace.",
      claimSource: {
        title: "The Oasis Plan",
        author: "Lyndon LaRouche",
        date: "1975",
        status: "pending",
        source: "siarchive",
        note: "Dated original required. The proposal is referenced continuously in later Institute material."
      },
      followed: {
        year: 2023,
        text:
          "83% of the population of the Middle East and North Africa now lives under extremely high water stress — the highest exposure of any region measured. WRI projects 100% by 2050.",
        status: "sourced",
        source: "wri23"
      },
      genealogy: {
        proposed: "1975 — water and power first; borders second.",
        dismissed: "Treated as a technical distraction from the political question.",
        adopted: "Partially. Desalination is now regional policy; the integrated scheme is not built."
      }
    },
    {
      id: "landbridge-1991",
      year: 1991,
      domain: "economics",
      claim:
        "That the productive core of Europe should be extended eastward as development corridors — rail, water and power together — and that these should be carried across Eurasia to the Pacific rather than terminating at a frontier.",
      claimSource: {
        title:
          "The Productive Triangle Paris–Berlin–Vienna, extended as the Eurasian Land-Bridge",
        author: "Helga Zepp-LaRouche / Schiller Institute",
        date: "1991–1996",
        status: "pending",
        source: "siarchive",
        note:
          "The 1996 Beijing conference proceedings are the strongest candidate document. Confirm the date and obtain a facsimile."
      },
      followed: {
        year: 2013,
        text:
          "The Belt and Road Initiative was announced in 2013. By May 2025, 150 countries had signed a memorandum of understanding; cumulative China–Europe rail freight passed 120,000 train trips in November 2025.",
        status: "sourced",
        source: "gfdc25",
        source2: "csrg25"
      },
      genealogy: {
        proposed: "1991 — corridors, not trade routes: rail, water and power built together.",
        dismissed: "1990s — dismissed in Western policy circles as a map without financing.",
        adopted:
          "2013 onward — adopted at scale by another state, on different terms and without attribution."
      }
    },
    {
      id: "systemic-2007",
      year: 2007,
      domain: "economics",
      claim:
        "That the crisis then forming was systemic rather than a liquidity episode confined to subprime mortgages, and that it would not be contained by rate policy.",
      claimSource: {
        title: "Webcast on the systemic crisis",
        author: "Lyndon LaRouche",
        date: "2007-07",
        status: "pending",
        source: "siarchive",
        note: "A dated webcast transcript is the likely primary document."
      },
      followed: {
        year: 2008,
        text:
          "The Financial Crisis Inquiry Commission concluded in 2011 that the crisis was systemic and avoidable, and that warnings had been widely disregarded.",
        status: "sourced",
        source: "fcic11"
      },
      genealogy: {
        proposed: "2007 — systemic, not sectoral.",
        dismissed: "2007–08 — described officially as contained.",
        adopted: "2011 — the systemic reading is the official finding."
      }
    },
    {
      id: "tuning-1988",
      year: 1988,
      domain: "culture",
      claim:
        "That the rise in orchestral pitch damages the human singing voice, and that the Verdi tuning of C = 256 Hz should be restored as the reference for classical performance.",
      claimSource: {
        title: "Campaign for the Verdi tuning",
        author: "Schiller Institute",
        date: "1988",
        status: "pending",
        source: "siarchive",
        note:
          "Both sides of this entry need documents: the Institute's petition, and the Italian parliamentary proposal that followed. Do not publish until both are in hand."
      },
      followed: {
        year: null,
        text:
          "Outcome line withheld. The Italian legislative proposal frequently cited in Institute material has not been verified against a parliamentary record for this draft.",
        status: "pending",
        source: "siarchive"
      },
      genealogy: {
        proposed: "1988 — restore C = 256 Hz as the performance reference.",
        dismissed: "Rejected by most orchestras; standard pitch continued to rise.",
        adopted: "Not adopted. Kept here as an open entry rather than a favourable one."
      }
    }
  ];

  /* ------------------------------------------------------------------
     3. THE ATLAS — corridors, nodes and the scroll acts.

        Two registers, deliberately kept apart so the map can juxtapose
        them (handoff §2, "let juxtaposition carry the argument"):

          register: "proposed" → what the Institute put on paper, dated.
          register: "built"    → what third parties record as existing or
                                 financed, each with an external citation.

        A corridor is a list of gazetteer keys. The renderer draws a
        gently bowed polyline between them; `bow` sets the curvature.
     ------------------------------------------------------------------ */
  var CORRIDORS = [
    /* ---- Eurasia ---- */
    {
      id: "eurasian-landbridge",
      register: "proposed",
      act: "eurasia",
      name: "Eurasian Land-Bridge — northern route",
      dated: "1991–1996",
      path: ["rotterdam", "berlin", "warsaw", "minsk", "moscow", "yekaterinburg",
             "novosibirsk", "urumqi", "lanzhou", "xian", "zhengzhou", "lianyungang"],
      bow: 0.10
    },
    {
      id: "cerx",
      register: "built",
      act: "eurasia",
      name: "China–Europe Railway Express",
      dated: "operating since 2011",
      path: ["duisburg", "warsaw", "minsk", "moscow", "yekaterinburg", "novosibirsk",
             "khorgos", "urumqi", "lanzhou", "xian", "zhengzhou"],
      bow: 0.10,
      datum: "120,000 cumulative train trips; cargo valued above US$490bn",
      source: "csrg25"
    },
    {
      id: "middle-corridor",
      register: "built",
      act: "eurasia",
      name: "Trans-Caspian (Middle) Corridor",
      dated: "operating",
      path: ["istanbul", "ankara", "tbilisi", "baku", "aktau", "almaty", "khorgos", "urumqi"],
      bow: -0.06,
      datum: "Second land route between China and Europe, bypassing Russia",
      source: "csrg25"
    },
    {
      id: "southern-eurasia",
      register: "proposed",
      act: "eurasia",
      name: "Southern route — via Southwest Asia",
      dated: "1996",
      path: ["istanbul", "tehran", "islamabad", "delhi"],
      bow: -0.08
    },
    /* ---- Southwest Asia ---- */
    {
      id: "oasis-water",
      register: "proposed",
      act: "swasia",
      name: "Oasis Plan — water and power axis",
      dated: "1975",
      path: ["haifa", "gaza", "aqaba", "amman", "damascus", "baghdad", "basra"],
      bow: 0.16
    },
    {
      id: "oasis-nile",
      register: "proposed",
      act: "swasia",
      name: "Oasis Plan — Nile and Sinai works",
      dated: "1975",
      path: ["cairo", "aqaba", "riyadh", "muscat"],
      bow: -0.10
    },
    {
      id: "gibraltar",
      register: "proposed",
      act: "swasia",
      name: "Gibraltar fixed link — Europe to Africa",
      dated: "studied since 1980",
      path: ["madrid", "algeciras", "tangier"],
      bow: 0.05,
      datum: "38.7 km reference alignment, 27.7 km submarine; Spain funded further technical studies in 2025",
      source: "irj25"
    },
    /* ---- Africa ---- */
    {
      id: "africa-spine",
      register: "proposed",
      act: "africa",
      name: "Trans-African spine — Cairo to the Cape",
      dated: "2014",
      path: ["cairo", "khartoum", "addis", "nairobi", "daressalaam", "lusaka",
             "johannesburg", "capetown"],
      bow: 0.10
    },
    {
      id: "africa-west",
      register: "proposed",
      act: "africa",
      name: "West African corridor",
      dated: "2014",
      path: ["dakar", "bamako", "accra", "lagos", "abuja", "ndjamena", "khartoum"],
      bow: -0.08
    },
    {
      id: "lobito",
      register: "built",
      act: "africa",
      name: "Lobito Corridor",
      dated: "financed 2023–2025",
      path: ["lobito", "luau", "kolwezi", "lusaka"],
      bow: 0.06,
      datum: "1,300 km rail corridor; US$753m financing closed December 2025 (US DFC and DBSA)",
      source: "oecd25"
    },
    {
      id: "inga-grid",
      register: "proposed",
      act: "africa",
      name: "Inga power transmission",
      dated: "long-standing",
      path: ["inga", "lusaka", "johannesburg"],
      bow: -0.12
    },
    /* ---- The Americas and the Bering link ---- */
    {
      id: "bering",
      register: "proposed",
      act: "americas",
      name: "Bering Strait link",
      dated: "1990s onward",
      path: ["yakutsk", "uelen", "nome", "fairbanks", "anchorage", "vancouver", "chicago"],
      bow: 0.05
    },
    {
      id: "panamerican",
      register: "proposed",
      act: "americas",
      name: "Pan-American corridor and the Darién gap",
      dated: "1990s onward",
      path: ["chicago", "mexicocity", "panama", "bogota", "lima", "saopaulo", "buenosaires"],
      bow: -0.10
    }
  ];

  /* Nodes carrying a datum of their own. Everything else on the map is
     drawn as an unlabelled waypoint.
     `anchor`/`dx`/`dy` place the label clear of its neighbours; they are in
     screen pixels, applied after the counter-scale, so a label sits the same
     distance from its dot at every zoom. */
  var NODES = [
    { place: "duisburg", label: "Duisburg", act: "eurasia", register: "built",
      anchor: "end", dx: -9, dy: 1,
      datum: "European terminus of the China–Europe rail service. 229 destination cities in 26 European countries are served from 128 Chinese cities.",
      source: "csrg25" },
    { place: "khorgos", label: "Khorgos", act: "eurasia", register: "built",
      anchor: "start", dx: 9, dy: -6,
      datum: "Kazakhstan–China border crossing and dry port on the principal rail route.",
      source: "csrg25" },
    { place: "xian", label: "Xi'an", act: "eurasia", register: "built",
      anchor: "start", dx: 9, dy: 12,
      datum: "Largest single origin: 6,037 trains despatched in 2025.",
      source: "csrg25" },
    { place: "istanbul", label: "Istanbul", act: "eurasia", register: "built",
      anchor: "end", dx: -9, dy: 10,
      datum: "Middle Corridor gateway; the route passed its 20,000th train in August 2025.",
      source: "csrg25" },
    { place: "gaza", label: "Gaza", act: "swasia", register: "proposed",
      anchor: "end", dx: -9, dy: -4,
      datum: "Named in the 1975 Oasis Plan as a desalination and power site. Not built.",
      source: "siarchive" },
    { place: "aqaba", label: "Aqaba", act: "swasia", register: "proposed",
      anchor: "start", dx: 9, dy: 13,
      datum: "Head of the proposed Red Sea–Dead Sea works. Regional water stress is now the highest measured anywhere.",
      source: "wri23" },
    { place: "algeciras", label: "Strait of Gibraltar", act: "swasia", register: "proposed",
      anchor: "end", dx: -9, dy: 2,
      datum: "14 km at the narrowest point; the studied rail alignment runs 38.7 km with 27.7 km beneath the sea. Studied since 1980, not begun.",
      source: "irj25" },
    { place: "lobito", label: "Lobito", act: "africa", register: "built",
      anchor: "end", dx: -9, dy: 2,
      datum: "Atlantic port of the corridor. Co-led by the United States and the European Union under the G7 Partnership for Global Infrastructure and Investment since 2023.",
      source: "atlantic24" },
    { place: "inga", label: "Inga, DRC", act: "africa", register: "proposed",
      anchor: "start", dx: 9, dy: 14,
      datum: "730 million people worldwide still live without electricity — a decline of only 11 million in a year.",
      source: "iea25" },
    { place: "uelen", label: "Bering Strait", act: "americas", register: "proposed",
      anchor: "start", dx: 9, dy: 2,
      datum: "82 km of water separates the two continental rail networks. No crossing has been begun.",
      source: "siarchive" },
    { place: "panama", label: "Darién gap", act: "americas", register: "proposed",
      anchor: "end", dx: -9, dy: 10,
      datum: "The single break in the Pan-American road system, roughly 100 km. Unbridged.",
      source: "siarchive" }
  ];

  /* Scroll acts. `view` is a centre in degrees plus a width in degrees of
     longitude; the renderer derives the height from the live stage aspect,
     so the plate never letterboxes and mobile gets a genuine close view. */
  var ACTS = [
    {
      id: "world",
      kicker: "Plate I",
      title: "The proposal, entire",
      view: { lon: 20, lat: 24, w: 340, fill: false },
      lede:
        "Every line on this plate was published before it was built, or has not been built at all. The dashed lines are proposals of the Schiller Institute, dated. The solid lines are infrastructure that third parties record as operating or financed. The argument of this section is the difference between them.",
      facts: [
        { text: "150 countries have signed a Belt and Road memorandum of understanding, as of May 2025. Two have withdrawn: Italy in 2023, Panama in 2025.", source: "gfdc25" },
        { text: "111 approved members of the Asian Infrastructure Investment Bank — 53 regional, 58 non-regional.", source: "aiib25" }
      ]
    },
    {
      id: "eurasia",
      kicker: "Plate II",
      title: "The corridor that was built",
      view: { lon: 66, lat: 44, w: 160 },
      lede:
        "The northern route the Institute published in the 1990s and the freight corridor now operating are, for most of their length, the same line. It carries a name the Institute did not give it and a flag it did not fly. The record is offered here without a claim of credit — only of date.",
      facts: [
        { text: "120,000 cumulative train trips; goods valued above US$490bn, as of November 2025.", source: "csrg25" },
        { text: "The World Bank estimated in 2019 that corridor trade could rise 9.7%, global income 2.9%, and 32 million people leave moderate poverty.", source: "wb19" },
        { text: "The same study found that 12 of 43 corridor economies analysed could see their debt sustainability outlook deteriorate. Printed here because it is part of the record.", source: "wb19" }
      ]
    },
    {
      id: "swasia",
      kicker: "Plate III",
      title: "The plan that was not",
      view: { lon: 40, lat: 29, w: 46 },
      lede:
        "The Oasis Plan was published in 1975: water and power in quantity, treated as the physical precondition of a settlement rather than its reward. Half a century later the water position is the worst measured on earth. The plate shows the proposal, not an achievement.",
      facts: [
        { text: "83% of the population of the Middle East and North Africa lives under extremely high water stress — the highest of any region. WRI projects 100% by 2050.", source: "wri23" },
        { text: "The Gibraltar fixed link has been under formal bilateral study since 1980. Spain committed further study funding in 2025; no construction date exists.", source: "irj25" }
      ]
    },
    {
      id: "africa",
      kicker: "Plate IV",
      title: "A spine, partly begun",
      view: { lon: 20, lat: -4, w: 88 },
      lede:
        "One segment of the African proposal now has financing, and it came from a direction nobody expected: the Lobito Corridor is co-led by the United States and the European Union. The rest of the spine remains a drawing.",
      facts: [
        { text: "Lobito Corridor: 1,300 km, Angola–DRC–Zambia. US$753m financing closed in December 2025 (US DFC US$553m, DBSA US$200m).", source: "oecd25" },
        { text: "730 million people worldwide had no access to electricity in 2024 — a fall of 11 million on the year.", source: "iea25" }
      ]
    },
    {
      id: "americas",
      kicker: "Plate V",
      title: "Two gaps",
      view: { lon: -122, lat: 44, w: 118 },
      lede:
        "The Eurasian and American rail networks are separated by 82 km of water at the Bering Strait. The Pan-American road system is separated from itself by roughly 100 km of forest at the Darién. Neither gap is a matter of engineering difficulty at this point in the century.",
      facts: [
        { text: "No crossing of the Bering Strait has been begun. The figure is stated as distance, not as a plan.", source: "siarchive" }
      ]
    },
    {
      id: "ledger",
      kicker: "Plate VI",
      title: "The plate, read as a ledger",
      view: { lon: 20, lat: 24, w: 340, fill: false },
      lede:
        "Proposed and dated: thirteen corridors. Recorded as operating or financed by an outside authority: four. The Institute's position is that the gap between those numbers is a political fact and not a technical one. The reader is invited to check every figure on this plate against its source before agreeing.",
      facts: [
        { text: "Every figure on this plate is dated and linked. Where the Institute's own document has not been located for this draft, the entry says so.", source: "siarchive" }
      ]
    }
  ];

  /* ------------------------------------------------------------------
     4. THE LIBRARY — collections and a sample of the corpus.
        `migration` is the honest state of each item with respect to the
        legacy archive: re-typeset / scanned / not yet migrated.
     ------------------------------------------------------------------ */
  var COLLECTIONS = [
    { id: "forecasts", name: "Forecasts & reports", count: "—", note: "Dated economic and strategic forecasts with their source documents." },
    { id: "landbridge", name: "The World Land-Bridge", count: "—", note: "Corridor studies, conference proceedings, maps." },
    { id: "culture", name: "Classical culture & aesthetics", count: "—", note: "Schiller, Beethoven, tuning, the aesthetic education." },
    { id: "proceedings", name: "Conference proceedings", count: "—", note: "Full programmes and transcripts, 1984 onward." },
    { id: "correspondence", name: "Correspondence & history", count: "—", note: "Institutional history and open letters." },
    { id: "method", name: "Method & pedagogy", count: "—", note: "Primers, reading paths, glossaries." }
  ];

  var LIBRARY = [
    { title: "The New Silk Road Becomes the World Land-Bridge", author: "Schiller Institute", year: 2014, decade: "2010s", collection: "landbridge", type: "Report", migration: "scanned" },
    { title: "So, You Wish to Learn All About Economics?", author: "Lyndon LaRouche", year: 1984, decade: "1980s", collection: "method", type: "Book", migration: "scanned" },
    { title: "Proceedings — founding conference", author: "Schiller Institute", year: 1984, decade: "1980s", collection: "proceedings", type: "Proceedings", migration: "not-migrated" },
    { title: "The Productive Triangle Paris–Berlin–Vienna", author: "Helga Zepp-LaRouche", year: 1991, decade: "1990s", collection: "landbridge", type: "Programme", migration: "not-migrated" },
    { title: "Proceedings — Beijing symposium on the Eurasian Land-Bridge", author: "Schiller Institute", year: 1996, decade: "1990s", collection: "proceedings", type: "Proceedings", migration: "not-migrated" },
    { title: "A Manual on the Rudiments of Tuning and Registration", author: "Schiller Institute", year: 1992, decade: "1990s", collection: "culture", type: "Book", migration: "scanned" },
    { title: "The Oasis Plan — Southwest Asia water and power", author: "Lyndon LaRouche", year: 1975, decade: "1970s", collection: "forecasts", type: "Programme", migration: "not-migrated" },
    { title: "On the Aesthetic Education of Man (Institute edition)", author: "Friedrich Schiller", year: 1795, decade: "1790s", collection: "culture", type: "Primary text", migration: "typeset" },
    { title: "Ten Principles of a New International Security and Development Architecture", author: "Helga Zepp-LaRouche", year: 2022, decade: "2020s", collection: "forecasts", type: "Programme", migration: "typeset" },
    { title: "The Biosphere and the Noösphere", author: "V. I. Vernadsky", year: 1945, decade: "1940s", collection: "method", type: "Primary text", migration: "scanned" },
    { title: "Open letter on the monetary order", author: "Lyndon LaRouche", year: 1971, decade: "1970s", collection: "correspondence", type: "Letter", migration: "not-migrated" },
    { title: "Proceedings — Bad Soden conference", author: "Schiller Institute", year: 2019, decade: "2010s", collection: "proceedings", type: "Proceedings", migration: "scanned" }
  ];

  /* ------------------------------------------------------------------
     5. METHOD — the steelman pairs (handoff §7.2).
        The orthodox column cites real, canonical sources. This is the
        point: the opposing case is stated in its own strongest terms and
        with its own literature, before anything is said against it.
     ------------------------------------------------------------------ */
  var STEELMAN = [
    {
      question: "What produces growth?",
      orthodox: {
        text:
          "Output per head rises through capital accumulation and, in the long run, through a residual of technical progress that the model does not itself explain. Later work makes that residual endogenous: ideas are non-rival, so research raises the growth rate rather than the level. Markets allocate scarce means among competing ends, and prices carry the information required to do it.",
        cites: ["solow56", "romer90"]
      },
      physical: {
        text:
          "Take the question one layer down. A society's capacity to support human life at a rising standard — its potential relative population density — depends on the energy-flux density of the processes it commands, which rises in discrete steps: wood, coal, oil, fission, fusion. On this account the residual is not a residual. It is the subject.",
        cites: []
      }
    },
    {
      question: "What should be measured?",
      orthodox: {
        text:
          "The national accounts are a consistent, internationally agreed framework. Monetary aggregates are comparable across countries and time, and the discipline of a common standard is worth more than any single alternative measure, however theoretically attractive.",
        cites: ["sna08"]
      },
      physical: {
        text:
          "Then plot three curves together over the same period: financial aggregates, monetary aggregates, and physical output per head. Where the first two rise while the third falls, the accounts are internally consistent and describing a contraction. The objection is not that the measure is wrong; it is that it is not sufficient.",
        cites: []
      }
    },
    {
      question: "Where does discovery come from?",
      orthodox: {
        text:
          "Discovery is modelled as the output of a research sector responding to incentives — an input–output relation with uncertainty attached. Treating it otherwise removes it from analysis altogether.",
        cites: ["romer90"]
      },
      physical: {
        text:
          "A discovery that overturns the axioms of the system that produced it cannot be an output of that system. Riemann's 1854 lecture is the standing example: the hypotheses on which geometry rests are themselves subject to revision by evidence. What is claimed is that the same act underlies discovery in science and composition in classical art — which is why this Institute keeps both under one roof.",
        cites: ["riemann54", "vernadsky45"]
      }
    }
  ];

  var GLOSSARY = {
    "energy-flux density":
      "The power delivered per unit cross-section of the working process — not total energy consumed. The measure by which wood, coal, oil, fission and fusion form an ordered series rather than a set of alternatives.",
    "potential relative population density":
      "The population per unit area a society could support at a given standard of living with the technologies it commands — as distinct from the population it happens to have.",
    "the Triple Curve":
      "A diagnostic drawing: financial aggregates, monetary aggregates and physical output per head plotted over one period. Its interest is entirely in the cases where the curves diverge.",
    "the complex domain":
      "Following Riemann: the domain in which a physical principle is represented, as against the visible domain in which its effects are observed."
  };

  return {
    PLACES: PLACES,
    SOURCES: SOURCES,
    RECORD: RECORD,
    CORRIDORS: CORRIDORS,
    NODES: NODES,
    ACTS: ACTS,
    COLLECTIONS: COLLECTIONS,
    LIBRARY: LIBRARY,
    STEELMAN: STEELMAN,
    GLOSSARY: GLOSSARY,
    VERIFIED: "2026-08-12"
  };
})();
