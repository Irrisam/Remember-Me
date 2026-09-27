import { createPack, readRmbr } from '$lib/rmbr/archive.js';

/**
 * Le recueil ouvert, partagé entre les pages (vitrine → création → recueil).
 * Rien n'est persisté : tout vit en mémoire jusqu'à l'enregistrement du fichier.
 */
class Session {
	/** @type {import('$lib/rmbr/archive.js').Recueil | null} */
	recueil = $state.raw(null);
	/** creator : crée et modère ; contributor : prépare un pack ; reader : consulte. null = à demander. */
	role = $state(null);
	/** Auteur qui utilise l'app. */
	me = $state.raw(null);
	/** Clé du propriétaire déverrouillée par son mot de passe (recueil protégé). Jamais exportable. */
	signer = $state.raw(null);
	/** Pack en préparation (contributor). */
	pack = $state.raw(null);
	/** Changements pas encore enregistrés dans un fichier. */
	dirty = $state(false);
	/** Avertissements de la dernière ouverture de fichier. */
	warnings = $state([]);

	/** Recueil tout juste créé : on en est le créateur. */
	start(recueil, signer = null) {
		this.recueil = recueil;
		this.role = 'creator';
		this.me = recueil.manifest.authors[0];
		this.signer = signer;
		this.pack = null;
		this.warnings = [];
		this.dirty = true;
		rememberOwner(recueil);
	}

	/** Ouvre un fichier .rmbr reçu. Le rôle sera demandé (« Qui êtes-vous ? »). */
	async open(file) {
		const { recueil, warnings } = await readRmbr(new Uint8Array(await file.arrayBuffer()));
		this.recueil = recueil;
		this.warnings = [...warnings, ...checkOwner(recueil)];
		this.role = this.me = this.pack = this.signer = null;
		this.dirty = false;
	}

	/** @param {import('$lib/rmbr/owner-key.js').Signer | null} [signer] clé déverrouillée, pour le créateur */
	become(role, author, signer = null) {
		this.role = role;
		this.me = author;
		this.signer = role === 'creator' ? signer : null;
		this.pack = role === 'contributor' ? createPack(this.recueil, author) : null;
	}

	close() {
		this.recueil = this.role = this.me = this.pack = this.signer = null;
		this.warnings = [];
		this.dirty = false;
	}
}

export const session = new Session();

/*
 * Confiance au premier contact : ce navigateur retient la clé du propriétaire de chaque recueil déjà ouvert,
 * et prévient si elle disparaît ou change (fichier reconstruit par quelqu'un d'autre).
 * Simple confort local : sans stockage disponible, on ne vérifie rien.
 */
const OWNER_PREFIX = 'remember-me:owner:';

function ownerKeyId(recueil) {
	return recueil.manifest.authors.find((a) => a.id === recueil.manifest.creatorId)?.publicKey?.keyId ?? null;
}

export function rememberOwner(recueil) {
	const keyId = ownerKeyId(recueil);
	try {
		if (keyId) localStorage.setItem(OWNER_PREFIX + recueil.manifest.id, keyId);
	} catch {
		/* stockage indisponible */
	}
}

function checkOwner(recueil) {
	let known = null;
	try {
		known = localStorage.getItem(OWNER_PREFIX + recueil.manifest.id);
	} catch {
		return [];
	}
	const current = ownerKeyId(recueil);
	if (known && known !== current) {
		return [
			current
				? 'Attention : la clé du propriétaire de ce recueil a changé depuis votre dernière ouverture. Le fichier a peut-être été modifié par quelqu’un d’autre.'
				: 'Attention : ce recueil était protégé par un mot de passe lors de votre dernière ouverture, il ne l’est plus. Le fichier a peut-être été modifié par quelqu’un d’autre.'
		];
	}
	rememberOwner(recueil);
	return [];
}

/** Nom de fichier sans accents ni espaces. */
export function slug(s) {
	return (
		s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-zA-Z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase() || 'recueil'
	);
}
