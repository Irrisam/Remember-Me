/**
 * Questions guidées : de simples suggestions pour vaincre la page blanche, jamais une obligation.
 * Deux voix :
 * - self : la personne raconte sa propre vie (« Quel était votre premier métier ? ») ;
 * - other : un proche écrit sur elle, {name} = son prénom. Jamais de pronom : on ne devine pas le genre.
 * Ton sobre et chaleureux : on parle de vie, pas de fin de vie.
 */
export const THEMES = [
	{
		id: 'enfance',
		label: 'Enfance',
		self: [
			'À quoi ressemblait la maison de votre enfance ?',
			'Quel était votre jeu préféré quand vous étiez petit ou petite ?',
			'Quel souvenir gardez-vous de votre école ?',
			'Qui était votre meilleur ami ou meilleure amie d’enfance ?',
			'Quelle bêtise d’enfant vous fait encore sourire ?',
			'Quelle odeur vous ramène tout de suite à votre enfance ?'
		],
		other: [
			'Que vous a raconté {name} de son enfance ?',
			'Quelle photo d’enfance de {name} aimez-vous particulièrement ?',
			'Quel jeu ou quelle chanson avez-vous appris grâce à {name} ?'
		]
	},
	{
		id: 'famille',
		label: 'Famille',
		self: [
			'Comment décririez-vous vos parents à quelqu’un qui ne les a pas connus ?',
			'Quelle tradition de famille aimez-vous le plus ?',
			'Quel souvenir gardez-vous de vos grands-parents ?',
			'Comment se passaient les repas de famille ?',
			'Quel moment avec vos enfants ou petits-enfants garde une place à part ?'
		],
		other: [
			'Quel moment passé en famille avec {name} vous revient souvent ?',
			'Qu’est-ce que {name} vous a appris sans même le dire ?',
			'Quelle expression de {name} répète-t-on encore dans la famille ?'
		]
	},
	{
		id: 'jeunesse',
		label: 'Jeunesse',
		self: [
			'Quelle musique écoutiez-vous à vingt ans ?',
			'Où alliez-vous danser ou sortir quand vous étiez jeune ?',
			'Quel rêve aviez-vous à vingt ans ?',
			'Quelle a été votre première grande aventure ?'
		],
		other: [
			'Qu’avez-vous appris de la jeunesse de {name} ?',
			'Quelle anecdote de jeunesse de {name} aimez-vous raconter ?'
		]
	},
	{
		id: 'amour',
		label: 'Amour et amitié',
		self: [
			'Comment avez-vous rencontré la personne qui a partagé votre vie ?',
			'Quel a été votre plus beau rendez-vous ?',
			'Quelle amitié a compté le plus pour vous ?',
			'Qu’est-ce qui vous a fait dire « c’est la bonne personne » ?'
		],
		other: [
			'Comment avez-vous rencontré {name} ?',
			'Quelle belle amitié de {name} connaissez-vous ?'
		]
	},
	{
		id: 'travail',
		label: 'Travail',
		self: [
			'Quel était votre premier métier ?',
			'De quelle réussite professionnelle êtes-vous fier ou fière ?',
			'Quelle personne a compté pour vous au travail ?',
			'À quoi ressemblait une journée de travail ordinaire ?',
			'Si vous pouviez refaire un métier, lequel choisiriez-vous ?'
		],
		other: [
			'Que savez-vous du métier de {name} ?',
			'Quel savoir-faire de {name} admirez-vous ?'
		]
	},
	{
		id: 'lieux',
		label: 'Lieux',
		self: [
			'Quel lieu vous manque le plus ?',
			'Quelle maison ou quel appartement a été le plus heureux ?',
			'Quel paysage vous émeut à chaque fois ?',
			'Dans quel café, quel marché ou quelle rue aimiez-vous vous promener ?'
		],
		other: [
			'Quel lieu vous fait penser à {name} ?',
			'Où alliez-vous avec {name} ?'
		]
	},
	{
		id: 'traditions',
		label: 'Traditions et recettes',
		self: [
			'Quelle recette voudriez-vous transmettre ?',
			'Comment fêtiez-vous Noël ou les grandes fêtes ?',
			'Quel plat vous rappelle la maison ?',
			'Quelle chanson chantait-on à la maison ?'
		],
		other: [
			'Quel plat de {name} vous rappelle la maison ?',
			'Quelle chanson de {name} vous revient en tête ?',
			'Quelle habitude de {name} aimeriez-vous garder vivante ?'
		]
	},
	{
		id: 'voyages',
		label: 'Voyages',
		self: [
			'Quel voyage vous reste le plus en mémoire ?',
			'Quelles étaient vos vacances d’été quand vous étiez enfant ?',
			'Quel imprévu de voyage vous fait rire aujourd’hui ?'
		],
		other: [
			'Quel voyage avez-vous fait avec {name} ?',
			'Quelles vacances avec {name} vous reviennent en mémoire ?'
		]
	},
	{
		id: 'moments',
		label: 'Moments forts',
		self: [
			'Quel jour de votre vie aimeriez-vous revivre ?',
			'Quel événement historique avez-vous vécu, et où étiez-vous ?',
			'Quelle épreuve vous a rendu plus fort ou plus forte ?',
			'De quoi êtes-vous le plus fier ou la plus fière ?'
		],
		other: [
			'Quel moment avec {name} ne voulez-vous jamais oublier ?',
			'Quel moment de joie partagé avec {name} vous revient ?'
		]
	},
	{
		id: 'transmettre',
		label: 'Transmettre',
		self: [
			'Quel conseil aimeriez-vous donner à vos petits-enfants ?',
			'Qu’avez-vous appris de plus important dans la vie ?',
			'Quelle valeur voulez-vous transmettre ?',
			'Qu’aimeriez-vous que l’on retienne de vous ?'
		],
		other: [
			'Quel conseil de {name} gardez-vous précieusement ?',
			'Que voulez-vous dire à {name} aujourd’hui ?',
			'Qu’avez-vous envie de transmettre de {name} à la génération suivante ?'
		]
	}
];

