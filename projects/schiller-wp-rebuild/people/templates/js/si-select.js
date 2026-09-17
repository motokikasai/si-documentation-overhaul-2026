/* si-select.js — Jasper dropdown (design-system component; styles in components.css).
 *
 * Enhances a native <select>: the browser's own popup cannot be positioned or sized
 * by CSS (Chrome on Windows opened it upward, past the viewport). This one opens
 * downward, is clamped to the space the viewport actually has below the control,
 * and flips upward only when there is clearly more room above — never under the
 * sticky header. The native <select> stays in the DOM as the source of truth:
 * choosing an option sets its value and dispatches `change`, so existing listeners
 * keep working, and setting `select.value` from code updates the label.
 *
 * Keyboard: ↑/↓, Home/End, Enter/Space, Escape, Tab, and type-ahead.
 */
let uid = 0;
const GAP = 6;           // px between control and list
const EDGE = 12;         // px kept clear of the viewport edge
const MIN_BELOW = 180;   // below this, and more room above, the list flips up

export function enhanceSelect(select) {
	if (select.dataset.siSelect) return;
	select.dataset.siSelect = '1';
	const id = `si-select-${++uid}`;

	const wrap = document.createElement('div');
	wrap.className = 'si-select';
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'si-select__button';
	button.setAttribute('aria-haspopup', 'listbox');
	button.setAttribute('aria-expanded', 'false');
	button.setAttribute('aria-controls', `${id}-list`);
	const label = select.getAttribute('aria-label');
	if (label) button.setAttribute('aria-label', label);
	button.innerHTML = `<span class="si-select__value"></span><svg class="si-select__chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`;
	const list = document.createElement('ul');
	list.className = 'si-select__list';
	list.id = `${id}-list`;
	list.setAttribute('role', 'listbox');
	list.tabIndex = -1;
	if (label) list.setAttribute('aria-label', label);
	list.hidden = true;

	select.before(wrap);
	wrap.append(button, select);
	document.body.append(list);        // fixed-position, outside any clipping/sticky context
	select.classList.add('si-select__native');
	select.tabIndex = -1;
	select.setAttribute('aria-hidden', 'true');

	const valueEl = button.querySelector('.si-select__value');
	const sync = () => {
		const opt = select.options[select.selectedIndex];
		valueEl.textContent = opt ? opt.textContent : '';
	};
	// setting .value from code must update the label too
	const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
	Object.defineProperty(select, 'value', {
		get() { return proto.get.call(this); },
		set(v) { proto.set.call(this, v); sync(); },
	});
	select.addEventListener('change', sync);
	sync();

	let active = -1, typed = '', typedAt = 0;
	const items = () => [...list.children];

	function build() {
		list.innerHTML = [...select.options].map((o, i) =>
			`<li role="option" id="${id}-o${i}" data-index="${i}" aria-selected="${i === select.selectedIndex}">${o.textContent.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</li>`).join('');
	}

	function place() {
		const r = button.getBoundingClientRect();
		const header = document.querySelector('.ct-header');
		const top = Math.max(EDGE, header && getComputedStyle(header).position !== 'static' ? header.getBoundingClientRect().bottom + EDGE : EDGE);
		const below = innerHeight - r.bottom - GAP - EDGE;
		const above = r.top - GAP - top;
		const up = below < MIN_BELOW && above > below;
		const natural = list.scrollHeight;
		const max = Math.max(120, Math.min(natural, up ? above : below, 360));
		list.style.maxHeight = `${Math.floor(max)}px`;
		list.style.minWidth = `${Math.round(r.width)}px`;
		list.style.left = `${Math.round(Math.min(r.left, innerWidth - EDGE - list.offsetWidth))}px`;
		list.style.top = up ? `${Math.round(r.top - GAP - Math.min(natural, max))}px` : `${Math.round(r.bottom + GAP)}px`;
		list.dataset.side = up ? 'top' : 'bottom';
	}

	function setActive(i, scroll = true) {
		const all = items();
		if (!all.length) return;
		active = Math.max(0, Math.min(all.length - 1, i));
		all.forEach((li, k) => li.classList.toggle('is-active', k === active));
		list.setAttribute('aria-activedescendant', all[active].id);
		if (scroll) all[active].scrollIntoView({ block: 'nearest' });
	}

	function open() {
		if (!list.hidden) return;
		build();
		list.hidden = false;
		list.style.maxHeight = '';
		place();
		setActive(select.selectedIndex, true);
		button.setAttribute('aria-expanded', 'true');
		wrap.classList.add('is-open');
		list.focus({ preventScroll: true });
		addEventListener('scroll', place, true);
		addEventListener('resize', place);
		document.addEventListener('pointerdown', outside, true);
	}

	function close(focusButton = true) {
		if (list.hidden) return;
		list.hidden = true;
		button.setAttribute('aria-expanded', 'false');
		wrap.classList.remove('is-open');
		removeEventListener('scroll', place, true);
		removeEventListener('resize', place);
		document.removeEventListener('pointerdown', outside, true);
		if (focusButton) button.focus({ preventScroll: true });
	}

	function choose(i) {
		if (i !== select.selectedIndex) {
			select.selectedIndex = i;
			select.dispatchEvent(new Event('change', { bubbles: true }));
		}
		sync();
		close();
	}

	function outside(e) {
		if (!list.contains(e.target) && !wrap.contains(e.target)) close(false);
	}

	button.addEventListener('click', () => (list.hidden ? open() : close()));
	button.addEventListener('keydown', e => {
		if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
	});
	list.addEventListener('pointermove', e => {
		const li = e.target.closest('li');
		if (li) setActive(+li.dataset.index, false);
	});
	list.addEventListener('click', e => {
		const li = e.target.closest('li');
		if (li) choose(+li.dataset.index);
	});
	list.addEventListener('keydown', e => {
		const n = items().length;
		switch (e.key) {
			case 'ArrowDown': e.preventDefault(); setActive(active + 1); break;
			case 'ArrowUp': e.preventDefault(); setActive(active - 1); break;
			case 'Home': e.preventDefault(); setActive(0); break;
			case 'End': e.preventDefault(); setActive(n - 1); break;
			case 'PageDown': e.preventDefault(); setActive(active + 8); break;
			case 'PageUp': e.preventDefault(); setActive(active - 8); break;
			case 'Enter': case ' ': e.preventDefault(); choose(active); break;
			case 'Escape': e.preventDefault(); close(); break;
			case 'Tab': close(false); break;
			default:
				if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
					const now = Date.now();
					typed = (now - typedAt > 700 ? '' : typed) + e.key.toLowerCase();
					typedAt = now;
					const hit = items().findIndex(li => li.textContent.toLowerCase().startsWith(typed));
					if (hit >= 0) setActive(hit);
				}
		}
	});
	return { open, close, sync };
}
