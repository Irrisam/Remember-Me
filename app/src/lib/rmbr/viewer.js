import { formatDate } from './timeline.js';
import { story, ageAt, formatAge } from './story.js';

const MEDIA_PATH = /^media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

/**
 * Génère viewer/index.html : une page statique, sans JavaScript, lisible en ouvrant
 * simplement le fichier après décompression. Même récit que l'app : frise (liens d'ancre),
 * périodes, réponses sous leur souvenir. Tout le texte est échappé ; les médias sont
 * référencés en relatif (../media/…) et seulement s'ils sont bien présents dans l'archive.
 * @param {import('./archive.js').Recueil} recueil
 */
export function renderViewer(recueil) {
	const { manifest } = recueil;
	const authors = new Map(manifest.authors.map((a) => [a.id, a.name]));
	const author = (e) => esc(authors.get(e.authorId) ?? 'auteur inconnu');
	const s = story(recueil.entries, manifest);
	const subject = manifest.subject;

	const body = (entry) => {
		const parts = [];
		const age = subject ? formatAge(subject.name, ageAt(subject.birthDate, entry.date)) : '';
		if (entry.date || age) {
			const date = entry.date ? esc(formatDate(entry.date)) : '';
			parts.push(`<p class="date">${date}${date && age ? ' · ' : ''}${age ? `<span class="age">${esc(age)}</span>` : ''}</p>`);
		}
		if (entry.title) parts.push(`<h3>${esc(entry.title)}</h3>`);
		for (const item of entry.media ?? []) {
			if (MEDIA_PATH.test(item.path) && recueil.media.has(item.path)) parts.push(media(item));
		}
		if (entry.text) parts.push(`<p class="text">${esc(entry.text)}</p>`);
		return parts.join('\n');
	};

	const thread = ({ entry, replies }) =>
		`<article>
${body(entry)}
<p class="by">Par ${author(entry)}</p>
${replies.map((r) => `<div class="reply"><p class="added">${author(r)} a complété :</p>\n${body(r)}</div>`).join('\n')}
</article>`;

	const filled = s.periods.filter((p) => p.threads.length);
	const sections = [
		...filled.map((p) => `<section id="periode-${p.key}">\n<h2>${esc(p.label)}</h2>\n${p.threads.map(thread).join('\n')}\n</section>`),
		s.undated.length ? `<section id="sans-date">\n<h2>Sans date</h2>\n${s.undated.map(thread).join('\n')}\n</section>` : ''
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
html { scroll-behavior: smooth; }
body { margin: 0; background: #f7f4ef; color: #2b2724; font: 18px/1.6 Georgia, 'Times New Roman', serif; }
main { max-width: 680px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 2rem; margin: 0 0 4px; }
.subject { color: #6b625a; margin-top: 0; }
article { background: #fff; border: 1px solid #e6dfd5; border-radius: 12px; padding: 20px; margin: 16px 0; }
section { scroll-margin-top: 96px; }
h2 { margin: 32px 0 0; color: #6b625a; font-size: 1.3rem; }
h3 { margin: 4px 0 12px; }
.date { color: #8a6d4f; margin: 0; font-style: italic; }
.age { font-style: normal; color: #6b625a; }
.text { white-space: pre-wrap; }
.by, figcaption, footer { color: #8a8076; font-size: 0.9rem; }
.reply { border-left: 3px solid #d9c7ad; padding: 4px 0 4px 16px; margin: 20px 0 0; }
.reply h3 { font-size: 1.05rem; }
.added { margin: 0 0 4px; color: #8a6d4f; font-size: 0.9rem; font-weight: 600; }
figure { margin: 0 0 12px; }
img, video { max-width: 100%; height: auto; border-radius: 8px; }
audio { width: 100%; }
footer { margin-top: 48px; text-align: center; }
.frise { position: sticky; top: 0; z-index: 1; background: #f7f4ef; margin: 16px -16px 0; padding: 8px 16px 4px; border-bottom: 1px solid #e6dfd5; overflow-x: auto; }
.frise ol { list-style: none; display: flex; margin: 0; padding: 0; min-width: max-content; background: linear-gradient(#cfc6ba, #cfc6ba) no-repeat 0 17px / 100% 2px; }
.frise li { flex: 1 0 64px; display: grid; justify-items: center; }
.frise a, .frise .stop { display: grid; justify-items: center; gap: 6px; text-decoration: none; color: inherit; padding: 4px 6px; }
.frise .dot { width: var(--size); height: var(--size); margin: calc((28px - var(--size)) / 2) 0; border-radius: 50%; background: #8a6d4f; box-shadow: 0 0 0 3px #f7f4ef; }
.frise a:hover .dot, .frise a:focus-visible .dot { background: #5b4636; }
.frise .empty .dot { background: #f7f4ef; border: 2px solid #cfc6ba; box-sizing: border-box; }
.frise .year { font-size: 0.85rem; font-weight: 600; white-space: nowrap; }
.frise .empty .year { color: #b3a898; font-weight: 400; }
.frise .undated { border-left: 1px dashed #cfc6ba; }
.frise .undated .dot { background: #b3a898; }
.frise .birth { font-size: 0.75rem; color: #8a6d4f; font-style: italic; margin-top: -4px; }
</style>
</head>
<body>
<main>
<h1>${esc(manifest.title)}</h1>
${subject ? `<p class="subject">${esc(subject.name)}</p>` : ''}
${frise(s)}
${sections || '<p>Aucun souvenir pour l’instant.</p>'}
<footer>Recueil Remember Me, mis à jour le ${esc(formatTimestamp(manifest.updatedAt))}.<br>
Les fichiers d’origine sont dans les dossiers entries/ et media/, à côté de ce dossier.</footer>
</main>
</body>
</html>
`;
}

/** Même frise que le composant Frise.svelte, en HTML pur. */
function frise({ periods, undated }) {
	if (periods.length + (undated.length ? 1 : 0) <= 1) return '';
	const size = (n) => (n ? 10 + Math.min(n, 6) * 3 : 8);
	const plural = (n) => `${n} souvenir${n > 1 ? 's' : ''}`;
	const dot = (n, label) => `<span class="dot" style="--size:${size(n)}px"></span><span class="year">${esc(label)}</span>`;
	const items = periods.map((p) => {
		const n = p.threads.length;
		const inner = n
			? `<a href="#periode-${p.key}" title="${esc(`${p.label} : ${plural(n)}`)}">${dot(n, p.short)}</a>`
			: `<span class="stop" title="${esc(`${p.label} : aucun souvenir`)}">${dot(0, p.short)}</span>`;
		return `<li${n ? '' : ' class="empty"'}>${inner}${p.birth ? '<span class="birth">naissance</span>' : ''}</li>`;
	});
	if (undated.length) {
		items.push(`<li class="undated"><a href="#sans-date" title="${esc(`Sans date : ${plural(undated.length)}`)}">${dot(undated.length, 'Sans date')}</a></li>`);
	}
	return `<nav class="frise" aria-label="Frise des souvenirs"><ol>${items.join('')}</ol></nav>`;
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