/**
 * Voix des questions : `self` si l'on écrit sur sa propre vie (le créateur est la personne du recueil),
 * `other` sinon (un proche, ou « je crée pour quelqu'un »).
 * @param {any} manifest
 * @param {{ id: string, name: string } | null} me
 */
export function promptVoice(manifest, me) {
	const subject = manifest.subject?.name;
	if (!subject || !me || me.id !== manifest.creatorId) return subject ? 'other' : 'self';
	const first = (s) => s.trim().split(/\s+/)[0].toLocaleLowerCase('fr');
	return first(subject) === first(me.name) ? 'self' : 'other';
}

/** Prénom de la personne du recueil, pour les questions « other ». */
export function subjectFirstName(manifest) {
	return manifest.subject?.name.trim().split(/\s+/)[0] ?? '';
}

/**
 * Questions disponibles, prénom inséré, sans celles déjà utilisées.
 * @param {{ voice: 'self' | 'other', name?: string, theme?: string, used?: Iterable<string> }} opts
 * @returns {{ theme: string, text: string }[]}
 */
export function availablePrompts({ voice, name = '', theme, used = [] }) {
	const done = new Set(used);
	const out = [];
	for (const t of THEMES) {
		if (theme && t.id !== theme) continue;
		// Sans prénom connu, les questions « other » ne peuvent pas être formulées.
		const texts = voice === 'other' && name ? t.other.map((q) => q.replaceAll('{name}', name)) : t.self;
		for (const text of texts) if (!done.has(text)) out.push({ theme: t.id, text });
	}
	return out;
}

/**
 * Une question au hasard, différente de la précédente si possible.
 * @param {Parameters<typeof availablePrompts>[0] & { previous?: string, random?: () => number }} opts
 */
export function pickPrompt({ previous, random = Math.random, ...opts }) {
	const pool = availablePrompts(opts);
	const choices = pool.length > 1 ? pool.filter((p) => p.text !== previous) : pool;
	return choices.length ? choices[Math.floor(random() * choices.length)] : null;
}
