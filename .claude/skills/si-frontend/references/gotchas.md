# Front-end gotchas already paid for

**CSS resets outrank sibling rules.** `.ar-prose p { margin: 0 }` is (0,1,1) and
`.ar-prose > * + * { margin-top: … }` is (0,1,0), so the reset wins whatever the source
order. Write the reset with `:where()` — `.ar-prose :where(p, figure, ul) { margin: 0 }` —
which carries no specificity at all.

**`content-visibility: auto` breaks in-page anchor jumps.** An anchor inside a
not-yet-rendered section overshoots. It is fine on a page with no anchors (the Ledger's month
groups); it is not fine anywhere with a table of contents or footnotes.

**Sticky elements trigger Firefox's scroll-anchoring warning** — set `overflow-anchor: none`
on the body of a page that has them.

**An inline `grid-row` cannot be undone by a media query.** Pass it as a custom property
(`style="--row:3"`) and apply `grid-row: var(--row)` only in the breakpoint that wants it.
The Drift's two-column pairing overlapped every entry on a phone until this was fixed.

**Lazily-filled sections make a scroll jump land short.** Reserved heights are never exactly
right, so the sections the jump passed grow and push the target down. Land, then correct in a
short settle loop until the target stops moving.

**Firefox does not re-evaluate `:hover` under a cursor that has not moved.** If you replace
markup under the pointer, a test must move the mouse twice — and so, in effect, must a user.

**`getComputedStyle().getPropertyValue('--x')` can read stale in Playwright** for a custom
property set from JS. Read `el.style.getPropertyValue('--x')` instead, and wait for the value
with `waitForFunction` rather than a fixed timeout.

**`scroll-behavior: smooth` is set globally by the prototype shim**, so `window.scrollTo` in a
test must be waited out (~900 ms) or given `behavior: 'instant'`, or a click races the
animation and silently misses.

**A stacked grid needs an explicit `row-gap`.** `.leaf` had only a `column-gap`, so on a phone
the margin apparatus sat flush against the first line of the article.

**`nohup … &` inside a tool call does not survive.** Use the harness's own background mode.

**Playwright lives in the npx cache**, not in a local `node_modules`; symlink it rather than
`npm i`, which pulls a version whose browser revisions do not match `~/.cache/ms-playwright`.

**Face-detection needs opencv-python-headless 4.x** — 5.x dropped the Haar cascades.

**An audit that hits a remote host must separate "gone" from "did not answer."**
Eight concurrent HEAD requests against the live site turned into 225 connection
failures that a first version counted as missing files. Retry serially, report
what still will not answer as *unchecked*, and never fold it into the headline
number.

**wptexturize rewrites `&` inside a `<script>` too.** Any JavaScript echoed from a block's
`render.php` — or from anything else that goes through `the_content` — comes back with every
bare `&` as `&#038;`, so `a && b` reaches the browser as `a &#038;&#038; b` and dies on
`SyntaxError: '#' not followed by identifier`. wptexturize skips *quotes* and dashes in
no-texturize elements, which is why the damage looks so selective. Emit an HTML comment as a
marker and swap the real script in on `the_content` at priority 99 (si-hero-earth does), or
encode the payload — `wp_json_encode( …, JSON_HEX_AMP )` for a JSON island.

**Firefox has no `layout-shift` PerformanceObserver.** `observe({ type: 'layout-shift' })`
throws nothing and reports nothing, so a CLS of `0.0000` from the only browser on this box
means "not measured", not "no shift". Measure a reflow by watching
`document.documentElement.scrollHeight` instead.

**A class on a `<p>` loses to `.container p`.** `.si-hero__kicker { font-size: … }` is
(0,1,0) and `.si-hero__stage p { font-size: … }` is (0,1,1), so the container rule sets the
kicker's size — in the shipped hero it has always rendered at 17.28px against the 11.5px its
own rule asks for, and nobody saw it because it still *looked* like a kicker. Write the
container rule as `p:not(.si-hero__kicker)`, or give it no specificity with `:where(p)`. Same
family as the reset trap above: measure `getComputedStyle` rather than trusting the sheet.
