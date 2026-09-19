/* langswitch.js — the compact language control.
 *
 * Progressive: the page ships a plain <ul> of links (every language reachable
 * and crawlable with no script). This folds it into a popup and adds a trigger,
 * so the eight chips of the earlier drafts become one control.
 *
 * Interaction follows `templates/js/si-select.js`, which is the house dropdown:
 * the popup is fixed-positioned and flipped when it would leave the viewport,
 * arrow keys move an `is-active` row, Home/End jump, Escape closes and returns
 * focus, and a type-ahead buffer jumps by first letter. It is a MENU of links,
 * not a listbox of values — the roles differ from si-select's for that reason,
 * and Enter simply follows the link.
 */
const OPEN_CLASS = 'is-open';

export function initLangSwitch(root = document) {
	root.querySelectorAll('[data-langswitch]').forEach(setup);
}

function setup(el) {
	const list = el.querySelector('.si-lang__list');
	const label = el.querySelector('.si-lang__label');
	const items = [...list.querySelectorAll('a')];
	const current = items.find(a => a.getAttribute('aria-current') === 'true') || items[0];
	if (!items.length) return;

	// The visible label is the current language's native name. `si-lang__label`
	// stays as the accessible name of the control rather than being thrown away.
	const id = `lang-pop-${Math.random().toString(36).slice(2, 8)}`;
	list.id = id;
	list.hidden = true;
	list.setAttribute('role', 'menu');
	items.forEach(a => {
		a.setAttribute('role', 'menuitem');
		a.tabIndex = -1;
	});

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'si-lang__button';
	button.setAttribute('aria-expanded', 'false');
	button.setAttribute('aria-controls', id);
	button.setAttribute('aria-label', `${label ? label.textContent.trim() : 'Language'}: ${current.textContent.trim()}`);
	button.innerHTML =
		`<span class="si-lang__current">${current.querySelector('.si-lang__native').textContent}</span>` +
		`<svg class="si-lang__chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">` +
		`<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
	el.insertBefore(button, list);
	if (label) label.classList.add('si-visually-hidden');

	let active = items.indexOf(current);
	let typed = '';
	let typedAt = 0;

	const isOpen = () => el.classList.contains(OPEN_CLASS);

	function place() {
		// fixed popup: measure the trigger and flip up when there is no room below
		const r = button.getBoundingClientRect();
		const h = list.offsetHeight;
		const below = innerHeight - r.bottom - 8;
		const up = below < h && r.top > below;
		list.dataset.side = up ? 'top' : 'bottom';
		list.style.minWidth = `${r.width}px`;
		list.style.left = `${Math.min(r.left, innerWidth - list.offsetWidth - 8)}px`;
		list.style.top = up ? `${r.top - h - 6}px` : `${r.bottom + 6}px`;
	}

	function mark(i) {
		items.forEach(a => a.classList.remove('is-active'));
		active = (i + items.length) % items.length;
		items[active].classList.add('is-active');
		items[active].focus();
	}

	function open(focusIndex = active) {
		if (isOpen()) return;
		list.hidden = false;
		el.classList.add(OPEN_CLASS);
		button.setAttribute('aria-expanded', 'true');
		place();
		mark(focusIndex);
		addEventListener('scroll', place, true);
		addEventListener('resize', place);
	}

	function close({ refocus = true } = {}) {
		if (!isOpen()) return;
		el.classList.remove(OPEN_CLASS);
		button.setAttribute('aria-expanded', 'false');
		list.hidden = true;
		items.forEach(a => a.classList.remove('is-active'));
		removeEventListener('scroll', place, true);
		removeEventListener('resize', place);
		if (refocus) button.focus();
	}

	button.addEventListener('click', () => (isOpen() ? close() : open()));
	button.addEventListener('keydown', e => {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			open(e.key === 'ArrowDown' ? active : items.length - 1);
		}
	});

	list.addEventListener('keydown', e => {
		switch (e.key) {
			case 'Escape': e.preventDefault(); close(); break;
			case 'ArrowDown': e.preventDefault(); mark(active + 1); break;
			case 'ArrowUp': e.preventDefault(); mark(active - 1); break;
			case 'Home': e.preventDefault(); mark(0); break;
			case 'End': e.preventDefault(); mark(items.length - 1); break;
			case 'Tab': close({ refocus: false }); break;
			default:
				if (e.key.length !== 1) return;
				// type-ahead on the NATIVE name, which is what the reader sees
				typed = (Date.now() - typedAt < 700 ? typed : '') + e.key.toLowerCase();
				typedAt = Date.now();
				const hit = items.findIndex(a =>
					a.querySelector('.si-lang__native').textContent.toLowerCase().startsWith(typed));
				if (hit >= 0) mark(hit);
		}
	});

	addEventListener('pointerdown', e => {
		if (isOpen() && !el.contains(e.target)) close({ refocus: false });
	});
}
