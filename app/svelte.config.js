import adapter from '@sveltejs/adapter-static';

/** Site 100 % statique : aucune donnée ne quitte le navigateur. */
export default {
	kit: {
		// 404.html : sans elle, Cloudflare Pages sert l'accueil (en 200) pour toute adresse inconnue.
		adapter: adapter({ fallback: '404.html' }),
		/*
		 * Politique de sécurité injectée dans chaque page (balise meta, avec les empreintes des scripts
		 * de SvelteKit). Seule exception réseau : jsDelivr, pour l'outil vidéo, vérifié par empreinte.
		 * Les en-têtes que la meta ne peut pas porter (frame-ancestors…) sont dans static/_headers.
		 */
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', 'wasm-unsafe-eval'],
				'worker-src': ['self', 'blob:'],
				'connect-src': ['self', 'https://cdn.jsdelivr.net'],
				'img-src': ['self', 'blob:', 'data:'],
				'media-src': ['self', 'blob:'],
				'font-src': ['self', 'data:'],
				// Svelte pose des attributs style (style:--size…) : styles en ligne nécessaires.
				'style-src': ['self', 'unsafe-inline'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};
