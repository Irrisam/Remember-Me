import { FFmpeg } from '@ffmpeg/ffmpeg';
import { sha256Hex } from './ids.js';
import { MAX_DURATION, MAX_BYTES, videoKbps, encodeArgs, probeArgs, parseProbe } from './video-plan.js';

/**
 * Moteur ffmpeg (≈ 32 Mo) : trop lourd pour être servi avec le site, chargé depuis jsDelivr
 * seulement quand on choisit une vidéo. Version figée et empreintes vérifiées avant exécution.
 * Pour changer de version : mettre à jour @ffmpeg/core (devDependency) puis ces empreintes,
 * le test video-plan.test.js vérifie qu'elles correspondent au paquet installé.
 */
export const CORE = {
	base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
	js: { file: 'ffmpeg-core.js', type: 'text/javascript', sha256: '67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3' },
	wasm: { file: 'ffmpeg-core.wasm', type: 'application/wasm', sha256: '9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7' }
};

/** Au-delà, le fichier ne tient pas dans la mémoire WebAssembly. */
const MAX_INPUT = 1024 * 1024 * 1024;

/** @type {Promise<FFmpeg> | null} */
let engine = null;

function getEngine() {
	engine ??= (async () => {
		const [coreURL, wasmURL] = await Promise.all([verifiedUrl(CORE.js), verifiedUrl(CORE.wasm)]);
		const ffmpeg = new FFmpeg();
		await ffmpeg.load({ coreURL, wasmURL });
		return ffmpeg;
	})().catch((err) => {
		engine = null;
		throw err;
	});
	return engine;
}

async function verifiedUrl({ file, type, sha256 }) {
	let bytes;
	try {
		const res = await fetch(`${CORE.base}/${file}`);
		if (!res.ok) throw new Error(String(res.status));
		bytes = new Uint8Array(await res.arrayBuffer());
	} catch {
		throw new Error('L’outil vidéo n’a pas pu être téléchargé. Vérifiez votre connexion et réessayez.');
	}
	if ((await sha256Hex(bytes)) !== sha256) throw new Error('L’outil vidéo téléchargé est altéré : il n’a pas été lancé.');
	return URL.createObjectURL(new Blob([bytes], { type }));
}

/**
 * Compresse une vidéo côté client : MP4 H.264 + AAC, 720p max, ≤ 3 min, ≤ 20 Mo.
 * @param {File} file
 * @param {{ onProgress?: (p: { stage: 'load' | 'encode', ratio: number }) => void, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ bytes: Uint8Array, mimeType: 'video/mp4', width: number, height: number, durationSec: number }>}
 */
export async function compressVideo(file, { onProgress = () => {}, signal } = {}) {
	if (file.size > MAX_INPUT) throw new Error('Cette vidéo est trop lourde (plus de 1 Go). Raccourcissez-la d’abord.');
	onProgress({ stage: 'load', ratio: 0 });
	const ffmpeg = await getEngine();
	const abort = () => {
		ffmpeg.terminate();
		engine = null;
	};
	if (signal?.aborted) throw new Error('Annulé.');
	signal?.addEventListener('abort', abort, { once: true });
	const report = ({ progress }) => onProgress({ stage: 'encode', ratio: Math.min(1, Math.max(0, progress)) });
	ffmpeg.on('progress', report);

	const input = `in-${Date.now()}`;
	try {
		await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
		const source = await probe(ffmpeg, input);
		if (source.durationSec > MAX_DURATION + 0.5) {
			throw new Error('Cette vidéo dure plus de 3 minutes. Raccourcissez-la avant de l’ajouter.');
		}

		let result;
		for (const scale of [1, 0.7]) {
			result = await encode(ffmpeg, input, videoKbps(source.durationSec, scale));
			if (result.bytes.length <= MAX_BYTES) break;
		}
		if (result.bytes.length > MAX_BYTES) throw new Error('Cette vidéo reste trop lourde une fois compressée.');
		if (!result.bytes.length || !result.width || !result.height) {
			throw new Error('Cette vidéo n’a pas pu être lue. Essayez un autre fichier.');
		}
		onProgress({ stage: 'encode', ratio: 1 });
		return {
			bytes: result.bytes,
			mimeType: 'video/mp4',
			width: result.width,
			height: result.height,
			durationSec: Math.min(MAX_DURATION, Math.round(result.durationSec * 10) / 10)
		};
	} catch (err) {
		if (signal?.aborted) throw new Error('Annulé.');
		throw err;
	} finally {
		signal?.removeEventListener('abort', abort);
		if (!signal?.aborted) {
			ffmpeg.off('progress', report);
			await ffmpeg.deleteFile(input).catch(() => {});
		}
	}
}

/**
 * Encode puis mesure le résultat dans le système de fichiers de ffmpeg, avant de le relire.
 * Attention : writeFile/readFile transfèrent le buffer entre la page et le worker,
 * un Uint8Array passé à writeFile est vidé côté page.
 */
async function encode(ffmpeg, input, kbps) {
	const output = 'out.mp4';
	const code = await ffmpeg.exec(encodeArgs(input, output, kbps));
	if (code !== 0) throw new Error('Cette vidéo n’a pas pu être lue. Essayez un autre fichier.');
	const meta = await probe(ffmpeg, output);
	const bytes = /** @type {Uint8Array} */ (await ffmpeg.readFile(output));
	await ffmpeg.deleteFile(output);
	return { bytes, ...meta };
}

async function probe(ffmpeg, input) {
	const output = 'probe.json';
	await ffmpeg.ffprobe(probeArgs(input, output));
	try {
		return parseProbe(/** @type {string} */ (await ffmpeg.readFile(output, 'utf8')));
	} catch {
		throw new Error('Cette vidéo n’a pas pu être lue. Essayez un autre fichier.');
	} finally {
		await ffmpeg.deleteFile(output).catch(() => {});
	}
}
