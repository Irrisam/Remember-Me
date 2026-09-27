import { test, expect, createRecueil, download, readArchive } from './fixtures.js';

// Télécharge ffmpeg (32 Mo) depuis jsDelivr : nécessite internet.
test('vidéo 1080p compressée en MP4 720p, rangée dans le recueil et lisible', async ({ page }, testInfo) => {
	test.setTimeout(240_000);
	await createRecueil(page, { name: 'Jeanne Martin' });

	// Vidéo source fabriquée dans le navigateur : canvas animé 1920×1080 + son, 3 s, WebM.
	const source = await page.evaluate(async () => {
		const canvas = Object.assign(document.createElement('canvas'), { width: 1920, height: 1080 });
		const g = canvas.getContext('2d');
		const audio = new AudioContext();
		const osc = audio.createOscillator();
		const out = audio.createMediaStreamDestination();
		osc.connect(out);
		osc.start();
		const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...out.stream.getAudioTracks()]);
		const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 8e6 });
		const chunks = [];
		rec.ondataavailable = (e) => chunks.push(e.data);
		const t0 = performance.now();
		const draw = () => {
			const t = (performance.now() - t0) / 1000;
			g.fillStyle = `hsl(${t * 90},60%,50%)`;
			g.fillRect(0, 0, 1920, 1080);
			g.fillStyle = '#fff';
			g.font = 'bold 160px serif';
			g.fillText(`Souvenir ${t.toFixed(1)} s`, 200 + t * 100, 560);
			if (rec.state === 'recording') requestAnimationFrame(draw);
		};
		rec.start();
		draw();
		await new Promise((r) => setTimeout(r, 3000));
		rec.stop();
		await new Promise((r) => (rec.onstop = r));
		const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
		let s = '';
		for (const b of bytes) s += String.fromCharCode(b);
		return btoa(s);
	});

	await page.getByRole('button', { name: /Ajouter un (premier )?souvenir/ }).first().click();
	await page.getByLabel('Un titre').fill('Le mariage');
	await page.locator('.stepper button').nth(2).click();
	await page.locator('input[type=file][accept="video/*"]').setInputFiles({
		name: 'mariage.webm',
		mimeType: 'video/webm',
		buffer: Buffer.from(source, 'base64')
	});
	await expect(page.getByRole('button', { name: 'Retirer la vidéo' })).toBeVisible({ timeout: 200_000 });
	await page.getByRole('button', { name: 'Ajouter ce souvenir' }).click();
	const video = page.locator('article.memory video');
	await expect(video).toHaveCount(1);
	const size = await video.evaluate((v) =>
		new Promise((r) => (v.readyState >= 1 ? r([v.videoWidth, v.videoHeight]) : (v.onloadedmetadata = () => r([v.videoWidth, v.videoHeight]))))
	);
	expect(size).toEqual([1280, 720]);

	const file = await download(page, testInfo, 'Enregistrer le fichier');
	const { files, entries } = readArchive(file);
	const media = entries[0].media[0];
	expect(media).toMatchObject({ mimeType: 'video/mp4', width: 1280, height: 720 });
	expect(media.size).toBeLessThan(20 * 1024 * 1024);
	expect(Buffer.from(files[media.path].slice(4, 8)).toString()).toBe('ftyp');
});
