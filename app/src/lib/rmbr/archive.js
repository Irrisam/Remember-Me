import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { uuidv7, now, sha256Hex } from './ids.js';
import { renderViewer } from './viewer.js';

export const FORMAT_VERSION = '0.2';
/** Seuil habituel des pièces jointes mail : au-delà, l'app prévient. */
export const MAIL_LIMIT = 25 * 1024 * 1024;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ENTRY_PATH = new RegExp(`^entries/(${UUID})\\.json$`);
const MEDIA_PATH = new RegExp(`^media/${UUID}\\.[a-z0-9]{2,5}$`);
/** Plafond décompressé par fichier : bloque les bombes zip (vidéo max 20 Mo). */
const MAX_FILE = 25 * 1024 * 1024;

const EXT = {
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/png': 'png',
	'audio/webm': 'webm',
	'audio/ogg': 'ogg',
	'audio/mp4': 'm4a',
	'video/mp4': 'mp4',
	'video/webm': 'webm'
};

/**
 * Recueil en mémoire : le manifest, les entrées par id et les octets des médias par chemin.
 * @typedef {{ manifest: any, entries: Map<string, any>, media: Map<string, Uint8Array> }} Recueil
 */

/** @returns {Recueil} */
export function createRecueil({ title, subjectName, creatorName }) {
	const creatorId = uuidv7();
	const t = now();
	const manifest = {
		format: 'remember-me',
		formatVersion: FORMAT_VERSION,
		kind: 'recueil',
		id: uuidv7(),
		title,
		language: 'fr',
		createdAt: t,
		updatedAt: t,
		creatorId,
		authors: [{ id: creatorId, name: creatorName, role: 'creator' }],
		entries: []
	};
	if (subjectName) manifest.subject = { name: subjectName };
	return { manifest, entries: new Map(), media: new Map() };
}

/**
 * Ajoute un souvenir. Les champs vides sont omis pour rester conforme au schéma.
 * @param {Recueil} recueil
 * @param {{ type: string, authorId: string, title?: string, text?: string, date?: any,
 *   media?: { bytes: Uint8Array, mimeType: string, width?: number, height?: number,
 *     durationSec?: number, caption?: string }[] }} input
 */
export async function addEntry(recueil, { type, authorId, title, text, date, media = [] }) {
	const entry = { id: uuidv7(), type, authorId, createdAt: now() };
	if (title) entry.title = title;
	if (text) entry.text = text;
	if (date) entry.date = date;
	if (media.length) {
		entry.media = [];
		for (const m of media) {
			const path = `media/${uuidv7()}.${EXT[m.mimeType]}`;
			const item = { path, mimeType: m.mimeType, size: m.bytes.length, sha256: await sha256Hex(m.bytes) };
			if (m.width) item.width = m.width;
			if (m.height) item.height = m.height;
			if (m.durationSec) item.durationSec = m.durationSec;
			if (m.caption) item.caption = m.caption;
			entry.media.push(item);
			recueil.media.set(path, m.bytes);
		}
	}
	recueil.entries.set(entry.id, entry);
	recueil.manifest.entries.push(indexRef(entry));
	recueil.manifest.updatedAt = entry.createdAt;
	return entry;
}

/** Copie légère d'une entrée pour l'index du manifest. */
function indexRef(entry) {
	const ref = { id: entry.id, type: entry.type, authorId: entry.authorId };
	if (entry.title) ref.title = entry.title;
	if (entry.date) ref.date = entry.date;
	return ref;
}

/**
 * Sérialise le recueil en archive .rmbr, viewer hors ligne compris (régénéré à chaque export).
 * Les médias sont déjà compressés : stockés sans recompression.
 * @param {Recueil} recueil
 */
export function exportRmbr(recueil) {
	/** @type {Record<string, any>} */
	const files = {
		'manifest.json': strToU8(JSON.stringify(recueil.manifest, null, 2)),
		'LISEZMOI.txt': strToU8(lisezmoi(recueil.manifest)),
		'viewer/index.html': strToU8(renderViewer(recueil))
	};
	for (const [id, entry] of recueil.entries) {
		files[`entries/${id}.json`] = strToU8(JSON.stringify(entry, null, 2));
	}
	for (const [path, bytes] of recueil.media) {
		files[path] = [bytes, { level: 0 }];
	}
	return zipSync(files, { level: 6 });
}

