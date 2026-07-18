export const meta = {
  name: 'si-classify-corpus',
  description: 'Classify all 5,343 schillerinstitute items into the v3 content model, with per-chunk adversarial verification',
  phases: [
    { title: 'Classify', detail: 'one agent per 120-item chunk' },
    { title: 'Verify', detail: 'independent spot-check of each chunk output' },
  ],
}

const WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
const chunks = Array.from({length: 3}, (_, i) =>
  `${WORK}/chunks-llm/chunk-${String(i).padStart(3, '0')}.jsonl`)

const RULES = `
You are classifying legacy WordPress items for the schillerinstitute.com rebuild (migration to a new content model). Work item-by-item, using your judgment — you are the reviewer of record, so decide; use low confidence instead of punting.

METHOD (mandatory): read the input file and judge EVERY item individually with your own reasoning — the titles/excerpts require language understanding (EN/DE/FR/RU). You may use a small script to reformat or assemble the output JSONL, but you MUST NOT encode keyword/regex rules and bulk-apply them as the classification — per-item decisions come from you, not from a script.

INPUT: a JSONL file; one item per line with: id, wp_type (post|page|portfolio_cpt|portfolio), status, date, slug, title, lang, cats (category slugs), ptax (portfolio_category slugs), meta_video (theme video flag), yt_url, sub_header, signals {yt_embed, yt_deeplink, pdf, ext_domains, len, signatory, transcript_marker}, excerpt (first ~700 chars, HTML-stripped).

TARGET final_type (exactly one): article (stays a blog post) | page (stays a page) | si_conference | si_presentation | si_video | si_document | si_statement | si_coverage | retire

DECISION RULES (ordered; first confident match wins; default = least disruptive):
1. wp_type portfolio_cpt -> si_presentation (always). wp_type portfolio: title like "Portfolio Item NN" -> retire; else si_presentation.
2. si_coverage: cats include hzl-coverage / activity-coverage / coverage-de / coverage-de-2 / old-coverage, OR the item is clearly a report that an EXTERNAL outlet covered SI (title names an outlet, excerpt summarizes third-party coverage, ext_domains has a news site). SI's own writing about events is NOT coverage.
3. si_video: meta_video or yt_embed, AND it is a broadcast episode: cats include webcast/hzl-webcast/webcast-de/webcast-mit-helga-zepp-larouche/hzl-video, or title matches webcast|dialogue|live with|fireside|broadcast|interview with (SI hosting). A text article that merely embeds a clip stays article.
4. si_statement: title/excerpt is a declaration/appeal/open letter/resolution/petition text/call (e.g. "Appeal to...", "Open Letter...", "Declaration...", "Ten Principles"), corroborated by signals.signatory or a signatory list / addressed-to-officials pattern in the excerpt. Reports ABOUT an appeal stay article.
5. si_conference: the item IS a conference landing/record: title = conference name possibly with date, excerpt has panels/agenda/speaker lists/registration. News reports about a conference stay article. Applies to posts AND pages.
6. si_presentation (R4.1): a page/post that is ONE talk: title like 'Speaker Name: "Talk Title"' or speaker+topic, with a single video (often yt_deeplink) and/or transcript_marker.
7. si_document: the item exists to deliver a PDF/report/study (excerpt is a short intro + download).
8. page: real evergreen pages (about, contact, campaign hubs, membership, magazine hubs) stay page.
9. retire: test/demo/junk (titles like TEST, test-home, error-404, SliderPro TEST, Icons, Navigation, Custom Pricing Tables, empty titles, URL-pasted-as-title stubs), superseded duplicates. Be conservative: when in doubt between retire and keep -> keep with note.
10. Everything else -> article.

ALSO ASSIGN per item:
- topics: 0-2 of exactly: "Peace & Strategy" (war/peace, geopolitics, diplomacy, sanctions, color revolutions, intelligence) | "Physical Economy" (economic development, finance, new financial architecture, energy production, infrastructure economics) | "New Silk Road & Great Projects" (BRI, World Land-Bridge, BRICS, big infrastructure projects) | "Classical Culture" (music, poetry, drama, art, choruses, Beethoven) | "Science & Space" | "Health & Food Security" (healthcare, pandemics, famine, agriculture) | "Energy & Environment" (environmentalism debate, Green New Deal critique, climate policy) | "Education & Youth" | "History & Method" (LaRouche legacy, historical analysis, method) | "New Paradigm" (civilizational vision, new renaissance, philosophy of the movement)
- region: one of Africa | Asia & Pacific | Eurasia | Europe | Southwest Asia | North America | Ibero-America | Global, ONLY if the item is substantially about that region/country. Else null.
- campaign: one of "International Peace Coalition" | "Oasis Plan" | "World Land-Bridge" | "Stop Green Fascism" | "Coincidence of Opposites" | "Operation Ibn Sina" | "LaRouche Youth Movement", ONLY on a clear signal (cats or title). Else null.
- series: one of "Weekly Webcast with HZL" | "Schlanger Daily Update" | "Daily Beethoven" | "IPC Meeting" | "Youth Class Series" | "Fundamentals of LaRouche Economics", if the item is an episode of it. Else null.
- person_hints: array of person names visible as SPEAKER/AUTHOR/SUBJECT-of-talk in title/sub_header/excerpt (full names only, strip honorifics into the name e.g. "Helga Zepp-LaRouche", include affiliation after a | pipe if visible, e.g. "Marco Zanni | Member of European Parliament"). Empty array if none.
- confidence: high | medium | low
- note: only when something odd (empty string otherwise).

German/French/Russian/Chinese items: same rules, same canonical English topic/region/campaign names.

OUTPUT: write a JSONL file (one line per input item, SAME order): {"id":..,"final_type":"..","confidence":"..","topics":[..],"region":..,"campaign":..,"series":..,"person_hints":[..],"note":".."}. Every input id must appear exactly once. Then return the summary via your structured output.`

