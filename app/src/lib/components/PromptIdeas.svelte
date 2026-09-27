<script>
	import { THEMES, pickPrompt } from '$lib/rmbr/prompts.js';

	/**
	 * Suggestions de questions : fermées par défaut, jamais obligatoires. `value` = question choisie (ou '').
	 * @type {{ value: string, voice: 'self' | 'other', name?: string, used?: string[] }}
	 */
	let { value = $bindable(''), voice, name = '', used = [] } = $props();

	let open = $state(false);
	let theme = $state(null);
	let current = $state(null);

	function draw() {
		current = pickPrompt({ voice, name, theme: theme ?? undefined, used, previous: current?.text });
	}

	function toggleOpen() {
		open = !open;
		if (open && !current) draw();
	}

	function chooseTheme(id) {
		theme = theme === id ? null : id;
		current = null;
		draw();
	}

	function use() {
		value = current.text;
		open = false;
	}
</script>

<div class="ideas">
	{#if value}
		<div class="chosen">
			<p class="label">Question</p>
			<p class="question">« {value} »</p>
			<div class="btn-row">
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => { value = ''; open = true; draw(); }}>Changer de question</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (value = '')}>Retirer la question</button>
			</div>
		</div>
	{:else}
		<button type="button" class="btn btn-ghost btn-sm toggle" onclick={toggleOpen} aria-expanded={open}>
			💡 {open ? 'Masquer les idées' : 'Besoin d’une idée ?'}
		</button>
		{#if open}
			<div class="panel-ideas">
				<p class="hint">Une question pour vous lancer, si vous le souhaitez. Vous pouvez aussi écrire librement.</p>
				<div class="chips" role="group" aria-label="Thèmes">
					{#each THEMES as t (t.id)}
						<button type="button" class="chip" aria-pressed={theme === t.id} onclick={() => chooseTheme(t.id)}>{t.label}</button>
					{/each}
				</div>
				{#if current}
					<p class="question suggestion" aria-live="polite">« {current.text} »</p>
					<div class="btn-row">
						<button type="button" class="btn btn-secondary btn-sm" onclick={use}>Répondre à cette question</button>
						<button type="button" class="btn btn-ghost btn-sm" onclick={draw}>Une autre idée</button>
					</div>
				{:else}
					<p class="hint">Toutes les questions de ce thème ont déjà une réponse dans le recueil. Essayez un autre thème.</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.ideas {
		display: grid;
		gap: 12px;
	}
	.toggle {
		justify-self: start;
		padding-inline: 12px;
	}
	.panel-ideas,
	.chosen {
		display: grid;
		gap: 14px;
		padding: 18px 20px;
		border-radius: var(--radius);
		background: var(--accent-soft);
	}
	.panel-ideas .hint,
	.chosen p {
		margin: 0;
	}
	.label {
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent-strong);
	}
	.question {
		margin: 0;
		font: italic 500 1.25rem/1.4 var(--font-display);
		color: var(--ink);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	/* Téléphone : une seule rangée qui défile, pour ne pas repousser le texte loin sous les thèmes. */
	@media (max-width: 560px) {
		.chips {
			flex-wrap: nowrap;
			overflow-x: auto;
			margin-inline: -20px;
			padding: 2px 20px 6px;
			scrollbar-width: thin;
		}
		.chip {
			flex: none;
		}
	}
	.chip {
		min-height: 44px;
		padding: 6px 14px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--card);
		color: var(--ink-soft);
		font: 500 0.95rem/1.2 var(--font-text);
		cursor: pointer;
	}
	.chip:hover {
		border-color: var(--accent);
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
</style>
