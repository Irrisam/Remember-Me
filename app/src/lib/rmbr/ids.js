/** UUID v7 en minuscules : 48 bits d'horodatage ms puis aléa, donc triable par date de création. */
export function uuidv7() {
	const b = crypto.getRandomValues(new Uint8Array(16));
	let ts = Date.now();
	for (let i = 5; i >= 0; i--) {
		b[i] = ts % 256;
		ts = Math.floor(ts / 256);
	}
	b[6] = (b[6] & 0x0f) | 0x70;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = toHex(b);
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Horodatage technique ISO 8601 en UTC. */
export function now() {
	return new Date().toISOString();
}

/** @param {Uint8Array} bytes */
export async function sha256Hex(bytes) {
	return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

/** @param {Uint8Array} bytes */
function toHex(bytes) {
	return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
}