const OUT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    chunk: { type: 'string' }, n_in: { type: 'number' }, n_out: { type: 'number' },
    counts_by_type: { type: 'object', additionalProperties: { type: 'number' } },
    low_confidence_ids: { type: 'array', items: { type: 'number' } },
    notes: { type: 'string' },
  },
  required: ['chunk', 'n_in', 'n_out', 'counts_by_type'],
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    chunk: { type: 'string' }, n_checked: { type: 'number' },
    disagreements: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'number' }, original: { type: 'string' }, mine: { type: 'string' }, reason: { type: 'string' },
    }, required: ['id', 'original', 'mine', 'reason'] } },
    systematic_issue: { type: 'string' },
  },
  required: ['chunk', 'n_checked', 'disagreements'],
}

log(`classifying ${chunks.length} chunks (~5,343 items)`)

const results = await pipeline(
  chunks,
  (chunk, _, idx) => {
    const out = `${WORK}/classified/out-${String(idx).padStart(3, '0')}.jsonl`
    return agent(
      `${RULES}\n\nYour input file: ${chunk}\nWrite your output JSONL to: ${out}\nRead the input, classify EVERY line, write the output file, then return the structured summary.`,
      { label: `classify:${idx}`, phase: 'Classify', schema: OUT_SCHEMA }
    ).then(r => ({ ...r, outFile: out, chunkFile: chunk, idx }))
  },
  (res, chunk, idx) => {
    if (!res) return null
    return agent(
      `You are an adversarial reviewer for a WordPress content-classification pass.\n\nSource items: ${res.chunkFile} (JSONL)\nClassifier output: ${res.outFile} (JSONL)\n\nThe classification rules the classifier was given are:\n${RULES}\n\nDo: (1) verify output has one line per input id (report if not); (2) pick ~12 items spread across the chunk, INCLUDING any si_statement/si_coverage/si_conference/retire decisions (these are the error-prone types) plus a few 'article' defaults; (3) independently judge each from the source data; (4) report only REAL disagreements on final_type or a clearly wrong retire (topic quibbles don't count). Return via structured output.`,
      { label: `verify:${idx}`, phase: 'Verify', schema: VERIFY_SCHEMA }
    ).then(v => ({ classify: res, verify: v }))
  }
)

const ok = results.filter(Boolean)
const totals = {}
let nOut = 0, disagreements = [], lowConf = 0, integrity = []
for (const r of ok) {
  nOut += r.classify.n_out
  lowConf += (r.classify.low_confidence_ids || []).length
  for (const [k, v] of Object.entries(r.classify.counts_by_type || {})) totals[k] = (totals[k] || 0) + v
  if (r.classify.n_in !== r.classify.n_out) integrity.push(r.classify.chunk)
  for (const d of (r.verify?.disagreements || [])) disagreements.push({ chunk: r.classify.idx, ...d })
}
log(`done: ${nOut} items classified, ${disagreements.length} verifier disagreements, ${lowConf} low-confidence`)
return { chunks_ok: ok.length, chunks_total: chunks.length, n_classified: nOut, totals, integrity_failures: integrity, disagreements, low_confidence_count: lowConf }