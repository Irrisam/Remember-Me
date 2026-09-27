<script>
	import { goto } from '$app/navigation';
	import {
		editRecueil,
		addEntry,
		editEntry,
		deleteEntry,
		exportRmbr,
		exportRmbrc,
		readRmbrc,
		MAIL_LIMIT
	} from '$lib/rmbr/archive.js';
	import { reviewPack, mergePack } from '$lib/rmbr/merge.js';
	import { story } from '$lib/rmbr/story.js';
	import { formatDate } from '$lib/rmbr/timeline.js';
	import { uuidv7 } from '$lib/rmbr/ids.js';
	import { objectUrls, revokeAll } from '$lib/media-urls.js';
	import { unlockOwnerKey } from '$lib/rmbr/owner-key.js';
	import { session, slug, rememberOwner } from '$lib/session.svelte.js';
	import OwnerAccess from '$lib/components/OwnerAccess.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import EntryForm from '$lib/components/EntryForm.svelte';
	import Story from '$lib/components/Story.svelte';
	import Moderation from '$lib/components/Moderation.svelte';
	import RecueilSettings from '$lib/components/RecueilSettings.svelte';

	/** Panneau ouvert sous l'en-tête : formulaire, modération ou réglages. Un seul à la fois. */
	let panel = $state(null);
	/** Contribution en cours d'examen (creator). */
	let review = $state.raw(null);
	let replyTo = $state.raw(null);
	/** Souvenir en cours de modification. */
	let editTarget = $state.raw(null);
	let notice = $state('');
	let error = $state('');
	let newcomer = $state({ name: '', relation: '' });
	/** « Je suis le propriétaire » sur un recueil protégé : on demande le mot de passe. */
	let unlocking = $state(false);
	let unlockPassword = $state('');
	let unlockError = $state('');
	let unlockBusy = $state(false);

	const recueil = $derived(session.recueil);
	const role = $derived(session.role);
	const me = $derived(session.me);
	const pack = $derived(session.pack);
	const creator = $derived(recueil?.manifest.authors.find((a) => a.id === recueil.manifest.creatorId));
	const contributors = $derived(recueil?.manifest.authors.filter((a) => a.role === 'contributor') ?? []);
	const subject = $derived(recueil?.manifest.subject);
	/**
	 * Ce qu'on affiche : le recueil, plus le pack en préparation pour un proche.
	 * Toujours une nouvelle Map : les entrées sont ajoutées sur place, la même référence ne déclencherait rien.
	 */
	const shown = $derived(recueil && new Map(pack ? [...recueil.entries, ...pack.entries] : recueil.entries));
	const view = $derived(shown ? story(shown, recueil.manifest) : null);
	const names = $derived(new Map([...(recueil?.manifest.authors ?? []), ...(me ? [me] : [])].map((a) => [a.id, a.name])));
	const pending = $derived(pack ? pack.entries.size : 0);
	const count = $derived(view ? view.periods.reduce((n, p) => n + p.threads.length, 0) + view.undated.length : 0);
	const canWrite = $derived(role === 'creator' || role === 'contributor');
	const ownerKey = $derived(recueil?.manifest.ownerKey);

	let urls = $state.raw(new Map());
	$effect(() => {
		if (!shown) return;
		const media = pack ? new Map([...recueil.media, ...pack.media]) : recueil.media;
		const u = objectUrls(shown.values(), media);
		urls = u;
		return () => revokeAll(u);
	});

	function show(next) {
		panel = next;
		error = '';
		if (next !== 'review') review = null;
		if (next === null) replyTo = editTarget = null;
	}

	function chooseOwner() {
		if (!ownerKey) return session.become('creator', creator);
		unlocking = true;
		unlockError = '';
	}

	async function unlock(e) {
		e.preventDefault();
		unlockError = '';
		unlockBusy = true;
		try {
			const signer = await unlockOwnerKey(ownerKey, unlockPassword, creator.publicKey.keyId);
			session.become('creator', creator, signer);
			unlocking = false;
		} catch (err) {
			unlockError = err.message;
		} finally {
			unlockPassword = '';
			unlockBusy = false;
		}
	}

	/** Recueil protégé à l'instant, ou mot de passe changé. */
	function saveOwner(next, signer) {
		session.recueil = next;
		if (signer) session.signer = signer;
		rememberOwner(next);
		session.dirty = true;
		show(null);
		notice = signer
			? 'Recueil protégé. Enregistrez le fichier : c’est cette version, protégée, qu’il faut envoyer.'
			: 'Mot de passe changé. Enregistrez le fichier pour garder ce changement.';
	}

	function joinAsNewcomer(e) {
		e.preventDefault();
		session.become('contributor', { id: uuidv7(), name: newcomer.name.trim(), relation: newcomer.relation.trim() || undefined });
	}

	async function save(input) {
		notice = '';
		// Médias gardés lors d'une modification : on joint leurs octets (recueil ou pack).
		const media = input.media.map((m) => (m.keep ? { ...m, bytes: pack?.media.get(m.keep.path) ?? recueil.media.get(m.keep.path) } : m));
		const data = { ...input, media };
		let entry;
		if (editTarget) {
			entry = await applyEdit(editTarget, data);
			notice = 'Souvenir modifié.';
		} else if (role === 'creator') {
			entry = await addEntry(recueil, { ...data, authorId: me.id }, session.signer);
		} else {
			entry = await addEntry(pack, { ...data, authorId: me.id });
		}
		session.recueil = { ...session.recueil };
		if (pack) session.pack = { ...session.pack };
		session.dirty = true;
		show(null);
		focusEntry(entry);
	}

	/**
	 * Créateur : correction + suppression de l'ancienne version, signées.
	 * Proche : un souvenir pas encore envoyé est simplement remplacé dans le pack ;
	 * un souvenir déjà dans le recueil est corrigé via le pack.
	 */
	async function applyEdit(original, data) {
		if (role === 'creator') return editEntry(recueil, original, data, session.signer);
		if (pack.entries.has(original.id)) {
			dropFromPack(original);
			return addEntry(pack, { ...data, authorId: me.id, replyTo: original.replyTo, prompt: original.prompt });
		}
		return editEntry(pack, original, data);
	}

	function edit(entry) {
		show('entry');
		editTarget = entry;
		scrollTo({ top: 0 });
	}

	function canEdit(entry) {
		return canWrite && entry.type !== 'tombstone' && entry.authorId === me.id;
	}

	function dropFromPack(entry) {
		pack.entries.delete(entry.id);
		pack.manifest.entries = pack.manifest.entries.filter((r) => r.id !== entry.id);
		for (const item of entry.media ?? []) pack.media.delete(item.path);
	}

	/** Amène le nouveau souvenir à l'écran, pour qu'on voie qu'il a bien été ajouté. */
	function focusEntry(entry) {
		requestAnimationFrame(() => document.getElementById(`souvenir-${entry.id}`)?.scrollIntoView({ block: 'center' }));
	}

	function reply(entry) {
		show('entry');
		replyTo = entry;
		scrollTo({ top: 0 });
	}

	function canDelete(entry) {
		return role === 'creator' || (role === 'contributor' && entry.authorId === me.id);
	}

	async function remove(entry) {
		if (!confirm(`Supprimer « ${entry.title ?? 'ce souvenir'} » ? Il sera retiré du recueil.`)) return;
		if (role === 'creator') {
			await deleteEntry(recueil, entry.id, me.id, session.signer);
			session.recueil = { ...recueil };
		} else if (pack.entries.has(entry.id)) {
			// Pas encore envoyé : on le retire simplement du pack.
			dropFromPack(entry);
			session.pack = { ...pack };
		} else {
			await deleteEntry(pack, entry.id, me.id);
			session.pack = { ...pack };
		}
		session.dirty = true;
	}

	function download(bytes, name) {
		session.warnings = bytes.length > MAIL_LIMIT ? ['Ce fichier dépasse 25 Mo : il risque d’être refusé en pièce jointe de mail. Passez plutôt par une clé USB ou un service de transfert.'] : [];
		const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
		session.dirty = false;
	}

	function saveRecueil() {
		download(exportRmbr(recueil), `${slug(recueil.manifest.title)}.rmbr`);
		notice = 'Recueil enregistré dans vos téléchargements. Envoyez ce fichier à vos proches, et gardez-en une copie en lieu sûr.';
	}

	function sendPack() {
		download(exportRmbrc(pack), `contribution-${slug(me.name)}-${new Date().toISOString().slice(0, 10)}.rmbrc`);
		notice = `Contribution enregistrée dans vos téléchargements. Envoyez ce fichier à ${creator.name}, par mail par exemple.`;
	}

	async function importPack(e) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		notice = error = '';
		try {
			const res = await readRmbrc(new Uint8Array(await file.arrayBuffer()));
			const items = await reviewPack(recueil, res.pack);
			show('review');
			review = { pack: res.pack, items };
			session.warnings = res.warnings;
		} catch (err) {
			error = err.message;
		}
	}

	function merge(accepted) {
		session.recueil = mergePack(recueil, review.pack, review.items, accepted);
		session.dirty = true;
		show(null);
		notice = `${accepted.size} souvenir${accepted.size > 1 ? 's ajoutés' : ' ajouté'}. Enregistrez le recueil, puis renvoyez-le à tout le monde.`;
	}

	/** Lève une erreur si les infos sont invalides : RecueilSettings l'affiche. */
	function saveSettings(info) {
		session.recueil = editRecueil(recueil, info);
		session.me = session.recueil.manifest.authors.find((a) => a.id === me.id);
		session.dirty = true;
		show(null);
		notice = 'Recueil modifié.';
	}

	function close() {
		if (session.dirty && !confirm('Des changements ne sont pas enregistrés dans un fichier. Fermer quand même ?')) return;
		session.close();
		goto('/');
	}
