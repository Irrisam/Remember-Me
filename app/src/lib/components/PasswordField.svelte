<script>
	/**
	 * Champ mot de passe avec bouton « Afficher » : taper à l'aveugle est pénible, surtout pour un public âgé.
	 * @type {{ value: string, label: string, hint?: string, autocomplete?: string, required?: boolean }}
	 */
	let { value = $bindable(''), label, hint, autocomplete = 'current-password', required = false } = $props();

	const id = `pw-${Math.random().toString(36).slice(2, 9)}`;
	let visible = $state(false);
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	{#if hint}<span class="hint">{hint}</span>{/if}
	<div class="row">
		<input
			class="input"
			{id}
			type={visible ? 'text' : 'password'}
			bind:value
			{autocomplete}
			{required}
			spellcheck="false"
			autocapitalize="off"
		/>
		<button type="button" class="btn btn-ghost btn-sm" onclick={() => (visible = !visible)} aria-pressed={visible}>
			{visible ? 'Masquer' : 'Afficher'}
		</button>
	</div>
</div>

<style>
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.row .input {
		flex: 1;
		min-width: 0;
	}
</style>
