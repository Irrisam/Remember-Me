import { timeline, formatDate } from './timeline.js';

const MEDIA_PATH = /^media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

/**
 * Génère viewer/index.html : une page statique, sans JavaScript, lisible en ouvrant
 * simplement le fichier après décompression. Tout le texte est échappé ; les médias sont
 * référencés en relatif (../media/…) et seulement s'ils sont bien présents dans l'archive.
 * @param {import('./archive.js').Recueil} recueil
 */
export function renderViewer(recueil) {
	const { manifest } = recueil;
	const authors = new Map(manifest.authors.map((a) => [a.id, a.name]));
	const { dated, undated } = timeline(recueil.entries, manifest.creatorId);

	const article = (entry) => {
		const parts = [];
		if (entry.date) parts.push(`<p class="date">${esc(formatDate(entry.date))}</p>`);
		if (entry.title) parts.push(`<h3>${esc(entry.title)}</h3>`);
		for (const item of entry.media ?? []) {
			if (MEDIA_PATH.test(item.path) && recueil.media.has(item.path)) parts.push(media(item));
		}
		if (entry.text) parts.push(`<p class="text">${esc(entry.text)}</p>`);
		parts.push(`<p class="by">Par ${esc(authors.get(entry.authorId) ?? 'auteur inconnu')}</p>`);
		return `<article>${parts.join('\n')}</article>`;
	};

	const body = [
		...dated.map(article),
		undated.length ? `<h2>Sans date</h2>` : '',
		...undated.map(article)
	].join('\n');

	return `<!doctype html>
<html lang="${esc(manifest.language ?? 'fr')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'">
<meta name="generator" content="Remember Me — format ${esc(manifest.formatVersion)}">
<title>${esc(manifest.title)}</title>
<style>
body { margin: 0; background: #f7f4ef; color: #2b2724; font: 18px/1.6 Georgia, 'Times New Roman', serif; }
main { max-width: 680px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 2rem; margin: 0 0 4px; }
.subject { color: #6b625a; margin-top: 0; }
article { background: #fff; border: 1px solid #e6dfd5; border-radius: 12px; padding: 20px; margin: 16px 0; }
h2 { margin-top: 32px; color: #6b625a; }
h3 { margin: 4px 0 12px; }
.date { color: #8a6d4f; margin: 0; font-style: italic; }
.text { white-space: pre-wrap; }
.by, figcaption, footer { color: #8a8076; font-size: 0.9rem; }
figure { margin: 0 0 12px; }
img, video { max-width: 100%; height: auto; border-radius: 8px; }
audio { width: 100%; }
footer { margin-top: 48px; text-align: center; }
</style>
</head>
<body>
<main>
<h1>${esc(manifest.title)}</h1>
${manifest.subject ? `<p class="subject">${esc(manifest.subject.name)}</p>` : ''}
${body || '<p>Aucun souvenir pour l’instant.</p>'}
<footer>Recueil Remember Me, mis à jour le ${esc(formatTimestamp(manifest.updatedAt))}.<br>
Les fichiers d’origine sont dans les dossiers entries/ et media/, à côté de ce dossier.</footer>
</main>
</body>
</html>
`;
}

function media(item) {
	const src = `../${item.path}`;
	const caption = item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : '';
	let tag;
	if (item.mimeType.startsWith('image/')) {
		tag = `<img src="${src}" alt="${esc(item.caption ?? '')}" width="${int(item.width)}" height="${int(item.height)}">`;
	} else if (item.mimeType.startsWith('audio/')) {
		tag = `<audio controls preload="none" src="${src}"></audio>`;
	} else {
		tag = `<video controls preload="metadata" src="${src}" width="${int(item.width)}" height="${int(item.height)}"></video>`;
	}
	return `<figure>${tag}${caption}</figure>`;
}

function formatTimestamp(ts) {
	const d = new Date(ts);
	return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const int = (n) => (Number.isInteger(n) && n > 0 ? n : '');

/** @param {string} s */
function esc(s) {
	return String(s)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
