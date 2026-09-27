/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';

/**
 * Hors ligne : l'application (pages, scripts, polices, icônes) est mise en cache à l'installation.
 * Les souvenirs ne passent jamais par ici : ils restent en mémoire puis dans les fichiers .rmbr.
 * L'outil vidéo (jsDelivr, autre origine) n'est pas mis en cache par ce worker.
 */
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const CACHE = `remember-me-${version}`;
// _headers est une consigne pour l'hébergeur, jamais servie : la mettre en cache ferait échouer l'installation.
const ASSETS = [...build, ...files.filter((f) => f !== '/_headers'), ...prerendered];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== sw.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// Fichiers de build versionnés : le cache fait foi.
			if (ASSETS.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}
			// Le reste : réseau d'abord, cache si hors ligne. Une page inconnue retombe sur l'accueil.
			try {
				const response = await fetch(request);
				if (response.ok && response.type === 'basic') cache.put(request, response.clone());
				return response;
			} catch (err) {
				const hit = (await cache.match(request)) ?? (request.mode === 'navigate' ? await cache.match('/') : undefined);
				if (hit) return hit;
				throw err;
			}
		})()
	);
});
