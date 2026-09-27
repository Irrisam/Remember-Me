import { test, expect, createRecueil, addMemory } from './fixtures.js';

test('vitrine : polices auto-hébergées, liens vers la création', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Racontez votre histoire, pour ceux que vous aimez.');
	const fonts = await page.evaluate(async () => {
		await document.fonts.ready;
		return [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))];
	});
	expect(fonts).toEqual(expect.arrayContaining(['Fraunces Variable', 'Source Serif 4 Variable']));
	await page.getByRole('link', { name: 'Commencer un recueil' }).first().click();
	await expect(page.getByRole('heading', { name: 'Pour qui créez-vous ce recueil ?' })).toBeVisible();
});

test('mobile : pas de défilement horizontal, frise et formulaire utilisables', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	for (const path of ['/', '/creer', '/confidentialite']) {
		await page.goto(path);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
	}
	await createRecueil(page, { mode: 'other', name: 'Jeanne Martin', birth: '1941', creator: 'Léa' });
	await addMemory(page, { title: 'La ferme', text: 'Six dans deux pièces.', date: '1946' });
	await addMemory(page, { title: 'Le bal', text: 'Le 14 juillet.', date: '1959-07-14' });
	await expect(page.locator('.frise a')).toHaveCount(2);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('souvenir : l’étape « Quand ? » affiche l’aperçu de la date et de l’âge', async ({ page }) => {
	await createRecueil(page, { mode: 'other', name: 'Jeanne Martin', birth: '1941-03', creator: 'Léa' });
	await page.getByRole('button', { name: /Ajouter un (premier )?souvenir/ }).first().click();
	await page.getByLabel(/^Racontez/).fill('Le bal.');
	await page.getByRole('button', { name: 'Suivant' }).click();
	await expect(page.locator('[data-step="2"]')).toBeHidden();
	await page.getByLabel(/L'année, le mois ou le jour/).fill('1959-07-14');
	await expect(page.locator('.preview')).toHaveText('Sur le souvenir : 14 juillet 1959 · Jeanne avait 18 ans');
	await page.getByLabel(/L'année, le mois ou le jour/).fill('59');
	await page.getByRole('button', { name: 'Suivant' }).click();
	await expect(page.locator('.entry-form .msg-error')).toContainText('La date doit être');
});

test('PWA : manifeste, service worker, et l’app se recharge hors ligne', async ({ page, context }) => {
	await page.goto('/');
	const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
	expect(manifest.icons).toHaveLength(3);
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Racontez votre histoire, pour ceux que vous aimez.');
	await page.goto('/creer');
	await expect(page.getByRole('heading', { name: 'Pour qui créez-vous ce recueil ?' })).toBeVisible();
	await context.setOffline(false);
});
