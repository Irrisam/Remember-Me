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

	const fresh = $derived(items.filter((i) => i.status === 'new'));
	const rejected = $derived(items.filter((i) => i.status === 'rejected'));
	const duplicates = $derived(items.filter((i) => i.status === 'duplicate').length);
	// Tout est gardé par défaut : le créateur retire ce qu'il ne veut pas.
	// Lu une seule fois : le parent recrée ce panneau pour chaque contribution.
	const kept = new SvelteSet(untrack(() => items.filter((i) => i.status === 'new').map((i) => i.entry.id)));

	const contributor = $derived(pack.manifest.authors[0]);
	const all = $derived(new Map([...recueil.entries, ...pack.entries]));

	let urls = $state.raw(new Map());
	$effect(() => {
		const u = objectUrls(pack.entries.values(), pack.media);
		urls = u;
		return () => revokeAll(u);
	});

	function toggle(id) {
		if (kept.has(id)) kept.delete(id);
		else kept.add(id);
	}
</script>

<section class="panel">
	<h2>Contribution de {contributor.name}{contributor.relation ? ` (${contributor.relation})` : ''}</h2>
	{#if fresh.length}
		<p>Choisissez les souvenirs à ajouter à votre recueil. Ceux que vous retirez ne laisseront aucune trace.</p>
	{:else}
		<p>Cette contribution n'apporte aucun nouveau souvenir.</p>
	{/if}
	{#if duplicates}<p class="hint">{duplicates} souvenir(s) déjà présent(s) dans le recueil, ignoré(s).</p>{/if}

	{#each fresh as { entry } (entry.id)}
		<div class:dropped={!kept.has(entry.id)}>
			<MemoryCard
				{entry}
				{urls}
				author={contributor.name}
				replyTitle={entry.replyTo ? (all.get(entry.replyTo)?.title ?? 'un souvenir') : undefined}
				targetTitle={all.get(entry.supersedes)?.title}
			>
				{#snippet actions()}
					<label class="keep">
						<input type="checkbox" checked={kept.has(entry.id)} onchange={() => toggle(entry.id)} />
						Garder
					</label>
				{/snippet}
			</MemoryCard>
		</div>
	{/each}

	{#if rejected.length}
		<h3>Refusés automatiquement</h3>
		<ul>
			{#each rejected as { entry, reason } (entry.id)}
				<li>« {entry.title ?? entry.text?.slice(0, 40) ?? entry.type} » : {reason}</li>
			{/each}
		</ul>
	{/if}

	<div class="actions">
		{#if fresh.length}
			<button onclick={() => onmerge(new Set(kept))} disabled={!kept.size}>
				Ajouter {kept.size} souvenir{kept.size > 1 ? 's' : ''} au recueil
			</button>
		{/if}
		<button class="secondary" onclick={oncancel}>{fresh.length ? 'Tout refuser' : 'Fermer'}</button>
	</div>
</section>

<style>
	.panel { background: #efe8dd; border-radius: 12px; padding: 20px; margin: 16px 0; }
	h2 { margin-top: 0; }
	.dropped { opacity: 0.45; }
	.keep { display: flex; gap: 8px; align-items: center; font-weight: 600; cursor: pointer; }
	.keep input { width: 22px; height: 22px; }
	.hint { color: #8a8076; font-size: 0.9rem; }
	ul { padding-left: 20px; color: #6b625a; }
	.actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
	button {
		font: inherit;
		font-weight: 600;
		padding: 12px 20px;
		border: 0;
		border-radius: 8px;
		background: #5b4636;
		color: #fff;
		cursor: pointer;
	}
	button:disabled { opacity: 0.6; cursor: not-allowed; }
	button.secondary { background: #e6dfd5; color: #2b2724; }
</style>
