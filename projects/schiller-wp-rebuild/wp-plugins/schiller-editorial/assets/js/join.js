/* schiller-editorial — Join · "Your Part" (Tier-1 Join, draft C).
 * Enhancement only: without it every field and its path are on the page as written.
 *
 * It reads the page, it does not carry it. The fields are the headings of the "Join role"
 * groups; the headline's italic part is the slot; every word it shows comes from those
 * blocks, so an editor who adds a field or translates the page never touches this file.
 *
 * The slot keeps the editor's own form. "I am <em>a scientist</em>" with a first field
 * "Scientist" says: the words go in lower case, after "a ". Where that prefix is the English
 * article it becomes "an" before a vowel ("an engineer", which the draft got wrong); a German
 * "Ich bin <em>Wissenschaftler</em>" has no prefix and keeps its capitals. If the slot does
 * not contain the first field's name, the headline is left exactly as written.
 *
 * Timings and the no-punctuation rule are the draft's (pages/README.md → Join · Your Part):
 * 95ms a letter in, a 3.6s hold, 45ms a letter out, 0.5s between words; no full stop while
 * cycling, one when the reader chooses — the sentence is in the reader's voice. */
(() => {
	const root = document.querySelector('.is-style-si-join');
	if (!root) return;
	const roles = [...root.querySelectorAll(':scope > .is-style-si-join-role')]
		.map((el) => ({ el, name: (el.querySelector(':scope > h2, :scope > h3')?.textContent || '').trim() }))
		.filter((r) => r.name);
	if (!roles.length) return;

	const h1 = root.querySelector(':scope > h1');
	const slot = h1 && [...h1.querySelectorAll('em')].pop();
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* the slot's grammar, read from the slot as the editor wrote it */
	let form = null;
	if (slot) {
		const tpl = slot.textContent, first = roles[0].name;
		const at = tpl.toLowerCase().indexOf(first.toLowerCase());
		if (at >= 0) {
			const prefix = tpl.slice(0, at), sample = tpl.slice(at, at + first.length);
			const lower = sample !== first && sample === first.toLowerCase();
			form = (name) => {
				let p = prefix;
				if (/^an? $/i.test(p)) p = (/^[aeiou]/i.test(name) ? 'an' : 'a').replace(/^a/, p[0]) + ' ';
				return p + (lower ? name.toLowerCase() : name);
			};
		}
	}

	/* the row of choices, labelled by the headline */
	if (h1 && !h1.id) h1.id = 'si-join-title';
	const row = document.createElement('div');
	row.className = 'si-join__roles';
	row.setAttribute('role', 'radiogroup');
	if (h1) row.setAttribute('aria-labelledby', h1.id);
	const btns = roles.map((r, i) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'si-join__role';
		b.setAttribute('role', 'radio');
		b.setAttribute('aria-checked', 'false');
		b.textContent = r.name;
		b.addEventListener('click', () => choose(i));
		return b;
	});
	btns.forEach((b) => row.append(b));
	roles[0].el.before(row);
	root.classList.add('is-enhanced');

	/* a screen reader hears the list once, never the letters */
	let sr = null;
	if (slot && form && !reduce) {
		slot.setAttribute('aria-hidden', 'true');
		sr = document.createElement('span');
		sr.className = 'si-visually-hidden';
		sr.textContent = roles.map((r) => form(r.name)).join(', ');
		slot.after(sr);
	}

	function choose(i) {
		stop();
		btns.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)));
		roles.forEach((r, j) => r.el.classList.toggle('is-chosen', i === j));
		root.classList.add('has-choice');
		if (slot && form) {
			slot.textContent = form(roles[i].name) + '.';
			if (sr) sr.textContent = slot.textContent;
			slot.classList.add('si-join__slot');
			slot.classList.remove('is-in'); void slot.offsetWidth; slot.classList.add('is-in');
		}
	}

	/* the typing: hold the word already there, rub it out, type the next */
	const TYPE = 95, ERASE = 45, HOLD = 3600, GAP = 500;
	let timer = null, typing = false;
	function stop() { typing = false; clearTimeout(timer); slot && slot.classList.remove('is-typing'); }
	function cycle(i, n, erasing) {
		if (!typing) return;
		const word = form(roles[i].name);
		slot.textContent = word.slice(0, n);
		if (!erasing && n === word.length) timer = setTimeout(() => cycle(i, n, true), HOLD);
		else if (erasing && n === 0) timer = setTimeout(() => cycle((i + 1) % roles.length, 0, false), GAP);
		else timer = setTimeout(() => cycle(i, n + (erasing ? -1 : 1), erasing), erasing ? ERASE : TYPE);
	}
	if (slot && form && !reduce && roles.length > 1) {
		typing = true;
		slot.classList.add('si-join__slot', 'is-typing');
		slot.textContent = form(roles[0].name);
		timer = setTimeout(() => cycle(0, slot.textContent.length, true), HOLD);
	}
})();
