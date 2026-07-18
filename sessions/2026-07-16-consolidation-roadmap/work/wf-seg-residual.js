export const meta = {
  name: 'si-seg-residual',
  description: 'Resolve the 220 ambiguous conference videos the deterministic pre-sorter could not decide',
  phases: [{ title: 'Resolve', detail: 'one low-effort agent per 12-video batch' }],
}

const WORK = '/Users/m.kasai/workspace/tutorials/wp-si-grill-me/sessions/2026-07-16-consolidation-roadmap/work'
const N = 19

const RULES = `
You resolve ambiguous YouTube conference videos for the schillerinstitute.com migration. Input file: a JSON array of videos; each has {playlist_id, playlist_title, video_id, video_title, duration (sec), upload_date, why, ...} plus one of: desc_head (first 900 chars of description), marks (parsed timestamp lines), chapters.

Per video, based on its 'why':
- "no clear signal": these are mostly single talks/excerpts whose TITLE is the talk topic and whose SPEAKER is named only in the description prose (or is inferable: e.g. quotes by known SI figures). Identify the presenter (full name, no honorific) + affiliation from desc_head/title. Then: duration<300 -> one presentation kind "Excerpt"; multi-speaker cues (panel/session/roundtable, several names) -> kind "Full session" with the names; concert/music -> kind "Talk" with note "performance"; else kind "Talk". Title = the talk title (clean the video title). If no presenter is identifiable, presenter null + note "presenter unresolved" — never invent a name.
- "timestamps invalid/out-of-order": labels/order are trustworthy, times are not. If chapters are present and strictly ascending, use chapter times to build a Case-1 split (one presentation per speaker-labeled chapter). Else emit ONE kind "Full session" presentation with agenda [{presenter, affiliation, talk_title}] in the marks' listed order, upgrade_candidate true.
- "ambiguous name/topic ratio": decide whether the marks name SPEAKERS (-> split into per-speaker presentations kind "Talk" with start/end seconds) or SECTIONS of one talk (-> one kind "Chaptered talk" with chapters).

Write the result JSON array to the output path given below — one entry per input video, SAME order:
{"video_id":..,"playlist_id":..,"case":1|2|3|4|5,"presentations":[{"title":..,"presenter":..,"presenter_affiliation":..,"start_seconds":..,"end_seconds":..,"kind":..,"chapters":..,"agenda":..,"upgrade_candidate":..}],"notes":".."}
Every input video must appear exactly once. Then return the structured summary.`

const SCHEMA = { type: 'object', additionalProperties: false, properties: {
  batch: { type: 'number' }, n_in: { type: 'number' }, n_out: { type: 'number' },
  n_presentations: { type: 'number' }, presenter_unresolved: { type: 'number' }, flags: { type: 'string' },
}, required: ['batch', 'n_in', 'n_out', 'n_presentations'] }

const results = await pipeline(
  Array.from({ length: N }, (_, i) => i),
  (i) => {
    const src = `${WORK}/seg-llm/videos-${String(i).padStart(3, '0')}.json`
    const out = `${WORK}/seg-out/segllm-${String(i).padStart(3, '0')}.json`
    return agent(`${RULES}\n\nInput: ${src}\nWrite output to: ${out}\nBatch number: ${i}`,
      { label: `resolve:${i}`, phase: 'Resolve', schema: SCHEMA, effort: 'low' })
  }
)

const ok = results.filter(Boolean)
const totals = { batches_ok: ok.length, batches_total: N,
  videos: ok.reduce((s, r) => s + (r.n_out || 0), 0),
  presentations: ok.reduce((s, r) => s + (r.n_presentations || 0), 0),
  presenter_unresolved: ok.reduce((s, r) => s + (r.presenter_unresolved || 0), 0),
  integrity: ok.filter(r => r.n_in !== r.n_out).map(r => r.batch) }
log(`resolved ${totals.videos} videos -> ${totals.presentations} presentations (${totals.presenter_unresolved} unresolved presenters)`)
return totals