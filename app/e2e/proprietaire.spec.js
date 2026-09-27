import { writeFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { test, expect, createRecueil, addMemory, download, openRecueil, actAsOwner, readArchive } from './fixtures.js';

const PASSWORD = 'le bal de 1959';

test('recueil protégé : mot de passe exigé, actions signées, falsification signalée', async ({ page }, testInfo) => {
	await test.step('confirmation différente refusée, puis création protégée', async () => {
		await page.goto('/creer');
		await page.getByRole('button', { name: /Pour moi/ }).click();
		await page.getByLabel('Votre nom').fill('Jeanne Martin');
		await page.getByRole('button', { name: 'Continuer' }).click();
		await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
		await page.getByLabel('Retapez-le', { exact: true }).fill('autre chose');
		await page.getByRole('button', { name: 'Créer le recueil' }).click();
		await expect(page.locator('.msg-error')).toHaveText('Les deux mots de passe ne sont pas identiques.');
		await page.getByLabel('Retapez-le', { exact: true }).fill(PASSWORD);
		await page.getByLabel(/Un indice/).fill('le premier bal');
		await page.getByRole('button', { name: 'Créer le recueil' }).click();
		await page.waitForURL('**/recueil');
		await expect(page.locator('.protect-tip')).toHaveCount(0);
		await addMemory(page, { text: 'Premier souvenir, signé.' });
	});
	const v1 = await download(page, testInfo, 'Enregistrer le fichier');
	const { manifest } = readArchive(v1);
	expect(manifest.ownerKey).toMatchObject({ kdf: 'PBKDF2-SHA256', iterations: 600000, cipher: 'AES-GCM-256', hint: 'le premier bal' });
	expect(manifest.authors[0].publicKey.keyId).toMatch(/^[0-9a-f]{16}$/);

	await test.step('mauvais mot de passe refusé, indice affiché, bon mot de passe accepté', async () => {
		await page.getByRole('button', { name: 'Fermer' }).click();
		await openRecueil(page, v1);
		await page.getByRole('button', { name: /Je suis Jeanne/ }).click();
		await expect(page.getByText('Votre indice : « le premier bal »')).toBeVisible();
		await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais');
		await page.getByRole('button', { name: 'Ouvrir en propriétaire' }).click();
		await expect(page.locator('.msg-error')).toHaveText('Mot de passe incorrect.');
		await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
		await page.getByRole('button', { name: 'Ouvrir en propriétaire' }).click();
		await expect(page.getByRole('button', { name: 'Importer une contribution' })).toBeVisible();
	});

	await test.step('suppression signée : aucune alerte à la réouverture', async () => {
		await page.locator('article', { hasText: 'Premier souvenir' }).getByRole('button', { name: 'Supprimer' }).click();
		const v2 = await download(page, testInfo, 'Enregistrer le fichier');
		const tomb = readArchive(v2).entries.find((e) => e.type === 'tombstone');
		expect(tomb.signature.alg).toBe('ES256');
		await openRecueil(page, v2);
		await expect(page.locator('.messages .msg-warning')).toHaveCount(0);

		// Quelqu'un retire la protection à la main : ce navigateur, qui connaît le recueil, prévient.
		const { files, manifest: m } = readArchive(v2);
		delete m.ownerKey;
		delete m.authors[0].publicKey;
		files['manifest.json'] = strToU8(JSON.stringify(m));
		const forged = testInfo.outputPath('falsifie.rmbr');
		writeFileSync(forged, zipSync(files));
		await openRecueil(page, forged);
		await expect(page.locator('.messages .msg-warning')).toContainText('il ne l’est plus');
	});
});

test('protéger un recueil existant depuis « Modifier le recueil »', async ({ page }, testInfo) => {
	await createRecueil(page, { name: 'Jeanne Martin' });
	await addMemory(page, { text: 'Écrit avant la protection.' });
	await expect(page.locator('.protect-tip')).toBeVisible();
	await page.getByRole('button', { name: 'Le protéger par un mot de passe' }).click();
	await page.getByLabel('Mot de passe', { exact: true }).fill('mamie jeanne 41');
	await page.getByLabel('Retapez-le', { exact: true }).fill('mamie jeanne 41');
	await page.getByRole('button', { name: 'Protéger le recueil' }).click();
	await expect(page.locator('.msg-success')).toContainText('Recueil protégé');
	const file = await download(page, testInfo, 'Enregistrer le fichier');
	expect(readArchive(file).entries.every((e) => e.signature)).toBe(true);
	await openRecueil(page, file);
	await actAsOwner(page, 'Jeanne', 'mamie jeanne 41');
	await expect(page.locator('.messages .msg-warning')).toHaveCount(0);
});
