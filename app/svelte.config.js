import adapter from '@sveltejs/adapter-static';

/** Site 100 % statique : aucune donnée ne quitte le navigateur. */
export default {
	kit: {
		adapter: adapter()
	}
};
