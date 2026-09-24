/* donate-shared.js — the gift form the three Donate drafts share.
 * Recurring-first (00-executive-summary: "Recurring-first donations in
 * NationBuilder"): monthly is the default, one-off is one click away. Amounts
 * are PLACEHOLDERS until the Institute sets them; checkout is NationBuilder's. */
import { esc } from './pages-core.js';

export const AMOUNTS = { monthly: [10, 25, 50], once: [50, 100, 250] };   // placeholders — see README

export function giftForm({ id = 'gift', cta = 'Continue', note = '' } = {}) {
	return `<form class="dg-form" id="${id}" onsubmit="event.preventDefault()">
		<div class="dg-freq si-segmented" role="group" aria-label="How often">
			<button type="button" data-f="monthly" aria-pressed="true">Monthly</button><button type="button" data-f="once" aria-pressed="false">Once</button>
		</div>
		<div class="dg-cur"><label class="si-visually-hidden" for="${id}-cur">Currency</label><select id="${id}-cur"><option>€</option><option>$</option></select></div>
		<fieldset class="dg-amounts"><legend class="si-visually-hidden">Amount</legend>
			${[0, 1, 2].map(i => `<label class="dg-amt"><input type="radio" name="${id}-amt" value="${i}"${i === 1 ? ' checked' : ''}><span data-i="${i}"></span></label>`).join('')}
			<label class="dg-amt dg-amt--other"><input type="radio" name="${id}-amt" value="other"><span><input class="dg-other" inputmode="decimal" placeholder="Other" aria-label="Other amount"></span></label>
		</fieldset>
		<p class="dg-sum" aria-live="polite"></p>
		<button class="ct-button dg-go">${esc(cta)}</button>
		<p class="dg-fine">Secure checkout on NationBuilder · cancel a monthly gift at any time ${note}<span class="pg-ph-inline">amounts are placeholders</span></p>
	</form>`;
}

export function wireGift(form, { onChange } = {}) {
	const state = { f: 'monthly', cur: '€' };
	const spans = form.querySelectorAll('.dg-amt span[data-i]');
	const sum = form.querySelector('.dg-sum');
	function paint() {
		spans.forEach(s => { s.textContent = state.cur + AMOUNTS[state.f][+s.dataset.i]; });
		const r = form.querySelector('input[type=radio]:checked');
		const v = r?.value === 'other' ? parseFloat(form.querySelector('.dg-other').value) || 0 : AMOUNTS[state.f][+r.value];
		sum.innerHTML = v ? `${state.cur}${v} <span>${state.f === 'monthly' ? `a month · ${state.cur}${v * 12} a year` : 'once'}</span>` : '&nbsp;';
		onChange?.({ ...state, v });
	}
	form.querySelector('.dg-freq').addEventListener('click', e => {
		const b = e.target.closest('button'); if (!b) return;
		state.f = b.dataset.f; form.querySelectorAll('.dg-freq button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint();
	});
	form.querySelector('select').addEventListener('change', e => { state.cur = e.target.value; paint(); });
	form.addEventListener('change', paint);
	form.querySelector('.dg-other').addEventListener('focus', () => { form.querySelector('input[value=other]').checked = true; paint(); });
	form.querySelector('.dg-other').addEventListener('input', paint);
	paint();
	return state;
}
