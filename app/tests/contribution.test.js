import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate';
import {
	createRecueil,
	createPack,
	addEntry,
	deleteEntry,
	exportRmbr,
	exportRmbrc,
	readRmbr,
	readRmbrc
} from '../src/lib/rmbr/archive.js';
import { reviewPack, mergePack } from '../src/lib/rmbr/merge.js';
import { timeline } from '../src/lib/rmbr/timeline.js';
import { signEntry, keyIdOf } from '../src/lib/rmbr/signature.js';
import { uuidv7 } from '../src/lib/rmbr/ids.js';
import { validManifest, validEntry } from './schema.js';

const photo = (n) => ({ bytes: new Uint8Array([n, n, n]), mimeType: 'image/webp', width: 10, height: 10 });

/** Recueil de Jeanne avec un souvenir, puis Léa qui en ajoute deux dans un pack. */
async function scenario() {
	const recueil = createRecueil({ title: 'Mamie Jeanne', creatorName: 'Jeanne' });
	const bal = await addEntry(recueil, { type: 'text', authorId: recueil.manifest.creatorId, title: 'Le bal', text: 'Juillet 1959.' });
	const lea = { id: uuidv7(), name: 'Léa', relation: 'petite-fille' };
	const pack = createPack(recueil, lea);
	const reply = await addEntry(pack, { type: 'photo', authorId: lea.id, title: 'La photo du bal', replyTo: bal.id, media: [photo(1)] });
	const other = await addEntry(pack, { type: 'text', authorId: lea.id, text: 'Les crêpes du dimanche.' });
	return { recueil, pack, lea, bal, reply, other };
}

/** Passe par les fichiers, comme en vrai : export puis réouverture. */
const viaFile = async (pack) => (await readRmbrc(exportRmbrc(pack))).pack;
const reopen = async (recueil) => (await readRmbr(exportRmbr(recueil))).recueil;

test('pack .rmbrc : conforme au schéma, sans viewer, relu à l’identique', async () => {
	const { pack } = await scenario();
	const bytes = exportRmbrc(pack);
	const files = unzipSync(bytes);
	assert.equal(files['viewer/index.html'], undefined);
	assert.ok(files['LISEZMOI.txt']);
	const manifest = JSON.parse(strFromU8(files['manifest.json']));
	assert.ok(validManifest(manifest), JSON.stringify(validManifest.errors));
	for (const entry of pack.entries.values()) assert.ok(validEntry(entry), JSON.stringify(validEntry.errors));

	const { pack: back, warnings } = await readRmbrc(bytes);
	assert.deepEqual(warnings, []);
	assert.deepEqual(back.manifest, pack.manifest);
	await assert.rejects(readRmbr(bytes), /pack de contribution/);
});

test('fusion : seules les entrées acceptées entrent, avec leur auteur et leurs médias', async () => {
	const { recueil, pack, lea, reply, other } = await scenario();
	const items = await reviewPack(recueil, await viaFile(pack));
	assert.deepEqual(items.map((i) => i.status), ['new', 'new']);

	const merged = mergePack(recueil, await viaFile(pack), items, new Set([reply.id]));
	assert.ok(merged.entries.has(reply.id));
	assert.ok(!merged.entries.has(other.id));
	assert.equal(merged.manifest.authors.find((a) => a.id === lea.id)?.relation, 'petite-fille');
	assert.equal(merged.media.size, 1);

	const bytes = exportRmbr(merged);
	const manifest = JSON.parse(strFromU8(unzipSync(bytes)['manifest.json']));
	assert.ok(validManifest(manifest), JSON.stringify(validManifest.errors));
	const { recueil: back, warnings } = await readRmbr(bytes);
	assert.deepEqual(warnings, []);
	assert.equal(back.entries.size, 2);
});

test('fusion : tout refuser ne laisse aucune trace, pas même l’auteur', async () => {
	const { recueil, pack } = await scenario();
	const items = await reviewPack(recueil, pack);
	assert.equal(mergePack(recueil, pack, items, new Set()), recueil);
});

test('règle 1 : pack destiné à un autre recueil refusé', async () => {
	const { pack } = await scenario();
	const other = createRecueil({ title: 'Autre', creatorName: 'Paul' });
	await assert.rejects(reviewPack(other, pack), /autre recueil/);
});

test('règle 5 : un pack ne peut pas se faire passer pour le créateur', async () => {
	const { recueil, pack } = await scenario();
	pack.manifest.authors[0].id = recueil.manifest.creatorId;
	await assert.rejects(reviewPack(recueil, pack), /créateur/);
});

test('règle 3 : une entrée déjà présente est ignorée', async () => {
	const { recueil, pack, reply } = await scenario();
	const merged = mergePack(recueil, pack, await reviewPack(recueil, pack), new Set([reply.id]));
	const items = await reviewPack(merged, pack);
	assert.equal(items.find((i) => i.entry.id === reply.id).status, 'duplicate');
});

