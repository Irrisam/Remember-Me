<script>
	import { goto } from '$app/navigation';
	import { createRecueil, protectRecueil, MIN_PASSWORD } from '$lib/rmbr/archive.js';
	import { PARTIAL_DATE } from '$lib/rmbr/timeline.js';
	import { session } from '$lib/session.svelte.js';
	import PasswordField from '$lib/components/PasswordField.svelte';

	/** self : je raconte ma vie ; other : je crée pour quelqu'un. */
	let mode = $state(null);
	let step = $state(0);
	let form = $state({ subjectName: '', birthDate: '', creatorName: '', title: '' });
	let protection = $state({ password: '', confirm: '', hint: '' });
	let titleTouched = $state(false);
	let busy = $state(false);
	let error = $state('');

	const first = (name) => name.trim().split(/\s+/)[0] ?? '';
	const suggestedTitle = $derived(form.subjectName.trim() ? `Les souvenirs de ${first(form.subjectName)}` : 'Nos souvenirs');

	function choose(m) {
		mode = m;
		step = 1;
		error = '';
	}

	function next(e) {
		e.preventDefault();
		error = '';
		const birth = form.birthDate.trim();
		if (birth && !PARTIAL_DATE.test(birth)) {
			error = 'La date de naissance doit être une année (1941), un mois (1941-03) ou un jour (1941-03-12).';
			return;
		}
		if (mode === 'self' && !form.creatorName.trim()) form.creatorName = first(form.subjectName);
		if (!titleTouched) form.title = suggestedTitle;
		step = 2;
	}

	async function create(e) {
		e.preventDefault();
		error = '';
		const { password, confirm, hint } = protection;
		if (password && password !== confirm) {
			error = 'Les deux mots de passe ne sont pas identiques.';
			return;
		}
		busy = true;
		try {
			let recueil = createRecueil({
				title: form.title.trim() || suggestedTitle,
				subjectName: form.subjectName.trim(),
				subjectBirthDate: form.birthDate.trim(),
				creatorName: form.creatorName.trim()
			});
			let signer = null;
			if (password) ({ recueil, signer } = await protectRecueil(recueil, password, { hint: hint.trim() }));
			session.start(recueil, signer);
			goto('/recueil');
		} catch (err) {
			error = err.message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Commencer un recueil · Remember Me</title>
</svelte:head>

<div class="container narrow">
	<p class="eyebrow">Nouveau recueil · étape {step + 1} sur 3</p>
	<div class="progress" aria-hidden="true"><span style:width="{((step + 1) / 3) * 100}%"></span></div>

	{#if step === 0}
		<h1>Pour qui créez-vous ce recueil ?</h1>
		<p class="lead">Vous pourrez inviter vos proches à y ajouter leurs souvenirs ensuite.</p>
		<div class="choices">
			<button class="choice" onclick={() => choose('self')}>
				<span class="icon" aria-hidden="true">✍️</span>
				<strong>Pour moi</strong>
				<span>Je raconte ma vie, pour la transmettre à mes proches.</span>
			</button>
			<button class="choice" onclick={() => choose('other')}>
				<span class="icon" aria-hidden="true">🤝</span>
				<strong>Pour un proche</strong>
				<span>Je rassemble les souvenirs d'un parent, d'un grand-parent, d'un ami.</span>
			</button>
		</div>
	{:else if step === 1}
		<h1>{mode === 'self' ? 'Présentez-vous' : 'De qui parle ce recueil ?'}</h1>
		<p class="lead">
			{mode === 'self'
				? 'Votre nom figurera en tête du recueil.'
				: 'Son nom figurera en tête du recueil. Vous pourrez le changer plus tard.'}
		</p>
		<form class="card stack" onsubmit={next}>
			<label class="field">{mode === 'self' ? 'Votre nom' : 'Son nom'}
				<input class="input" bind:value={form.subjectName} required maxlength="200" autocomplete={mode === 'self' ? 'name' : 'off'} placeholder="Jeanne Martin" />
			</label>
			<label class="field">
				{mode === 'self' ? 'Votre date de naissance' : 'Sa date de naissance'} <span class="hint">(facultatif)</span>
				<span class="hint">L'année suffit : 1941. Elle permet d'indiquer l'âge à chaque souvenir.</span>
				<input class="input" bind:value={form.birthDate} inputmode="numeric" placeholder="1941 ou 1941-03-12" />
			</label>
			{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}
			<div class="btn-row">
				<button class="btn" type="submit">Continuer</button>
				<button class="btn btn-ghost" type="button" onclick={() => (step = 0)}>Retour</button>
			</div>
		</form>
	{:else}
		<h1>Dernière étape</h1>
		<p class="lead">Donnez un titre au recueil. Il apparaîtra sur le fichier que vous enverrez.</p>
		<form class="card stack" onsubmit={create}>
			<label class="field">Titre du recueil
				<input class="input" bind:value={form.title} oninput={() => (titleTouched = true)} required maxlength="200" />
			</label>
			<label class="field">
				{mode === 'self' ? 'Le prénom qui signera vos souvenirs' : 'Votre prénom'}
				<span class="hint">Il s'affiche à côté de chaque souvenir que vous ajoutez.</span>
				<input class="input" bind:value={form.creatorName} required maxlength="120" autocomplete="given-name" placeholder="Léa" />
			</label>

			<fieldset class="protect">
				<legend>🔒 Protéger votre accès de propriétaire <span class="tag">conseillé</span></legend>
				<p class="hint">
					Toute personne qui reçoit le fichier peut lire le recueil et proposer ses souvenirs. Avec un mot de
					passe, vous serez la seule personne à pouvoir choisir ce qui y entre, retirer un souvenir ou modifier le recueil.
				</p>
				<div class="pw-grid">
					<PasswordField bind:value={protection.password} label="Mot de passe" hint="{MIN_PASSWORD} caractères au moins. Une phrase facile à retenir fonctionne bien." autocomplete="new-password" />
					<PasswordField bind:value={protection.confirm} label="Retapez-le" autocomplete="new-password" />
				</div>
				{#if protection.password}
					<label class="field">Un indice pour vous en souvenir <span class="hint">(facultatif, visible par tous)</span>
						<input class="input" bind:value={protection.hint} maxlength="200" placeholder="le prénom de mon premier chien" />
					</label>
					<p class="msg msg-warning">
						Notez-le en lieu sûr : s'il est oublié, personne ne pourra le retrouver. Le recueil restera lisible,
						mais plus personne ne pourra le modifier en votre nom.
					</p>
				{:else}
					<p class="hint">Laissez vide pour ne pas protéger le recueil. Vous pourrez le faire plus tard.</p>
				{/if}
			</fieldset>

			{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}
			<div class="btn-row">
				<button class="btn btn-lg" type="submit" disabled={busy}>{busy ? 'Protection en cours…' : 'Créer le recueil'}</button>
				<button class="btn btn-ghost" type="button" onclick={() => (step = 1)}>Retour</button>
			</div>
		</form>
		<p class="hint reassure">
			Rien n'est envoyé sur internet : le recueil reste dans votre navigateur jusqu'à ce que vous l'enregistriez
			dans un fichier.
		</p>
	{/if}
</div>

<style>
	.narrow {
		max-width: 640px;
		padding-top: 24px;
	}
	.progress {
		height: 6px;
		border-radius: 999px;
		background: var(--paper-deep);
		margin: 0 0 32px;
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: inherit;
		transition: width 0.3s;
	}
	.choices {
		display: grid;
		gap: 16px;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		margin-top: 24px;
	}
	.choice {
		display: grid;
		align-content: start;
		gap: 6px;
		text-align: left;
		padding: 24px;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		font: inherit;
		color: var(--ink);
		cursor: pointer;
		transition: border-color 0.15s, transform 0.15s;
	}
	.choice:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
	}
	.choice strong {
		font: 600 1.4rem/1.2 var(--font-display);
	}
	.choice span:not(.icon) {
		color: var(--ink-soft);
	}
	.icon {
		font-size: 2rem;
	}
	form {
		margin-top: 24px;
	}
	.reassure {
		margin-top: 20px;
	}
	.protect {
		display: grid;
		gap: 16px;
		margin: 8px 0 0;
		padding: 20px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper);
	}
	.protect legend {
		padding: 0 8px;
		margin-left: -8px;
		font: 600 1.15rem/1.3 var(--font-display);
	}
	.protect .hint,
	.protect .msg {
		margin: 0;
	}
	.tag {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 10px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-strong);
		font: 600 0.8rem/1.6 var(--font-text);
		vertical-align: middle;
	}
	.pw-grid {
		display: grid;
		gap: 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		align-items: end;
	}
</style>
