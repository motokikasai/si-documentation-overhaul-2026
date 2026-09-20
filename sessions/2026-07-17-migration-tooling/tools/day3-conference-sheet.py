#!/usr/bin/env python3
"""
day3-conference-sheet.py — build the review page for the conference-post sweep.

The unit of decision is the **WPML translation group**, not the row: same-trid rows
must end on one final_type (01-csv-contracts.md, trap 2), so the EN and DE landing pages
of one conference are decided once, together. Each card is one trid group; a single row
can still be overridden underneath.

Every card shows the evidence the sweep measured — the embedded videos as thumbnails,
the Panel/agenda headings verbatim, the count of printed speaker lines, and whether the
video pipeline already knows those recordings — so a row can be judged without opening
the post. The live permalink is one click away for the ones that need it.

Output: conference-review.html (open from disk) → "Copy decisions" →
        decisions-conference.txt → tools/day3-apply-conference.py

Usage (from the session directory):
  python3 tools/day3-conference-sheet.py
  python3 tools/day3-conference-sheet.py --all     # include the 443 parked tier-D rows
  python3 tools/day3-conference-sheet.py --no-thumbs
"""
import argparse, collections, csv, html, os

HERE = os.path.dirname(os.path.abspath(__file__))
SESSION = os.path.abspath(os.path.join(HERE, '..'))
CSV_PATH = os.path.join(SESSION, 'incoming/conference-post-candidates.csv')
CONF_PATH = os.path.join(SESSION, 'incoming/conference-map.csv')
OUT = os.path.join(SESSION, 'conference-review.html')
LIVE = 'https://schillerinstitute.com'

ACTIONS = [
    ('conference', 'this post IS the event record'),
    ('attach', 'landing content for an existing Conference'),
    ('presentation', 'one talk of an event'),
    ('video', 'one recording'),
    ('skip', 'it really is an Article'),
]

TIER_NOTE = {
    'A': 'conference-map already names this post as a conference’s WordPress match — but '
         'that match is fuzzy (see the score in the note) and the 0-video rows are mostly '
         'reports about the event, not the event.',
    'B': 'multi-video record with programme structure, or it embeds a video the segmentation '
         'pass already files under a conference.',
    'C': 'three or more embedded videos, or an event title plus body structure.',
    'D': 'thin evidence. Most of these are reports *about* an event and should be `skip`; '
         'they are queued only because nothing else has reclassified them.',
}


