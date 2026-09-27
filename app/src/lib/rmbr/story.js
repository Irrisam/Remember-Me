import { timeline } from './timeline.js';

/**
 * Le recueil mis en récit, partagé par l'app et le viewer hors ligne :
 * des fils (un souvenir et les réponses des proches), rangés par période pour la frise.
 * @typedef {{ entry: any, replies: any[] }} Thread
 * @typedef {{ key: number, label: string, short: string, threads: Thread[], birth: boolean }} Period
 */

/**
 * @param {Map<string, any>} entries
 * @param {any} manifest
 * @returns {{ periods: Period[], undated: Thread[], birthYear: number | null }}
 */
export function story(entries, manifest) {
	const { dated, undated } = timeline(entries, manifest.creatorId);
	const visible = new Map([...dated, ...undated].map((e) => [e.id, e]));

	// Une réponse se range sous le souvenir d'origine de la chaîne, quelle que soit sa propre date.
	const rootOf = (entry) => {
		const seen = new Set();
		let cur = entry;
		while (cur.replyTo && visible.has(cur.replyTo) && !seen.has(cur.id)) {
			seen.add(cur.id);
			cur = visible.get(cur.replyTo);
		}
		return cur;
	};
	/** @type {Map<string, any[]>} */
	const replies = new Map();
	const tops = new Set();
	for (const e of visible.values()) {
		const root = rootOf(e);
		if (root === e) tops.add(e.id);
		else replies.set(root.id, [...(replies.get(root.id) ?? []), e]);
	}
	const byCreation = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
	const thread = (entry) => ({ entry, replies: (replies.get(entry.id) ?? []).sort(byCreation) });

	const datedThreads = dated.filter((e) => tops.has(e.id)).map(thread);
	const undatedThreads = undated.filter((e) => tops.has(e.id)).map(thread);

	const birthYear = yearOf(manifest.subject?.birthDate);
	const years = datedThreads.map((t) => yearOf(t.entry.date.value));
	if (!years.length) return { periods: [], undated: undatedThreads, birthYear };

	// Frise par décennie, ou par année si tout tient en moins de 10 ans. Elle part de la naissance si on la connaît.
	const from = Math.min(...years, ...(birthYear && birthYear <= Math.min(...years) ? [birthYear] : []));
	const to = Math.max(...years);
	const step = to - from >= 10 ? 10 : 1;
	const periods = [];
	for (let key = Math.floor(from / step) * step; key <= to; key += step) {
		periods.push({
			key,
			label: step === 10 ? `Les années ${key}` : String(key),
			short: step === 10 ? `${key}` : String(key),
			threads: datedThreads.filter((t) => Math.floor(yearOf(t.entry.date.value) / step) * step === key),
			birth: birthYear !== null && Math.floor(birthYear / step) * step === key
		});
	}
	return { periods, undated: undatedThreads, birthYear };
}

/**
 * Âge de la personne du recueil à la date d'un souvenir, ou null si on ne peut pas le dire.
 * @param {string | undefined} birth date ISO tronquée (AAAA, AAAA-MM, AAAA-MM-JJ)
 * @param {{ value?: string, approximate?: boolean } | undefined} date
 */
export function ageAt(birth, date) {
	if (!birth || !date?.value) return null;
	const [by, bm, bd] = birth.split('-').map(Number);
	const [y, m, d] = date.value.split('-').map(Number);
	let age = y - by;
	if (bm && m && (m < bm || (m === bm && bd && d && d < bd))) age--;
	if (age < 0 || age > 120) return null;
	// Sans les mois des deux côtés, l'âge peut être décalé d'un an.
	return { age, approximate: !(bm && m) || !!date.approximate };
}

/** « Jeanne avait 18 ans », avec le seul prénom. */
export function formatAge(name, a) {
	if (!a) return '';
	const first = name.trim().split(/\s+/)[0];
	if (a.age === 0) return `${first} avait moins d’un an`;
	return `${first} avait ${a.approximate ? 'environ ' : ''}${a.age} an${a.age > 1 ? 's' : ''}`;
}

function yearOf(partialDate) {
	return partialDate ? Number(partialDate.slice(0, 4)) : null;
}
