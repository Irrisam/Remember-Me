<script>
	import { goto } from '$app/navigation';
	import { session } from '$lib/session.svelte.js';

	let error = $state('');

	async function open(e) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		error = '';
		try {
			await session.open(file);
			goto('/recueil');
		} catch (err) {
			error = err.message;
		}
	}

	const steps = [
		{ n: '1', title: 'Vous racontez', text: 'Écrivez vos souvenirs, ajoutez des photos, enregistrez votre voix ou une courte vidéo. À votre rythme, un souvenir à la fois.' },
		{ n: '2', title: 'Vous offrez', text: 'Tout tient dans un seul fichier. Envoyez-le par mail, sur une clé USB, ou gardez-le précieusement pour plus tard.' },
		{ n: '3', title: 'Ils complètent', text: 'Vos proches le lisent, même sans internet, et vous renvoient leurs propres souvenirs. Vous choisissez ce que vous gardez.' }
	];

	const pillars = [
		{ icon: '🔒', title: 'Chez vous, pas chez nous', text: 'Aucun compte, aucun serveur. Vos souvenirs ne quittent votre ordinateur que dans le fichier que vous envoyez.' },
		{ icon: '♾️', title: 'Lisible dans 30 ans', text: 'Chaque recueil contient sa propre page de lecture. Il reste lisible même si Remember Me disparaît un jour.' },
		{ icon: '👨‍👩‍👧', title: 'À plusieurs voix', text: 'Enfants, petits-enfants, amis : chacun peut ajouter sa version d’un souvenir.' },
		{ icon: '🫶', title: 'Fait de son vivant', text: 'Pour transmettre ce qui compte, et épargner à ses proches la recherche de souvenirs éparpillés.' }
	];

	const faq = [
		{ q: 'Où sont stockés mes souvenirs ?', a: 'Nulle part ailleurs que chez vous. Tout se passe dans votre navigateur, et le recueil n’existe que dans le fichier .rmbr que vous enregistrez. Pensez à en garder une copie : sans compte, il n’y a pas de sauvegarde automatique.' },
		{ q: 'Mes proches doivent-ils installer quelque chose ?', a: 'Non. Ils ouvrent le fichier sur ce site, ou, sans connexion, ils le décompressent et ouvrent la page de lecture qu’il contient. Aucune inscription n’est nécessaire.' },
		{ q: 'Que se passe-t-il si Remember Me disparaît ?', a: 'Votre recueil reste lisible. Le fichier est un format ouvert (une archive ZIP) qui contient les textes, les photos, les sons et une page de lecture autonome.' },
		{ q: 'Quelle taille peut faire un recueil ?', a: 'Les photos et les vidéos sont allégées automatiquement. Au-delà de 25 Mo, un recueil passe mal en pièce jointe : l’application vous prévient, et une clé USB ou un service de transfert prennent le relais.' },
		{ q: 'Est-ce un testament ?', a: 'Non. Remember Me sert à transmettre des souvenirs. Il n’a aucune valeur juridique et ne remplace pas les démarches auprès d’un notaire.' }
	];
</script>

<svelte:head>
	<title>Remember Me · Vos souvenirs, pour ceux que vous aimez</title>
	<meta
		name="description"
		content="Rassemblez vos souvenirs, textes, photos, voix et vidéos, dans un seul fichier à offrir à vos proches. Sans compte, sans serveur, lisible même hors ligne."
	/>
</svelte:head>

