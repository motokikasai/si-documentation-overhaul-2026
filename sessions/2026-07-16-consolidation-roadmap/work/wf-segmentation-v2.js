export const meta = {
  name: 'si-video-segmentation',
  description: '5-case sort of conference-playlist videos into presentation plans (size-budgeted batches)',
  phases: [
    { title: 'Plan', detail: 'one low-effort agent per ~5KB video batch' },
    { title: 'Verify', detail: 'full-effort re-check of Case-1 split proposals only' },
  ],
}

const WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
const N_BATCHES = 93 // from repack_seg_batches.py manifest

const RULES = `
You are planning YouTube -> WordPress presentation ingestion for schillerinstitute.com. Input: ONE batch file (JSON): {playlist_id, playlist_title, batch_index, n_batches, is_first_batch, wp_candidates, videos:[{id,title,duration(sec),upload_date,chapters,description (intro + ---AGENDA--- lines, pre-trimmed)}]}.

TASKS:
1. Only if is_first_batch: match the conference against wp_candidates (WP posts/pages) by title/date/language -> wp_match:{wp_id, confidence} or null; if null, create_new:{title, start_date YYYY-MM-DD, language}.
2. For EVERY video apply the FIVE-CASE sort:
 - Case 1 (split): per-SPEAKER timestamps parseable from description agenda lines (leading "0:00 ·" or trailing "... 1:04:23") or chapters that mirror them. presentations:[{title (talk title if given else "{Speaker} — {video title}"), presenter, presenter_affiliation, start_seconds, end_seconds (next mark or duration), kind:"Talk"}]. VALIDATE ascending + < duration; if times are corrupted/out-of-order, prefer consistent chapters, else drop times -> Case 5 keeping the agenda.
 - Case 2 (chaptered talk): timestamps but labels are TOPICS around one speaker -> 1 presentation kind:"Chaptered talk", chapters:[{label,start_seconds}].
 - Case 3 (single talk, no timestamps): one speaker, whole video -> 1 presentation kind:"Talk" (2017-2019 era: title often "Speaker: Title" -> parse presenter from video title).
 - Case 4 (multi-talk, no signal): 1 presentation kind:"Full session", known speakers listed.
 - Case 5 (agenda without times): ordered speaker list, no usable times -> 1 presentation kind:"Full session" with agenda:[{presenter, affiliation, talk_title}], upgrade_candidate:true.
 Short per-speaker excerpt videos duplicating a panel -> kind:"Excerpt", note which speaker; don't double-create.
Write the plan JSON to the output path given below:
{"playlist_id":..,"batch_index":..,"wp_match":..,"create_new":..,"videos":[{"id":..,"case":..,"presentations":[..],"notes":".."}]}
Then return the structured summary. Be decisive; note oddities, never leave a video unplanned.`

const PLAN_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  batch: { type: 'number' }, n_videos: { type: 'number' }, n_presentations: { type: 'number' },
  case_counts: { type: 'object', additionalProperties: { type: 'number' } },
  has_case1: { type: 'boolean' }, flags: { type: 'string' },
}, required: ['batch', 'n_videos', 'n_presentations', 'has_case1'] }

const VER_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  batch: { type: 'number' }, problems: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
    video_id: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['video_id', 'issue', 'fix'] } },
}, required: ['batch', 'problems'] }

const batches = Array.from({ length: N_BATCHES }, (_, i) => i)
log(`planning ${N_BATCHES} video batches (529 videos, 41 conference playlists)`)

const results = await pipeline(
  batches,
  (i) => {
    const src = `${WORK}/seg-batches/seg-batch-${String(i).padStart(3, '0')}.json`
    const out = `${WORK}/seg-out/segout-${String(i).padStart(3, '0')}.json`
    return agent(`${RULES}\n\nInput batch: ${src}\nWrite plan to: ${out}`,
      { label: `plan:${i}`, phase: 'Plan', schema: PLAN_SCHEMA, effort: 'low' })
      .then(r => ({ ...r, out, src, i }))
  },
  (r) => {
    if (!r) return null
    if (!r.has_case1) return { plan: r, ver: { batch: r.i, problems: [] } } // only split proposals get expensive verification
    return agent(
      `Verify Case-1 split proposals in a video-segmentation plan.\nSource batch: ${r.src}\nPlan: ${r.out}\nFor EVERY video planned as Case 1: re-derive the timestamps from the description yourself; confirm strictly ascending, end<duration, presenters are human names not topics, no listed speaker missed. Report only real problems with concrete fixes.`,
      { label: `verify:${r.i}`, phase: 'Verify', schema: VER_SCHEMA })
      .then(v => ({ plan: r, ver: v }))
  }
)

const ok = results.filter(Boolean)
const cases = {}
let pres = 0, problems = []
for (const r of ok) {
  pres += r.plan.n_presentations || 0
  for (const [k, v] of Object.entries(r.plan.case_counts || {})) cases[k] = (cases[k] || 0) + v
  for (const p of (r.ver?.problems || [])) problems.push({ batch: r.plan.i, ...p })
}
log(`planned ${ok.length}/${N_BATCHES} batches, ${pres} presentations, ${problems.length} problems`)
return { batches_ok: ok.length, batches_total: N_BATCHES, presentations: pres, case_counts: cases, problems }