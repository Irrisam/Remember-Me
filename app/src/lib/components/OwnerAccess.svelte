<script>
	import { untrack } from 'svelte';
	import { protectRecueil, changeOwnerPassword, MIN_PASSWORD } from '$lib/rmbr/archive.js';
	import PasswordField from './PasswordField.svelte';

	/**
	 * Accès propriétaire : protéger un recueil qui ne l'est pas, ou changer de mot de passe.
	 * @type {{ recueil: any, onsave: (recueil: any, signer?: any) => void }}
	 */
	let { recueil, onsave } = $props();

	const protectedRecueil = $derived(!!recueil.manifest.ownerKey);
	// Lu une seule fois : le parent recrée ce panneau à chaque ouverture.
	let form = $state({ current: '', password: '', confirm: '', hint: untrack(() => recueil.manifest.ownerKey?.hint ?? '') });
	let busy = $state(false);
	let error = $state('');

	async function submit(e) {
		e.preventDefault();
		error = '';
		if (form.password !== form.confirm) {
			error = 'Les deux nouveaux mots de passe ne sont pas identiques.';
			return;
		}
		busy = true;
		try {
			const hint = form.hint.trim();
			if (protectedRecueil) {
				onsave(await changeOwnerPassword(recueil, form.current, form.password, { hint }));
			} else {
				const res = await protectRecueil(recueil, form.password, { hint });
				onsave(res.recueil, res.signer);
			}
		} catch (err) {
			error = err.message;
		} finally {
			busy = false;
		}
	}
</script>

<section class="owner" aria-labelledby="owner-title">
	<h3 id="owner-title">🔒 Accès propriétaire</h3>
	{#if protectedRecueil}
		<p class="hint">Ce recueil est protégé. Pour changer de mot de passe, il faut connaître l'actuel.</p>
	{:else}
		<p class="hint">
			Ce recueil n'est pas protégé : toute personne qui reçoit le fichier peut se présenter comme vous et le
			modifier. Choisissez un mot de passe pour être la seule personne à pouvoir fusionner, retirer ou modifier.
		</p>
	{/if}
	<form class="stack" onsubmit={submit}>
		{#if protectedRecueil}
			<PasswordField bind:value={form.current} label="Mot de passe actuel" required />
		{/if}
		<div class="pw-grid">
			<PasswordField
				bind:value={form.password}
				label={protectedRecueil ? 'Nouveau mot de passe' : 'Mot de passe'}
				hint="{MIN_PASSWORD} caractères au moins."
				autocomplete="new-password"
				required
			/>
			<PasswordField bind:value={form.confirm} label="Retapez-le" autocomplete="new-password" required />
		</div>
		<label class="field">Indice <span class="hint">(facultatif, visible par tous)</span>
			<input class="input" bind:value={form.hint} maxlength="200" placeholder="le prénom de mon premier chien" />
		</label>
		<p class="msg msg-warning">S'il est oublié, personne ne pourra le retrouver : notez-le en lieu sûr.</p>
		{#if error}<p class="msg msg-error" role="alert">{error}</p>{/if}
		<div>
			<button class="btn" type="submit" disabled={busy}>
				{busy ? 'Un instant…' : protectedRecueil ? 'Changer le mot de passe' : 'Protéger le recueil'}
			</button>
		</div>
	</form>
</section>

<style>
	.owner {
		margin-top: 32px;
		padding-top: 24px;
		border-top: 1px solid var(--line);
	}
	.owner .msg {
		margin: 0;
	}
	.pw-grid {
		display: grid;
		gap: 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
		align-items: end;
	}
</style>
