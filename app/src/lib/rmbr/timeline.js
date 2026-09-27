/**
 * Entrées visées par un supersedes légitime (auteur de l'entrée visée ou créateur) :
 * deleted = supprimées par tombstone, replaced = remplacées par une correction.
 * @param {Map<string, any>} entries
 * @param {string} creatorId
 */
export function overrides(entries, creatorId) {
	const deleted = new Set();
	const replaced = new Set();
	for (const e of entries.values()) {
		if (!e.supersedes) continue;
		const target = entries.get(e.supersedes);
		if (target && e.authorId !== target.authorId && e.authorId !== creatorId) continue;
		(e.type === 'tombstone' ? deleted : replaced).add(e.supersedes);
	}
	return { deleted, replaced };
}

/**
 * Souvenirs à afficher, dans l'ordre chronologique de la spec.
 * Retire les tombstones, les entrées supprimées et les entrées remplacées.
 * @param {Map<string, any>} entries
 * @param {string} creatorId
 * @returns {{ dated: any[], undated: any[] }}
 */
export function timeline(entries, creatorId) {
	const { deleted, replaced } = overrides(entries, creatorId);
	const visible = [...entries.values()].filter(
		(e) => e.type !== 'tombstone' && !deleted.has(e.id) && !replaced.has(e.id)
	);
	const byCreation = (a, b) => cmp(a.createdAt, b.createdAt);
	// Comparaison de chaînes : 1959 < 1959-07 < 1959-07-14, une date partielle passe en tête de sa période.
	const dated = visible
		.filter((e) => e.date?.value)
		.sort((a, b) => cmp(a.date.value, b.date.value) || byCreation(a, b));
	const undated = visible.filter((e) => !e.date?.value).sort(byCreation);
	return { dated, undated };
}

/** Date ISO tronquée du schéma : AAAA, AAAA-MM ou AAAA-MM-JJ. */
export const PARTIAL_DATE = /^[0-9]{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)?$/;

const cmp =(a, b) => (a < b ? -1 : a > b ? 1 : 0);

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Date lisible : le label libre prime, sinon la valeur ISO tronquée en français. */
export function formatDate(date) {
	if (!date) return '';
	if (date.label) return date.label;
	const [y, m, d] = date.value.split('-');
	const text = [d && String(Number(d)), m && MONTHS[Number(m) - 1], y].filter(Boolean).join(' ');
	return date.approximate ? `vers ${text}` : text;
}
