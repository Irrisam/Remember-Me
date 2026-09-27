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

<article class={nested ? 'nested' : 'card'}>
	{#if nested}<p class="added">{author} a complété :</p>{/if}
	{#if entry.type === 'tombstone'}
		<p><strong>Demande de suppression</strong> de « {targetTitle ?? 'un souvenir'} »</p>
	{:else}
		{#if entry.date || age}
			<p class="date">{entry.date ? formatDate(entry.date) : ''}{entry.date && age ? ' · ' : ''}{#if age}<span class="age">{age}</span>{/if}</p>
		{/if}
		{#if entry.title}<h3>{entry.title}</h3>{/if}
		{#if replyTitle}<p class="reply">En réponse à « {replyTitle} »</p>{/if}
		{#each entry.media ?? [] as item (item.path)}
			{#if urls.get(item.path)}
				<figure>
					{#if item.mimeType.startsWith('image/')}
						<img src={urls.get(item.path)} alt={item.caption ?? ''} width={item.width} height={item.height} />
					{:else if item.mimeType.startsWith('audio/')}
						<audio controls preload="none" src={urls.get(item.path)}></audio>
					{:else if item.mimeType.startsWith('video/')}
						<!-- Sous-titres à brancher sur media.transcript avec l'étape vidéo. -->
						<!-- svelte-ignore a11y_media_has_caption -->
						<video controls preload="metadata" src={urls.get(item.path)} width={item.width} height={item.height}></video>
					{/if}
					{#if item.caption}<figcaption>{item.caption}</figcaption>{/if}
				</figure>
			{/if}
		{/each}
		{#if entry.text}<p class="text">{entry.text}</p>{/if}
	{/if}
	{#if !nested}<p class="by">Par {author}</p>{/if}
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
	{@render children?.()}
</article>

<style>
	.card { background: #fff; border: 1px solid #e6dfd5; border-radius: 12px; padding: 20px; margin: 16px 0; }
	.nested { border-left: 3px solid #d9c7ad; padding: 4px 0 4px 16px; margin: 20px 0 0; }
	.nested h3 { font-size: 1.05rem; }
	.added { margin: 0 0 4px; color: #8a6d4f; font-size: 0.9rem; font-weight: 600; }
	.age { font-style: normal; color: #6b625a; }
	.date { color: #8a6d4f; margin: 0; font-style: italic; }
	.reply { color: #6b625a; margin: -8px 0 12px; font-size: 0.95rem; }
	h3 { margin: 4px 0 12px; }
	.text { white-space: pre-wrap; }
	figure { margin: 0 0 12px; }
	img, video { max-width: 100%; height: auto; border-radius: 8px; }
	audio { width: 100%; }
	figcaption, .by { color: #8a8076; font-size: 0.9rem; }
	.actions { display: flex; gap: 12px; flex-wrap: wrap; }
</style>
