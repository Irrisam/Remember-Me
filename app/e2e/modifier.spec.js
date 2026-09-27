import { test, expect, png, createRecueil, download, openRecueil, actAsOwner, readArchive, addMemory } from './fixtures.js';

test('le créateur modifie son souvenir : texte corrigé, photo retirée, ancienne version hors du fichier', async ({ page }, testInfo) => {
	await createRecueil(page, { name: 'Jeanne Martin', birth: '1941' });
	await page.getByRole('button', { name: /Ajouter un (premier )?souvenir/ }).first().click();
	await page.getByLabel('Un titre').fill('Le bal');
	await page.getByLabel(/^Racontez/).fill('Texte avec une fote.');
	await page.locator('.stepper button').nth(2).click();
	await page.locator('input[type=file][accept="image/*"]').setInputFiles([png(600, 400), { ...png(400, 600), name: 'portrait.png' }]);
	await expect(page.locator('.thumbs img')).toHaveCount(2);
	await page.getByRole('button', { name: 'Ajouter ce souvenir' }).click();
	await expect(page.locator('article.memory img')).toHaveCount(2);

	await page.locator('article.memory').getByRole('button', { name: 'Modifier' }).click();
	await expect(page.getByRole('heading', { name: 'Modifier le souvenir' })).toBeVisible();
	await expect(page.getByLabel('Un titre')).toHaveValue('Le bal');
	await page.getByLabel(/^Racontez/).fill('Texte corrigé.');
	await page.getByRole('button', { name: 'Suivant' }).click();
	await page.getByLabel(/L'année, le mois ou le jour/).fill('1959-07-14');
	await page.getByRole('button', { name: 'Suivant' }).click();
	await expect(page.locator('.thumbs img')).toHaveCount(2);
	await page.getByRole('button', { name: 'Retirer cette photo' }).last().click();
	await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();

	const card = page.locator('article.memory');
	await expect(card).toHaveCount(1);
	await expect(card.locator('.text')).toHaveText('Texte corrigé.');
	await expect(card.locator('.date')).toContainText('modifié');
	await expect(card.locator('.age')).toContainText('Jeanne avait');
	await expect(card.locator('img')).toHaveCount(1);

	const file = await download(page, testInfo, 'Enregistrer le fichier');
	const { entries, files } = readArchive(file);
	expect(entries.filter((e) => e.type !== 'tombstone').map((e) => e.text)).toEqual(['Texte corrigé.']);
	expect(Object.keys(files).filter((n) => n.startsWith('media/'))).toHaveLength(1);
});

test('un proche modifie son souvenir déjà fusionné : une seule carte « Modification » à valider', async ({ page }, testInfo) => {
	await createRecueil(page, { name: 'Jeanne Martin' });
	await addMemory(page, { title: 'Le bal', text: 'Version de Jeanne.' });
	const v1 = await download(page, testInfo, 'Enregistrer le fichier');

	await openRecueil(page, v1);
	await page.getByLabel('Votre prénom').fill('Léa');
	await page.getByRole('button', { name: 'Continuer' }).click();
	await addMemory(page, { title: 'Les crêpes', text: 'Avec une fote.' });
	await expect(page.locator('article.memory', { hasText: 'Le bal' }).getByRole('button', { name: 'Modifier' })).toHaveCount(0);
	const pack1 = await download(page, testInfo, /Envoyer ma contribution/);

	await openRecueil(page, v1);
	await actAsOwner(page, 'Jeanne');
	await page.locator('input[type=file][accept=".rmbrc"]').setInputFiles(pack1);
	await page.getByRole('button', { name: 'Ajouter 1 souvenir au recueil' }).click();
	const v2 = await download(page, testInfo, 'Enregistrer le fichier');

	await openRecueil(page, v2);
	await page.getByRole('button', { name: /Je suis Léa/ }).click();
	await page.locator('article.memory', { hasText: 'Les crêpes' }).getByRole('button', { name: 'Modifier' }).click();
	await page.getByLabel(/^Racontez/).fill('Sans faute.');
	await page.getByRole('button', { name: 'Enregistrer tout de suite' }).click();
	await expect(page.getByText('Sans faute.')).toBeVisible();
	await expect(page.getByText('Avec une fote.')).toHaveCount(0);
	const pack2 = await download(page, testInfo, /Envoyer ma contribution/);

	await openRecueil(page, v2);
	await actAsOwner(page, 'Jeanne');
	await page.locator('input[type=file][accept=".rmbrc"]').setInputFiles(pack2);
	await expect(page.getByText('Modification de « Les crêpes », qui remplacera la version actuelle :')).toBeVisible();
	await expect(page.locator('.moderation article')).toHaveCount(1);
	await page.getByRole('button', { name: 'Ajouter 1 souvenir au recueil' }).click();
	await expect(page.getByText('Sans faute.')).toBeVisible();
	await expect(page.getByText('Avec une fote.')).toHaveCount(0);
	const v3 = await download(page, testInfo, 'Enregistrer le fichier');
	expect(readArchive(v3).entries.some((e) => e.text === 'Avec une fote.')).toBe(false);
});
