import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { createRecueil, editRecueil, addEntry, exportRmbr, readRmbr } from '../src/lib/rmbr/archive.js';
import { timeline, formatDate } from '../src/lib/rmbr/timeline.js';
import { validManifest, validEntry } from './schema.js';

async function sample() {
	const r = createRecueil({ title: 'Les souvenirs de Mamie Jeanne', subjectName: 'Jeanne Martin', creatorName: 'Jeanne' });
	const me = r.manifest.creatorId;
	await addEntry(r, { type: 'text', authorId: me, text: 'Sans date.' });
	await addEntry(r, { type: 'text', authorId: me, title: 'Le bal', text: 'Il m’a marché sur les pieds.', date: { value: '1959-07-14' } });
	await addEntry(r, {
		type: 'photo',
		authorId: me,
		title: 'La photo du bal',
		date: { value: '1959', approximate: true },
		media: [{ bytes: new Uint8Array([1, 2, 3, 4]), mimeType: 'image/webp', width: 10, height: 8 }]
	});
	return r;
}

test('export puis réouverture : contenu identique et conforme au schéma', async () => {
	const original = await sample();
	const bytes = exportRmbr(original);
	const files = unzipSync(bytes);

	assert.ok(files['LISEZMOI.txt']);
	const manifest = JSON.parse(strFromU8(files['manifest.json']));
	assert.ok(validManifest(manifest), JSON.stringify(validManifest.errors));
	for (const [name, data] of Object.entries(files)) {
		if (!name.startsWith('entries/')) continue;
		const entry = JSON.parse(strFromU8(data));
		assert.ok(validEntry(entry), `${name} : ${JSON.stringify(validEntry.errors)}`);
	}

	const { recueil, warnings } = await readRmbr(bytes);
	assert.deepEqual(warnings, []);
	assert.deepEqual(recueil.manifest, original.manifest);
	assert.deepEqual([...recueil.entries.values()], [...original.entries.values()]);
	assert.deepEqual([...recueil.media.entries()], [...original.media.entries()]);
});

test('souvenir audio : conforme au schéma, relu à l’identique, lecteur dans le viewer', async () => {
	const r = await sample();
	const entry = await addEntry(r, {
		type: 'audio',
		authorId: r.manifest.creatorId,
		title: 'La chanson de ma mère',
		media: [{ bytes: new Uint8Array([26, 69, 223, 163]), mimeType: 'audio/webm', durationSec: 42.5 }]
	});
	assert.ok(validEntry(entry), JSON.stringify(validEntry.errors));
	assert.deepEqual(Object.keys(entry.media[0]).sort(), ['durationSec', 'mimeType', 'path', 'sha256', 'size']);
	assert.match(entry.media[0].path, /\.webm$/);

	const bytes = exportRmbr(r);
	const { recueil, warnings } = await readRmbr(bytes);
	assert.deepEqual(warnings, []);
	assert.deepEqual(recueil.entries.get(entry.id), entry);
	const html = strFromU8(unzipSync(bytes)['viewer/index.html']);
	assert.ok(html.includes(`<audio controls preload="none" src="../${entry.media[0].path}">`));
});

test('modifier le recueil : titre, personne, naissance, prénom du créateur', async () => {
	const r = await sample();
	const edited = editRecueil(r, { title: 'Mamie', subjectName: 'Jeanne M.', subjectBirthDate: '1941-03', creatorName: 'Jeannette' });
	assert.equal(edited.manifest.title, 'Mamie');
	assert.deepEqual(edited.manifest.subject, { name: 'Jeanne M.', birthDate: '1941-03' });
	assert.equal(edited.manifest.authors[0].name, 'Jeannette');
	assert.ok(validManifest(edited.manifest), JSON.stringify(validManifest.errors));
	assert.equal(r.manifest.title, 'Les souvenirs de Mamie Jeanne', 'l’original n’est pas modifié');

	const noBirth = editRecueil(edited, { title: 'Mamie', subjectName: 'Jeanne M.', creatorName: 'Jeannette' });
	assert.deepEqual(noBirth.manifest.subject, { name: 'Jeanne M.' });
	const noSubject = editRecueil(edited, { title: 'Mamie', subjectBirthDate: '1941', creatorName: 'Jeannette' });
	assert.equal(noSubject.manifest.subject, undefined);
	assert.ok(validManifest(noSubject.manifest), JSON.stringify(validManifest.errors));

	assert.throws(() => editRecueil(r, { title: '', creatorName: 'J' }), /titre/);
	assert.throws(() => editRecueil(r, { title: 'T', creatorName: 'J', subjectName: 'X', subjectBirthDate: '41' }), /naissance/);
	const { recueil: back } = await readRmbr(exportRmbr(edited));
	assert.deepEqual(back.manifest, edited.manifest);
});

