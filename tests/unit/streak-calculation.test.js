import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateUserStreak } from '../../src/lib/gamification.js';

/**
 * Test: Streak Calculation Logic
 *
 * CRITICAL: This test validates the core streak calculation logic works correctly.
 *
 * The function must:
 * 1. Check if most recent post is from today OR yesterday (EST timezone)
 * 2. Count consecutive calendar days (not 24-hour periods)
 * 3. Handle timezone conversions correctly
 * 4. Return 0 if streak is broken
 */
describe('calculateUserStreak()', () => {
	// Mock current date/time for consistent testing
	const mockNow = new Date('2025-10-27T14:00:00Z'); // 10 AM EST on Oct 27

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(mockNow);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('Streak Freshness Check', () => {
		it('should return streak if most recent post is from today', () => {
			const posts = [
				{ postedAt: '2025-10-27T00:00:00' }, // Today
				{ postedAt: '2025-10-26T00:00:00' }, // Yesterday
				{ postedAt: '2025-10-25T00:00:00' }, // 2 days ago
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBeGreaterThan(0);
			expect(streak).toBe(3); // 3 consecutive days
		});

		it('should return streak if most recent post is from yesterday', () => {
			const posts = [
				{ postedAt: '2025-10-26T00:00:00' }, // Yesterday
				{ postedAt: '2025-10-25T00:00:00' }, // 2 days ago
				{ postedAt: '2025-10-24T00:00:00' }, // 3 days ago
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBeGreaterThan(0);
			expect(streak).toBe(3);
		});

		it('should return 0 if most recent post is older than yesterday', () => {
			const posts = [
				{ postedAt: '2025-10-25T00:00:00' }, // 2 days ago
				{ postedAt: '2025-10-24T00:00:00' }, // 3 days ago
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBe(0); // Streak broken
		});

		it('should return 0 if most recent post is 3+ days old', () => {
			const posts = [
				{ postedAt: '2025-10-24T00:00:00' }, // 3 days ago
				{ postedAt: '2025-10-23T00:00:00' },
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBe(0);
		});
	});

	describe('Consecutive Days Counting', () => {
		it('should count consecutive days correctly', () => {
			const posts = [
				{ postedAt: '2025-10-27T00:00:00' }, // Today
				{ postedAt: '2025-10-26T00:00:00' }, // -1
				{ postedAt: '2025-10-25T00:00:00' }, // -2
				{ postedAt: '2025-10-24T00:00:00' }, // -3
				{ postedAt: '2025-10-23T00:00:00' }, // -4
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBe(5);
		});

		it('should stop counting when gap is detected', () => {
			const posts = [
				{ postedAt: '2025-10-27T00:00:00' }, // Today
				{ postedAt: '2025-10-26T00:00:00' }, // Yesterday
				{ postedAt: '2025-10-25T00:00:00' }, // -2
				// GAP: Oct 24 missing
				{ postedAt: '2025-10-23T00:00:00' }, // -4
				{ postedAt: '2025-10-22T00:00:00' }, // -5
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBe(3); // Stops at the gap
		});

		it('should handle multiple posts on same day', () => {
			const posts = [
				{ postedAt: '2025-10-27T00:00:00' }, // Today #1
				{ postedAt: '2025-10-27T00:00:00' }, // Today #2 (duplicate day)
				{ postedAt: '2025-10-26T00:00:00' }, // Yesterday #1
				{ postedAt: '2025-10-26T00:00:00' }, // Yesterday #2
				{ postedAt: '2025-10-25T00:00:00' }, // -2
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBe(3); // 3 unique days
		});
	});

	describe('Edge Cases', () => {
		it('should return 0 for empty array', () => {
			expect(calculateUserStreak([])).toBe(0);
		});

		it('should return 0 for null', () => {
			expect(calculateUserStreak(null)).toBe(0);
		});

		it('should return 0 for undefined', () => {
			expect(calculateUserStreak(undefined)).toBe(0);
		});

		it('should return 1 for single recent post', () => {
			const posts = [{ postedAt: '2025-10-27T00:00:00' }];

			expect(calculateUserStreak(posts)).toBe(1);
		});

		it('should handle posts with createdAt fallback', () => {
			const posts = [
				{ createdAt: '2025-10-27T00:00:00' }, // No postedAt
				{ createdAt: '2025-10-26T00:00:00' },
			];

			const streak = calculateUserStreak(posts);

			expect(streak).toBe(2);
		});
	});

	describe('Real-world Scenarios', () => {
		it('should match Jon Schulman actual data (12-day streak)', () => {
			// Jon's actual posts from database
			const jonPosts = [
				{ postedAt: '2025-10-26T00:00:00' },
				{ postedAt: '2025-10-26T00:00:00' }, // Duplicate day
				{ postedAt: '2025-10-25T00:00:00' },
				{ postedAt: '2025-10-24T00:00:00' },
				{ postedAt: '2025-10-23T00:00:00' },
				{ postedAt: '2025-10-22T00:00:00' },
				{ postedAt: '2025-10-21T00:00:00' },
				{ postedAt: '2025-10-20T00:00:00' },
				{ postedAt: '2025-10-19T00:00:00' },
				{ postedAt: '2025-10-18T00:00:00' },
				{ postedAt: '2025-10-17T00:00:00' },
				{ postedAt: '2025-10-16T00:00:00' },
				{ postedAt: '2025-10-15T00:00:00' },
			];

			const streak = calculateUserStreak(jonPosts);

			expect(streak).toBe(12); // Should match actual calculated value
		});

		it('should match Brandt Keller actual data (19-day streak)', () => {
			// Brandt's actual posts
			const brandtPosts = [
				{ postedAt: '2025-10-26T00:00:00' },
				{ postedAt: '2025-10-25T00:00:00' },
				{ postedAt: '2025-10-24T00:00:00' },
				{ postedAt: '2025-10-23T00:00:00' },
				{ postedAt: '2025-10-22T00:00:00' },
				{ postedAt: '2025-10-21T00:00:00' },
				{ postedAt: '2025-10-21T00:00:00' }, // Duplicate
				{ postedAt: '2025-10-20T00:00:00' },
				{ postedAt: '2025-10-19T00:00:00' },
				{ postedAt: '2025-10-18T00:00:00' },
				{ postedAt: '2025-10-17T00:00:00' },
				{ postedAt: '2025-10-16T00:00:00' },
				{ postedAt: '2025-10-15T00:00:00' },
				{ postedAt: '2025-10-14T00:00:00' },
				{ postedAt: '2025-10-13T00:00:00' },
				{ postedAt: '2025-10-12T00:00:00' },
				{ postedAt: '2025-10-11T00:00:00' },
				{ postedAt: '2025-10-10T00:00:00' },
				{ postedAt: '2025-10-09T00:00:00' },
				{ postedAt: '2025-10-08T00:00:00' },
			];

			const streak = calculateUserStreak(brandtPosts);

			expect(streak).toBe(19);
		});

		it('should return 0 for Mike (last post 3 days ago)', () => {
			const mikePosts = [
				{ postedAt: '2025-10-24T00:00:00' }, // 3 days ago
				{ postedAt: '2025-10-16T00:00:00' },
			];

			const streak = calculateUserStreak(mikePosts);

			expect(streak).toBe(0); // Streak broken
		});
	});

	describe('Timezone Handling (EST)', () => {
		it('should use EST timezone for date calculations', () => {
			// This is implicitly tested by the "today OR yesterday" checks
			// The function converts all dates to EST before comparison

			const posts = [
				// Midnight UTC is 7 PM EST previous day (during DST)
				// or 8 PM EST previous day (during standard time)
				{ postedAt: '2025-10-27T04:00:00Z' }, // Midnight EST
			];

			const streak = calculateUserStreak(posts);

			// Should count as today in EST
			expect(streak).toBeGreaterThan(0);
		});
	});
});