def esc(s):
    return html.escape(s or '')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true',
                    help='include rows already reclassified as something else')
    ap.add_argument('--no-thumbs', action='store_true',
                    help='do not load YouTube thumbnails (offline review)')
    args = ap.parse_args()

    rows = list(csv.DictReader(open(CSV_PATH, newline='', encoding='utf-8')))
    if not args.all:
        rows = [r for r in rows if r['action_needed'] == '1']

    conf_keys = sorted({r['conference_key'] for r in
                        csv.DictReader(open(CONF_PATH, newline='', encoding='utf-8'))
                        if r['conference_key']})

    # group by trid — the decision unit. A row with no trid is its own group.
    groups = collections.OrderedDict()
    for r in rows:
        groups.setdefault(r['trid'] or ('solo-' + r['legacy_id']), []).append(r)
    order = sorted(groups.items(),
                   key=lambda kv: (kv[1][0]['tier'], -max(int(x['yt_embeds']) for x in kv[1]),
                                   kv[1][0]['date']))

    cards = []
    for gkey, items in order:
        first = items[0]
        tier = first['tier']
        gid = 'g-' + gkey
        proposal = first['proposed_action'].split(':')[0]
        prekey = (first['proposed_action'].split(':', 1)[1]
                  if ':' in first['proposed_action'] else first['conference_key'].split('|')[0])
        decided = first['final_action'] or ''

        # Nothing is pre-selected. A proposal is marked, not chosen — the whole
        # point of this pass is that a machine proposal accepted by default is how
        # 155 conferences became Articles in the first place. "Accept proposals"
        # in the toolbar applies them in one deliberate click.
        opts = ''.join(
            f'<label class="act{" prop" if a == proposal else ""}">'
            f'<input type="radio" name="{gid}" value="{a}" data-group="{gid}"'
            f'{" checked" if decided == a or (decided.startswith(a + ":")) else ""}>'
            f'<b>{a}</b><span>{lbl}</span></label>'
            for a, lbl in ACTIONS)

        keysel = (f'<select class="ckey" data-group="{gid}">'
                  f'<option value="">— conference_key —</option>'
                  + ''.join(f'<option value="{esc(k)}"'
                            f'{" selected" if k == prekey else ""}>{esc(k)}</option>'
                            for k in conf_keys)
                  + '</select>')

        body = []
        for r in items:
            vids = [v for v in r['yt_embed_ids'].split('|') if v]
            thumbs = '' if args.no_thumbs else ''.join(
                f'<a class="th" href="https://youtu.be/{esc(v)}" target="_blank" '
                f'rel="noopener" title="{esc(v)}">'
                f'<img loading="lazy" src="https://i.ytimg.com/vi/{esc(v)}/mqdefault.jpg" '
                f'alt=""></a>' for v in vids[:12])
            more = (f'<span class="dim">+{len(vids) - 12} more</span>'
                    if len(vids) > 12 else '')
            cov = r['seg_covered']
            covcls = 'warn' if cov.startswith('0/') and not cov.endswith('/0') else 'dim'
            heads = ' · '.join(x for x in (r['panel_headings'] + '|' +
                                           r['agenda_headings']).split('|') if x)[:220]
            chips = []
            if r['panel_headings'] or r['agenda_headings']:
                chips.append(f'<span class="chip">{esc(heads)}</span>')
            if r['speaker_lines'] != '0':
                chips.append(f'<span class="chip">{esc(r["speaker_lines"])} speaker lines</span>')
            if r['event_markers']:
                chips.append(f'<span class="chip dim">{esc(r["event_markers"][:70])}</span>')
            if r['conf_match_note']:
                chips.append(f'<span class="chip warn">{esc(r["conf_match_note"][:110])}</span>')
            if r['notes']:
                chips.append(f'<span class="chip warn">{esc(r["notes"][:110])}</span>')
            url = LIVE + r['legacy_url'] if r['legacy_url'] else f'{LIVE}/?p={r["legacy_id"]}'
            body.append(f'''<div class="row" data-id="{esc(r['legacy_id'])}" data-group="{gid}">
  <div class="meta"><code>{esc(r['legacy_id'])}</code> <span class="dim">{esc(r['date'])}</span>
    <span class="lang">{esc(r['language'] or '?')}</span>
    <span class="dim">{esc(r['words'])}w</span>
    <span class="pill now">now → {esc(r['current_type'])}</span>
    <span class="pill {covcls}">seg {esc(cov)}</span></div>
  <div class="ttl"><a href="{esc(url)}" target="_blank" rel="noopener">{esc(r['title'])}</a></div>
  <div class="chips">{''.join(chips)}</div>
  <div class="thumbs">{thumbs}{more}</div>
  <div class="ovr"><select data-id="{esc(r['legacy_id'])}">
      <option value="">— follow group —</option>
      {''.join(f'<option value="{a}">{a}</option>' for a, _ in ACTIONS)}
    </select></div>
</div>''')

        cards.append(f'''<article class="card t{tier}" id="{esc(gid)}" data-tier="{tier}" data-proposal="{esc(proposal)}">
  <header><span class="tier">tier {tier}</span>
    <h2>{esc(first['title'][:90])}</h2>
    <span class="n">{len(items)} row{'s' if len(items) > 1 else ''}{' · trid ' + esc(first['trid']) if first['trid'] else ''}</span>
    <div class="acts">{opts}</div></header>
  <div class="why">{esc(first['evidence'])}</div>
  <div class="keyrow">{keysel}<span class="dim">used by <code>attach</code></span></div>
  {''.join(body)}
</article>''')

    tiers = collections.Counter(r['tier'] for r in rows)
    doc = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conference posts — review</title>
