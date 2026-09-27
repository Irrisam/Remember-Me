<svelte:head>
	<title>Confidentialité · Remember Me</title>
	<meta name="description" content="Comment Remember Me traite vos souvenirs : dans votre navigateur, sans compte ni serveur." />
</svelte:head>

<article class="container prose">
	<p class="eyebrow">Confidentialité</p>
	<h1>Vos souvenirs restent chez vous</h1>
	<p class="lead">
		Remember Me est conçu pour ne rien savoir de vous. Voici précisément ce qui se passe quand vous l’utilisez.
	</p>

	<h2>Ce que nous ne faisons pas</h2>
	<table>
		<tbody>
			<tr><th scope="row">Compte</th><td>Aucun. Pas d’inscription, pas d’adresse mail, pas de mot de passe.</td></tr>
			<tr><th scope="row">Stockage</th><td>Aucun souvenir n’est envoyé sur nos serveurs. Textes, photos, sons et vidéos sont traités dans votre navigateur.</td></tr>
			<tr><th scope="row">Cookies</th><td>Aucun cookie de suivi ou publicitaire.</td></tr>
			<tr><th scope="row">Revente</th><td>Nous n’avons rien à revendre : nous ne possédons aucune de vos données.</td></tr>
		</tbody>
	</table>

	<h2>Où vivent vos souvenirs</h2>
	<p>
		Tant que la page est ouverte, le recueil est en mémoire dans votre navigateur. Quand vous cliquez sur
		« Enregistrer le fichier », il est écrit dans un fichier <code>.rmbr</code> sur votre appareil. C’est le seul
		exemplaire : gardez-en une copie en lieu sûr (clé USB, disque externe, ou le stockage en ligne de votre choix).
	</p>
	<p>
		Les photos sont réencodées avant d’être ajoutées, ce qui retire leurs métadonnées cachées (position GPS,
		modèle d’appareil).
	</p>

	<h2>Les seuls échanges avec internet</h2>
	<table>
		<tbody>
			<tr>
				<th scope="row">Le site lui-même</th>
				<td>Votre navigateur télécharge les pages et les polices de Remember Me, hébergées avec le site. Une fois installée, l’application fonctionne sans connexion.</td>
			</tr>
			<tr>
				<th scope="row">L’outil vidéo</th>
				<td>
					Seulement si vous ajoutez une vidéo : l’outil de compression (ffmpeg, 32 Mo) est téléchargé depuis
					le réseau jsDelivr. Ce service voit votre adresse IP, comme pour toute page web, mais jamais votre vidéo,
					qui est compressée sur votre appareil. Le fichier téléchargé est vérifié avant d’être utilisé.
				</td>
			</tr>
		</tbody>
	</table>

	<h2>Partager un recueil</h2>
	<p>
		Quand vous envoyez un fichier par mail ou par un service de transfert, c’est ce service qui le transporte, selon
		ses propres règles. Remember Me n’intervient pas dans l’envoi.
	</p>

	<p><a class="btn btn-secondary" href="/">Retour à l’accueil</a></p>
</article>

<style>
	.prose {
		padding-top: 24px;
	}
	.prose h2 {
		margin-top: 48px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin: 16px 0 24px;
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: 14px 16px 14px 0;
		border-bottom: 1px solid var(--line);
	}
	th {
		width: 30%;
		font-family: var(--font-display);
		font-weight: 600;
	}
	code {
		background: var(--paper-deep);
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 0.95em;
	}
	@media (max-width: 560px) {
		th,
		td {
			display: block;
			width: 100%;
			padding-right: 0;
		}
		th {
			border-bottom: 0;
			padding-bottom: 0;
		}
	}
</style>
