export const meta = {
  name: 'si-person-resolution',
  description: 'Adjudicate person-mention buckets into canonical Person records (entity resolution)',
  phases: [
    { title: 'Scout', detail: 'list input chunks' },
    { title: 'Adjudicate', detail: 'one agent per mention-bucket chunk' },
    { title: 'Verify', detail: 'independent re-check of risky merges' },
  ],
}

const WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'

const files = await agent(
  `Run: ls ${WORK}/person-chunks/pchunk-*.json — return the sorted list of absolute file paths via structured output.`,
  { label: 'scout', phase: 'Scout', schema: { type: 'object', additionalProperties: false, properties: { paths: { type: 'array', items: { type: 'string' } } }, required: ['paths'] } }
)
log(`${files.paths.length} person chunks`)

const RULES = `
You are the entity-resolution adjudicator for the schillerinstitute.com migration. Input file: a JSON array of surname buckets; each bucket = {bucket, mentions:[{name, affil, src (portfolio|wp-hint|yt), ref, lang}]}. Mentions inside one bucket share a normalized surname+first-initial, but the SAME real person may also have transliteration variants (Kortunow/Kortunov, w<->v already folded) and honorific residue; DIFFERENT real people may share a bucket (family members, common surnames).

For each bucket decide the canonical person(s):
- MERGE mentions that are the same human (spelling/transliteration/diacritic/honorific variants; affiliation agreement is strong evidence; e.g. "Helga Zepp-LaRouche" == "Helga Zepp LaRouche").
- SPLIT genuinely different people (e.g. "Lyndon LaRouche" vs "Helga Zepp-LaRouche" never merge; junior/senior; different affiliations AND different first names).
- DROP garbage rows that are not human names (organizations, talk-title fragments, "Question Answers", song titles). Be ruthless with garbage, conservative with merges: if unsure two mentions are the same person, keep them separate and flag.
- canonical_name: full name, no honorific, Latin script preferred if variants exist (keep the most complete/most frequent form).
- honorific: Dr./Prof./Sen./Amb./H.E./Col. etc. if consistently present, else "".
- affiliation: the best single affiliation (most informative, English preferred).
- person_type: one of Leadership (SI principals: Helga Zepp-LaRouche, Lyndon LaRouche, Harley Schlanger, Dennis Speed, Diane Sare, Jacques Cheminade, Dennis Small, Megan Dobrodt, Jason Ross, Daniel Burke, Anastasia Battle and similar SI/LaRouche-movement officials) | Guest (external speakers: diplomats, ex-officials, academics) | Author | Unknown.
Write your result file (path given below) as JSON:
{"persons":[{"key":"<bucket>-<n>","canonical_name":..,"honorific":..,"affiliation":..,"person_type":..,"aliases":[..distinct raw spellings..],"mention_refs":[{"src":..,"ref":..}] }], "dropped":[..raw names dropped as non-person..], "uncertain":[{"names":[..],"why":..}]}
Then return the structured summary.`

const ADJ_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  chunk: { type: 'string' }, n_mentions: { type: 'number' }, n_persons: { type: 'number' },
  n_dropped: { type: 'number' }, n_uncertain: { type: 'number' }, risky_merge_keys: { type: 'array', items: { type: 'string' } },
}, required: ['chunk', 'n_mentions', 'n_persons', 'n_dropped', 'n_uncertain'] }

const VER_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  chunk: { type: 'string' }, problems: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
    key: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['key', 'issue', 'fix'] } },
}, required: ['chunk', 'problems'] }

const results = await pipeline(
  files.paths,
  (p, _, i) => {
    const out = `${WORK}/persons/padj-${String(i).padStart(3, '0')}.json`
    return agent(`${RULES}\n\nInput file: ${p}\nWrite result to: ${out}\nProcess EVERY bucket.`,
      { label: `adjudicate:${i}`, phase: 'Adjudicate', schema: ADJ_SCHEMA }).then(r => ({ ...r, out, src: p, i }))
  },
  (r, p, i) => {
    if (!r) return null
    return agent(
      `Adversarially review entity-resolution output.\nSource mentions: ${r.src}\nAdjudication: ${r.out}\nCheck: (1) every WRONG MERGE (two different humans merged — compare first names + affiliations); (2) every WRONG SPLIT among high-frequency names (same person kept apart); (3) SI principals typed Guest or vice versa; (4) real people wrongly dropped as garbage. Inspect ALL merges with >1 alias plus 10 random persons. Report only real problems with a concrete fix.`,
      { label: `verify:${i}`, phase: 'Verify', schema: VER_SCHEMA }).then(v => ({ adj: r, ver: v }))
  }
)

const ok = results.filter(Boolean)
let persons = 0, mentions = 0, dropped = 0, uncertain = 0, problems = []
for (const r of ok) {
  persons += r.adj.n_persons; mentions += r.adj.n_mentions; dropped += r.adj.n_dropped; uncertain += r.adj.n_uncertain
  for (const p of (r.ver?.problems || [])) problems.push({ chunk: r.adj.i, ...p })
}
log(`persons: ${persons} canonical from ${mentions} mentions; ${problems.length} verifier problems`)
return { chunks: ok.length, mentions, persons, dropped, uncertain, problems }