<style>
 :root {{ --bg:#14181d; --card:#1b2026; --fg:#e8ecf1; --dim:#93a0ad; --line:#2c343d;
          --ok:#7ec699; --warn:#d8a657; --acc:#7fa8d8 }}
 * {{ box-sizing:border-box }}
 body {{ margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 ui-sans-serif,system-ui,sans-serif }}
 header.top {{ position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line);
   padding:12px 20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap }}
 h1 {{ font-size:17px; margin:0 }} .count {{ color:var(--dim); font-size:13px }}
 .legend {{ padding:10px 20px; color:var(--dim); font-size:12.5px; border-bottom:1px solid var(--line) }}
 .legend b {{ color:var(--fg) }}
 main {{ padding:16px 20px 140px; display:grid; gap:12px }}
 .card {{ background:var(--card); border:1px solid var(--line); border-left-width:4px; border-radius:10px; padding:12px 14px }}
 .card.tA {{ border-left-color:var(--ok) }} .card.tB {{ border-left-color:var(--acc) }}
 .card.tC {{ border-left-color:var(--warn) }} .card.tD {{ border-left-color:var(--line) }}
 .card header {{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:6px }}
 .card h2 {{ font-size:15px; margin:0; font-weight:600 }}
 .tier {{ font:11px ui-monospace,monospace; color:var(--dim); border:1px solid var(--line);
          border-radius:999px; padding:2px 8px }}
 .n {{ color:var(--dim); font-size:12px }}
 .why {{ color:var(--dim); font-size:12.5px; margin-bottom:8px }}
 .acts {{ display:flex; gap:6px; margin-left:auto; flex-wrap:wrap }}
 .act {{ display:flex; gap:6px; align-items:baseline; border:1px solid var(--line);
         border-radius:6px; padding:5px 9px; cursor:pointer }}
 .act b {{ font:12px ui-monospace,monospace; font-weight:600 }}
 .act span {{ color:var(--dim); font-size:11px }}
 .act:has(input:checked) {{ border-color:var(--ok); background:#11301f }}
 .act.prop {{ border-style:dashed; border-color:var(--acc) }}
 .act.prop b::after {{ content:'·proposed'; color:var(--acc); font-size:10px; margin-left:4px }}
 .bar {{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:9px 20px;
         border-bottom:1px solid var(--line); font-size:12.5px }}
 .card:not(:has(input:checked)) {{ opacity:.82 }}
 .act input {{ margin:0 }}
 .keyrow {{ display:flex; gap:8px; align-items:center; margin-bottom:8px }}
 select {{ background:var(--bg); color:var(--fg); border:1px solid var(--line); border-radius:5px;
           font:12px ui-monospace,monospace; padding:4px 6px; max-width:420px }}
 .row {{ border-top:1px solid var(--line); padding:8px 0 4px; display:grid; gap:4px }}
 .meta {{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:12px }}
 .meta code {{ color:var(--acc) }}
 .lang {{ font:11px ui-monospace,monospace; border:1px solid var(--line); border-radius:4px; padding:0 5px }}
 .pill {{ font:11px ui-monospace,monospace; border:1px solid var(--line); border-radius:999px; padding:1px 7px }}
 .pill.now {{ color:var(--dim) }} .pill.warn {{ color:var(--warn); border-color:var(--warn) }}
 .dim {{ color:var(--dim) }} .warn {{ color:var(--warn) }}
 .ttl a {{ color:var(--fg); text-decoration:none; font-size:14px }}
 .ttl a:hover {{ text-decoration:underline }}
 .chips {{ display:flex; gap:6px; flex-wrap:wrap }}
 .chip {{ font:11.5px ui-monospace,monospace; color:var(--fg); background:#232a32;
          border-radius:5px; padding:2px 7px }}
 .chip.dim {{ color:var(--dim) }} .chip.warn {{ color:var(--warn) }}
 .thumbs {{ display:flex; gap:5px; flex-wrap:wrap; align-items:center }}
 .th img {{ width:104px; height:58px; object-fit:cover; border-radius:4px; display:block;
            background:#232a32 }}
 footer {{ position:fixed; inset:auto 0 0 0; background:var(--card); border-top:1px solid var(--line);
   padding:10px 20px; display:flex; gap:12px; align-items:flex-start }}
 textarea {{ flex:1; height:84px; background:var(--bg); color:var(--fg); border:1px solid var(--line);
   border-radius:6px; padding:8px; font:12px/1.45 ui-monospace,monospace }}
 button {{ font:13px inherit; color:var(--fg); background:var(--card); border:1px solid var(--line);
   border-radius:6px; padding:7px 12px; cursor:pointer }}
 button:hover {{ border-color:var(--ok) }}
</style></head><body>
<header class="top">
  <h1>Conference posts — review</h1>
  <span class="count">{len(rows)} rows · {len(order)} decision groups ·
    {' · '.join(f'tier {k} {v}' for k, v in sorted(tiers.items()))}</span>
  <span class="count" id="tally" style="margin-left:auto"></span>
</header>
<div class="bar">
  <span class="dim">Accept the machine proposal for</span>
  <button data-accept="A">tier A</button>
  <button data-accept="B">tier B</button>
  <button data-accept="C">tier C</button>
  <button data-accept="*">every tier</button>
  <span class="dim">· then correct what is wrong.</span>
  <button id="clear" style="margin-left:auto">Clear all</button>
</div>
<div class="legend">
  One card = one WPML translation group; setting the card decides every row in it, and a row
  can override itself. <b>attach</b> also needs the <b>conference_key</b> select.
  <b>seg 0/n</b> means the video pipeline has never seen those recordings.
  Tiers: {' '.join(f'<b>{k}</b> {v}' for k, v in TIER_NOTE.items())}
</div>
<main>{''.join(cards)}</main>
<footer>
  <textarea id="out" readonly placeholder="legacy_id,action"></textarea>
  <button id="copy">Copy decisions</button>
  <button id="dl">Download .txt</button>
</footer>
<script>
 const out = document.getElementById('out');
 function refresh() {{
   const lines = [], tally = {{}};
   document.querySelectorAll('.row[data-id]').forEach(row => {{
     const own = row.querySelector('select[data-id]').value;
     const grp = document.querySelector('input[name="' + row.dataset.group + '"]:checked');
     let action = own || (grp ? grp.value : '');
     if (!action) return;
     if (action === 'attach') {{
       const sel = document.querySelector('select.ckey[data-group="' + row.dataset.group + '"]');
       const key = sel ? sel.value : '';
       if (!key) {{ action = 'attach:MISSING-KEY'; }} else {{ action = 'attach:' + key; }}
     }}
     lines.push(row.dataset.id + ',' + action);
     const k = action.split(':')[0];
     tally[k] = (tally[k] || 0) + 1;
   }});
   out.value = lines.join('\\n');
   const miss = lines.filter(l => l.includes('MISSING-KEY')).length;
   document.getElementById('tally').textContent =
     lines.length + ' of {len(rows)} decided — ' +
     Object.entries(tally).map(([k, v]) => k + ' ' + v).join(' · ') +
     (miss ? '  ⚠ ' + miss + ' attach without a key' : '');
 }}
 document.querySelectorAll('button[data-accept]').forEach(btn => {{
   btn.onclick = () => {{
     const want = btn.dataset.accept;
     document.querySelectorAll('.card').forEach(card => {{
       if (want !== '*' && card.dataset.tier !== want) return;
       const p = card.dataset.proposal;
       if (!p) return;                       // no proposal: it stays a human judgement
       const input = card.querySelector('.act input[value="' + p + '"]');
       if (input) input.checked = true;
     }});
     refresh();
   }};
 }});
 document.getElementById('clear').onclick = () => {{
   document.querySelectorAll('.act input').forEach(i => {{ i.checked = false; }});
   document.querySelectorAll('select[data-id]').forEach(s => {{ s.value = ''; }});
   refresh();
 }};
 document.addEventListener('change', refresh);
 document.getElementById('copy').onclick = () => {{ out.select(); document.execCommand('copy'); }};
 document.getElementById('dl').onclick = () => {{
   const b = new Blob([out.value + '\\n'], {{type: 'text/plain'}});
   const a = document.createElement('a');
   a.href = URL.createObjectURL(b); a.download = 'decisions-conference.txt'; a.click();
 }};
 refresh();
</script>
</body></html>'''
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(f'{len(rows)} rows · {len(order)} decision groups → {os.path.relpath(OUT, SESSION)}')


if __name__ == '__main__':
    main()
