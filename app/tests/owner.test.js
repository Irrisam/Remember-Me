import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate';
import {
	createRecueil,
	createPack,
	addEntry,
	deleteEntry,
	exportRmbr,
	readRmbr,
	protectRecueil,
	changeOwnerPassword
} from '../src/lib/rmbr/archive.js';
import { unlockOwnerKey } from '../src/lib/rmbr/owner-key.js';
import { verifyEntry } from '../src/lib/rmbr/signature.js';
import { uuidv7 } from '../src/lib/rmbr/ids.js';
import { validManifest, validEntry } from './schema.js';

// Minimum du schéma : assez rapide pour les tests (l'app utilise 600 000).
const FAST = { iterations: 100000 };
const PASSWORD = 'le bal de 1959';

async function protectedSample() {
	const r = createRecueil({ title: 'Mamie Jeanne', creatorName: 'Jeanne' });
	const me = r.manifest.creatorId;
	await addEntry(r, { type: 'text', authorId: me, title: 'Avant la protection', text: 'x' });
	const { recueil, signer } = await protectRecueil(r, PASSWORD, { ...FAST, hint: 'le premier bal' });
	return { recueil, signer, me };
}

const creatorOf = (r) => r.manifest.authors.find((a) => a.id === r.manifest.creatorId);

test('protéger : clé chiffrée dans le manifest, clé publique publiée, souvenirs existants signés', async () => {
	const { recueil, me } = await protectedSample();
	assert.ok(validManifest(recueil.manifest), JSON.stringify(validManifest.errors));
	assert.equal(recueil.manifest.ownerKey.hint, 'le premier bal');
	assert.doesNotMatch(JSON.stringify(recueil.manifest.ownerKey), /BEGIN|"d":/, 'aucune clé privée en clair');
	const pub = creatorOf(recueil).publicKey;
	for (const entry of recueil.entries.values()) {
		assert.equal(entry.authorId, me);
		assert.ok(validEntry(entry), JSON.stringify(validEntry.errors));
		assert.ok(await verifyEntry(entry, pub));
	}
	const { warnings } = await readRmbr(exportRmbr(recueil));
	assert.deepEqual(warnings, []);
});

test('déverrouiller : bon mot de passe → signe, mauvais → refusé', async () => {
	const { recueil } = await protectedSample();
	const pub = creatorOf(recueil).publicKey;
	await assert.rejects(unlockOwnerKey(recueil.manifest.ownerKey, 'pas le bon', pub.keyId), /incorrect/);
	const signer = await unlockOwnerKey(recueil.manifest.ownerKey, PASSWORD, pub.keyId);
	const entry = await addEntry(recueil, { type: 'text', authorId: recueil.manifest.creatorId, text: 'Après' }, signer);
	assert.ok(await verifyEntry(entry, pub));
	const tomb = await deleteEntry(recueil, entry.id, recueil.manifest.creatorId, signer);
	assert.ok(await verifyEntry(tomb, pub));
});

test('souvenir du propriétaire ajouté sans mot de passe ou modifié après coup : signalé à l’ouverture', async () => {
	const { recueil, signer, me } = await protectedSample();
	const signed = await addEntry(recueil, { type: 'text', authorId: me, title: 'Signé', text: 'Vrai texte' }, signer);
	await addEntry(recueil, { type: 'text', authorId: me, title: 'Glissé en douce', text: 'x' });
	const files = unzipSync(exportRmbr(recueil));
	const path = `entries/${signed.id}.json`;
	files[path] = strToU8(strFromU8(files[path]).replace('Vrai texte', 'Texte falsifié'));
	const { warnings } = await readRmbr(zipSync(files));
	assert.equal(warnings.length, 2);
	assert.ok(warnings.some((w) => w.includes('« Glissé en douce » n’est pas authentifié')));
	assert.ok(warnings.some((w) => w.includes('« Signé » n’est pas authentifié')));
});

test('clé publique retirée d’un recueil protégé : fichier refusé', async () => {
	const { recueil } = await protectedSample();
	const files = unzipSync(exportRmbr(recueil));
	const manifest = JSON.parse(strFromU8(files['manifest.json']));
	delete manifest.authors[0].publicKey;
	files['manifest.json'] = strToU8(JSON.stringify(manifest));
	await assert.rejects(readRmbr(zipSync(files)), /clé publique a disparu/);
});

test('changer de mot de passe : même clé, ancien refusé, nouveau accepté, indice mis à jour', async () => {
	const { recueil } = await protectedSample();
	const keyId = creatorOf(recueil).publicKey.keyId;
	await assert.rejects(changeOwnerPassword(recueil, 'faux', 'nouveau mot de passe'), /incorrect/);
	await assert.rejects(changeOwnerPassword(recueil, PASSWORD, 'court'), /8 caractères/);
	const changed = await changeOwnerPassword(recueil, PASSWORD, 'nouveau mot de passe', { hint: 'nouvel indice' });
	assert.equal(changed.manifest.ownerKey.hint, 'nouvel indice');
	await assert.rejects(unlockOwnerKey(changed.manifest.ownerKey, PASSWORD, keyId), /incorrect/);
	await unlockOwnerKey(changed.manifest.ownerKey, 'nouveau mot de passe', keyId);
	assert.deepEqual((await readRmbr(exportRmbr(changed))).warnings, [], 'les anciennes signatures restent valides');
});

test('mot de passe trop court ou recueil déjà protégé : refusé', async () => {
	await assert.rejects(protectRecueil(createRecueil({ title: 'T', creatorName: 'J' }), 'court', FAST), /8 caractères/);
	const { recueil } = await protectedSample();
	await assert.rejects(protectRecueil(recueil, PASSWORD, FAST), /déjà protégé/);
});

test('un pack de contribution ne peut pas porter de clé propriétaire', async () => {
	const { recueil } = await protectedSample();
	const pack = createPack(recueil, { id: uuidv7(), name: 'Léa' });
	assert.ok(validManifest(pack.manifest), JSON.stringify(validManifest.errors));
	assert.ok(!validManifest({ ...pack.manifest, ownerKey: recueil.manifest.ownerKey }));
});
