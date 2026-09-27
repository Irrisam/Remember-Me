import { test } from 'node:test';
import assert from 'node:assert/strict';
import { story, ageAt, formatAge } from '../src/lib/rmbr/story.js';

let n = 0;
const entry = (fields) => ({
	id: `0192f3a1-7c2e-7b4d-9a10-${String(++n).padStart(12, '0')}`,
	type: 'text',
	authorId: 'a',
	createdAt: `2026-09-27T10:00:${String(n).padStart(2, '0')}Z`,
	text: 'x',
	...fields
});
const manifest = (birthDate) => ({ creatorId: 'a', subject: birthDate ? { name: 'Jeanne Martin', birthDate } : undefined });
const map = (...entries) => new Map(entries.map((e) => [e.id, e]));

test('frise par décennie, depuis la naissance, périodes vides comprises', () => {
	const s = story(map(entry({ date: { value: '1959-07-14' } }), entry({ date: { value: '1982' } })), manifest('1941-03'));
	assert.deepEqual(s.periods.map((p) => p.key), [1940, 1950, 1960, 1970, 1980]);
	assert.deepEqual(s.periods.map((p) => p.threads.length), [0, 1, 0, 0, 1]);
	assert.equal(s.periods[0].label, 'Les années 1940');
	assert.ok(s.periods[0].birth);
});

test('frise par année si tout tient en moins de 10 ans', () => {
	const s = story(map(entry({ date: { value: '1959' } }), entry({ date: { value: '1961-02' } })), manifest());
	assert.deepEqual(s.periods.map((p) => p.label), ['1959', '1960', '1961']);
});

test('une naissance postérieure aux souvenirs ne déplace pas la frise', () => {
	const s = story(map(entry({ date: { value: '1930' } })), manifest('1941'));
	assert.deepEqual(s.periods.map((p) => p.key), [1930]);
});

test('réponses rangées sous le souvenir d’origine, même non datées ou en chaîne', () => {
	const bal = entry({ title: 'Le bal', date: { value: '1959-07-14' } });
	const photo = entry({ title: 'La photo', replyTo: bal.id });
	const reponse = entry({ title: 'Réponse à la photo', replyTo: photo.id, date: { value: '1990' } });
	const orphan = entry({ title: 'Orpheline', replyTo: '0192f3a1-7c2e-7b4d-9a10-ffffffffffff' });
	const s = story(map(bal, photo, reponse, orphan), manifest());
	const threads = s.periods.flatMap((p) => p.threads);
	assert.deepEqual(threads.map((t) => t.entry.title), ['Le bal']);
	assert.deepEqual(threads[0].replies.map((e) => e.title), ['La photo', 'Réponse à la photo']);
	assert.deepEqual(s.undated.map((t) => t.entry.title), ['Orpheline'], 'réponse à un souvenir absent : affichée seule');
});

test('réponses en boucle : pas de blocage, chacune reste visible', () => {
	const a = entry({ title: 'A' });
	const b = entry({ title: 'B', replyTo: a.id });
	a.replyTo = b.id;
	const s = story(map(a, b), manifest());
	assert.equal(s.undated.length + s.undated.flatMap((t) => t.replies).length, 2);
});

test('âge : exact avec les mois, approximatif sinon', () => {
	assert.deepEqual(ageAt('1941-03', { value: '1959-07-14' }), { age: 18, approximate: false });
	assert.deepEqual(ageAt('1941-08-20', { value: '1959-08-14' }), { age: 17, approximate: false });
	assert.deepEqual(ageAt('1941', { value: '1959-07' }), { age: 18, approximate: true });
	assert.deepEqual(ageAt('1941-03', { value: '1959-07', approximate: true }), { age: 18, approximate: true });
	assert.equal(ageAt('1941', { label: 'mon enfance' }), null);
	assert.equal(ageAt('1941', { value: '1930' }), null);
	assert.equal(formatAge('Jeanne Martin', { age: 18, approximate: false }), 'Jeanne avait 18 ans');
	assert.equal(formatAge('Jeanne', { age: 1, approximate: true }), 'Jeanne avait environ 1 an');
	assert.equal(formatAge('Jeanne', { age: 0, approximate: false }), 'Jeanne avait moins d’un an');
});
