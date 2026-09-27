import { test, expect, png, createRecueil, addMemory, download, openRecueil, actAsOwner, readArchive } from './fixtures.js';

test('Jeanne crée, Léa contribue, Jeanne fusionne ce qu’elle garde', async ({ page }, testInfo) => {
	await test.step('Jeanne crée son recueil et ajoute « Le bal » avec sa voix', async () => {
		await createRecueil(page, { mode: 'self', name: 'Jeanne Martin', birth: '1941-03' });
		await addMemory(page, {
			title: 'Le bal du 14 juillet',
			text: "C'est là que j'ai rencontré votre grand-père.",
			date: '1959-07-14',
			voice: true
		});
		const bal = page.locator('article.memory', { hasText: 'Le bal du 14 juillet' });
		await expect(bal.locator('audio')).toHaveCount(1);
		await expect(bal.locator('.age')).toHaveText('Jeanne avait 18 ans');
	});
	const v1 = await download(page, testInfo, 'Enregistrer le fichier');

	await test.step('Léa se présente, complète « Le bal » avec une photo et ajoute un souvenir', async () => {
		await page.getByRole('button', { name: 'Fermer' }).click();
		await openRecueil(page, v1);
		await page.getByLabel('Votre prénom').fill('Léa');
		await page.getByLabel(/Votre lien/).fill('petite-fille');
		await page.getByRole('button', { name: 'Continuer' }).click();
		await page.getByRole('button', { name: 'Compléter ce souvenir' }).click();
		await expect(page.getByText('Vous ajoutez votre version de « Le bal du 14 juillet »')).toBeVisible();
		await page.getByRole('button', { name: 'Suivant' }).click();
		await page.getByRole('button', { name: 'Suivant' }).click();
		await page.locator('input[type=file][accept="image/*"]').setInputFiles(png());
		await page.getByRole('button', { name: 'Ajouter ce souvenir' }).click();
		await expect(page.getByText('Léa a complété :')).toBeVisible();
		await addMemory(page, { text: 'Les crêpes du dimanche.' });
		await expect(page.getByText('Pas encore envoyé')).toHaveCount(2);
	});
	const pack = await download(page, testInfo, /Envoyer ma contribution/);
	const { manifest: packManifest } = readArchive(pack);
	expect(packManifest.kind).toBe('contribution');
	expect(packManifest.entries).toHaveLength(2);

	await test.step('Jeanne garde la photo et refuse les crêpes', async () => {
		await page.getByRole('button', { name: 'Fermer' }).click();
		await openRecueil(page, v1);
		await actAsOwner(page, 'Jeanne');
		await page.locator('input[type=file][accept=".rmbrc"]').setInputFiles(pack);
		await expect(page.getByText('Les souvenirs de Léa (petite-fille)')).toBeVisible();
		await page.locator('.moderation article', { hasText: 'Les crêpes du dimanche.' }).getByLabel('Garder ce souvenir').uncheck();
		await page.getByRole('button', { name: 'Ajouter 1 souvenir au recueil' }).click();
		await expect(page.getByText('Léa a complété :')).toBeVisible();
		await expect(page.getByText('Les crêpes du dimanche.')).toHaveCount(0);
		await expect(page.locator('article img')).toHaveJSProperty('naturalWidth', 600);
	});
	const v2 = await download(page, testInfo, 'Enregistrer le fichier');

	await test.step('La v2 : Léa est connue, la lecture seule n’offre pas d’ajout', async () => {
		const { manifest, entries } = readArchive(v2);
		expect(manifest.authors.map((a) => a.name)).toEqual(['Jeanne', 'Léa']);
		expect(entries.some((e) => e.text === 'Les crêpes du dimanche.')).toBe(false);
		await page.getByRole('button', { name: 'Fermer' }).click();
		await openRecueil(page, v2);
		await expect(page.getByRole('button', { name: /Je suis Léa/ })).toBeVisible();
		await page.getByRole('button', { name: /seulement le lire/ }).click();
		await expect(page.locator('article.memory')).toHaveCount(1);
		await expect(page.getByRole('button', { name: /Ajouter un souvenir/ })).toHaveCount(0);
	});
});
