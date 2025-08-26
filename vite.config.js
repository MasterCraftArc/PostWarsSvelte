import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			external: (id) => {
				// Make playwright and related dependencies external
				if (id.includes('playwright') || 
				    id.includes('chromium') || 
				    id.includes('puppeteer') ||
				    id.includes('sharp')) {
					return true;
				}
				return false;
			}
		}
	},
	ssr: {
		external: ['playwright', 'playwright-core'],
		noExternal: ['@supabase/supabase-js'] // Keep essential dependencies
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.js']
				}
			},
			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./src/lib/test-setup.js']
				}
			}
		]
	}
});
