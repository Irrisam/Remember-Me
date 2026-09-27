<script>
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import MemoryCard from './MemoryCard.svelte';
	import { objectUrls, revokeAll } from '$lib/media-urls.js';

	/**
	 * @type {{ recueil: any, pack: any, items: { entry: any, status: string, reason?: string }[],
	 *   onmerge: (accepted: Set<string>) => void, oncancel: () => void }}
	 */
	let { recueil, pack, items, onmerge, oncancel } = $props();

	/*
	 * Une modification arrive en deux entrées : la nouvelle version (supersedes) et la suppression de l'ancienne.
	 * On n'en montre qu'une carte, et les deux sont gardées ou refusées ensemble.
	 */
	const companion = $derived.by(() => {
		const news = items.filter((i) => i.status === 'new').map((i) => i.entry);
		const map = new Map();
		for (const c of news) {
			if (c.type === 'tombstone' || !c.supersedes) continue;
			const tomb = news.find((t) => t.type === 'tombstone' && t.supersedes === c.supersedes);
			if (tomb) map.set(c.id, tomb.id);
		}
		return map;
	});
	const hidden = $derived(new Set(companion.values()));
	const fresh = $derived(items.filter((i) => i.status === 'new' && !hidden.has(i.entry.id)));
	const rejected = $derived(items.filter((i) => i.status === 'rejected'));
	const duplicates = $derived(items.filter((i) => i.status === 'duplicate').length);
	// Tout est gardé par défaut : le créateur retire ce qu'il ne veut pas.
	// Lu une seule fois : le parent recrée ce panneau pour chaque contribution.
	const kept = new SvelteSet(untrack(() => items.filter((i) => i.status === 'new').map((i) => i.entry.id)));
	const keptCount = $derived(fresh.filter((i) => kept.has(i.entry.id)).length);

	const contributor = $derived(pack.manifest.authors[0]);
	const all = $derived(new Map([...recueil.entries, ...pack.entries]));

	let urls = $state.raw(new Map());
	$effect(() => {
		const u = objectUrls(pack.entries.values(), pack.media);
		urls = u;
		return () => revokeAll(u);
	});

	function toggle(id) {
		const ids = [id, ...(companion.has(id) ? [companion.get(id)] : [])];
		const keep = !kept.has(id);
		for (const i of ids) {
			if (keep) kept.add(i);
			else kept.delete(i);
		}
	}
</script>

<section class="panel moderation" aria-labelledby="moderation-title">
	<p class="eyebrow">Contribution reçue</p>
	<h2 id="moderation-title">Les souvenirs de {contributor.name}{contributor.relation ? ` (${contributor.relation})` : ''}</h2>
	{#if fresh.length}
		<p>Choisissez ce que vous gardez dans votre recueil. Ce que vous retirez ne laissera aucune trace.</p>
	{:else}
		<p>Cette contribution n'apporte aucun nouveau souvenir.</p>
	{/if}
	{#if duplicates}
		<p class="hint">{duplicates} souvenir{duplicates > 1 ? 's' : ''} déjà dans le recueil, ignoré{duplicates > 1 ? 's' : ''}.</p>
	{/if}

	{#each fresh as { entry } (entry.id)}
		<div class="item" class:dropped={!kept.has(entry.id)}>
			{#if companion.has(entry.id)}
				<p class="change">Modification de « {all.get(entry.supersedes)?.title ?? 'un souvenir'} », qui remplacera la version actuelle :</p>
			{/if}
			<MemoryCard
				{entry}
				{urls}
				author={contributor.name}
				replyTitle={entry.replyTo ? (all.get(entry.replyTo)?.title ?? 'un souvenir') : undefined}
				targetTitle={all.get(entry.supersedes)?.title}
			>
				{#snippet actions()}
					<label class="check keep">
						<input type="checkbox" checked={kept.has(entry.id)} onchange={() => toggle(entry.id)} />
						Garder ce souvenir
					</label>
				{/snippet}
			</MemoryCard>
		</div>
	{/each}

	{#if rejected.length}
		<h3>Écartés automatiquement</h3>
		<ul class="rejected">
			{#each rejected as { entry, reason } (entry.id)}
				<li>« {entry.title ?? entry.text?.slice(0, 40) ?? entry.type} » : {reason}</li>
			{/each}
		</ul>
	{/if}

	<div class="btn-row">
		{#if fresh.length}
			<button class="btn" onclick={() => onmerge(new Set(kept))} disabled={!keptCount}>
				Ajouter {keptCount} souvenir{keptCount > 1 ? 's' : ''} au recueil
			</button>
		{/if}
		<button class="btn btn-secondary" onclick={oncancel}>{fresh.length ? 'Tout refuser' : 'Fermer'}</button>
	</div>
</section>

<style>
	.moderation { margin: 16px 0 32px; }
	.item { transition: opacity 0.2s; }
	.dropped { opacity: 0.5; }
	.keep { font-weight: 600; }
	.change { margin: 20px 0 -8px; color: var(--accent-strong); font-weight: 600; }
	.rejected { padding-left: 20px; color: var(--ink-soft); }
	h3 { margin-top: 24px; }
</style>
