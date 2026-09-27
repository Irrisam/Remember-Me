<script>
	import {
		createRecueil,
		createPack,
		addEntry,
		deleteEntry,
		exportRmbr,
		exportRmbrc,
		readRmbr,
		readRmbrc,
		MAIL_LIMIT
	} from '$lib/rmbr/archive.js';
	import { reviewPack, mergePack } from '$lib/rmbr/merge.js';
	import { story } from '$lib/rmbr/story.js';
	import { PARTIAL_DATE } from '$lib/rmbr/timeline.js';
	import { uuidv7 } from '$lib/rmbr/ids.js';
	import { objectUrls, revokeAll } from '$lib/media-urls.js';
	import EntryForm from '$lib/components/EntryForm.svelte';
	import Story from '$lib/components/Story.svelte';
	import Moderation from '$lib/components/Moderation.svelte';

	/** @type {import('$lib/rmbr/archive.js').Recueil | null} */
	let recueil = $state.raw(null);
	/** creator : crée et modère ; contributor : prépare un pack ; reader : consulte. null = à demander. */
	let role = $state(null);
	/** Auteur qui utilise l'app. */
	let me = $state.raw(null);
	/** Pack en préparation (contributor). */
	let pack = $state.raw(null);
	/** Contribution en cours d'examen (creator). */
	let review = $state.raw(null);
	/** Changements pas encore enregistrés dans un fichier. */
	let dirty = $state(false);
	let replyTo = $state.raw(null);
	let warnings = $state([]);
	let notice = $state('');
	let error = $state('');

	let setup = $state({ title: '', subjectName: '', birthDate: '', creatorName: '' });
	let newcomer = $state({ name: '', relation: '' });

	const creatorId = $derived(recueil?.manifest.creatorId);
	const creator = $derived(recueil?.manifest.authors.find((a) => a.id === creatorId));
	const contributors = $derived(recueil?.manifest.authors.filter((a) => a.role === 'contributor') ?? []);
	/**
	 * Ce qu'on affiche : le recueil, plus le pack en préparation pour un proche.
	 * Toujours une nouvelle Map : les entrées sont ajoutées sur place, la même référence ne déclencherait rien.
	 */
	const shown = $derived(recueil && new Map(pack ? [...recueil.entries, ...pack.entries] : recueil.entries));
	const view = $derived(shown ? story(shown, recueil.manifest) : null);
	const names = $derived(new Map([...(recueil?.manifest.authors ?? []), ...(me ? [me] : [])].map((a) => [a.id, a.name])));
	const pending = $derived(pack ? [...pack.entries.values()].length : 0);

	let urls = $state.raw(new Map());
	$effect(() => {
		if (!shown) return;
		const media = pack ? new Map([...recueil.media, ...pack.media]) : recueil.media;
		const u = objectUrls(shown.values(), media);
		urls = u;
		return () => revokeAll(u);
	});

	// Fichier unique, pas de compte : on prévient avant de perdre des changements.
	$effect(() => {
		if (!dirty) return;
		const guard = (e) => e.preventDefault();
		window.addEventListener('beforeunload', guard);
		return () => window.removeEventListener('beforeunload', guard);
	});

	function reset() {
		error = '';
		notice = '';
		warnings = [];
	}

	function start(e) {
		e.preventDefault();
		reset();
		const birthDate = setup.birthDate.trim();
		if (birthDate && !PARTIAL_DATE.test(birthDate)) {
			error = 'La date de naissance doit être une année (1941), un mois (1941-03) ou un jour (1941-03-12).';
			return;
		}
		recueil = createRecueil({
			title: setup.title.trim(),
			subjectName: setup.subjectName.trim(),
			subjectBirthDate: birthDate,
			creatorName: setup.creatorName.trim()
		});
		role = 'creator';
		me = recueil.manifest.authors[0];
		dirty = true;
	}

	async function openRecueil(e) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		reset();
		try {
			const res = await readRmbr(new Uint8Array(await file.arrayBuffer()));
			recueil = res.recueil;
			warnings = res.warnings;
			role = null;
		} catch (err) {
			error = err.message;
		}
	}

	function become(nextRole, author) {
		role = nextRole;
		me = author;
		pack = nextRole === 'contributor' ? createPack(recueil, author) : null;
	}

	function joinAsNewcomer(e) {
		e.preventDefault();
		become('contributor', { id: uuidv7(), name: newcomer.name.trim(), relation: newcomer.relation.trim() || undefined });
	}

	async function save(input) {
		notice = '';
		if (role === 'creator') {
			await addEntry(recueil, { ...input, authorId: me.id });
			recueil = { ...recueil };
		} else {
			await addEntry(pack, { ...input, authorId: me.id });
			pack = { ...pack };
		}
		dirty = true;
		replyTo = null;
	}

	function canDelete(entry) {
		return role === 'creator' || (role === 'contributor' && entry.authorId === me.id);
	}

	async function remove(entry) {
		if (!confirm(`Supprimer « ${entry.title ?? 'ce souvenir'} » ? Il sera retiré du recueil.`)) return;
		if (role === 'creator') {
			await deleteEntry(recueil, entry.id, me.id);
			recueil = { ...recueil };
		} else if (pack.entries.has(entry.id)) {
			// Pas encore envoyé : on le retire simplement du pack.
			pack.entries.delete(entry.id);
			pack.manifest.entries = pack.manifest.entries.filter((r) => r.id !== entry.id);
			for (const item of entry.media ?? []) pack.media.delete(item.path);
			pack = { ...pack };
		} else {
			await deleteEntry(pack, entry.id, me.id);
			pack = { ...pack };
		}
		dirty = true;
	}

	function download(bytes, name) {
		warnings = bytes.length > MAIL_LIMIT ? ['Ce fichier dépasse 25 Mo : il risque d’être refusé en pièce jointe de mail.'] : [];
		const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
		dirty = false;
	}

	function saveRecueil() {
		download(exportRmbr(recueil), `${slug(recueil.manifest.title)}.rmbr`);
		notice = 'Recueil enregistré. Envoyez ce fichier à vos proches, et gardez-en une copie.';
	}

	function sendPack() {
		download(exportRmbrc(pack), `contribution-${slug(me.name)}-${new Date().toISOString().slice(0, 10)}.rmbrc`);
		notice = `Contribution enregistrée. Envoyez ce fichier à ${creator.name}.`;
	}

	async function importPack(e) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		reset();
		try {
			const res = await readRmbrc(new Uint8Array(await file.arrayBuffer()));
			review = { pack: res.pack, items: await reviewPack(recueil, res.pack) };
			warnings = res.warnings;
		} catch (err) {
			error = err.message;
		}
	}

	function merge(accepted) {
		recueil = mergePack(recueil, review.pack, review.items, accepted);
		review = null;
		dirty = true;
		notice = `${accepted.size} souvenir(s) ajouté(s). Enregistrez le recueil puis renvoyez-le à tout le monde.`;
	}

	function close() {
		if (dirty && !confirm('Des changements ne sont pas enregistrés dans un fichier. Fermer quand même ?')) return;
		recueil = pack = review = me = replyTo = role = null;
		dirty = false;
		reset();
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
				{#if setup.subjectName.trim()}
					<label>Sa date de naissance <span class="hint">(facultatif : 1941, 1941-03 ou 1941-03-12)</span>
						<input bind:value={setup.birthDate} inputmode="numeric" placeholder="1941" />
					</label>
				{/if}
				<label>Votre prénom
					<input bind:value={setup.creatorName} required maxlength="120" placeholder="Jeanne" />
				</label>
				<button type="submit">Commencer</button>
			</form>
		</section>

		<section class="card">
			<h2>Ouvrir un recueil reçu</h2>
			<label class="file">Choisir un fichier .rmbr
				<input type="file" accept=".rmbr" onchange={openRecueil} />
			</label>
		</section>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	{:else}
		<header>
			<h1>{recueil.manifest.title}</h1>
			{#if recueil.manifest.subject}<p class="lead">{recueil.manifest.subject.name}</p>{/if}
			{#if me}<p class="hint">Vous êtes {me.name}{role === 'creator' ? ', créateur du recueil' : ''}.</p>{/if}
			<div class="actions">
				{#if role === 'creator'}
					<button onclick={saveRecueil}>Enregistrer le fichier .rmbr</button>
					<label class="button secondary">Importer une contribution
						<input type="file" accept=".rmbrc" onchange={importPack} hidden />
					</label>
				{:else if role === 'contributor'}
					<button onclick={sendPack} disabled={!pending}>Envoyer ma contribution ({pending})</button>
				{/if}
				<button class="secondary" onclick={close}>Fermer</button>
			</div>
		</header>

		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if notice}<p class="notice">{notice}</p>{/if}
		{#each warnings as w}<p class="warning">{w}</p>{/each}

		{#if role === null}
			<section class="card">
				<h2>Qui êtes-vous ?</h2>
				<div class="choices">
					<button onclick={() => become('creator', creator)}>Je suis {creator.name}, j'ai créé ce recueil</button>
					{#each contributors as author (author.id)}
						<button class="secondary" onclick={() => become('contributor', author)}>Je suis {author.name}</button>
					{/each}
					<button class="secondary" onclick={() => become('reader', null)}>Je veux seulement le lire</button>
				</div>
				<form onsubmit={joinAsNewcomer}>
					<h3>Je suis un proche et je veux ajouter des souvenirs</h3>
					<label>Votre prénom
						<input bind:value={newcomer.name} required maxlength="120" placeholder="Léa" />
					</label>
					<label>Votre lien avec {recueil.manifest.subject?.name ?? creator.name} <span class="hint">(facultatif)</span>
						<input bind:value={newcomer.relation} maxlength="80" placeholder="petite-fille" />
					</label>
					<button type="submit">Continuer</button>
				</form>
			</section>
		{:else}
			{#if review}
				{#key review}
					<Moderation {recueil} pack={review.pack} items={review.items} onmerge={merge} oncancel={() => (review = null)} />
				{/key}
			{/if}

			{#if role !== 'reader' && !review}
				<EntryForm onsave={save} {replyTo} oncancelreply={() => (replyTo = null)} />
			{/if}

			<Story story={view} subject={recueil.manifest.subject} {urls} {names} {entryActions} />
		{/if}
	{/if}
</main>

{#snippet entryActions(entry)}
	{#if pack?.entries.has(entry.id)}<span class="badge">Pas encore envoyé</span>{/if}
	{#if role === 'creator' || role === 'contributor'}
		<button class="small secondary" onclick={() => { replyTo = entry; scrollTo({ top: 0, behavior: 'smooth' }); }}>
			Compléter ce souvenir
		</button>
	{/if}
	{#if canDelete(entry)}
		<button class="small secondary" onclick={() => remove(entry)}>Supprimer</button>
	{/if}
{/snippet}

<style>
	:global(body) {
		margin: 0;
		background: #f7f4ef;
		color: #2b2724;
		font: 18px/1.6 Georgia, 'Times New Roman', serif;
	}
	main { max-width: 680px; margin: 0 auto; padding: 24px 16px 64px; }
	h1 { font-size: 2rem; margin: 0 0 4px; }
	.lead { color: #6b625a; margin: 0; }
	.card { background: #fff; border: 1px solid #e6dfd5; border-radius: 12px; padding: 20px; margin: 16px 0; }
	form { display: grid; gap: 14px; }
	label { display: grid; gap: 4px; font-weight: 600; }
	.hint { font-weight: 400; color: #8a8076; font-size: 0.9rem; }
	input {
		font: inherit;
		font-weight: 400;
		padding: 10px 12px;
		border: 1px solid #cfc6ba;
		border-radius: 8px;
		background: #fffdfa;
	}
	button, .button {
		display: inline-block;
		font: inherit;
		font-weight: 600;
		padding: 12px 20px;
		border: 0;
		border-radius: 8px;
		background: #5b4636;
		color: #fff;
		cursor: pointer;
	}
	button:disabled { opacity: 0.6; cursor: not-allowed; }
	.secondary { background: #e6dfd5; color: #2b2724; }
	.small { padding: 8px 14px; font-size: 0.95rem; }
	.actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; align-items: center; }
	.choices { display: grid; gap: 12px; margin-bottom: 24px; }
	.file input { font-size: 1rem; }
	.badge { background: #f3e3c3; color: #7a5200; border-radius: 999px; padding: 4px 12px; font-size: 0.85rem; }
	.error { color: #9b2c2c; font-weight: 600; }
	.warning { color: #8a5a00; }
	.notice { background: #e4efe0; color: #2f5a26; padding: 12px 16px; border-radius: 8px; }
</style>
