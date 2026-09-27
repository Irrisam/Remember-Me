<script>
	import { untrack } from 'svelte';
	import { compressImage } from '$lib/rmbr/image.js';
	import { PARTIAL_DATE, formatDate } from '$lib/rmbr/timeline.js';
	import { ageAt, formatAge } from '$lib/rmbr/story.js';
	import Recorder from './Recorder.svelte';
	import VideoPicker from './VideoPicker.svelte';
	import PromptIdeas from './PromptIdeas.svelte';

	/**
	 * Ajout guidé d'un souvenir, en trois étapes. onsave reçoit une entrée prête pour addEntry, sans authorId.
	 * Les étapes restent montées (masquées) : une vidéo continue de se compresser quand on navigue.
	 * Sur grand écran, les étapes passent dans une colonne à gauche ; sur téléphone, en onglets au-dessus.
	 * Avec `initial`, le formulaire modifie ce souvenir : champs préremplis, médias existants repris
	 * sous la forme `{ keep: item }` (le parent y joint les octets).
	 * `ideas` : questions guidées proposées (jamais imposées) ; `startPrompt` : question déjà choisie.
	 * @type {{ onsave: (input: any) => Promise<void>, replyTo?: any, subject?: any, initial?: any,
	 *   urls?: Map<string, string>, oncancel: () => void,
	 *   ideas?: { voice: 'self' | 'other', name: string, used: string[] }, startPrompt?: string }}
	 */
	let { onsave, replyTo = null, subject, initial = null, urls = new Map(), oncancel, ideas, startPrompt = '' } = $props();

	// Lu une seule fois : le parent recrée le formulaire pour chaque souvenir modifié.
	const start = untrack(() => initial);
	const startMedia = start?.media ?? [];
	let prompt = $state(untrack(() => start?.prompt ?? startPrompt));

	const STEPS = [
		{ label: 'Racontez', help: 'Le souvenir, en quelques mots ou en quelques pages.' },
		{ label: 'Quand ?', help: 'Pour le ranger sur la frise.' },
		{ label: 'Photos, vidéo, voix', help: 'Tout est facultatif.' }
	];
	let step = $state(0);
	let draft = $state({
		title: start?.title ?? '',
		text: start?.text ?? '',
		dateValue: start?.date?.value ?? '',
		approximate: !!start?.date?.approximate,
		dateLabel: start?.date?.label ?? ''
	});
	/** Médias du souvenir modifié, gardés tant qu'on ne les retire pas. */
	let keptPhotos = $state.raw(startMedia.filter((m) => m.mimeType.startsWith('image/')));
	let keptVideo = $state.raw(startMedia.find((m) => m.mimeType.startsWith('video/')) ?? null);
	let keptAudio = $state.raw(startMedia.find((m) => m.mimeType.startsWith('audio/')) ?? null);
	/** @type {{ file: File, url: string }[]} */
	let photos = $state([]);
	let audio = $state.raw(null);
	let recording = $state(false);
	let video = $state.raw(null);
	let videoBusy = $state(false);
	let busy = $state(false);
	let error = $state('');
	/** @type {HTMLElement} */
	let root;

	/** Aperçu de la date telle qu'elle apparaîtra sur le souvenir. */
	const datePreview = $derived.by(() => {
		const value = draft.dateValue.trim();
		const date = {
			...(PARTIAL_DATE.test(value) && { value }),
			...(PARTIAL_DATE.test(value) && draft.approximate && { approximate: true }),
			...(draft.dateLabel.trim() && { label: draft.dateLabel.trim() })
		};
		if (!date.value && !date.label) return '';
		const age = subject ? formatAge(subject.name, ageAt(subject.birthDate, date)) : '';
		return [formatDate(date), age].filter(Boolean).join(' · ');
	});

	$effect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)));

	function go(next) {
		error = '';
		if (step === 1 && next > 1 && !dateOk()) return;
		step = next;
		root.querySelector(`[data-step="${next}"] input, [data-step="${next}"] textarea`)?.focus();
		root.scrollIntoView({ block: 'start' });
	}

	function dateOk() {
		const v = draft.dateValue.trim();
		if (!v || PARTIAL_DATE.test(v)) return true;
		error = 'La date doit être une année (1959), un mois (1959-07) ou un jour (1959-07-14).';
		return false;
	}

	function addPhotos(e) {
		const files = [...(e.currentTarget.files ?? [])];
		e.currentTarget.value = '';
		photos = [...photos, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))];
	}

	function removePhoto(i) {
		URL.revokeObjectURL(photos[i].url);
		photos = photos.filter((_, j) => j !== i);
	}

	function submit(e) {
		e.preventDefault();
		if (step < STEPS.length - 1) go(step + 1);
		else finish();
	}

	async function finish() {
		error = '';
		if (!dateOk()) return (step = 1);
		const videoItem = video ?? (keptVideo && { keep: keptVideo });
		const audioItem = audio ?? (keptAudio && { keep: keptAudio });
		const hasPhotos = photos.length + keptPhotos.length > 0;
		if (!hasPhotos && !audioItem && !videoItem && !draft.text.trim()) {
			error = 'Écrivez quelques mots, ajoutez une photo ou une vidéo, ou enregistrez votre voix.';
			return;
		}
		busy = true;
		try {
			const images = [];
			for (const p of photos) images.push(await compressImage(p.file));
			const dateValue = draft.dateValue.trim();
			let date;
			if (dateValue || draft.dateLabel.trim()) {
				date = {};
				if (dateValue) date.value = dateValue;
				if (dateValue && draft.approximate) date.approximate = true;
				if (draft.dateLabel.trim()) date.label = draft.dateLabel.trim();
			}
			// Le type dit la nature principale : vidéo, puis photo, puis voix, sinon texte.
			const photoItems = [...keptPhotos.map((keep) => ({ keep })), ...images];
			await onsave({
				type: videoItem ? 'video' : photoItems.length ? 'photo' : audioItem ? 'audio' : 'text',
				title: draft.title.trim(),
				text: draft.text.trim(),
				date,
				replyTo: replyTo?.id,
				// Toujours présent (même vide) : en modification, une question retirée doit le rester.
				prompt: prompt || undefined,
				media: [...(videoItem ? [videoItem] : []), ...photoItems, ...(audioItem ? [audioItem] : [])]
			});
		} catch (err) {
			error = err.message;
		} finally {
			busy = false;
		}
	}
