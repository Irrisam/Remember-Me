<script>
	import { createRecueil, addEntry, exportRmbr, readRmbr, MAIL_LIMIT } from '$lib/rmbr/archive.js';
	import { timeline, formatDate } from '$lib/rmbr/timeline.js';
	import { compressImage } from '$lib/rmbr/image.js';
	import Recorder from '$lib/components/Recorder.svelte';

	const PARTIAL_DATE = /^[0-9]{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)?$/;

	/** @type {import('$lib/rmbr/archive.js').Recueil | null} */
	let recueil = $state.raw(null);
	let warnings = $state([]);
	let error = $state('');
	let busy = $state(false);

	let setup = $state({ title: '', subjectName: '', creatorName: '' });
	let draft = $state(emptyDraft());
	let audio = $state.raw(null);
	let recording = $state(false);
	/** @type {HTMLInputElement} */
	let photoInput;

	const view = $derived(recueil ? timeline(recueil.entries, recueil.manifest.creatorId) : null);
	const authorName = $derived(
		new Map((recueil?.manifest.authors ?? []).map((a) => [a.id, a.name]))
	);

	/** URLs locales des médias, libérées quand le recueil change. */
	let mediaUrls = $state.raw(new Map());
	$effect(() => {
		const urls = new Map();
		if (recueil) {
			for (const entry of recueil.entries.values()) {
				for (const item of entry.media ?? []) {
					const bytes = recueil.media.get(item.path);
					if (bytes) urls.set(item.path, URL.createObjectURL(new Blob([bytes], { type: item.mimeType })));
				}
			}
		}
		mediaUrls = urls;
		return () => urls.forEach((u) => URL.revokeObjectURL(u));
	});

	function emptyDraft() {
		return { title: '', text: '', dateValue: '', approximate: false, dateLabel: '' };
	}

	function start(e) {
		e.preventDefault();
		recueil = createRecueil({
			title: setup.title.trim(),
			subjectName: setup.subjectName.trim(),
			creatorName: setup.creatorName.trim()
		});
		warnings = [];
		error = '';
	}

	async function save(e) {
		e.preventDefault();
		error = '';
		const dateValue = draft.dateValue.trim();
		if (dateValue && !PARTIAL_DATE.test(dateValue)) {
			error = 'La date doit être une année (1959), un mois (1959-07) ou un jour (1959-07-14).';
			return;
		}
		const files = [...(photoInput.files ?? [])];
		if (!files.length && !audio && !draft.text.trim()) {
			error = 'Écrivez quelques mots, ajoutez une photo ou enregistrez votre voix.';
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
			// POC : c'est toujours le créateur qui écrit. Les contributeurs arrivent en phase 2.
			// Le type dit la nature principale : la photo prime, puis la voix, sinon le texte.
			await addEntry(recueil, {
				type: photos.length ? 'photo' : audio ? 'audio' : 'text',
				authorId: recueil.manifest.creatorId,
				title: draft.title.trim(),
				text: draft.text.trim(),
				date,
				media: audio ? [...photos, audio] : photos
			});
			recueil = { ...recueil };
			draft = emptyDraft();
			audio = null;
			photoInput.value = '';
		} catch (err) {
			error = err.message;
		} finally {
			busy = false;
		}
	}

	function download() {
		const bytes = exportRmbr(recueil);
		warnings = bytes.length > MAIL_LIMIT
			? ['Ce recueil dépasse 25 Mo : il risque d’être refusé en pièce jointe de mail.']
			: [];
		const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `${slug(recueil.manifest.title)}.rmbr`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function open(e) {
		const file = e.currentTarget.files?.[0];
		if (!file) return;
		error = '';
		try {
			const res = await readRmbr(new Uint8Array(await file.arrayBuffer()));
			recueil = res.recueil;
			warnings = res.warnings;
		} catch (err) {
			error = err.message;
		}
		e.currentTarget.value = '';
	}

	function slug(s) {
		return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'recueil';
	}
</script>

<main>
	{#if !recueil}
		<h1>Remember Me</h1>
		<p class="lead">Rassemblez vos souvenirs dans un fichier, et offrez-le à vos proches.</p>

		<section class="card">
			<h2>Commencer un recueil</h2>
			<form onsubmit={start}>
				<label>Titre du recueil
					<input bind:value={setup.title} required maxlength="200" placeholder="Les souvenirs de Mamie Jeanne" />
				</label>
				<label>De qui parle-t-il ? <span class="hint">(facultatif)</span>
					<input bind:value={setup.subjectName} maxlength="200" placeholder="Jeanne Martin" />
				</label>
				<label>Votre prénom
					<input bind:value={setup.creatorName} required maxlength="120" placeholder="Jeanne" />
				</label>
				<button type="submit">Commencer</button>
			</form>
		</section>

		<section class="card">
			<h2>Ouvrir un recueil reçu</h2>
			<label class="file">Choisir un fichier .rmbr
				<input type="file" accept=".rmbr" onchange={open} />
			</label>
		</section>
	{:else}
		<header>
			<h1>{recueil.manifest.title}</h1>
			{#if recueil.manifest.subject}<p class="lead">{recueil.manifest.subject.name}</p>{/if}
			<div class="actions">
				<button onclick={download}>Enregistrer le fichier .rmbr</button>
				<button class="secondary" onclick={() => (recueil = null)}>Fermer</button>
			</div>
		</header>

		<section class="card">
			<h2>Ajouter un souvenir</h2>
			<form onsubmit={save}>
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
					<span class="label">Votre voix <span class="hint">(facultatif)</span></span>
					<Recorder bind:value={audio} bind:recording />
				</div>
				<button type="submit" disabled={busy || recording}>{busy ? 'Préparation…' : 'Ajouter ce souvenir'}</button>
			</form>
		</section>
	{/if}

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#each warnings as w}<p class="warning">{w}</p>{/each}

	{#if view}
		<section>
			{#each view.dated as entry (entry.id)}
				{@render memory(entry)}
			{/each}
			{#if view.undated.length}
				<h2 class="period">Sans date</h2>
				{#each view.undated as entry (entry.id)}
					{@render memory(entry)}
				{/each}
			{/if}
			{#if !view.dated.length && !view.undated.length}
				<p class="hint">Aucun souvenir pour l'instant.</p>
			{/if}
		</section>
	{/if}
</main>

{#snippet memory(entry)}
	<article class="card">
		{#if entry.date}<p class="date">{formatDate(entry.date)}</p>{/if}
		{#if entry.title}<h3>{entry.title}</h3>{/if}
		{#each entry.media ?? [] as item (item.path)}
			{#if mediaUrls.get(item.path)}
				<figure>
					{#if item.mimeType.startsWith('image/')}
						<img src={mediaUrls.get(item.path)} alt={item.caption ?? ''} width={item.width} height={item.height} />
					{:else if item.mimeType.startsWith('audio/')}
						<audio controls preload="none" src={mediaUrls.get(item.path)}></audio>
					{/if}
					{#if item.caption}<figcaption>{item.caption}</figcaption>{/if}
				</figure>
			{/if}
		{/each}
		{#if entry.text}<p class="text">{entry.text}</p>{/if}
		<p class="hint">Par {authorName.get(entry.authorId) ?? 'auteur inconnu'}</p>
	</article>
{/snippet}

<style>
	:global(body) {
		margin: 0;
		background: #f7f4ef;
		color: #2b2724;
		font: 18px/1.6 Georgia, 'Times New Roman', serif;
	}
	main {
		max-width: 680px;
		margin: 0 auto;
		padding: 24px 16px 64px;
	}
	h1 { font-size: 2rem; margin: 0 0 4px; }
	.lead { color: #6b625a; margin-top: 0; }
	.card {
		background: #fff;
		border: 1px solid #e6dfd5;
		border-radius: 12px;
		padding: 20px;
		margin: 16px 0;
	}
	form { display: grid; gap: 14px; }
	label, .field { display: grid; gap: 4px; font-weight: 600; }
	audio { width: 100%; }
	.hint { font-weight: 400; color: #8a8076; font-size: 0.9rem; }
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
	button {
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
	button.secondary { background: #e6dfd5; color: #2b2724; }
	.actions { display: flex; gap: 12px; flex-wrap: wrap; }
	.file input { font-size: 1rem; }
	.date { color: #8a6d4f; margin: 0; font-style: italic; }
	h3 { margin: 4px 0 12px; }
	.text { white-space: pre-wrap; }
	figure { margin: 0 0 12px; }
	img { max-width: 100%; height: auto; border-radius: 8px; }
	figcaption { color: #6b625a; font-size: 0.9rem; }
	.period { margin-top: 32px; color: #6b625a; }
	.error { color: #9b2c2c; font-weight: 600; }
	.warning { color: #8a5a00; }
</style>
