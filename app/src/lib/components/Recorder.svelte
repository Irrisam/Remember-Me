<script>
	/** Plafonds du schéma pour un audio. */
	const MAX_SEC = 30 * 60;
	const MAX_BYTES = 10 * 1024 * 1024;
	/** Opus à 32 kbit/s : voix claire, 30 min ≈ 7 Mo. */
	const BITRATE = 32000;
	const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

	/** @type {{ value: { bytes: Uint8Array, mimeType: string, durationSec: number } | null, recording: boolean }} */
	let { value = $bindable(null), recording = $bindable(false) } = $props();

	let elapsed = $state(0);
	let error = $state('');
	let previewUrl = $state('');

	/** @type {MediaRecorder | undefined} */
	let recorder;
	/** @type {MediaStream | undefined} */
	let stream;
	let chunks = [];
	let startedAt = 0;
	let timer;

	$effect(() => {
		if (!value) return;
		const url = URL.createObjectURL(new Blob([value.bytes], { type: value.mimeType }));
		previewUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	// Micro coupé si on quitte la page en plein enregistrement.
	$effect(() => () => release());

	async function start() {
		error = '';
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			error = 'Ce navigateur ne permet pas d’enregistrer le son.';
			return;
		}
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
		} catch {
			error = 'Le micro n’est pas accessible. Autorisez ce site à utiliser le micro, puis réessayez.';
			return;
		}
		const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
		recorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: BITRATE });
		chunks = [];
		recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
		recorder.onstop = finish;
		recorder.start(1000);
		startedAt = performance.now();
		elapsed = 0;
		timer = setInterval(() => {
			elapsed = (performance.now() - startedAt) / 1000;
			if (elapsed >= MAX_SEC) stop();
		}, 250);
		recording = true;
	}

	function stop() {
		if (recorder?.state === 'recording') recorder.stop();
	}

	async function finish() {
		const durationSec = Math.min(MAX_SEC, Math.round((performance.now() - startedAt) / 100) / 10);
		release();
		const type = (recorder.mimeType || chunks[0]?.type || '').split(';')[0];
		const blob = new Blob(chunks, { type });
		if (!['audio/webm', 'audio/ogg', 'audio/mp4'].includes(type)) {
			error = 'Ce navigateur enregistre dans un format non pris en charge.';
		} else if (durationSec < 1) {
			error = 'L’enregistrement est trop court.';
		} else if (blob.size > MAX_BYTES) {
			error = 'L’enregistrement est trop lourd. Essayez en plusieurs morceaux.';
		} else {
			value = { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: type, durationSec };
		}
	}

	function release() {
		clearInterval(timer);
		stream?.getTracks().forEach((t) => t.stop());
		stream = undefined;
		recording = false;
	}

	function clock(sec) {
		const s = Math.floor(sec);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}
</script>

<div class="recorder">
	{#if recording}
		<p class="live"><span class="dot"></span> Enregistrement… {clock(elapsed)} <span class="hint">/ 30:00</span></p>
		<button type="button" class="stop" onclick={stop}>■ Arrêter</button>
	{:else if value}
		<audio controls src={previewUrl}></audio>
		<p class="hint">{clock(value.durationSec)} enregistrées</p>
		<div class="actions">
			<button type="button" class="secondary" onclick={start}>Recommencer</button>
			<button type="button" class="secondary" onclick={() => (value = null)}>Retirer</button>
		</div>
	{:else}
		<button type="button" class="secondary" onclick={start}>🎙️ Enregistrer ma voix</button>
		<p class="hint">Jusqu'à 30 minutes.</p>
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
	.recorder { display: grid; gap: 8px; justify-items: start; }
	.live { display: flex; align-items: center; gap: 8px; margin: 0; font-weight: 600; }
	.dot { width: 12px; height: 12px; border-radius: 50%; background: #b3261e; animation: pulse 1.2s infinite; }
	@keyframes pulse { 50% { opacity: 0.3; } }
	audio { width: 100%; }
	.actions { display: flex; gap: 12px; flex-wrap: wrap; }
	.hint { margin: 0; font-weight: 400; color: #8a8076; font-size: 0.9rem; }
	.error { margin: 0; color: #9b2c2c; font-weight: 600; }
	button {
		font: inherit;
		font-weight: 600;
		padding: 12px 20px;
		border: 0;
		border-radius: 8px;
		background: #e6dfd5;
		color: #2b2724;
		cursor: pointer;
	}
	button.stop { background: #b3261e; color: #fff; }
</style>
