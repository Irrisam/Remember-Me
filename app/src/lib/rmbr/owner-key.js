import { keyIdOf } from './signature.js';

/**
 * Clé du propriétaire (créateur) d'un recueil : une paire ES256 dont la clé privée voyage dans le
 * manifest (bloc ownerKey), chiffrée par un mot de passe. Sans lui, impossible d'agir en propriétaire.
 * Pas de récupération possible : un oubli laisse le recueil lisible, mais plus modifiable en son nom.
 */
export const OWNER_KEY_ITERATIONS = 600000;

const EC = { name: 'ECDSA', namedCurve: 'P-256' };
const utf8 = new TextEncoder();

/**
 * @param {string} password
 * @param {{ hint?: string, iterations?: number }} [opts]
 * @returns {Promise<{ publicKey: { keyId: string, jwk: any }, ownerKey: any, signer: Signer }>}
 */
export async function createOwnerKey(password, { hint, iterations = OWNER_KEY_ITERATIONS } = {}) {
	const pair = await crypto.subtle.generateKey(EC, true, ['sign', 'verify']);
	const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
	const jwk = { kty, crv, x, y };
	const keyId = await keyIdOf(jwk);
	const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
	return {
		publicKey: { keyId, jwk },
		ownerKey: await wrap(pkcs8, password, iterations, hint),
		signer: { privateKey: await importPrivate(pkcs8), keyId }
	};
}

/**
 * Déverrouille la clé avec le mot de passe. La clé obtenue n'est pas exportable.
 * @typedef {{ privateKey: CryptoKey, keyId: string }} Signer
 * @param {any} ownerKey bloc ownerKey du manifest
 * @param {string} password
 * @param {string} keyId keyId attendu (celui de la clé publique du créateur)
 * @returns {Promise<Signer>}
 */
export async function unlockOwnerKey(ownerKey, password, keyId) {
	return { privateKey: await importPrivate(await unwrap(ownerKey, password)), keyId };
}

/** Nouveau mot de passe pour la même clé : il faut connaître l'ancien. */
export async function rewrapOwnerKey(ownerKey, oldPassword, newPassword, { hint, iterations = ownerKey.iterations } = {}) {
	return wrap(await unwrap(ownerKey, oldPassword), newPassword, iterations, hint);
}

async function wrap(pkcs8, password, iterations, hint) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await derive(password, salt, iterations);
	const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pkcs8));
	const block = {
		kdf: 'PBKDF2-SHA256',
		iterations,
		salt: toB64(salt),
		cipher: 'AES-GCM-256',
		iv: toB64(iv),
		data: toB64(data)
	};
	if (hint) block.hint = hint;
	return block;
}

async function unwrap(ownerKey, password) {
	const key = await derive(password, fromB64(ownerKey.salt), ownerKey.iterations);
	try {
		return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ownerKey.iv) }, key, fromB64(ownerKey.data)));
	} catch {
		throw new Error('Mot de passe incorrect.');
	}
}

async function derive(password, salt, iterations) {
	const base = await crypto.subtle.importKey('raw', utf8.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		base,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

function importPrivate(pkcs8) {
	return crypto.subtle.importKey('pkcs8', pkcs8, EC, false, ['sign']);
}

function toB64(bytes) {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}

function fromB64(s) {
	return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
