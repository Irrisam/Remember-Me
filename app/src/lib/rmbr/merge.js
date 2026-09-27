import { indexRef, major } from './archive.js';
import { overrides } from './timeline.js';
import { verifyEntry } from './signature.js';
import { now } from './ids.js';

/**
 * Examine un pack avant fusion (règles 1 à 8 de la spec). Lève une erreur si le pack entier est refusé.
 * Chaque entrée reçoit un statut : new (à proposer au créateur), duplicate (déjà présente, ignorée)
 * ou rejected (refusée d'office, avec la raison).
 * @param {import('./archive.js').Recueil} recueil
 * @param {import('./archive.js').Recueil} pack
 * @returns {Promise<{ entry: any, status: 'new' | 'duplicate' | 'rejected', reason?: string }[]>}
 */
export async function reviewPack(recueil, pack) {
	const m = recueil.manifest;
	const p = pack.manifest;
	if (p.recueilId !== m.id) throw new Error('Cette contribution est destinée à un autre recueil.');
	if (major(p.formatVersion) !== major(m.formatVersion)) {
		throw new Error(`Version de format incompatible : ${p.formatVersion}.`);
	}

	const packAuthors = new Map();
	for (const a of p.authors ?? []) {
		if (a.role === 'creator' || a.id === m.creatorId) {
			throw new Error('Cette contribution se présente comme venant du créateur : elle est refusée.');
		}
		packAuthors.set(a.id, a);
	}
	// Confiance au premier contact : la clé déjà connue dans le recueil prime sur celle du pack.
	const known = new Map(m.authors.map((a) => [a.id, a]));
	const publicKey = (id) => (known.has(id) ? known.get(id).publicKey : packAuthors.get(id)?.publicKey);

	const { deleted } = overrides(recueil.entries, m.creatorId);
	const everything = new Map([...recueil.entries, ...pack.entries]);
	const existingSha = new Map();
	for (const e of recueil.entries.values()) for (const item of e.media ?? []) existingSha.set(item.path, item.sha256);

	async function refusal(entry) {
		if (deleted.has(entry.id)) return 'Ce souvenir a été supprimé du recueil.';
		if (!packAuthors.has(entry.authorId)) return 'Son auteur ne fait pas partie de cette contribution.';
		if (entry.supersedes) {
			const target = everything.get(entry.supersedes);
			// Le créateur ne peut pas écrire dans un pack : seul l'auteur d'origine peut corriger ou supprimer.
			if (target && target.authorId !== entry.authorId) {
				return 'Seul l’auteur d’un souvenir peut le corriger ou le supprimer.';
			}
		}
		const key = publicKey(entry.authorId);
		if (key && !(await verifyEntry(entry, key))) return 'Signature absente ou invalide.';
		for (const item of entry.media ?? []) {
			if (!pack.media.has(item.path)) return 'Une photo, un son ou une vidéo est abîmé ou manquant.';
			if (existingSha.has(item.path) && existingSha.get(item.path) !== item.sha256) {
				return 'Un média entre en conflit avec un fichier déjà présent.';
			}
		}
		return null;
	}

	const items = [];
	for (const entry of pack.entries.values()) {
		if (recueil.entries.has(entry.id)) {
			items.push({ entry, status: 'duplicate' });
			continue;
		}
		const reason = await refusal(entry);
		items.push(reason ? { entry, status: 'rejected', reason } : { entry, status: 'new' });
	}
	return items;
}

/**
 * Fusionne les entrées acceptées par le créateur (règles 3 à 10). Les entrées refusées et
 * les auteurs sans aucune entrée acceptée ne laissent aucune trace. Renvoie un nouveau recueil.
 * @param {import('./archive.js').Recueil} recueil
 * @param {import('./archive.js').Recueil} pack
 * @param {Awaited<ReturnType<typeof reviewPack>>} items
 * @param {Set<string>} acceptedIds
 */
export function mergePack(recueil, pack, items, acceptedIds) {
	const accepted = items.filter((i) => i.status === 'new' && acceptedIds.has(i.entry.id)).map((i) => i.entry);
	if (!accepted.length) return recueil;

	const entries = new Map(recueil.entries);
	const media = new Map(recueil.media);
	for (const entry of accepted) {
		entries.set(entry.id, entry);
		for (const item of entry.media ?? []) if (!media.has(item.path)) media.set(item.path, pack.media.get(item.path));
	}

	const authors = [...recueil.manifest.authors];
	for (const id of new Set(accepted.map((e) => e.authorId))) {
		if (authors.some((a) => a.id === id)) continue;
		const { name, relation, publicKey } = pack.manifest.authors.find((a) => a.id === id);
		authors.push({ id, name, role: 'contributor', ...(relation && { relation }), ...(publicKey && { publicKey }) });
	}

	return {
		manifest: {
			...recueil.manifest,
			authors,
			entries: [...recueil.manifest.entries, ...accepted.map(indexRef)],
			updatedAt: now()
		},
		entries,
		media
	};
}