test('règles 6 et 7 : suppression par son auteur ok, par un tiers refusée, pas de retour par un vieux pack', async () => {
	const { recueil, pack, lea, bal, reply } = await scenario();
	let merged = mergePack(recueil, pack, await reviewPack(recueil, pack), new Set([reply.id]));

	const pack2 = createPack(merged, lea);
	const own = await deleteEntry(pack2, reply.id, lea.id);
	const foreign = await deleteEntry(pack2, bal.id, lea.id);
	const items = await reviewPack(merged, pack2);
	assert.equal(items.find((i) => i.entry.id === own.id).status, 'new');
	assert.match(items.find((i) => i.entry.id === foreign.id).reason, /auteur/);

	merged = await reopen(mergePack(merged, pack2, items, new Set([own.id])));
	assert.ok(!merged.entries.has(reply.id), 'le souvenir supprimé a quitté l’archive');
	assert.equal(merged.media.size, 0, 'sa photo aussi');

	const replay = await reviewPack(merged, pack);
	assert.match(replay.find((i) => i.entry.id === reply.id).reason, /supprimé/);
});

test('règle 8 : auteur avec clé publique → signature exigée et vérifiée', async () => {
	const { recueil, lea, bal } = await scenario();
	const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
	const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', publicKey);
	const jwk = { kty, crv, x, y };
	const keyId = await keyIdOf(jwk);

	const pack = createPack(recueil, lea);
	pack.manifest.authors[0].publicKey = { keyId, jwk };
	const unsigned = await addEntry(pack, { type: 'text', authorId: lea.id, text: 'Non signé.', replyTo: bal.id });
	const signed = await signEntry(await addEntry(pack, { type: 'text', authorId: lea.id, text: 'Signé.' }), privateKey, keyId);
	pack.entries.set(signed.id, signed);
	const forged = { ...signed, id: uuidv7(), text: 'Modifié après signature.' };
	pack.entries.set(forged.id, forged);

	assert.ok(validManifest(pack.manifest), JSON.stringify(validManifest.errors));
	assert.ok(validEntry(signed), JSON.stringify(validEntry.errors));
	const items = await reviewPack(recueil, await viaFile(pack));
	const status = (id) => items.find((i) => i.entry.id === id);
	assert.equal(status(signed.id).status, 'new');
	assert.match(status(unsigned.id).reason, /Signature/);
	assert.match(status(forged.id).reason, /Signature/);
});

test('médias : manquant ou en conflit avec un fichier existant → refusé', async () => {
	const { recueil, pack, reply } = await scenario();
	const files = unzipSync(exportRmbrc(pack));
	delete files[reply.media[0].path];
	const { pack: broken } = await readRmbrc(zipSync(files));
	assert.match((await reviewPack(recueil, broken)).find((i) => i.entry.id === reply.id).reason, /abîmé/);

	const clash = await addEntry(recueil, { type: 'photo', authorId: recueil.manifest.creatorId, media: [photo(2)] });
	pack.entries.get(reply.id).media[0].path = clash.media[0].path;
	pack.media.set(clash.media[0].path, photo(1).bytes);
	assert.match((await reviewPack(recueil, pack)).find((i) => i.entry.id === reply.id).reason, /conflit/);
});

test('suppression par le créateur : retiré de l’affichage, de l’index et de l’archive', async () => {
	const recueil = createRecueil({ title: 'Mamie Jeanne', creatorName: 'Jeanne' });
	const me = recueil.manifest.creatorId;
	const gone = await addEntry(recueil, { type: 'photo', authorId: me, title: 'À retirer', media: [photo(3)] });
	await addEntry(recueil, { type: 'text', authorId: me, text: 'Reste.' });
	const tomb = await deleteEntry(recueil, gone.id, me);
	assert.ok(validEntry(tomb), JSON.stringify(validEntry.errors));
	assert.equal(timeline(recueil.entries, me).undated.length, 1);

	const files = unzipSync(exportRmbr(recueil));
	assert.equal(files[`entries/${gone.id}.json`], undefined);
	assert.equal(files[gone.media[0].path], undefined);
	assert.ok(files[`entries/${tomb.id}.json`]);
	const manifest = JSON.parse(strFromU8(files['manifest.json']));
	assert.ok(!manifest.entries.some((r) => r.id === gone.id));
	assert.doesNotMatch(strFromU8(files['viewer/index.html']), /À retirer/);
	assert.deepEqual((await readRmbr(zipSync(files))).warnings, []);
});

test('un recueil importé comme contribution est refusé', async () => {
	const { recueil } = await scenario();
	await assert.rejects(readRmbrc(exportRmbr(recueil)), /recueil, pas un pack/);
	await assert.rejects(readRmbrc(strToU8('x')), /lisible/);
});
