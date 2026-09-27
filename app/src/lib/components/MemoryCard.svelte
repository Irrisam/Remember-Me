<script>
	import { formatDate } from '$lib/rmbr/timeline.js';

	/**
	 * nested : réponse affichée sous son souvenir d'origine. children : les réponses, sous la carte.
	 * @type {{ entry: any, urls: Map<string, string>, author: string, replyTitle?: string,
	 *   targetTitle?: string, age?: string, nested?: boolean,
	 *   actions?: import('svelte').Snippet, children?: import('svelte').Snippet }}
	 */
	let { entry, urls, author, replyTitle, targetTitle, age, nested = false, actions, children } = $props();
</script>

<article class={nested ? 'nested' : 'memory card'} id="souvenir-{entry.id}">
	{#if nested}<p class="added">{author} a complété :</p>{/if}
	{#if entry.type === 'tombstone'}
		<p><strong>Demande de suppression</strong> de « {targetTitle ?? 'un souvenir'} »</p>
	{:else}
		{#if entry.date || age || entry.supersedes}
			<p class="date">
				{#if entry.date}<span>{formatDate(entry.date)}</span>{/if}
				{#if age}<span class="age">{age}</span>{/if}
				{#if entry.supersedes}<span class="edited">modifié</span>{/if}
			</p>
		{/if}
		{#if entry.prompt}<p class="prompt"><span class="visually-hidden">Question : </span>« {entry.prompt} »</p>{/if}
		{#if entry.title}<h3>{entry.title}</h3>{/if}
		{#if replyTitle}<p class="reply">En réponse à « {replyTitle} »</p>{/if}
		{#each entry.media ?? [] as item (item.path)}
			{#if urls.get(item.path)}
				<figure>
					{#if item.mimeType.startsWith('image/')}
						<img src={urls.get(item.path)} alt={item.caption ?? ''} width={item.width} height={item.height} loading="lazy" />
					{:else if item.mimeType.startsWith('audio/')}
						<audio controls preload="none" src={urls.get(item.path)}></audio>
					{:else if item.mimeType.startsWith('video/')}
						<!-- Sous-titres à brancher sur media.transcript. -->
						<!-- svelte-ignore a11y_media_has_caption -->
						<video controls preload="metadata" src={urls.get(item.path)} width={item.width} height={item.height}></video>
					{/if}
					{#if item.caption}<figcaption>{item.caption}</figcaption>{/if}
				</figure>
			{/if}
		{/each}
		{#if entry.text}<p class="text">{entry.text}</p>{/if}
	{/if}
	<footer class:solo={nested}>
		{#if !nested}<span class="by">Par {author}</span>{/if}
		{#if actions}<span class="actions">{@render actions()}</span>{/if}
	</footer>
	{@render children?.()}
</article>

<style>
	.memory {
		margin: 20px 0;
		scroll-margin-top: 110px;
	}
	.nested {
		border-left: 3px solid var(--line-strong);
		padding: 2px 0 2px 18px;
		margin: 24px 0 0;
	}
	.added {
		margin: 0 0 6px;
		color: var(--accent);
		font-size: 0.95rem;
		font-weight: 600;
	}
	.date {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin: 0 0 6px;
		color: var(--accent);
		font-style: italic;
	}
	.age,
	.edited {
		font-style: normal;
		color: var(--ink-faint);
	}
	.edited {
		font-size: 0.9rem;
	}
	h3 {
		font-size: 1.45rem;
		margin: 0 0 14px;
	}
	.nested h3 {
		font-size: 1.15rem;
	}
	.prompt {
		margin: 0 0 8px;
		padding-left: 12px;
		border-left: 2px solid var(--accent);
		color: var(--ink-soft);
		font-style: italic;
		max-width: 70ch;
	}
	.reply {
		color: var(--ink-faint);
		margin: -8px 0 14px;
		font-size: 0.95rem;
	}
	/* Lignes de ~70 caractères : au-delà, l'œil perd le fil, même si la carte est large. */
	.text {
		white-space: pre-wrap;
		margin: 0 0 12px;
		max-width: 70ch;
		font-size: 1.1rem;
	}
	h3,
	.reply,
	figcaption {
		max-width: 70ch;
	}
	figure {
		margin: 4px 0 16px;
	}
	img,
	video {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
	}
	audio {
		width: 100%;
	}
	figcaption {
		margin-top: 6px;
		color: var(--ink-faint);
		font-size: 0.95rem;
		font-style: italic;
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		margin-top: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}
	footer.solo {
		border-top: 0;
		padding-top: 0;
	}
	footer:not(:has(*)) {
		display: none;
	}
	.by {
		color: var(--ink-faint);
		font-size: 0.95rem;
	}
	.actions {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-left: auto;
	}
	.actions:empty {
		display: none;
	}
</style>
