import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			external: (id) => {
				// Make playwright and all related dependencies external
				const externals = [
					'playwright',
					'playwright-core',
					'chromium',
					'chromium-bidi',
					'puppeteer',
					'sharp'
				];
				
				// Make linkedin-scraper files external to prevent bundling
				if (id.includes('linkedin-scraper')) {
					return true;
				}
				
				return externals.some(ext => id.includes(ext));
			}
		}
	},
	ssr: {
		external: [
			'playwright', 
			'playwright-core', 
			'chromium-bidi',
			/^chromium-bidi\/.*/,
			/^playwright.*/,
			/linkedin-scraper/
		],
		noExternal: ['@supabase/supabase-js']
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
