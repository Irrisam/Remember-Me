import { sha256Hex } from './ids.js';

const ALGO = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };
const utf8 = new TextEncoder();

/**
 * Canonisation JCS (RFC 8785) : clés triées par unités UTF-16, pas d'espaces,
 * chaînes et nombres sérialisés comme JSON.stringify (ce que la RFC reprend d'ECMAScript).
 */
export function canonicalize(value) {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
	const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

/** keyId : 16 premiers hex du SHA-256 de l'empreinte JWK (RFC 7638). */
export async function keyIdOf(jwk) {
	const thumbprint = canonicalize({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
	return (await sha256Hex(utf8.encode(thumbprint))).slice(0, 16);
}

/**
 * Vérifie la signature ES256 d'une entrée avec la clé publique de son auteur.
 * @param {any} entry
 * @param {{ keyId: string, jwk: any }} publicKey
 */
export async function verifyEntry(entry, publicKey) {
	const { signature, ...unsigned } = entry;
	if (!signature || signature.alg !== 'ES256' || signature.keyId !== publicKey.keyId) return false;
	if ((await keyIdOf(publicKey.jwk)) !== publicKey.keyId) return false;
	try {
		const key = await crypto.subtle.importKey('jwk', publicKey.jwk, ALGO, false, ['verify']);
		return await crypto.subtle.verify(SIGN, key, fromB64url(signature.value), utf8.encode(canonicalize(unsigned)));
	} catch {
		return false;
	}
}

/**
 * Signe une entrée (r‖s en base64url). Renvoie une copie avec le champ signature.
 * @param {any} entry
 * @param {CryptoKey} privateKey
 * @param {string} keyId
 */
export async function signEntry(entry, privateKey, keyId) {
	const { signature: _, ...unsigned } = entry;
	const sig = await crypto.subtle.sign(SIGN, privateKey, utf8.encode(canonicalize(unsigned)));
	return { ...unsigned, signature: { alg: 'ES256', keyId, value: toB64url(new Uint8Array(sig)) } };
}

function fromB64url(s) {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toB64url(bytes) {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
