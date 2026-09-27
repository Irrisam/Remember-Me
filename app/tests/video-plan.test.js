import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { videoKbps, encodeArgs, parseProbe, MAX_BYTES, MAX_DURATION } from '../src/lib/rmbr/video-plan.js';

test('débit : une vidéo de 3 min tient sous 20 Mo, audio compris', () => {
	const kbps = videoKbps(MAX_DURATION);
	const bytes = ((kbps + 64) * 1000 * MAX_DURATION) / 8;
	assert.ok(bytes < MAX_BYTES, `${bytes} octets`);
	assert.ok(kbps > 600, 'qualité correcte en 720p');
});

test('débit : plafonné pour une vidéo courte, prudent si la durée est inconnue', () => {
	assert.equal(videoKbps(5), 2000);
	assert.equal(videoKbps(NaN), videoKbps(MAX_DURATION));
	assert.ok(videoKbps(MAX_DURATION, 0.7) < videoKbps(MAX_DURATION));
});

test('arguments ffmpeg : MP4 H.264/AAC, 720p max, coupé à 3 min', () => {
	const args = encodeArgs('in', 'out.mp4', 800).join(' ');
	assert.match(args, /-c:v libx264/);
	assert.match(args, /-c:a aac/);
	assert.match(args, /scale=1280:1280:force_original_aspect_ratio=decrease/);
	assert.match(args, /-t 180 out\.mp4$/);
	assert.match(args, /-map 0:a:0\?/, 'une vidéo sans son reste acceptée');
});

test('ffprobe : durée et dimensions de la piste vidéo', () => {
	const json = JSON.stringify({
		streams: [{ codec_type: 'audio' }, { codec_type: 'video', width: 1280, height: 720 }],
		format: { duration: '12.480000' }
	});
	assert.deepEqual(parseProbe(json), { durationSec: 12.48, width: 1280, height: 720 });
});

test('empreintes du moteur ffmpeg = celles du paquet @ffmpeg/core installé', async () => {
	// video.js importe @ffmpeg/ffmpeg (navigateur) : on lit les constantes dans le source.
	const src = readFileSync(new URL('../src/lib/rmbr/video.js', import.meta.url), 'utf8');
	const pkg = JSON.parse(readFileSync(new URL('../node_modules/@ffmpeg/core/package.json', import.meta.url), 'utf8'));
	assert.ok(src.includes(`@ffmpeg/core@${pkg.version}/`), `version du CDN ≠ ${pkg.version}`);
	for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
		const bytes = readFileSync(new URL(`../node_modules/@ffmpeg/core/dist/esm/${file}`, import.meta.url));
		const hash = createHash('sha256').update(bytes).digest('hex');
		assert.ok(src.includes(hash), `empreinte de ${file} absente de video.js`);
	}
});
