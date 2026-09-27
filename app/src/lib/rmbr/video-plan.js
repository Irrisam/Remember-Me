/** Plafonds du schéma pour une vidéo. */
export const MAX_DURATION = 180;
export const MAX_BYTES = 20 * 1024 * 1024;
/** Marge sous le plafond : le débit visé n'est qu'une moyenne. */
const TARGET_BYTES = 18 * 1024 * 1024;
/** 720p : bon compromis netteté / temps d'encodage en WebAssembly (le schéma autorise 1920). */
export const MAX_SIDE = 1280;
const AUDIO_KBPS = 64;
const MIN_VIDEO_KBPS = 200;
const MAX_VIDEO_KBPS = 2000;

/**
 * Débit vidéo (kbit/s) pour tenir dans le budget sur toute la durée.
 * @param {number} durationSec durée réelle, ou NaN si inconnue (on prend alors le plafond)
 * @param {number} [scale] facteur de réduction pour une 2e tentative
 */
export function videoKbps(durationSec, scale = 1) {
	const d = Number.isFinite(durationSec) && durationSec > 0 ? Math.min(durationSec, MAX_DURATION) : MAX_DURATION;
	const total = (TARGET_BYTES * 8) / 1000 / d;
	return Math.round(Math.min(MAX_VIDEO_KBPS, Math.max(MIN_VIDEO_KBPS, (total - AUDIO_KBPS) * scale)));
}

/** Arguments ffmpeg : MP4 H.264 + AAC mono, lisible partout, démarrage rapide en lecture. */
export function encodeArgs(input, output, kbps) {
	return [
		'-i', input,
		'-map', '0:v:0',
		'-map', '0:a:0?',
		'-vf', `scale=${MAX_SIDE}:${MAX_SIDE}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
		'-c:v', 'libx264',
		'-preset', 'veryfast',
		'-profile:v', 'main',
		'-pix_fmt', 'yuv420p',
		'-b:v', `${kbps}k`,
		'-maxrate', `${Math.round(kbps * 1.25)}k`,
		'-bufsize', `${kbps * 2}k`,
		'-c:a', 'aac',
		'-b:a', `${AUDIO_KBPS}k`,
		'-ac', '1',
		'-movflags', '+faststart',
		'-t', String(MAX_DURATION),
		output
	];
}

/** Arguments ffprobe : durée et dimensions en JSON dans un fichier. */
export function probeArgs(input, output) {
	return [
		'-v', 'error',
		'-print_format', 'json',
		'-show_entries', 'format=duration:stream=codec_type,width,height',
		input,
		'-o', output
	];
}

/**
 * Lit la sortie JSON de ffprobe.
 * @param {string} json
 * @returns {{ durationSec: number, width?: number, height?: number }}
 */
export function parseProbe(json) {
	const data = JSON.parse(json);
	const video = (data.streams ?? []).find((s) => s.codec_type === 'video');
	return {
		durationSec: Number.parseFloat(data.format?.duration),
		width: video?.width,
		height: video?.height
	};
}
