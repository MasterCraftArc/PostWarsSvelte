import { describe, it, expect, beforeAll } from 'vitest';
import { supabaseAdmin } from '../../src/lib/supabase-node.js';
import { calculateUserStreak } from '../../src/lib/gamification.js';

/**
 * Integration Test: Database Streak Verification
 *
 * CRITICAL: This test verifies actual database data matches calculated streaks.
 * Runs against REAL database to catch data drift.
 *
 * This prevents the issue where:
 * - Database showed currentStreak = 0
 * - Actual calculated streak was 12-19
 * - Users' streaks were stale/incorrect
 */
describe('Database Streak Verification (Integration)', () => {
	let allUsers;

	beforeAll(async () => {
		// Fetch all users from database
		const { data, error } = await supabaseAdmin
			.from('users')
			.select('id, name, email, currentStreak');

		if (error) {
			throw new Error(`Failed to fetch users: ${error.message}`);
		}

		allUsers = data;
	});

	it('should have users in database', () => {
		expect(allUsers).toBeDefined();
		expect(allUsers.length).toBeGreaterThan(0);
	});

	describe('Streak Accuracy for All Users', () => {
		it('should match calculated streak for all users', async () => {
			const discrepancies = [];

			for (const user of allUsers) {
				// Get user's posts
				const { data: posts } = await supabaseAdmin
					.from('linkedin_posts')
					.select('postedAt, createdAt')
					.eq('userId', user.id)
					.order('postedAt', { ascending: false });

				// Calculate expected streak
				const calculatedStreak = calculateUserStreak(posts || []);
				const dbStreak = user.currentStreak || 0;

				// Check if they match
				if (calculatedStreak !== dbStreak) {
					discrepancies.push({
						user: user.name || user.email,
						userId: user.id,
						calculated: calculatedStreak,
						database: dbStreak,
						postCount: posts?.length || 0,
						mostRecentPost: posts?.[0]?.postedAt || 'none'
					});
				}
			}

			if (discrepancies.length > 0) {
				const message = discrepancies.map(d =>
					`❌ ${d.user}: DB=${d.database}, Calculated=${d.calculated} (${d.postCount} posts, last: ${d.mostRecentPost})`
				).join('\n');

				expect.fail(`Found ${discrepancies.length} users with incorrect streaks:\n${message}\n\nRun: node recalculate-user-points.js`);
			}

			expect(discrepancies).toHaveLength(0);
		}, 30000); // 30 second timeout for large dataset
	});

	describe('Recent Posters Should Have Streaks', () => {
		it('should not have streak=0 for users who posted yesterday or today', async () => {
			const now = new Date();
			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);

			const yesterdayStr = yesterday.toISOString().split('T')[0];
			const todayStr = now.toISOString().split('T')[0];

			// Find users with recent posts
			const { data: recentPosts } = await supabaseAdmin
				.from('linkedin_posts')
				.select('userId')
				.gte('postedAt', `${yesterdayStr}T00:00:00`)
				.order('postedAt', { ascending: false });

			const recentUserIds = [...new Set(recentPosts?.map(p => p.userId))];

			const violations = [];

			for (const userId of recentUserIds) {
				const user = allUsers.find(u => u.id === userId);
				if (user && user.currentStreak === 0) {
					violations.push({
						user: user.name || user.email,
						userId: user.id,
						streak: user.currentStreak
					});
				}
			}

			if (violations.length > 0) {
				const message = violations.map(v =>
					`❌ ${v.user} posted recently but has streak=${v.streak}`
				).join('\n');

				expect.fail(`Found ${violations.length} users with incorrect zero streaks:\n${message}`);
			}

			expect(violations).toHaveLength(0);
		}, 30000);
	});

	describe('Scraping Queue Health', () => {
		it('should not have unscraped posts older than 2 hours', async () => {
			const twoHoursAgo = new Date();
			twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

			// Find posts with NULL lastScrapedAt that are old
			const { data: unscrappedPosts } = await supabaseAdmin
				.from('linkedin_posts')
				.select('id, url, createdAt, userId')
				.is('lastScrapedAt', null)
				.lt('createdAt', twoHoursAgo.toISOString());

			if (unscrappedPosts && unscrappedPosts.length > 0) {
				const message = unscrappedPosts.map(p =>
					`Post ${p.id} created ${p.createdAt} still not scraped`
				).join('\n');

				expect.fail(`Found ${unscrappedPosts.length} old unscraped posts:\n${message}\n\nCheck scraping cron!`);
			}

			expect(unscrappedPosts?.length || 0).toBe(0);
		});

		it('should prioritize NULL lastScrapedAt in next scraping batch', async () => {
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);

			// Simulate the scraping queue query
			const { data: queuePosts } = await supabaseAdmin
				.from('linkedin_posts')
				.select('id, lastScrapedAt, createdAt')
				.or(`lastScrapedAt.is.null,lastScrapedAt.lt.${oneHourAgo.toISOString()}`)
				.order('lastScrapedAt', { ascending: true, nullsFirst: true })
				.limit(30);

			if (queuePosts && queuePosts.length > 0) {
				// First post in queue should be NULL if any NULL exists
				const hasNull = queuePosts.some(p => p.lastScrapedAt === null);

				if (hasNull) {
					const firstPost = queuePosts[0];
					expect(firstPost.lastScrapedAt).toBe(null);
				}
			}
		});
	});

	describe('Data Consistency Checks', () => {
		it('should not have negative currentStreak values', () => {
			const negative = allUsers.filter(u => (u.currentStreak || 0) < 0);

			if (negative.length > 0) {
				const message = negative.map(u =>
					`${u.name}: streak=${u.currentStreak}`
				).join('\n');

				expect.fail(`Found users with negative streaks:\n${message}`);
			}

			expect(negative).toHaveLength(0);
		});

		it('should not have unreasonably high streaks (>100 days)', () => {
			const unreasonable = allUsers.filter(u => (u.currentStreak || 0) > 100);

			if (unreasonable.length > 0) {
				const message = unreasonable.map(u =>
					`${u.name}: streak=${u.currentStreak} (verify this is correct!)`
				).join('\n');

				// This might be valid, but warrants investigation
				console.warn(`⚠️  Found users with very high streaks:\n${message}`);
			}

			// Just log, don't fail (could be legitimate)
		});

		it('should have currentStreak ≤ total post count', async () => {
			const violations = [];

			for (const user of allUsers) {
				const { count } = await supabaseAdmin
					.from('linkedin_posts')
					.select('id', { count: 'exact', head: true })
					.eq('userId', user.id);

				if (user.currentStreak > count) {
					violations.push({
						user: user.name || user.email,
						streak: user.currentStreak,
						posts: count
					});
				}
			}

			if (violations.length > 0) {
				const message = violations.map(v =>
					`${v.user}: streak=${v.streak} but only ${v.posts} posts`
				).join('\n');

				expect.fail(`Found impossible streaks:\n${message}`);
			}

			expect(violations).toHaveLength(0);
		}, 60000); // 60 second timeout
	});
});

