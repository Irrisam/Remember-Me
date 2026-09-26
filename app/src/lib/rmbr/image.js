const MAX_SIDE = 2048;
/** Plafond du schéma pour une image. */
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Recompresse une photo côté client : WebP (JPEG si le navigateur ne sait pas),
 * 2048 px max, ≤ 3 Mo. Le réencodage retire aussi les métadonnées EXIF (GPS, appareil).
 * @param {File} file
 */
export async function compressImage(file) {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	let quality = 0.85;
	let type = 'image/webp';

	for (let attempt = 0; attempt < 12; attempt++) {
		const width = Math.round(bitmap.width * scale);
		const height = Math.round(bitmap.height * scale);
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
		const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
		if (blob.type !== type) {
			type = 'image/jpeg';
			continue;
		}
		if (blob.size <= MAX_BYTES) {
			bitmap.close();
			return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: type, width, height };
		}
		if (quality > 0.55) quality -= 0.1;
		else scale *= 0.8;
	}
	bitmap.close();
	throw new Error('Cette photo est trop lourde, même compressée.');
}
