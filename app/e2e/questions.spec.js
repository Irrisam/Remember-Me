import { test, expect, createRecueil, addMemory, download, readArchive } from './fixtures.js';

test('les questions restent une suggestion : fermées par défaut, écriture libre possible', async ({ page }, testInfo) => {
	await createRecueil(page, { name: 'Jeanne Martin' });
	await page.getByRole('button', { name: /Ajouter un (premier )?souvenir/ }).first().click();
	await expect(page.getByRole('button', { name: /Besoin d’une idée/ })).toBeVisible();
	await expect(page.locator('.panel-ideas')).toHaveCount(0);
	await page.getByRole('button', { name: 'Annuler' }).click();

	await addMemory(page, { title: 'Libre', text: 'Écrit sans question.' });
	await expect(page.locator('article.memory .prompt')).toHaveCount(0);
	const file = await download(page, testInfo, 'Enregistrer le fichier');
	expect(readArchive(file).entries[0].prompt).toBeUndefined();
});

test('répondre à une question choisie par thème : visible sur le souvenir et dans le viewer', async ({ page }, testInfo) => {
	await createRecueil(page, { name: 'Jeanne Martin' });
	await page.getByRole('button', { name: /Ajouter un (premier )?souvenir/ }).first().click();
	await page.getByRole('button', { name: /Besoin d’une idée/ }).click();
	await page.getByRole('button', { name: 'Travail', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Travail', exact: true })).toHaveAttribute('aria-pressed', 'true');
	const first = (await page.locator('.suggestion').textContent()).trim();
	await page.getByRole('button', { name: 'Une autre idée' }).click();
	const question = (await page.locator('.suggestion').textContent()).trim();
	expect(question).not.toBe(first);
	await page.getByRole('button', { name: 'Répondre à cette question' }).click();
	await expect(page.locator('.chosen .question')).toHaveText(question);

	await page.getByLabel(/^Racontez/).fill('Apprentie couturière, à quatorze ans.');
	await page.getByRole('button', { name: 'Ajouter tout de suite' }).click();
	await expect(page.locator('article.memory .prompt')).toContainText(question.replace(/^« | »$/g, ''));

	const file = await download(page, testInfo, 'Enregistrer le fichier');
	const { entries, files } = readArchive(file);
	expect(`« ${entries[0].prompt} »`).toBe(question);
	expect(Buffer.from(files['viewer/index.html']).toString()).toContain(`<p class="prompt">« ${entries[0].prompt.replaceAll("'", '&#39;')} »</p>`);
});

test('pour un proche : les questions parlent de la personne par son prénom', async ({ page }) => {
	await createRecueil(page, { mode: 'other', name: 'Jeanne Martin', creator: 'Léa' });
	await page.getByRole('button', { name: /Ajouter un (premier )?souvenir/ }).first().click();
	await page.getByRole('button', { name: /Besoin d’une idée/ }).click();
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('.suggestion')).toContainText('Jeanne');
		await page.getByRole('button', { name: 'Une autre idée' }).click();
	}
});

test('recueil vide : une question d’exemple, qu’on peut prendre ou retirer', async ({ page }) => {
	await createRecueil(page, { name: 'Jeanne Martin' });
	const idea = page.locator('.first-idea .idea');
	await expect(idea).toBeVisible();
	const text = (await idea.textContent()).trim();
	await page.locator('.first-idea').getByRole('button', { name: 'Répondre à cette question' }).click();
	await expect(page.locator('.chosen .question')).toHaveText(text);
	await page.getByRole('button', { name: 'Retirer la question' }).click();
	await expect(page.locator('.chosen')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Besoin d’une idée/ })).toBeVisible();
});