describe('Specific User Regression Tests', () => {
	/**
	 * These tests check the specific users who had the streak bug.
	 * If these fail, the original issue has returned.
	 */

	it('Jon Schulman should have correct streak', async () => {
		const { data: jon } = await supabaseAdmin
			.from('users')
			.select('id, currentStreak')
			.eq('email', 'jon.schulman@defenseunicorns.com')
			.single();

		if (!jon) {
			console.warn('⚠️  Jon Schulman not found in database');
			return;
		}

		const { data: posts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('postedAt')
			.eq('userId', jon.id)
			.order('postedAt', { ascending: false });

		const calculated = calculateUserStreak(posts || []);

		expect(jon.currentStreak).toBe(calculated);
	});

	it('Brandt Keller should have correct streak', async () => {
		const { data: brandt } = await supabaseAdmin
			.from('users')
			.select('id, currentStreak')
			.eq('email', 'brandt.keller@defenseunicorns.com')
			.single();

		if (!brandt) {
			console.warn('⚠️  Brandt Keller not found in database');
			return;
		}

		const { data: posts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('postedAt')
			.eq('userId', brandt.id)
			.order('postedAt', { ascending: false });

		const calculated = calculateUserStreak(posts || []);

		expect(brandt.currentStreak).toBe(calculated);
	});

	it('Michaela Flatau should have correct streak', async () => {
		const { data: michaela } = await supabaseAdmin
			.from('users')
			.select('id, currentStreak')
			.eq('email', 'michaela@defenseunicorns.com')
			.single();

		if (!michaela) {
			console.warn('⚠️  Michaela Flatau not found in database');
			return;
		}

		const { data: posts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('postedAt')
			.eq('userId', michaela.id)
			.order('postedAt', { ascending: false });

		const calculated = calculateUserStreak(posts || []);

		expect(michaela.currentStreak).toBe(calculated);
	});
});
