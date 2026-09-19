#!/usr/bin/env python3
"""
day3-byline-sheet.py — build the review page for incoming/post-byline.csv.

The decisions are mostly per NAME, not per article: "Daniel Platt wrote these 20 pieces —
make him a Person" is one judgement, not twenty. So the sheet groups the 155 rows by byline
name (34 groups), each with its proposal and its articles listed underneath. Setting the
group decides every article in it; a single article can still be overridden on its own row.

Output: byline-review.html (open from disk) → decisions → tools/day3-apply-bylines.py.

Usage (from the session directory):
  python3 tools/day3-byline-sheet.py
"""
import collections, csv, html, os, re, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SESSION = os.path.abspath(os.path.join(HERE, '..'))
CSV_PATH = os.path.join(SESSION, 'incoming/post-byline.csv')
OUT = os.path.join(SESSION, 'byline-review.html')
LIVE = 'https://schillerinstitute.com'

ACTIONS = [
    ('accept', 'link to the Person'),
    ('new-person', 'create a Person, then link'),
    ('text-only', 'byline_text, no Person'),
    ('skip', 'not a byline'),
]
fold = lambda s: ''.join(c for c in unicodedata.normalize('NFKD', s or '') if not unicodedata.combining(c)).lower().strip()


def main():
    rows = list(csv.DictReader(open(CSV_PATH, newline='', encoding='utf-8')))
    groups = collections.OrderedDict()
    for r in rows:
        groups.setdefault(fold(r['byline_raw']), []).append(r)
    order = sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))

    cards = []
    for gkey, items in order:
        first = items[0]
        name = first['byline_raw']
        proposal = first['proposed_action']
        person = first['proposed_person_key']
        match = first['match']
        gid = 'g-' + re.sub(r'[^a-z0-9]+', '-', gkey)[:40]
        opts = ''.join(
            f'<label class="act"><input type="radio" name="{gid}" value="{a}" data-group="{gid}"'
            f'{" checked" if a == proposal else ""}><b>{a}</b><span>{lbl}</span></label>'
            for a, lbl in ACTIONS)
        arts = ''.join(f'''<tr data-id="{html.escape(r['legacy_id'])}" data-group="{gid}">
            <td class="date">{html.escape(r['date'])}</td>
            <td class="lang">{html.escape(r['language'] or '?')}</td>
            <td class="title"><a href="{LIVE}/?p={html.escape(r['legacy_id'])}" target="_blank" rel="noopener">{html.escape(r['title'])}</a>
              <span class="snip">{html.escape(r['snippet'][:150])}</span></td>
            <td class="ev">{html.escape(r['evidence'].replace('-byline', '').replace('-sign', ''))}</td>
            <td class="ovr"><select data-id="{html.escape(r['legacy_id'])}">
              <option value="">— group —</option>
              {''.join(f'<option value="{a}">{a}</option>' for a, _ in ACTIONS)}
            </select></td></tr>''' for r in items)
        badge = (f'<span class="pill ok">{html.escape(person)}</span>' if person else
                 f'<span class="pill {"warn" if match == "none" else "part"}">{html.escape(match)}</span>')
        cards.append(f'''<article class="card" id="{gid}" data-count="{len(items)}">
  <header><h2>{html.escape(name)}</h2>{badge}<span class="n">{len(items)} article{'s' if len(items) > 1 else ''}</span>
    <div class="acts">{opts}</div></header>
  <table>{arts}</table>
</article>''')

    counts = collections.Counter(r['proposed_action'] or 'undecided' for r in rows)
    doc = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Article bylines — review</title>
