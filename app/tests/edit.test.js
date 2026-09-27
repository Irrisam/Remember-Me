import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import {
	createRecueil,
	createPack,
	addEntry,
	editEntry,
	exportRmbr,
	exportRmbrc,
	readRmbr,
	readRmbrc,
	protectRecueil
} from '../src/lib/rmbr/archive.js';
import { reviewPack, mergePack } from '../src/lib/rmbr/merge.js';
import { story } from '../src/lib/rmbr/story.js';
import { verifyEntry } from '../src/lib/rmbr/signature.js';
import { uuidv7 } from '../src/lib/rmbr/ids.js';
import { validManifest, validEntry } from './schema.js';

const photo = (n) => ({ bytes: new Uint8Array([n, n, n, n]), mimeType: 'image/webp', width: 10, height: 10 });
const keep = (r, item) => ({ keep: item, bytes: r.media.get(item.path) });
const titles = (s) => [...s.periods.flatMap((p) => p.threads), ...s.undated].map((t) => t.entry.title);

async function sample() {
	const r = createRecueil({ title: 'Mamie', creatorName: 'Jeanne' });
	const me = r.manifest.creatorId;
	const bal = await addEntry(r, {
		type: 'photo',
		authorId: me,
		title: 'Le bal',
		text: 'Texte avec une faute.',
		date: { value: '1959' },
		media: [photo(1), photo(2)]
	});
	return { r, me, bal };
}

test('modifier : la nouvelle version remplace l’ancienne, qui quitte le fichier à l’export', async () => {
	const { r, bal } = await sample();
	const [kept, dropped] = bal.media;
	const edited = await editEntry(r, bal, {
		type: 'photo',
		title: 'Le bal du 14 juillet',
		text: 'Texte corrigé.',
		date: { value: '1959-07-14' },
		media: [keep(r, kept)]
	});
	assert.ok(validEntry(edited), JSON.stringify(validEntry.errors));
	assert.equal(edited.supersedes, bal.id);
	assert.deepEqual(edited.media, [kept], 'le média gardé est repris tel quel, sans doublon');
	assert.deepEqual(titles(story(r.entries, r.manifest)), ['Le bal du 14 juillet']);

	const files = unzipSync(exportRmbr(r));
	assert.equal(files[`entries/${bal.id}.json`], undefined, 'ancienne version retirée');
	assert.ok(files[kept.path], 'photo gardée');
	assert.equal(files[dropped.path], undefined, 'photo retirée par la modification : partie aussi');
	const manifest = JSON.parse(strFromU8(files['manifest.json']));
	assert.ok(validManifest(manifest), JSON.stringify(validManifest.errors));
	assert.doesNotMatch(strFromU8(files['viewer/index.html']), /Texte avec une faute/);

	const { recueil, warnings } = await readRmbr(exportRmbr(r));
	assert.deepEqual(warnings, []);
	assert.deepEqual(titles(story(recueil.entries, recueil.manifest)), ['Le bal du 14 juillet']);
});

test('modifier : les réponses des proches suivent la nouvelle version, avant et après export', async () => {
	const { r, me, bal } = await sample();
	await addEntry(r, { type: 'text', authorId: me, title: 'Ma réponse', text: 'x', replyTo: bal.id });
	await editEntry(r, bal, { type: 'text', title: 'Le bal (corrigé)', text: 'y' });
	const check = (rec) => {
		const s = story(rec.entries, rec.manifest);
		const threads = [...s.periods.flatMap((p) => p.threads), ...s.undated];
		assert.deepEqual(threads.map((t) => t.entry.title), ['Le bal (corrigé)']);
		assert.deepEqual(threads[0].replies.map((e) => e.title), ['Ma réponse']);
	};
	check(r);
	check((await readRmbr(exportRmbr(r))).recueil);
});

test('modifier dans un recueil protégé : correction et suppression signées', async () => {
	const { r } = await sample();
	const { recueil, signer } = await protectRecueil(r, 'le bal de 1959', { iterations: 100000 });
	const bal = [...recueil.entries.values()][0];
	const edited = await editEntry(recueil, bal, { type: 'text', text: 'Corrigé.' }, signer);
	const pub = recueil.manifest.authors[0].publicKey;
	assert.ok(await verifyEntry(edited, pub));
	const tomb = [...recueil.entries.values()].find((e) => e.type === 'tombstone');
	assert.ok(await verifyEntry(tomb, pub));
	assert.deepEqual((await readRmbr(exportRmbr(recueil))).warnings, []);
});

test('un proche modifie son souvenir déjà fusionné : accepté par le créateur, remplacé', async () => {
	const { r } = await sample();
	const lea = { id: uuidv7(), name: 'Léa' };
	const pack1 = createPack(r, lea);
	const hers = await addEntry(pack1, { type: 'text', authorId: lea.id, title: 'Les crêpes', text: 'Faute.' });
	let merged = mergePack(r, pack1, await reviewPack(r, pack1), new Set([hers.id]));

	const pack2 = createPack(merged, lea);
	await editEntry(pack2, hers, { type: 'text', title: 'Les crêpes', text: 'Corrigé.' });
	const back = (await readRmbrc(exportRmbrc(pack2))).pack;
	const items = await reviewPack(merged, back);
	assert.deepEqual(items.map((i) => i.status), ['new', 'new']);
	merged = mergePack(merged, back, items, new Set(items.map((i) => i.entry.id)));

	const reopened = (await readRmbr(exportRmbr(merged))).recueil;
	const texts = [...reopened.entries.values()].filter((e) => e.text).map((e) => e.text);
	assert.ok(texts.includes('Corrigé.'));
	assert.ok(!texts.includes('Faute.'));
});
