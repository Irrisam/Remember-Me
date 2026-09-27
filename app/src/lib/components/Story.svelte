<script>
	import MemoryCard from './MemoryCard.svelte';
	import Frise from './Frise.svelte';
	import { ageAt, formatAge } from '$lib/rmbr/story.js';

	/**
	 * Lecture du recueil : frise, périodes, souvenirs et leurs réponses.
	 * @type {{ story: ReturnType<typeof import('$lib/rmbr/story.js').story>, subject?: any,
	 *   urls: Map<string, string>, names: Map<string, string>,
	 *   entryActions?: import('svelte').Snippet<[any]> }}
	 */
	let { story, subject, urls, names, entryActions } = $props();

	const author = (e) => names.get(e.authorId) ?? 'auteur inconnu';
	const age = (e) => (subject ? formatAge(subject.name, ageAt(subject.birthDate, e.date)) : '');
</script>

<Frise periods={story.periods} undatedCount={story.undated.length} />
{#each story.periods.filter((p) => p.threads.length) as period (period.key)}
	<section id="periode-{period.key}" class="period">
		<h2>{period.label}</h2>
		{#each period.threads as t (t.entry.id)}
			{@render thread(t)}
		{/each}
	</section>
{/each}
{#if story.undated.length}
	<section id="sans-date" class="period">
		<h2>Sans date</h2>
		{#each story.undated as t (t.entry.id)}
			{@render thread(t)}
		{/each}
	</section>
{/if}

{#snippet thread(t)}
	<MemoryCard entry={t.entry} {urls} author={author(t.entry)} age={age(t.entry)}>
		{#snippet actions()}{@render entryActions?.(t.entry)}{/snippet}
		{#each t.replies as reply (reply.id)}
			<MemoryCard entry={reply} {urls} author={author(reply)} nested>
				{#snippet actions()}{@render entryActions?.(reply)}{/snippet}
			</MemoryCard>
		{/each}
	</MemoryCard>
{/snippet}

<style>
	.period {
		scroll-margin-top: 100px;
		margin-top: 40px;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 0;
		color: var(--ink-soft);
		font-size: 1.35rem;
	}
	h2::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}
</style>
