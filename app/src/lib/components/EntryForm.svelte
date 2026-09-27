<script>
	import { compressImage } from '$lib/rmbr/image.js';
	import Recorder from './Recorder.svelte';
	import VideoPicker from './VideoPicker.svelte';
	import { PARTIAL_DATE } from '$lib/rmbr/timeline.js';

	/**
	 * onsave reçoit une entrée prête pour addEntry, sans authorId.
	 * @type {{ onsave: (input: any) => Promise<void>, replyTo?: any, oncancelreply?: () => void }}
	 */
	let { onsave, replyTo = null, oncancelreply } = $props();

	let draft = $state(emptyDraft());
	let audio = $state.raw(null);
	let recording = $state(false);
	let video = $state.raw(null);
	let videoBusy = $state(false);
	let busy = $state(false);
	let error = $state('');
	/** @type {HTMLInputElement} */
	let photoInput;

	function emptyDraft() {
		return { title: '', text: '', dateValue: '', approximate: false, dateLabel: '' };
	}

	async function submit(e) {
		e.preventDefault();
		error = '';
		const dateValue = draft.dateValue.trim();
		if (dateValue && !PARTIAL_DATE.test(dateValue)) {
			error = 'La date doit être une année (1959), un mois (1959-07) ou un jour (1959-07-14).';
			return;
		}
		const files = [...(photoInput.files ?? [])];
		if (!files.length && !audio && !video && !draft.text.trim()) {
			error = 'Écrivez quelques mots, ajoutez une photo ou une vidéo, ou enregistrez votre voix.';
			return;
		}

		busy = true;
		try {
			const photos = [];
			for (const f of files) photos.push(await compressImage(f));
			let date;
			if (dateValue || draft.dateLabel.trim()) {
				date = {};
				if (dateValue) date.value = dateValue;
				if (dateValue && draft.approximate) date.approximate = true;
				if (draft.dateLabel.trim()) date.label = draft.dateLabel.trim();
			}
			// Le type dit la nature principale : vidéo, puis photo, puis voix, sinon texte.
			await onsave({
				type: video ? 'video' : photos.length ? 'photo' : audio ? 'audio' : 'text',
				title: draft.title.trim(),
				text: draft.text.trim(),
				date,
				replyTo: replyTo?.id,
				media: [...(video ? [video] : []), ...photos, ...(audio ? [audio] : [])]
			});
			draft = emptyDraft();
			audio = null;
			video = null;
			photoInput.value = '';
		} catch (err) {
			error = err.message;
		} finally {
			busy = false;
		}
	}
</script>

<section class="card">
	<h2>{replyTo ? 'Compléter un souvenir' : 'Ajouter un souvenir'}</h2>
	{#if replyTo}
		<p class="reply">
			En réponse à « {replyTo.title ?? 'ce souvenir'} »
			<button type="button" class="link" onclick={oncancelreply}>annuler</button>
		</p>
	{/if}
	<form onsubmit={submit}>
		<label>Titre <span class="hint">(facultatif)</span>
			<input bind:value={draft.title} maxlength="200" placeholder="Le bal du 14 juillet" />
		</label>
		<label>Racontez
			<textarea bind:value={draft.text} rows="5" maxlength="50000"></textarea>
		</label>
		<div class="row">
			<label>Date <span class="hint">(1959, 1959-07 ou 1959-07-14)</span>
				<input bind:value={draft.dateValue} inputmode="numeric" placeholder="1959" />
			</label>
			<label class="check"><input type="checkbox" bind:checked={draft.approximate} /> environ</label>
		</div>
		<label>Ou en vos mots <span class="hint">(facultatif)</span>
			<input bind:value={draft.dateLabel} maxlength="100" placeholder="l'été de mes 20 ans" />
		</label>
		<label>Photos <span class="hint">(facultatif)</span>
			<input bind:this={photoInput} type="file" accept="image/*" multiple />
		</label>
		<div class="field">
			<span>Une vidéo <span class="hint">(facultatif)</span></span>
			<VideoPicker bind:value={video} bind:busy={videoBusy} />
		</div>
		<div class="field">
			<span>Votre voix <span class="hint">(facultatif)</span></span>
			<Recorder bind:value={audio} bind:recording />
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button type="submit" disabled={busy || recording || videoBusy}>{busy ? 'Préparation…' : 'Ajouter ce souvenir'}</button>
	</form>
</section>

<style>
	.card { background: #fff; border: 1px solid #e6dfd5; border-radius: 12px; padding: 20px; margin: 16px 0; }
	form { display: grid; gap: 14px; }
	label, .field { display: grid; gap: 4px; font-weight: 600; }
	.hint { font-weight: 400; color: #8a8076; font-size: 0.9rem; }
	.reply { color: #6b625a; margin-top: -8px; }
	input, textarea {
		font: inherit;
		font-weight: 400;
		padding: 10px 12px;
		border: 1px solid #cfc6ba;
		border-radius: 8px;
		background: #fffdfa;
	}
	.row { display: flex; gap: 16px; align-items: end; flex-wrap: wrap; }
	.row > label:first-child { flex: 1; }
	.check { display: flex; gap: 8px; align-items: center; padding-bottom: 12px; }
	.error { color: #9b2c2c; font-weight: 600; margin: 0; }
	button[type='submit'] {
		font: inherit;
		font-weight: 600;
		padding: 12px 20px;
		border: 0;
		border-radius: 8px;
		background: #5b4636;
		color: #fff;
		cursor: pointer;
	}
	button:disabled { opacity: 0.6; cursor: wait; }
	.link { font: inherit; background: none; border: 0; color: #5b4636; text-decoration: underline; cursor: pointer; padding: 0 4px; }
</style>
