/**
 * URLs locales (blob:) des médias des entrées données. À libérer avec revokeAll.
 * @param {Iterable<any>} entries
 * @param {Map<string, Uint8Array>} media
 */
export function objectUrls(entries, media) {
	const urls = new Map();
	for (const entry of entries) {
		for (const item of entry.media ?? []) {
			const bytes = media.get(item.path);
			if (bytes && !urls.has(item.path)) urls.set(item.path, URL.createObjectURL(new Blob([bytes], { type: item.mimeType })));
		}
	}
	return urls;
}

/** @param {Map<string, string>} urls */
export function revokeAll(urls) {
	urls.forEach((u) => URL.revokeObjectURL(u));
}
