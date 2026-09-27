<script>
	/** @type {{ value: any, busy: boolean }} */
	let { value = $bindable(null), busy = $bindable(false) } = $props();

	let stage = $state('load');
	let ratio = $state(0);
	let error = $state('');
	let previewUrl = $state('');
	/** @type {AbortController | null} */
	let controller = null;
	/** @type {HTMLInputElement} */
	let input;

	$effect(() => {
		if (!value) return;
		const url = URL.createObjectURL(new Blob([value.bytes], { type: value.mimeType }));
		previewUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	// Quitter la page en pleine compression : on arrête ffmpeg.
	$effect(() => () => controller?.abort());

	async function pick() {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		error = '';
		value = null;
		busy = true;
		stage = 'load';
		ratio = 0;
		controller = new AbortController();
		try {
			// Chargé à la demande : ni ffmpeg ni son worker ne pèsent sur la page tant qu'on n'ajoute pas de vidéo.
			const { compressVideo } = await import('$lib/rmbr/video.js');
			value = await compressVideo(file, {
				signal: controller.signal,
				onProgress: (p) => {
					stage = p.stage;
					ratio = p.ratio;
				}
			});
		} catch (err) {
			if (!controller.signal.aborted) error = err.message;
		} finally {
			busy = false;
			controller = null;
		}
	}

	function clock(sec) {
		const s = Math.round(sec);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}
</script>

<div class="picker">
	{#if busy}
		<p class="status">
			{#if stage === 'load'}
				Préparation de l'outil vidéo… <span class="hint">(la première fois, il se télécharge : 32 Mo)</span>
			{:else}
				Compression de la vidéo… {Math.round(ratio * 100)} %
			{/if}
		</p>
		<progress max="1" value={stage === 'load' ? undefined : ratio}></progress>
		<p class="hint">Vous pouvez continuer à écrire pendant ce temps.</p>
		<button type="button" class="btn btn-secondary btn-sm" onclick={() => controller?.abort()}>Annuler</button>
	{:else if value}
		<!-- Aperçu de sa propre vidéo : pas de sous-titres à ce stade. -->
		<!-- svelte-ignore a11y_media_has_caption -->
		<video controls src={previewUrl} width={value.width} height={value.height}></video>
		<p class="hint">{clock(value.durationSec)} · {(value.bytes.length / 1024 / 1024).toFixed(1)} Mo</p>
		<button type="button" class="btn btn-ghost btn-sm" onclick={() => (value = null)}>Retirer la vidéo</button>
	{/if}
	<label class="btn btn-secondary btn-sm" hidden={busy || !!value}>
		Choisir une vidéo
		<input class="visually-hidden" bind:this={input} type="file" accept="video/*" onchange={pick} />
	</label>
	{#if !busy && !value}<p class="hint">3 minutes maximum. Elle sera allégée pour tenir dans le recueil.</p>{/if}
	{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}
</div>

<style>
	.picker { display: grid; gap: 8px; justify-items: start; }
	.status { margin: 0; font-weight: 600; }
	progress { width: 100%; height: 12px; accent-color: var(--accent); }
	video { max-width: 100%; height: auto; border-radius: var(--radius-sm); }
	.hint { margin: 0; }
</style>