test('ordre chronologique : date partielle en tête de sa période, sans date à la fin', async () => {
	const r = await sample();
	const { dated, undated } = timeline(r.entries, r.manifest.creatorId);
	assert.deepEqual(dated.map((e) => e.title), ['La photo du bal', 'Le bal']);
	assert.deepEqual(undated.map((e) => e.text), ['Sans date.']);
	assert.equal(formatDate({ value: '1959', approximate: true }), 'vers 1959');
	assert.equal(formatDate({ value: '1959-07-14' }), '14 juillet 1959');
});

test('tombstone : le souvenir visé disparaît, sauf si un tiers tente de le supprimer', async () => {
	const r = await sample();
	const target = [...r.entries.values()][1];
	const stranger = '0192f3a1-7c2e-7b4d-9a10-3f6e2d8c1aff';
	r.entries.set('t1', { id: 't1', type: 'tombstone', authorId: stranger, supersedes: target.id });
	assert.equal(timeline(r.entries, r.manifest.creatorId).dated.length, 2);
	r.entries.set('t2', { id: 't2', type: 'tombstone', authorId: r.manifest.creatorId, supersedes: target.id });
	assert.equal(timeline(r.entries, r.manifest.creatorId).dated.length, 1);
});

test('média altéré : signalé, pas chargé', async () => {
	const files = unzipSync(exportRmbr(await sample()));
	const path = Object.keys(files).find((n) => n.startsWith('media/'));
	files[path] = new Uint8Array([9, 9, 9, 9]);
	const { recueil, warnings } = await readRmbr(zipSync(files));
	assert.equal(recueil.media.size, 0);
	assert.match(warnings[0], /abîmé/);
});

test('chemins hors spec ignorés (pas de ../)', async () => {
	const files = unzipSync(exportRmbr(await sample()));
	files['../evil.txt'] = strToU8('x');
	files['media/notes.txt'] = strToU8('x');
	const { warnings } = await readRmbr(zipSync(files));
	assert.equal(warnings.filter((w) => w.startsWith('Fichier inattendu')).length, 2);
});

test('viewer embarqué : statique, ordonné, texte échappé, médias en relatif', async () => {
	const r = await sample();
	await addEntry(r, { type: 'text', authorId: r.manifest.creatorId, title: '<script>alert(1)</script>', text: 'a & "b"' });
	const html = strFromU8(unzipSync(exportRmbr(r))['viewer/index.html']);

	assert.doesNotMatch(html, /<script/i);
	assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.match(html, /a &amp; &quot;b&quot;/);
	const at = (s) => html.indexOf(s);
	assert.ok(at('La photo du bal') < at('Le bal<') && at('Le bal<') < at('<section id="sans-date">'));
	const [path] = r.media.keys();
	assert.ok(html.includes(`src="../${path}"`));
});

test('viewer : frise en liens d’ancre, réponses sous leur souvenir, âge', async () => {
	const r = createRecueil({ title: 'Mamie', subjectName: 'Jeanne Martin', subjectBirthDate: '1941-03', creatorName: 'Jeanne' });
	const me = r.manifest.creatorId;
	const bal = await addEntry(r, { type: 'text', authorId: me, title: 'Le bal', text: 'x', date: { value: '1959-07-14' } });
	await addEntry(r, { type: 'text', authorId: me, title: 'La maison', text: 'x', date: { value: '1975' } });
	await addEntry(r, { type: 'text', authorId: me, title: 'Ma version', text: 'x', replyTo: bal.id });
	const html = strFromU8(unzipSync(exportRmbr(r))['viewer/index.html']);

	assert.match(html, /<nav class="frise"/);
	for (const key of [1950, 1970]) assert.ok(html.includes(`href="#periode-${key}"`) && html.includes(`id="periode-${key}"`));
	assert.match(html, /<li class="empty"><span class="stop" title="Les années 1960 : aucun souvenir">/);
	assert.match(html, /<span class="birth">naissance<\/span>/);
	assert.match(html, /Jeanne avait 18 ans/);
	const bal_ = html.indexOf('Le bal<');
	assert.ok(bal_ < html.indexOf('Ma version') && html.indexOf('Ma version') < html.indexOf('La maison'), 'la réponse suit son souvenir');
	assert.doesNotMatch(html, /id="sans-date"/, 'la réponse non datée ne tombe pas dans « Sans date »');
	assert.doesNotMatch(html, /<script/i);
});

test('viewer : un média absent de l’archive n’est pas référencé', async () => {
	const r = await sample();
	r.media.clear();
	const html = strFromU8(unzipSync(exportRmbr(r))['viewer/index.html']);
	assert.doesNotMatch(html, /<img/);
});

test('fichiers refusés : pas un zip, pas un recueil, pack de contribution', async () => {
	await assert.rejects(readRmbr(strToU8('bonjour')), /lisible/);
	await assert.rejects(readRmbr(zipSync({ 'a.txt': strToU8('x') })), /manifest/);
	const r = await sample();
	r.manifest.kind = 'contribution';
	await assert.rejects(readRmbr(exportRmbr(r)), /contribution/);
});
