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
	const empty = $derived(!story.periods.some((p) => p.threads.length) && !story.undated.length);
</script>

{#if empty}
	<p class="hint">Aucun souvenir pour l'instant.</p>
{:else}
	<Frise periods={story.periods} undatedCount={story.undated.length} />
	{#each story.periods.filter((p) => p.threads.length) as period (period.key)}
		<section id="periode-{period.key}">
			<h2>{period.label}</h2>
			{#each period.threads as t (t.entry.id)}
				{@render thread(t)}
			{/each}
		</section>
	{/each}
	{#if story.undated.length}
		<section id="sans-date">
			<h2>Sans date</h2>
			{#each story.undated as t (t.entry.id)}
				{@render thread(t)}
			{/each}
		</section>
	{/if}
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
	section { scroll-margin-top: 96px; }
	h2 { margin: 32px 0 0; color: #6b625a; font-size: 1.3rem; }
	.hint { color: #8a8076; }
</style>
