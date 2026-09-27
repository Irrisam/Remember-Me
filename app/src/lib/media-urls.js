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

/**
 * Cache d'URLs locales qui survit aux changements du recueil : un média déjà affiché garde son URL
 * (pas de rechargement des photos, pas de lecteur vidéo coupé), seuls les médias disparus sont libérés.
 */
export function urlCache() {
	/** @type {Map<string, string>} */
	let cache = new Map();
	return {
		/**
		 * @param {Iterable<any>} entries
		 * @param {Map<string, Uint8Array>} media
		 * @returns {Map<string, string>}
		 */
		sync(entries, media) {
			const next = new Map();
			for (const entry of entries) {
				for (const item of entry.media ?? []) {
					if (next.has(item.path)) continue;
					const bytes = media.get(item.path);
					if (!bytes) continue;
					next.set(item.path, cache.get(item.path) ?? URL.createObjectURL(new Blob([bytes], { type: item.mimeType })));
				}
			}
			for (const [path, url] of cache) if (!next.has(path)) URL.revokeObjectURL(url);
			cache = next;
			return new Map(next);
		},
		clear() {
			revokeAll(cache);
			cache = new Map();
		}
	};
}
