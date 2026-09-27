<script>
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Page introuvable · Remember Me</title>
</svelte:head>

<div class="container">
	<section class="card oops">
		<p class="eyebrow">Erreur {page.status}</p>
		<h1>{page.status === 404 ? 'Cette page n’existe pas' : 'Quelque chose s’est mal passé'}</h1>
		<p class="lead">
			{page.status === 404
				? 'Le lien est peut-être incomplet. Vos recueils, eux, sont en sécurité dans vos fichiers.'
				: 'Rechargez la page. Si un recueil était ouvert, rouvrez votre dernier fichier enregistré.'}
		</p>
		<a class="btn" href="/">Retour à l’accueil</a>
	</section>
</div>

<style>
	.oops {
		margin-top: 32px;
	}
</style>
