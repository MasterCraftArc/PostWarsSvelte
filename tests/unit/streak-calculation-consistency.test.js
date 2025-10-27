import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { glob } from 'glob';

/**
 * Test: Streak Calculation Consistency
 *
 * CRITICAL: This test ensures all code uses calculateUserStreak() function
 * instead of incorrect manual calculations.
 *
 * Root Cause (Issue #): Multiple files were calculating streaks incorrectly:
 * - job-queue.js: Used Math.max(...userPosts.map(p => p.totalScore))
 * - process-queued-jobs.yml: Same incorrect calculation
 * - update-analytics/+server.js: Used userPosts?.length
 *
 * These caused incorrect streak values in scoring calculations.
 */
describe('Streak Calculation Consistency', () => {
	it('should not use Math.max on totalScore for streak calculation', async () => {
		// Find all JS/TS files
		const files = await glob('**/*.{js,ts,yml}', {
			ignore: ['node_modules/**', '.netlify/**', 'tests/**', '.svelte-kit/**'],
		});

		const violations = [];

		for (const file of files) {
			const content = readFileSync(file, 'utf-8');

			// Anti-pattern 1: Math.max(...userPosts.map(p => p.totalScore))
			if (content.match(/Math\.max\([^)]*userPosts[^)]*totalScore/)) {
				violations.push({
					file,
					pattern: 'Math.max with totalScore',
					line: content.split('\n').findIndex(line =>
						line.match(/Math\.max\([^)]*userPosts[^)]*totalScore/)
					) + 1
				});
			}
		}

		if (violations.length > 0) {
			const message = violations.map(v =>
				`${v.file}:${v.line} - Uses ${v.pattern} instead of calculateUserStreak()`
			).join('\n');

			expect.fail(`Found incorrect streak calculations:\n${message}\n\nUse calculateUserStreak() instead!`);
		}

		expect(violations).toHaveLength(0);
	});

	it('should not use userPosts.length for streak calculation', async () => {
		const files = await glob('**/*.{js,ts,yml}', {
			ignore: ['node_modules/**', '.netlify/**', 'tests/**', '.svelte-kit/**'],
		});

		const violations = [];

		for (const file of files) {
			const content = readFileSync(file, 'utf-8');

			// Look for patterns like: currentStreak = userPosts.length
			// or: const streak = userPosts?.length
			const lines = content.split('\n');
			lines.forEach((line, idx) => {
				if (line.match(/streak\s*=\s*userPosts\??\.length/i) &&
				    !line.includes('calculateUserStreak')) {
					violations.push({
						file,
						pattern: 'userPosts.length assigned to streak',
						line: idx + 1
					});
				}
			});
		}

		if (violations.length > 0) {
			const message = violations.map(v =>
				`${v.file}:${v.line} - Uses ${v.pattern} instead of calculateUserStreak()`
			).join('\n');

			expect.fail(`Found incorrect streak calculations:\n${message}\n\nUse calculateUserStreak() instead!`);
		}

		expect(violations).toHaveLength(0);
	});

	it('should import calculateUserStreak where streaks are calculated', async () => {
		const files = await glob('**/*.{js,ts}', {
			ignore: [
				'node_modules/**',
				'.netlify/**',
				'tests/**',
				'.svelte-kit/**',
				'**/gamification.js' // Exclude the source file
			],
		});

		const violations = [];

		for (const file of files) {
			const content = readFileSync(file, 'utf-8');

			// If file mentions "currentStreak" or "calculatePostScore" with streak
			const hasStreakLogic = content.match(/currentStreak/i) &&
			                      content.match(/calculatePostScore/);

			if (hasStreakLogic) {
				// Should import calculateUserStreak
				const hasImport = content.match(/import.*calculateUserStreak.*from.*gamification/);

				if (!hasImport) {
					violations.push({
						file,
						issue: 'Uses currentStreak but does not import calculateUserStreak'
					});
				}
			}
		}

		if (violations.length > 0) {
			const message = violations.map(v =>
				`${v.file} - ${v.issue}`
			).join('\n');

			expect.fail(`Found files missing calculateUserStreak import:\n${message}`);
		}

		expect(violations).toHaveLength(0);
	});
});

describe('Anti-patterns Documentation', () => {
	it('documents the incorrect patterns we are preventing', () => {
		const antiPatterns = [
			{
				pattern: 'Math.max(...userPosts.map(p => p.totalScore))',
				why: 'Returns the highest post score, not streak length',
				correct: 'calculateUserStreak(userPosts)'
			},
			{
				pattern: 'userPosts?.length || 0',
				why: 'Returns total post count, not consecutive days',
				correct: 'calculateUserStreak(userPosts)'
			},
			{
				pattern: 'userPosts.filter(p => recent).length',
				why: 'Custom logic may have timezone or calendar bugs',
				correct: 'calculateUserStreak(userPosts)'
			}
		];

		// Document these for future developers
		antiPatterns.forEach(ap => {
			expect(ap.correct).toBe('calculateUserStreak(userPosts)');
		});
	});
});
