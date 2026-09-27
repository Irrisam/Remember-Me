import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, availablePrompts, pickPrompt, promptVoice, subjectFirstName } from '../src/lib/rmbr/prompts.js';
import { createRecueil, addEntry, editEntry, exportRmbr, readRmbr } from '../src/lib/rmbr/archive.js';
import { validEntry } from './schema.js';

const manifest = (subject, creatorName = 'Jeanne') => {
	const r = createRecueil({ title: 'T', subjectName: subject, creatorName });
	return r.manifest;
};

test('banque : chaque thème a des questions dans les deux voix, courtes, sans doublon ni accord deviné', () => {
	const all = THEMES.flatMap((t) => [...t.self, ...t.other]);
	assert.equal(new Set(all).size, all.length, 'pas de doublon');
	for (const t of THEMES) {
		assert.ok(t.self.length >= 3 && t.other.length >= 2, t.id);
		for (const q of t.other) assert.match(q, /\{name\}/, `question « other » sans prénom : ${q}`);
	}
	for (const q of all) {
		assert.ok(q.length <= 300, 'limite du schéma (prompt ≤ 300)');
		assert.match(q, /\?$/);
		// Pas de pronom genré à propos de la personne du recueil.
		assert.doesNotMatch(q, /-t-il|-t-elle|\b(il|elle) (était|a|vous)\b/, q);
	}
});

test('voix : sa propre vie → « vous », un proche ou « pour quelqu’un » → prénom', () => {
	const self = manifest('Jeanne Martin', 'Jeanne');
	const creator = self.authors[0];
	assert.equal(promptVoice(self, creator), 'self');
	assert.equal(promptVoice(self, { id: 'lea', name: 'Léa' }), 'other', 'un proche');
	const forSomeone = manifest('Jeanne Martin', 'Léa');
	assert.equal(promptVoice(forSomeone, forSomeone.authors[0]), 'other', 'créé pour quelqu’un');
	assert.equal(promptVoice(manifest(''), null), 'self', 'sans personne renseignée');
	assert.equal(subjectFirstName(self), 'Jeanne');
});

test('questions : prénom inséré, thème filtré, déjà utilisées exclues', () => {
	const other = availablePrompts({ voice: 'other', name: 'Jeanne', theme: 'traditions' });
	assert.ok(other.length > 0 && other.every((p) => p.theme === 'traditions'));
	assert.ok(other.some((p) => p.text === 'Quel plat de Jeanne vous rappelle la maison ?'));
	assert.ok(other.every((p) => !p.text.includes('{name}')));

	const used = ['Quel était votre premier métier ?'];
	assert.ok(!availablePrompts({ voice: 'self', theme: 'travail', used }).some((p) => used.includes(p.text)));
	assert.ok(availablePrompts({ voice: 'other', name: '' }).every((p) => !p.text.includes('{name}')), 'sans prénom : voix « self »');
});

test('tirage : jamais deux fois la même d’affilée, rien quand tout a été utilisé', () => {
	const first = pickPrompt({ voice: 'self', theme: 'voyages', random: () => 0 });
	const second = pickPrompt({ voice: 'self', theme: 'voyages', previous: first.text, random: () => 0 });
	assert.notEqual(second.text, first.text);
	const all = availablePrompts({ voice: 'self', theme: 'voyages' }).map((p) => p.text);
	assert.equal(pickPrompt({ voice: 'self', theme: 'voyages', used: all }), null);
});

test('souvenir avec question : conforme, relu, question retirable à la modification', async () => {
	const r = createRecueil({ title: 'T', creatorName: 'Jeanne' });
	const me = r.manifest.creatorId;
	const q = 'Quel était votre premier métier ?';
	const entry = await addEntry(r, { type: 'text', authorId: me, text: 'Apprentie couturière.', prompt: q });
	assert.ok(validEntry(entry), JSON.stringify(validEntry.errors));
	assert.equal(entry.prompt, q);

	const kept = await editEntry(r, entry, { type: 'text', text: 'Apprentie couturière, à 14 ans.' });
	assert.equal(kept.prompt, q, 'sans consigne, la question est gardée');
	const removed = await editEntry(r, kept, { type: 'text', text: 'Sans question.', prompt: undefined });
	assert.equal(removed.prompt, undefined, 'question retirée');

	const { recueil, warnings } = await readRmbr(exportRmbr(r));
	assert.deepEqual(warnings, []);
	assert.equal(recueil.entries.get(removed.id).prompt, undefined);
});