<section class="hero">
	<div class="hero-inner">
		<div class="pitch">
			<p class="eyebrow">Recueil de souvenirs</p>
			<h1>Racontez votre histoire, pour ceux que vous aimez.</h1>
			<p class="lead">
				Rassemblez vos souvenirs (textes, photos, voix, vidéos) dans un seul fichier à offrir à vos proches.
				Ils pourront le lire, même sans internet, et y ajouter les leurs.
			</p>
			<div class="btn-row">
				<a class="btn btn-lg" href="/creer">Commencer un recueil</a>
				<label class="btn btn-secondary btn-lg">
					Ouvrir un fichier reçu
					<input class="visually-hidden" type="file" accept=".rmbr" onchange={open} />
				</label>
			</div>
			{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}
			<p class="hint">Sans compte · Sans installation · Rien n’est stocké sur nos serveurs</p>
		</div>

		<div class="preview" aria-hidden="true">
			<div class="mini-frise">
				{#each [['1940', 1], ['1950', 3], ['1960', 2], ['1970', 1]] as [y, n]}
					<span class="mini-stop"><i style:--s="{8 + n * 4}px"></i>{y}</span>
				{/each}
			</div>
			<div class="mini-card">
				<p class="mini-date">14 juillet 1959 <span>Jeanne avait 18 ans</span></p>
				<p class="mini-title">Le bal du 14 juillet</p>
				<div class="mini-photo"></div>
				<p class="mini-text">C’est là que j’ai rencontré votre grand-père. Il m’a marché sur les pieds toute la soirée.</p>
				<div class="mini-reply">
					<p class="mini-by">Léa a complété :</p>
					<p class="mini-text">Papi dit que c’est Mamie qui lui marchait sur les pieds…</p>
				</div>
			</div>
		</div>
	</div>
</section>

<section class="band" id="comment">
	<div class="container wide">
		<p class="eyebrow">Comment ça marche</p>
		<h2>Trois étapes, sans rien installer</h2>
		<ol class="steps">
			{#each steps as s}
				<li>
					<span class="step-num">{s.n}</span>
					<h3>{s.title}</h3>
					<p>{s.text}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="container wide pillars-section">
	<p class="eyebrow">Nos engagements</p>
	<h2>Un recueil qui vous appartient vraiment</h2>
	<div class="pillars">
		{#each pillars as p}
			<article class="card pillar">
				<span class="pillar-icon" aria-hidden="true">{p.icon}</span>
				<h3>{p.title}</h3>
				<p>{p.text}</p>
			</article>
		{/each}
	</div>
</section>

<section class="container wide faq-section">
	<p class="eyebrow">Questions fréquentes</p>
	<h2>Bon à savoir</h2>
	<div class="faq">
		{#each faq as item}
			<details>
				<summary>{item.q}</summary>
				<p>{item.a}</p>
			</details>
		{/each}
	</div>
</section>

<section class="container wide cta">
	<div class="panel cta-panel">
		<h2>Le meilleur moment pour commencer, c’est aujourd’hui.</h2>
		<p class="lead">Un premier souvenir prend cinq minutes.</p>
		<a class="btn btn-lg" href="/creer">Commencer un recueil</a>
	</div>
</section>

<style>
	.wide {
		max-width: 1080px;
	}
	.hero {
		padding: 32px 0 72px;
	}
	.hero-inner {
		max-width: 1080px;
		margin: 0 auto;
		padding: 0 var(--gutter);
		display: grid;
		grid-template-columns: 1.25fr 1fr;
		gap: 48px;
		align-items: center;
	}
	.pitch h1 {
		font-size: clamp(2.3rem, 5.5vw, 3.6rem);
		margin-bottom: 20px;
	}
	.pitch .btn-row {
		margin: 28px 0 16px;
	}
	.pitch .msg {
		margin-bottom: 16px;
	}

	/* Aperçu du produit, en HTML pur */
	.preview {
		position: relative;
		padding: 20px;
		background: var(--paper-deep);
		border-radius: 24px;
		transform: rotate(1.2deg);
	}
	.mini-frise {
		display: flex;
		justify-content: space-between;
		padding: 4px 12px 16px;
		background: linear-gradient(var(--line-strong), var(--line-strong)) no-repeat 0 13px / 100% 2px;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.mini-stop {
		display: grid;
		justify-items: center;
		gap: 4px;
	}
	.mini-stop i {
		width: var(--s);
		height: var(--s);
		margin: calc((20px - var(--s)) / 2) 0;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px var(--paper-deep);
	}
	.mini-card {
		background: var(--card);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 20px;
		transform: rotate(-1.2deg);
	}
	.mini-date {
		margin: 0;
		color: var(--accent);
		font-style: italic;
		font-size: 0.95rem;
	}
	.mini-date span {
		color: var(--ink-faint);
		font-style: normal;
		margin-left: 10px;
	}
	.mini-title {
		font: 600 1.35rem/1.2 var(--font-display);
		margin: 4px 0 12px;
	}
	.mini-photo {
		height: 150px;
		border-radius: var(--radius-sm);
		background:
			radial-gradient(circle at 30% 40%, rgb(255 255 255 / 0.35), transparent 40%),
			linear-gradient(135deg, #c8a27a, #8c6446 55%, #5b4636);
		filter: sepia(0.35);
		margin-bottom: 12px;
	}
	.mini-text {
		font-size: 0.98rem;
		margin: 0;
	}
	.mini-reply {
		border-left: 3px solid var(--line-strong);
		padding-left: 14px;
		margin-top: 14px;
	}
	.mini-by {
		margin: 0;
		color: var(--accent);
		font-weight: 600;
		font-size: 0.88rem;
	}

	.band {
		background: var(--paper-deep);
		padding: 72px 0;
	}
	.steps {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 32px;
		margin: 32px 0 0;
		padding: 0;
	}
	.step-num {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		font: 600 1.2rem/1 var(--font-display);
		margin-bottom: 14px;
	}
	.steps p {
		color: var(--ink-soft);
		margin: 0;
	}

	.pillars-section {
		padding-top: 80px;
	}
	.pillars {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
		gap: 20px;
		margin-top: 32px;
	}
	.pillar p {
		color: var(--ink-soft);
		margin: 0;
	}
	.pillar-icon {
		font-size: 1.8rem;
		display: block;
		margin-bottom: 10px;
	}

	.faq-section {
		padding-top: 80px;
	}
	.faq {
		max-width: 760px;
		margin-top: 24px;
		border-top: 1px solid var(--line);
	}
	details {
		border-bottom: 1px solid var(--line);
	}
	summary {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 18px 0;
		min-height: 48px;
		font: 600 1.15rem/1.35 var(--font-display);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '+';
		color: var(--accent);
		font-size: 1.5rem;
		line-height: 1;
	}
	details[open] summary::after {
		content: '–';
	}
	details p {
		color: var(--ink-soft);
		margin: 0 0 20px;
	}

	.cta {
		padding-top: 80px;
	}
	.cta-panel {
		text-align: center;
		padding: 56px 24px;
	}
	.cta-panel h2 {
		max-width: 22ch;
		margin-inline: auto;
	}

	@media (max-width: 860px) {
		.hero-inner {
			grid-template-columns: 1fr;
			gap: 40px;
		}
		.preview {
			max-width: 440px;
			justify-self: center;
			width: 100%;
		}
		.steps {
			grid-template-columns: 1fr;
			gap: 28px;
		}
	}
</style>