</script>

<svelte:head>
	<title>{recueil ? `${recueil.manifest.title} · Remember Me` : 'Recueil · Remember Me'}</title>
</svelte:head>

<div class="container workspace">
	{#if !recueil}
		<section class="card empty">
			<h1>Aucun recueil ouvert</h1>
			<p class="lead">Commencez un nouveau recueil, ou ouvrez le fichier .rmbr qu'un proche vous a envoyé.</p>
			<div class="btn-row">
				<a class="btn" href="/creer">Commencer un recueil</a>
				<a class="btn btn-secondary" href="/">Retour à l'accueil</a>
			</div>
		</section>
	{:else}
		<header class="hero">
			<p class="eyebrow">Recueil de souvenirs</p>
			<h1>{recueil.manifest.title}</h1>
			{#if subject}
				<p class="lead">
					{subject.name}{#if subject.birthDate}<span class="dot-sep">·</span>naissance : {formatDate({ value: subject.birthDate })}{/if}
				</p>
			{/if}
			{#if me}
				<p class="hint who">
					Vous êtes <strong>{me.name}</strong>{role === 'creator' ? ' : vous avez créé ce recueil' : ' : vous ajoutez vos souvenirs'}.
					{#if count}{count} souvenir{count > 1 ? 's' : ''}.{/if}
				</p>
			{/if}

			{#if role}
				<div class="btn-row toolbar">
					{#if canWrite}
						<button class="btn" onclick={() => { replyTo = null; show(panel === 'entry' ? null : 'entry'); }} aria-expanded={panel === 'entry'}>
							＋ Ajouter un souvenir
						</button>
					{/if}
					{#if role === 'creator'}
						<button class="btn btn-secondary" onclick={saveRecueil}>Enregistrer le fichier</button>
						<label class="btn btn-secondary">
							Importer une contribution
							<input class="visually-hidden" type="file" accept=".rmbrc" onchange={importPack} />
						</label>
						<button class="btn btn-ghost" onclick={() => show(panel === 'settings' ? null : 'settings')} aria-expanded={panel === 'settings'}>
							Modifier le recueil
						</button>
					{:else if role === 'contributor'}
						<button class="btn btn-secondary" onclick={sendPack} disabled={!pending}>
							Envoyer ma contribution{pending ? ` (${pending})` : ''}
						</button>
					{/if}
					<button class="btn btn-ghost" onclick={close}>Fermer</button>
				</div>
			{/if}
		</header>

		<div class="messages" aria-live="polite">
			{#if session.dirty && role === 'creator' && count}
				<p class="msg msg-warning">
					Des changements ne sont pas encore enregistrés dans votre fichier.
					<button class="linklike" onclick={saveRecueil}>Enregistrer maintenant</button>
				</p>
			{/if}
			{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}
			{#if notice}<p class="msg msg-success">{notice}</p>{/if}
			{#each session.warnings as w}<p class="msg msg-warning">{w}</p>{/each}
			{#if role === 'creator' && !ownerKey && panel !== 'settings'}
				<p class="msg protect-tip">
					🔒 Ce recueil n'est pas protégé : toute personne qui reçoit le fichier peut se présenter comme vous.
					<button class="linklike" onclick={() => show('settings')}>Le protéger par un mot de passe</button>
				</p>
			{/if}
		</div>

		{#if role === null && unlocking}
			<section class="card who-card unlock">
				<h2>Bonjour {creator.name}</h2>
				<p>Ce recueil est protégé. Entrez votre mot de passe pour le modifier en tant que propriétaire.</p>
				<form class="stack" onsubmit={unlock}>
					<PasswordField bind:value={unlockPassword} label="Mot de passe" required />
					{#if ownerKey.hint}<p class="hint">Votre indice : « {ownerKey.hint} »</p>{/if}
					{#if unlockError}<p class="msg msg-error" role="alert">{unlockError}</p>{/if}
					<div class="btn-row">
						<button class="btn" type="submit" disabled={unlockBusy}>{unlockBusy ? 'Vérification…' : 'Ouvrir en propriétaire'}</button>
						<button class="btn btn-ghost" type="button" onclick={() => (unlocking = false)}>Retour</button>
					</div>
				</form>
				<p class="hint forgot">
					Mot de passe oublié ? Il ne peut pas être récupéré. Vous pouvez toujours lire le recueil, ou y ajouter des
					souvenirs comme un proche.
				</p>
			</section>
		{:else if role === null}
			<section class="card who-card">
				<h2>Qui êtes-vous ?</h2>
				<p class="hint">Cela permet d'afficher votre nom à côté de vos souvenirs.</p>
				<div class="choices">
					<button class="choice" onclick={chooseOwner}>
						<strong>Je suis {creator.name}</strong>
						<span>J'ai créé ce recueil{ownerKey ? ' · mot de passe demandé' : ''}</span>
					</button>
					{#each contributors as author (author.id)}
						<button class="choice" onclick={() => session.become('contributor', author)}>
							<strong>Je suis {author.name}</strong>
							<span>{author.relation ?? 'J’ai déjà ajouté des souvenirs'}</span>
						</button>
					{/each}
					<button class="choice" onclick={() => session.become('reader', null)}>
						<strong>Je veux seulement le lire</strong>
						<span>Sans rien ajouter</span>
					</button>
				</div>
				<form class="stack newcomer" onsubmit={joinAsNewcomer}>
					<h3>Je suis un proche et je veux ajouter mes souvenirs</h3>
					<label class="field">Votre prénom
						<input class="input" bind:value={newcomer.name} required maxlength="120" autocomplete="given-name" placeholder="Léa" />
					</label>
					<label class="field">Votre lien avec {subject?.name ?? creator.name} <span class="hint">(facultatif)</span>
						<input class="input" bind:value={newcomer.relation} maxlength="80" placeholder="petite-fille, ami d'enfance…" />
					</label>
					<div><button class="btn" type="submit">Continuer</button></div>
				</form>
			</section>
		{:else}
			{#if panel === 'settings'}
				<RecueilSettings manifest={recueil.manifest} onsave={saveSettings} oncancel={() => show(null)}>
					<OwnerAccess {recueil} onsave={saveOwner} />
				</RecueilSettings>
			{:else if panel === 'review' && review}
				{#key review}
					<Moderation {recueil} pack={review.pack} items={review.items} onmerge={merge} oncancel={() => show(null)} />
				{/key}
			{:else if panel === 'entry'}
				{#key editTarget}
					<EntryForm onsave={save} {replyTo} {subject} initial={editTarget} {urls} oncancel={() => show(null)} />
				{/key}
			{/if}

			{#if count === 0 && panel !== 'entry'}
				<section class="panel empty-story">
					<h2>Le recueil est encore vide</h2>
					{#if canWrite}
						<p>Commencez par un souvenir, même petit : une anecdote, une photo, quelques mots enregistrés à voix haute.</p>
						<button class="btn" onclick={() => show('entry')}>＋ Ajouter un premier souvenir</button>
					{:else}
						<p>Aucun souvenir n'a encore été ajouté.</p>
					{/if}
				</section>
			{:else}
				<Story story={view} {subject} {urls} {names} {entryActions} />
			{/if}
		{/if}
	{/if}
</div>

{#snippet entryActions(entry)}
	{#if pack?.entries.has(entry.id)}<span class="badge">Pas encore envoyé</span>{/if}
	{#if canWrite}
		<button class="btn btn-ghost btn-sm" onclick={() => reply(entry)}>Compléter ce souvenir</button>
	{/if}
	{#if canEdit(entry)}
		<button class="btn btn-ghost btn-sm" onclick={() => edit(entry)}>Modifier</button>
	{/if}
	{#if canDelete(entry)}
		<button class="btn btn-ghost btn-sm" onclick={() => remove(entry)}>Supprimer</button>
	{/if}
{/snippet}

<style>
	.workspace {
		max-width: 1040px;
	}
	.hero {
		padding: 24px 0 8px;
	}
	.dot-sep {
		margin: 0 0.5em;
		color: var(--line-strong);
	}
	.who {
		margin-top: -8px;
	}
	.toolbar {
		margin-top: 20px;
	}
	/* Sur téléphone : boutons pleine largeur, les actions secondaires regroupées en bas. */
	@media (max-width: 560px) {
		.toolbar {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.toolbar > :not(.btn-ghost) {
			grid-column: 1 / -1;
			width: 100%;
		}
		.toolbar > .btn-ghost {
			white-space: nowrap;
			padding-inline: 8px;
		}
	}
	.messages {
		display: grid;
		gap: 10px;
		margin: 16px 0;
	}
	.messages:empty {
		display: none;
	}
	.linklike {
		font: inherit;
		font-weight: 600;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		text-decoration: underline;
		cursor: pointer;
	}
	.empty {
		margin-top: 32px;
	}
	.who-card {
		margin-top: 16px;
	}
	.choices {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		margin: 20px 0 32px;
	}
	.choice {
		display: grid;
		gap: 2px;
		text-align: left;
		padding: 16px 18px;
		min-height: 72px;
		background: var(--card);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		font: inherit;
		color: var(--ink);
		cursor: pointer;
		transition: border-color 0.15s, background-color 0.15s;
	}
	.choice:hover {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.choice strong {
		font-family: var(--font-display);
		font-size: 1.1rem;
	}
	.choice span {
		color: var(--ink-faint);
		font-size: 0.95rem;
	}
	.unlock {
		max-width: 560px;
	}
	.unlock .hint {
		margin: 0;
	}
	.forgot {
		margin-top: 20px !important;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.protect-tip {
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
	.newcomer {
		border-top: 1px solid var(--line);
		padding-top: 24px;
		max-width: 480px;
	}
	.newcomer h3 {
		margin: 0;
	}
	.empty-story {
		margin-top: 24px;
		text-align: center;
	}
</style>
