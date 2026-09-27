<script>
	/**
	 * Frise des périodes : un point par période, plus gros s'il y a plus de souvenirs.
	 * De simples liens vers les sections, comme dans le viewer hors ligne.
	 * @type {{ periods: import('$lib/rmbr/story.js').Period[], undatedCount: number }}
	 */
	let { periods, undatedCount } = $props();

	const size = (n) => (n ? 10 + Math.min(n, 6) * 3 : 8);
	const plural = (n) => `${n} souvenir${n > 1 ? 's' : ''}`;
</script>

{#if periods.length + (undatedCount ? 1 : 0) > 1}
	<nav class="frise" aria-label="Frise des souvenirs">
		<ol>
			{#each periods as p (p.key)}
				<li class:empty={!p.threads.length}>
					{#if p.threads.length}
						<a href="#periode-{p.key}" title="{p.label} : {plural(p.threads.length)}">
							<span class="dot" style:--size="{size(p.threads.length)}px"></span>
							<span class="year">{p.short}</span>
						</a>
					{:else}
						<span class="stop" title="{p.label} : aucun souvenir">
							<span class="dot" style:--size="{size(0)}px"></span>
							<span class="year">{p.short}</span>
						</span>
					{/if}
					{#if p.birth}<span class="birth">naissance</span>{/if}
				</li>
			{/each}
			{#if undatedCount}
				<li class="undated">
					<a href="#sans-date" title="Sans date : {plural(undatedCount)}">
						<span class="dot" style:--size="{size(undatedCount)}px"></span>
						<span class="year">Sans date</span>
					</a>
				</li>
			{/if}
		</ol>
	</nav>
{/if}

<style>
	.frise {
		position: sticky;
		top: 0;
		z-index: 1;
		background: #f7f4ef;
		margin: 16px -16px 0;
		padding: 8px 16px 4px;
		border-bottom: 1px solid #e6dfd5;
		overflow-x: auto;
	}
	ol {
		list-style: none;
		display: flex;
		margin: 0;
		padding: 0;
		min-width: max-content;
		/* La ligne du temps passe au centre des points. */
		background: linear-gradient(#cfc6ba, #cfc6ba) no-repeat 0 17px / 100% 2px;
	}
	li { flex: 1 0 64px; display: grid; justify-items: center; }
	a, .stop { display: grid; justify-items: center; gap: 6px; text-decoration: none; color: inherit; padding: 4px 6px; }
	.dot {
		width: var(--size);
		height: var(--size);
		margin: calc((28px - var(--size)) / 2) 0;
		border-radius: 50%;
		background: #8a6d4f;
		box-shadow: 0 0 0 3px #f7f4ef;
	}
	a:hover .dot, a:focus-visible .dot { background: #5b4636; }
	.empty .dot { background: #f7f4ef; border: 2px solid #cfc6ba; box-sizing: border-box; }
	.year { font-size: 0.85rem; font-weight: 600; white-space: nowrap; }
	.empty .year { color: #b3a898; font-weight: 400; }
	.undated { border-left: 1px dashed #cfc6ba; }
	.undated .dot { background: #b3a898; }
	.birth { font-size: 0.75rem; color: #8a6d4f; font-style: italic; margin-top: -4px; }
</style>