<style>
 :root {{ --bg:#14181d; --card:#1b2026; --fg:#e8ecf1; --dim:#93a0ad; --line:#2c343d; --ok:#7ec699; --warn:#d8a657; --part:#7fa8d8 }}
 * {{ box-sizing:border-box }}
 body {{ margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 ui-sans-serif,system-ui,sans-serif }}
 header.top {{ position:sticky; top:0; z-index:5; background:var(--bg); border-bottom:1px solid var(--line);
   padding:12px 20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap }}
 h1 {{ font-size:17px; margin:0 }} .count {{ color:var(--dim); font-size:13px }}
 main {{ padding:16px 20px 130px; display:grid; gap:12px }}
 .card {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 14px }}
 .card header {{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px }}
 .card h2 {{ font-size:16px; margin:0 }}
 .pill {{ font:11px ui-monospace,monospace; padding:2px 7px; border-radius:999px; border:1px solid }}
 .ok {{ color:var(--ok); border-color:var(--ok) }} .warn {{ color:var(--warn); border-color:var(--warn) }}
 .part {{ color:var(--part); border-color:var(--part) }}
 .n {{ color:var(--dim); font-size:12px }}
 .acts {{ display:flex; gap:6px; margin-left:auto; flex-wrap:wrap }}
 .act {{ display:flex; gap:6px; align-items:baseline; border:1px solid var(--line); border-radius:6px; padding:5px 9px; cursor:pointer }}
 .act b {{ font:12px ui-monospace,monospace; font-weight:600 }} .act span {{ color:var(--dim); font-size:11px }}
 .act:has(input:checked) {{ border-color:var(--ok); background:#11301f }}
 .act input {{ margin:0 }}
 table {{ width:100%; border-collapse:collapse }}
 td {{ border-top:1px solid var(--line); padding:7px 6px; vertical-align:top; font-size:13px }}
 .date, .lang, .ev {{ color:var(--dim); font:12px ui-monospace,monospace; white-space:nowrap }}
 .title a {{ color:var(--fg); text-decoration:none }} .title a:hover {{ text-decoration:underline }}
 .snip {{ display:block; color:var(--dim); font-size:12px; margin-top:2px }}
 .ovr select {{ background:var(--bg); color:var(--fg); border:1px solid var(--line); border-radius:5px; font:12px inherit; padding:3px 5px }}
 footer {{ position:fixed; inset:auto 0 0 0; background:var(--card); border-top:1px solid var(--line); padding:10px 20px; display:flex; gap:12px }}
 textarea {{ flex:1; height:78px; background:var(--bg); color:var(--fg); border:1px solid var(--line); border-radius:6px; padding:8px; font:12px/1.45 ui-monospace,monospace }}
 button {{ font:13px inherit; color:var(--fg); background:var(--card); border:1px solid var(--line); border-radius:6px; padding:7px 12px; cursor:pointer }}
</style></head><body>
<header class="top">
  <h1>Article bylines — review</h1>
  <span class="count">{len(rows)} articles · {len(order)} names · proposed: {', '.join(f'{k} {v}' for k, v in counts.most_common())}</span>
  <span class="count" id="tally" style="margin-left:auto"></span>
</header>
<main>{''.join(cards)}</main>
<footer>
  <textarea id="out" readonly placeholder="legacy_id,action"></textarea>
  <button id="copy">Copy decisions</button>
</footer>
<script>
 const out = document.getElementById('out');
 function refresh() {{
   const lines = [];
   const tally = {{}};
   document.querySelectorAll('tr[data-id]').forEach(tr => {{
     const own = tr.querySelector('select').value;
     const grp = document.querySelector('input[name="' + tr.dataset.group + '"]:checked');
     const action = own || (grp ? grp.value : '');
     if (!action) return;
     lines.push(tr.dataset.id + ',' + action);
     tally[action] = (tally[action] || 0) + 1;
   }});
   out.value = lines.join('\\n');
   document.getElementById('tally').textContent =
     lines.length + ' of {len(rows)} decided — ' + Object.entries(tally).map(([k, v]) => k + ' ' + v).join(' · ');
 }}
 document.addEventListener('change', refresh);
 document.getElementById('copy').onclick = () => {{ out.select(); document.execCommand('copy'); }};
 refresh();
</script>
</body></html>'''
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(f'{len(rows)} rows · {len(order)} names → {os.path.relpath(OUT, SESSION)}')


if __name__ == '__main__':
    main()
