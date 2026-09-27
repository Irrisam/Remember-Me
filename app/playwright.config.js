import { defineConfig } from '@playwright/test';

/**
 * Tests navigateur de bout en bout, sur le build de production.
 * En local : le Edge installé (aucun navigateur à télécharger). En CI : Google Chrome, car le Chromium
 * de Playwright ne sait pas lire le H.264 des vidéos compressées.
 * Micro simulé pour l'enregistrement de la voix. Le test vidéo télécharge ffmpeg depuis jsDelivr.
 * E2E_BASE_URL=https://… npm run e2e : mêmes tests contre un site déployé (pas de serveur local).
 */
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
	testDir: 'e2e',
	timeout: 120_000,
	expect: { timeout: 15_000 },
	workers: process.env.CI ? 1 : 2,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: remote ?? 'http://localhost:4173',
		channel: process.env.CI ? 'chrome' : 'msedge',
		viewport: { width: 1280, height: 900 },
		locale: 'fr-FR',
		acceptDownloads: true,
		permissions: ['microphone'],
		launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: remote
		? undefined
		: {
				command: 'npm run build && npx vite preview --port 4173 --strictPort',
				port: 4173,
				reuseExistingServer: !process.env.CI,
				timeout: 180_000
			}
});
