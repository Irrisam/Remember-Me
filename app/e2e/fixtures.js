import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { unzipSync, strFromU8 } from 'fflate';

/**
 * `page` échoue le test à la moindre erreur console ou exception, et accepte les confirmations
 * (« Supprimer ce souvenir ? »). `allowedErrors` : erreurs attendues par un test précis
 * (ex. la page 404), à déclarer avec test.use().
 */
export const test = base.extend({
	allowedErrors: [[], { option: true }],
	page: async ({ page, allowedErrors }, use) => {
		const errors = [];
		const allowed = (text) => text.includes('ERR_INTERNET_DISCONNECTED') || allowedErrors.some((re) => re.test(text));
		page.on('pageerror', (e) => {
			if (!allowed(e.message)) errors.push(`exception : ${e.message}`);
		});
		page.on('console', (m) => {
			if (m.type() === 'error' && !allowed(m.text())) errors.push(`console : ${m.text()}`);
		});
		page.on('dialog', (d) => d.accept());
		await use(page);
		expect(errors, 'erreurs dans la page').toEqual([]);
	}
});
export { expect };

/** Image PNG de test (dégradé), pour les photos. */
export function png(width = 600, height = 400) {
	const raw = Buffer.alloc((width * 3 + 1) * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const o = y * (width * 3 + 1) + 1 + x * 3;
			raw[o] = 120 + y / 4;
			raw[o + 1] = 90 + x / 6;
			raw[o + 2] = 160 - y / 5;
		}
	}
	const chunk = (type, data) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type), data]);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(body));
		return Buffer.concat([len, body, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	const buffer = Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
	return { name: 'photo.png', mimeType: 'image/png', buffer };
}

/** Création guidée. `password` facultatif. */
export async function createRecueil(page, { mode = 'self', name = 'Jeanne Martin', birth, creator, password, hint } = {}) {
	await page.goto('/creer');
	await page.getByRole('button', { name: mode === 'self' ? /Pour moi/ : /Pour un proche/ }).click();
	await page.getByLabel(mode === 'self' ? 'Votre nom' : 'Son nom').fill(name);
	if (birth) await page.getByLabel(/date de naissance/).fill(birth);
	await page.getByRole('button', { name: 'Continuer' }).click();
	if (creator) await page.getByLabel(/prénom/).fill(creator);
	if (password) {
		await page.getByLabel('Mot de passe', { exact: true }).fill(password);
		await page.getByLabel('Retapez-le', { exact: true }).fill(password);
		if (hint) await page.getByLabel(/Un indice/).fill(hint);
	}
	await page.getByRole('button', { name: 'Créer le recueil' }).click();
	await page.waitForURL('**/recueil');
}

/** Ajout guidé d'un souvenir, en passant par les trois étapes. */
export async function addMemory(page, { title, text, date, photo, voice = false }) {
	await page.getByRole('button', { name: /Ajouter un (premier )?souvenir/ }).first().click();
	if (title) await page.getByLabel('Un titre').fill(title);
	if (text) await page.getByLabel(/^Racontez/).fill(text);
	await page.getByRole('button', { name: 'Suivant' }).click();
	if (date) await page.getByLabel(/L'année, le mois ou le jour/).fill(date);
	await page.getByRole('button', { name: 'Suivant' }).click();
	if (photo) {
		await page.locator('input[type=file][accept="image/*"]').setInputFiles(photo);
		await expect(page.locator('.thumbs img')).toHaveCount(1);
	}
	if (voice) {
		await page.getByRole('button', { name: 'Enregistrer ma voix' }).click();
		await expect(page.getByText('Enregistrement…')).toBeVisible();
		await page.waitForTimeout(1500);
		await page.getByRole('button', { name: /Arrêter/ }).click();
		await expect(page.getByText('enregistrées')).toBeVisible();
	}
	await page.getByRole('button', { name: 'Ajouter ce souvenir' }).click();
	await expect(page.locator('.entry-form')).toHaveCount(0);
}

/** Clique sur un bouton qui télécharge un fichier ; renvoie son chemin local. */
export async function download(page, testInfo, buttonName) {
	const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName }).click()]);
	const path = testInfo.outputPath(file.suggestedFilename());
	await file.saveAs(path);
	return path;
}

/** Ouvre un fichier .rmbr depuis l'accueil. */
export async function openRecueil(page, path) {
	await page.goto('/');
	await page.locator('input[type=file][accept=".rmbr"]').setInputFiles(path);
	await page.waitForURL('**/recueil');
	await expect(page.getByRole('heading', { name: 'Qui êtes-vous ?' })).toBeVisible();
}

/** « Je suis <créateur> », avec le mot de passe si le recueil est protégé. */
export async function actAsOwner(page, name, password) {
	await page.getByRole('button', { name: new RegExp(`Je suis ${name}`) }).click();
	if (password) {
		await page.getByLabel('Mot de passe', { exact: true }).fill(password);
		await page.getByRole('button', { name: 'Ouvrir en propriétaire' }).click();
	}
	await expect(page.getByRole('button', { name: 'Importer une contribution' })).toBeVisible();
}

/** Lit un fichier .rmbr/.rmbrc : manifest et entrées. */
export function readArchive(path) {
	const files = unzipSync(readFileSync(path));
	const json = (name) => JSON.parse(strFromU8(files[name]));
	return {
		files,
		manifest: json('manifest.json'),
		entries: Object.keys(files).filter((n) => n.startsWith('entries/')).map(json)
	};
}