</script>

<section class="card entry-form" bind:this={root} aria-labelledby="entry-form-title">
	<div class="head">
		<div>
			<h2 id="entry-form-title">
				{start ? 'Modifier le souvenir' : replyTo ? 'Compléter un souvenir' : 'Ajouter un souvenir'}
			</h2>
			{#if start}<p class="reply">La nouvelle version remplacera l'ancienne, y compris dans le fichier.</p>{/if}
			{#if replyTo}<p class="reply">Vous ajoutez votre version de « {replyTo.title ?? 'ce souvenir'} ».</p>{/if}
		</div>
		<button type="button" class="btn btn-ghost btn-sm" onclick={oncancel}>Annuler</button>
	</div>

	<div class="layout">
		<ol class="stepper">
			{#each STEPS as s, i}
				<li class:current={i === step} class:done={i < step}>
					<button type="button" onclick={() => go(i)} aria-current={i === step ? 'step' : undefined}>
						<span class="num">{i < step ? '✓' : i + 1}</span>
						<span class="text">
							<span class="label">{s.label}</span>
							<span class="help">{s.help}</span>
						</span>
					</button>
				</li>
			{/each}
		</ol>

		<form onsubmit={submit} novalidate>
			<div class="step" data-step="0" hidden={step !== 0}>
				{#if ideas && !replyTo}
					<PromptIdeas bind:value={prompt} voice={ideas.voice} name={ideas.name} used={ideas.used} />
				{/if}
				<label class="field">Un titre <span class="hint">(facultatif)</span>
					<input class="input input-title" bind:value={draft.title} maxlength="200" placeholder="Le bal du 14 juillet" />
				</label>
				<label class="field">Racontez
					<span class="hint">Écrivez comme vous le diriez à voix haute : qui était là, ce que vous avez ressenti, un détail qui vous reste.</span>
					<textarea class="input story-text" bind:value={draft.text} rows="12" maxlength="50000"></textarea>
				</label>
			</div>

			<div class="step" data-step="1" hidden={step !== 1}>
				<p class="hint">Une date aide à ranger le souvenir sur la frise. Pas de souci si vous ne la connaissez pas.</p>
				<div class="date-grid">
					<div class="stack">
						<label class="field">L'année, le mois ou le jour
							<input class="input" bind:value={draft.dateValue} inputmode="numeric" placeholder="1959, 1959-07 ou 1959-07-14" />
						</label>
						<label class="check"><input type="checkbox" bind:checked={draft.approximate} /> C'est à peu près</label>
					</div>
					<label class="field">Ou dites-le avec vos mots <span class="hint">(facultatif)</span>
						<input class="input" bind:value={draft.dateLabel} maxlength="100" placeholder="l'été de mes 20 ans" />
					</label>
				</div>
				<p class="preview" aria-live="polite">
					{#if datePreview}Sur le souvenir : <strong>{datePreview}</strong>{:else}Sans date, le souvenir ira dans « Sans date », à la fin du recueil.{/if}
				</p>
			</div>

			<div class="step" data-step="2" hidden={step !== 2}>
				<div class="tiles">
					<section class="tile tile-photos" aria-labelledby="tile-photos">
						<h3 id="tile-photos"><span aria-hidden="true">🖼️</span> Photos</h3>
						{#if photos.length || keptPhotos.length}
							<ul class="thumbs">
								{#each keptPhotos as item (item.path)}
									<li>
										<img src={urls.get(item.path)} alt={item.caption ?? ''} />
										<button type="button" class="remove" onclick={() => (keptPhotos = keptPhotos.filter((k) => k !== item))} aria-label="Retirer cette photo">×</button>
									</li>
								{/each}
								{#each photos as p, i (p.url)}
									<li>
										<img src={p.url} alt="" />
										<button type="button" class="remove" onclick={() => removePhoto(i)} aria-label="Retirer cette photo">×</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="hint">Autant que vous voulez. Elles seront allégées automatiquement.</p>
						{/if}
						<label class="btn btn-secondary btn-sm">
							{photos.length || keptPhotos.length ? 'Ajouter d’autres photos' : 'Choisir des photos'}
							<input class="visually-hidden" type="file" accept="image/*" multiple onchange={addPhotos} />
						</label>
					</section>
					<section class="tile" aria-labelledby="tile-video">
						<h3 id="tile-video"><span aria-hidden="true">🎬</span> Une vidéo</h3>
						{#if keptVideo && !video}
							<!-- Vidéo déjà dans le souvenir : sous-titres à brancher sur media.transcript. -->
							<!-- svelte-ignore a11y_media_has_caption -->
							<video controls preload="metadata" src={urls.get(keptVideo.path)} width={keptVideo.width} height={keptVideo.height}></video>
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => (keptVideo = null)}>Retirer la vidéo</button>
						{:else}
							<VideoPicker bind:value={video} bind:busy={videoBusy} />
						{/if}
					</section>
					<section class="tile" aria-labelledby="tile-voice">
						<h3 id="tile-voice"><span aria-hidden="true">🎙️</span> Votre voix</h3>
						{#if keptAudio && !audio}
							<audio controls preload="none" src={urls.get(keptAudio.path)}></audio>
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => (keptAudio = null)}>Retirer l'enregistrement</button>
						{:else}
							<Recorder bind:value={audio} bind:recording />
						{/if}
					</section>
				</div>
			</div>

			{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}

			<div class="nav">
				{#if step > 0}
					<button type="button" class="btn btn-secondary" onclick={() => go(step - 1)}>Précédent</button>
				{/if}
				<span class="spacer"></span>
				{#if step < STEPS.length - 1}
					{#if step === 0 && draft.text.trim()}
						<button type="button" class="btn btn-ghost" onclick={finish}>{start ? 'Enregistrer tout de suite' : 'Ajouter tout de suite'}</button>
					{/if}
					<button type="submit" class="btn">Suivant</button>
				{:else}
					<button type="submit" class="btn btn-lg" disabled={busy || recording || videoBusy}>
						{busy ? 'Préparation…' : videoBusy ? 'Vidéo en préparation…' : start ? 'Enregistrer les modifications' : 'Ajouter ce souvenir'}
					</button>
				{/if}
			</div>
		</form>
	</div>
</section>

<style>
	.entry-form {
		margin: 16px 0 32px;
		scroll-margin-top: 16px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 12px;
	}
	.head h2 {
		margin: 0;
	}
	.reply {
		color: var(--ink-soft);
		margin: 6px 0 0;
	}
	.layout {
		display: grid;
		gap: 24px;
		margin-top: 20px;
	}
	form {
		display: grid;
		gap: 20px;
		min-width: 0;
	}
	.step {
		display: grid;
		gap: 20px;
	}

	/* Étapes : onglets sur téléphone, colonne à gauche sur grand écran. */
	.stepper {
		list-style: none;
		display: flex;
		gap: 4px;
		margin: 0;
		padding: 0;
		border-bottom: 1px solid var(--line);
		overflow-x: auto;
	}
	.stepper button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 48px;
		padding: 8px 12px 12px;
		border: 0;
		border-bottom: 3px solid transparent;
		margin-bottom: -1px;
		background: none;
		font: inherit;
		text-align: left;
		color: var(--ink-faint);
		cursor: pointer;
		white-space: nowrap;
	}
	.num {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 2px solid var(--line-strong);
		font-weight: 600;
		font-size: 0.9rem;
	}
	.text {
		display: grid;
	}
	.help {
		display: none;
		font-size: 0.9rem;
		white-space: normal;
		color: var(--ink-faint);
	}
	.current button {
		color: var(--ink);
		border-bottom-color: var(--accent);
		font-weight: 600;
	}
	.current .num {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
	.done .num {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Téléphone : seule l'étape en cours garde son nom, les autres ne montrent que leur numéro. */
	@media (max-width: 899px) {
		.stepper li:not(.current) .text {
			display: none;
		}
		.stepper li.current {
			flex: 1;
		}
	}

	@media (min-width: 900px) {
		.layout {
			grid-template-columns: 230px 1fr;
			gap: 40px;
		}
		.stepper {
			flex-direction: column;
			gap: 6px;
			border-bottom: 0;
			border-right: 1px solid var(--line);
			padding-right: 16px;
			align-self: start;
			position: sticky;
			top: 16px;
		}
		.stepper button {
			border-bottom: 0;
			border-radius: var(--radius-sm);
			padding: 12px;
			margin: 0;
			white-space: normal;
		}
		.current button {
			background: var(--accent-soft);
		}
		.help {
			display: block;
			font-weight: 400;
		}
	}

	.input-title {
		font-size: 1.25rem;
		font-family: var(--font-display);
	}
	.story-text {
		min-height: 300px;
		line-height: 1.7;
	}

	.date-grid {
		display: grid;
		gap: 20px;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		align-items: start;
	}
	.preview {
		margin: 0;
		padding: 14px 16px;
		border-radius: var(--radius-sm);
		background: var(--paper);
		color: var(--ink-soft);
	}
	.preview strong {
		color: var(--accent);
		font-style: italic;
	}

	.tiles {
		display: grid;
		gap: 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		align-items: stretch;
	}
	.tile {
		display: grid;
		align-content: start;
		gap: 12px;
		padding: 20px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper);
		min-width: 0;
	}
	/* Les photos prennent toute la largeur : vidéo et voix se partagent la ligne suivante. */
	.tile-photos {
		grid-column: 1 / -1;
	}
	.tile h3 {
		margin: 0;
		font-size: 1.15rem;
	}
	.tile > .btn {
		justify-self: start;
	}
	.tile video {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
	}
	.tile audio {
		width: 100%;
	}
	.thumbs {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 0;
		padding: 0;
	}
	.thumbs li {
		position: relative;
	}
	.thumbs img {
		width: 84px;
		height: 84px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		display: block;
	}
	.remove {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid var(--card);
		background: var(--ink);
		color: #fff;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
	}

	.nav {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.spacer {
		flex: 1;
	}
</style>
