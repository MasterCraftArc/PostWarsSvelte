import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		prerender: {
			entries: ['/', '/login', '/signup'],
			handleHttpError: 'warn',
			handleMissingId: 'warn',
			handleUnseenRoutes: 'ignore'
		}
	}
};

export default config;