/**
 * Ouvre une archive .rmbr et fait les contrôles hors schéma de la spec.
 * Ne lève une erreur que si le fichier n'est pas un recueil exploitable ; le reste va dans warnings.
 * @param {Uint8Array} bytes
 * @returns {Promise<{ recueil: Recueil, warnings: string[] }>}
 */
export async function readRmbr(bytes) {
	const ignored = [];
	let files;
	try {
		files = unzipSync(bytes, {
			filter: (f) => {
				const ok = isAllowedPath(f.name) && f.originalSize <= MAX_FILE;
				if (!ok && !f.name.endsWith('/')) ignored.push(f.name);
				return ok;
			}
		});
	} catch {
		throw new Error("Ce fichier n'est pas une archive Remember Me lisible.");
	}

	const raw = files['manifest.json'];
	if (!raw) throw new Error('Fichier manifest.json absent : ce n’est pas un recueil Remember Me.');
	const manifest = parseJson(raw, 'manifest.json');
	if (manifest.format !== 'remember-me') throw new Error('Ce fichier n’est pas au format Remember Me.');
	if (manifest.kind !== 'recueil') throw new Error('Ce fichier est un pack de contribution, pas un recueil.');
	if (major(manifest.formatVersion) !== major(FORMAT_VERSION)) {
		throw new Error(`Version de format non prise en charge : ${manifest.formatVersion}.`);
	}

	const warnings = ignored.map((n) => `Fichier inattendu ignoré : ${n}`);
	const authors = new Set((manifest.authors ?? []).map((a) => a.id));
	const creator = manifest.authors?.find((a) => a.id === manifest.creatorId);
	if (!creator || creator.role !== 'creator') throw new Error('Le créateur du recueil est introuvable.');

	/** @type {Map<string, any>} */
	const entries = new Map();
	for (const [name, data] of Object.entries(files)) {
		const m = ENTRY_PATH.exec(name);
		if (!m) continue;
		const entry = parseJson(data, name);
		if (entry.id !== m[1]) {
			warnings.push(`L'entrée ${name} ne correspond pas à son nom de fichier : ignorée.`);
			continue;
		}
		entries.set(entry.id, entry);
	}

	const tombstoned = new Set([...entries.values()].filter((e) => e.type === 'tombstone').map((e) => e.supersedes));
	for (const ref of manifest.entries ?? []) {
		if (!entries.has(ref.id) && !tombstoned.has(ref.id)) warnings.push(`Souvenir manquant : ${ref.title ?? ref.id}`);
	}

	/** @type {Map<string, Uint8Array>} */
	const media = new Map();
	for (const entry of entries.values()) {
		if (!authors.has(entry.authorId)) warnings.push(`Auteur inconnu pour « ${entry.title ?? entry.id} ».`);
		for (const item of entry.media ?? []) {
			const data = files[item.path];
			if (!data || data.length !== item.size || (await sha256Hex(data)) !== item.sha256) {
				warnings.push(`Média abîmé ou manquant dans « ${entry.title ?? entry.id} ».`);
				continue;
			}
			media.set(item.path, data);
		}
	}

	return { recueil: { manifest, entries, media }, warnings };
}

/** Chemins autorisés dans l'archive : tout le reste est ignoré, jamais extrait. */
function isAllowedPath(name) {
	return (
		name === 'manifest.json' ||
		name === 'LISEZMOI.txt' ||
		name === 'viewer/index.html' ||
		ENTRY_PATH.test(name) ||
		MEDIA_PATH.test(name)
	);
}

function parseJson(data, name) {
	try {
		return JSON.parse(strFromU8(data));
	} catch {
		throw new Error(`${name} est illisible.`);
	}
}

function major(version) {
	return String(version ?? '').split('.')[0];
}

function lisezmoi(manifest) {
	return `${manifest.title}
${'='.repeat(manifest.title.length)}

Ce fichier est un recueil de souvenirs Remember Me.

Pour le consulter :
- ouvrez-le sur le site Remember Me (bouton « Ouvrir un recueil »),
- ou, sans connexion : renommez-le en .zip, décompressez-le,
  puis ouvrez viewer/index.html dans un navigateur.

Les textes sont dans le dossier entries/ (fichiers JSON lisibles),
les photos, sons et vidéos dans le dossier media/.

Gardez une copie de ce fichier en lieu sûr : c'est le seul exemplaire.
`;
}
