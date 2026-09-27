<script>
	import '@fontsource-variable/fraunces';
	import '@fontsource-variable/source-serif-4';
	import '../app.css';
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
	import { session } from '$lib/session.svelte.js';

	let { children } = $props();

	// Fichier unique, pas de compte : on prévient avant de fermer l'onglet avec des changements non enregistrés.
	$effect(() => {
		if (!session.dirty) return;
		const guard = (e) => e.preventDefault();
		window.addEventListener('beforeunload', guard);
		return () => window.removeEventListener('beforeunload', guard);
	});
</script>

<a class="skip visually-hidden" href="#contenu">Aller au contenu</a>

<header class="site-header">
	<div class="bar">
		<a class="brand" href="/" aria-label="Remember Me, accueil">
			<Logo size={34} />
			<span>Remember Me</span>
		</a>
		{#if session.recueil && page.url.pathname !== '/recueil'}
			<a class="btn btn-secondary btn-sm resume" href="/recueil">
				Reprendre <span class="resume-title">« {session.recueil.manifest.title} »</span>
			</a>
		{/if}
	</div>
</header>

<main id="contenu">
	{@render children()}
</main>

<footer class="site-footer">
	<div class="bar">
		<p>
			Vos souvenirs restent chez vous : Remember Me ne stocke rien sur ses serveurs.
			<br />Remember Me n’est pas un testament et n’a pas de valeur juridique.
		</p>
		<nav aria-label="Liens utiles">
			<a href="/#comment">Comment ça marche</a>
			<a href="/confidentialite">Confidentialité</a>
		</nav>
	</div>
</footer>

<style>
	.skip:focus {
		position: fixed;
		top: 8px;
		left: 8px;
		width: auto;
		height: auto;
		clip: auto;
		z-index: 10;
		padding: 8px 16px;
		background: var(--card);
		border-radius: var(--radius-sm);
	}
	.bar {
		max-width: 1080px;
		margin: 0 auto;
		padding: 0 var(--gutter);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.site-header {
		padding: 18px 0;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font: 600 1.3rem/1 var(--font-display);
		color: var(--ink);
		text-decoration: none;
	}
	.resume {
		max-width: 100%;
	}
	.resume-title {
		max-width: 22ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	main {
		min-height: 60vh;
	}
	.site-footer {
		margin-top: 96px;
		padding: 32px 0 40px;
		border-top: 1px solid var(--line);
		color: var(--ink-faint);
		font-size: 0.95rem;
	}
	.site-footer p {
		margin: 0;
	}
	.site-footer nav {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
	}
	.site-footer a {
		color: var(--ink-soft);
	}
</style>
