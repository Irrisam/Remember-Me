<script>
	import { untrack } from 'svelte';

	/**
	 * Modifier les infos du recueil (créateur). onsave peut lever une erreur, affichée ici.
	 * children : section « Accès propriétaire », sous le formulaire.
	 * @type {{ manifest: any, onsave: (info: any) => void, oncancel: () => void, children?: import('svelte').Snippet }}
	 */
	let { manifest, onsave, oncancel, children } = $props();

	// Lu une seule fois : le parent recrée ce panneau à chaque ouverture.
	let form = $state(
		untrack(() => ({
			title: manifest.title,
			subjectName: manifest.subject?.name ?? '',
			birthDate: manifest.subject?.birthDate ?? '',
			creatorName: manifest.authors.find((a) => a.id === manifest.creatorId).name
		}))
	);
	let error = $state('');

	function submit(e) {
		e.preventDefault();
		error = '';
		try {
			onsave({
				title: form.title.trim(),
				subjectName: form.subjectName.trim(),
				subjectBirthDate: form.subjectName.trim() ? form.birthDate.trim() : '',
				creatorName: form.creatorName.trim()
			});
		} catch (err) {
			error = err.message;
		}
	}
</script>

<section class="card settings" aria-labelledby="settings-title">
	<h2 id="settings-title">Modifier le recueil</h2>
	<form class="stack" onsubmit={submit}>
		<label class="field">Titre du recueil
			<input class="input" bind:value={form.title} required maxlength="200" />
		</label>
		<label class="field">De qui parle-t-il ? <span class="hint">(facultatif)</span>
			<input class="input" bind:value={form.subjectName} maxlength="200" placeholder="Jeanne Martin" />
		</label>
		{#if form.subjectName.trim()}
			<label class="field">Sa date de naissance <span class="hint">(facultatif : 1941, 1941-03 ou 1941-03-12)</span>
				<input class="input" bind:value={form.birthDate} inputmode="numeric" placeholder="1941" />
			</label>
		{/if}
		<label class="field">Votre prénom
			<input class="input" bind:value={form.creatorName} required maxlength="120" />
		</label>
		{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}
		<div class="btn-row">
			<button class="btn" type="submit">Enregistrer les modifications</button>
			<button class="btn btn-secondary" type="button" onclick={oncancel}>Fermer</button>
		</div>
	</form>
	{@render children?.()}
</section>

<style>
	.settings { margin: 16px 0 32px; max-width: 720px; }
</style>
