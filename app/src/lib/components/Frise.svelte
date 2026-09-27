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
		z-index: 2;
		background: color-mix(in srgb, var(--paper) 92%, transparent);
		backdrop-filter: blur(6px);
		margin: 24px calc(-1 * var(--gutter)) 0;
		padding: 10px var(--gutter) 6px;
		border-bottom: 1px solid var(--line);
		overflow-x: auto;
	}
	ol {
		list-style: none;
		display: flex;
		margin: 0;
		padding: 0;
		min-width: max-content;
		/* La ligne du temps passe au centre des points. */
		background: linear-gradient(var(--line-strong), var(--line-strong)) no-repeat 0 19px / 100% 2px;
	}
	li { flex: 1 0 68px; display: grid; justify-items: center; }
	a, .stop { display: grid; justify-items: center; gap: 6px; text-decoration: none; color: var(--ink); padding: 4px 8px; border-radius: var(--radius-sm); }
	a:hover { background: var(--accent-soft); color: var(--ink); }
	.dot {
		width: var(--size);
		height: var(--size);
		margin: calc((28px - var(--size)) / 2) 0;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 4px var(--paper);
	}
	a:hover .dot, a:focus-visible .dot { background: var(--accent-strong); }
	.empty .dot { background: var(--paper); border: 2px solid var(--line-strong); }
	.year { font-size: 0.88rem; font-weight: 600; white-space: nowrap; }
	.empty .year { color: var(--ink-faint); font-weight: 400; }
	.undated { border-left: 1px dashed var(--line-strong); }
	.undated .dot { background: var(--ink-faint); }
	.birth { font-size: 0.78rem; color: var(--accent); font-style: italic; margin-top: -4px; }
</style>
