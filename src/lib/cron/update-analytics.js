import { supabaseAdmin } from '../supabase-node.js';
import { calculatePostScore, updateUserStats, calculateUserStreak, checkAndAwardAchievements } from '../gamification.js';

export async function updateAllPostAnalytics() {
	console.log('Starting analytics update job...');

	try {
		// Get all posts that need updating (older than 1 hour since last scrape)
		const oneHourAgo = new Date();
		oneHourAgo.setHours(oneHourAgo.getHours() - 1);

		const { data: postsToUpdate, error: postsError } = await supabaseAdmin
			.from('linkedin_posts')
			.select(`
				*,
				user:users(*),
				analytics:post_analytics(*)
			`)
			.lt('lastScrapedAt', oneHourAgo.toISOString())
			.order('lastScrapedAt', { ascending: true })
			.limit(30); // Reduced from 50 for faster completion (runs 2x daily = 60 posts/day coverage)

		if (postsError) {
			console.error('Error fetching posts to update:', postsError);
			return { success: false, error: postsError.message };
		}

		console.log(`Found ${postsToUpdate.length} posts to update`);

		let successCount = 0;
		let errorCount = 0;

		// Import browser pool scraper for concurrent processing
		const { scrapeSinglePostQueued, browserPool } = await import('../linkedin-scraper.js');

		// Process posts in parallel batches for 10x speedup
		const BATCH_SIZE = 10;
		const batches = [];
		for (let i = 0; i < postsToUpdate.length; i += BATCH_SIZE) {
			batches.push(postsToUpdate.slice(i, i + BATCH_SIZE));
		}

		console.log(`⚡ Processing ${batches.length} batches of up to ${BATCH_SIZE} posts in parallel`);
		const startTime = Date.now();

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			const batchStartTime = Date.now();
			console.log(`\n📦 Batch ${batchIndex + 1}/${batches.length}: Processing ${batch.length} posts concurrently...`);

			// Process all posts in batch concurrently
			const batchPromises = batch.map(async (post) => {
				try {
					console.log(`  🔄 [${post.id}] Starting scrape: ${post.url}`);

					// Use browser pool for faster scraping with reused contexts
					const currentData = await scrapeSinglePostQueued(post.url, post.userId);

					if (!currentData) {
						console.log(`  ⚠️  [${post.id}] No data extracted`);
						return { success: false, postId: post.id, error: 'No data extracted' };
					}

					// Calculate growth since last check
					const lastAnalytics = post.analytics && post.analytics.length > 0 ?
						post.analytics.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0] :
						null;
					const reactionGrowth = currentData.reactions - (lastAnalytics?.reactions || post.reactions);
					const commentGrowth = currentData.comments - (lastAnalytics?.comments || post.comments);
					const repostGrowth = currentData.reposts - (lastAnalytics?.reposts || post.reposts);

					// Recalculate scoring with current engagement
					const { data: userPosts } = await supabaseAdmin
						.from('linkedin_posts')
						.select('*')
						.eq('userId', post.userId)
						.order('postedAt', { ascending: false });

					const currentStreak = calculateUserStreak(userPosts);
					const scoring = calculatePostScore(
						{
							word_count: post.wordCount,
							reactions: currentData.reactions,
							comments: currentData.comments,
							reposts: currentData.reposts,
							timestamp: post.postedAt instanceof Date ? post.postedAt.toISOString() : post.postedAt
						},
						currentStreak
					);

					// Update post with new engagement data
					const { error: updateError } = await supabaseAdmin
						.from('linkedin_posts')
						.update({
							reactions: currentData.reactions,
							comments: currentData.comments,
							reposts: currentData.reposts,
							totalEngagement: currentData.total_engagement,
							engagementScore: scoring.engagementScore,
							totalScore: scoring.totalScore,
							lastScrapedAt: new Date().toISOString()
						})
						.eq('id', post.id);

					if (updateError) {
						console.error(`  ❌ [${post.id}] Database update failed:`, updateError.message);
						return { success: false, postId: post.id, error: updateError.message };
					}

					// Create new analytics record
					const { error: analyticsError } = await supabaseAdmin
						.from('post_analytics')
						.insert({
							postId: post.id,
							reactions: currentData.reactions,
							comments: currentData.comments,
							reposts: currentData.reposts,
							totalEngagement: currentData.total_engagement,
							reactionGrowth,
							commentGrowth,
							repostGrowth
						});

					if (analyticsError) {
						console.error(`  ⚠️  [${post.id}] Analytics insert failed:`, analyticsError.message);
					}

					console.log(`  ✅ [${post.id}] Updated successfully (${currentData.reactions} reactions, ${currentData.comments} comments, ${currentData.reposts} reposts)`);
					return { success: true, postId: post.id };

				} catch (error) {
					console.error(`  ❌ [${post.id}] Failed:`, error.message);
					return { success: false, postId: post.id, error: error.message };
				}
			});

			// Wait for all posts in batch to complete
			const batchResults = await Promise.allSettled(batchPromises);

			// Count successes and failures for this batch
			let batchSuccess = 0;
			let batchErrors = 0;
			batchResults.forEach(result => {
				if (result.status === 'fulfilled' && result.value.success) {
					successCount++;
					batchSuccess++;
				} else {
					errorCount++;
					batchErrors++;
				}
			});

			const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
			console.log(`  📊 Batch ${batchIndex + 1} completed in ${batchDuration}s: ${batchSuccess} successes, ${batchErrors} errors`);

			// Short delay between batches (respectful to LinkedIn but much faster)
			if (batchIndex < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		// Cleanup browser pool
		console.log('\n🧹 Cleaning up browser pool...');
		try {
			await browserPool.cleanup();
			console.log('✅ Browser pool cleaned up successfully');
		} catch (cleanupError) {
			console.error('⚠️  Browser cleanup error:', cleanupError.message);
		}

		const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(`\n⚡ Total scraping time: ${totalDuration}s (avg ${(totalDuration / postsToUpdate.length).toFixed(1)}s per post)`);
		console.log(`📈 Performance: ${postsToUpdate.length} posts in ${totalDuration}s = ${(postsToUpdate.length / (totalDuration / 60)).toFixed(1)} posts/minute`);

		// Update all user stats after post updates
		const uniqueUserIds = [...new Set(postsToUpdate.map((p) => p.userId))];
		console.log(`Updating stats for ${uniqueUserIds.length} users`);

		for (const userId of uniqueUserIds) {
			try {
				await updateUserStats(userId);
				// Check and award achievements after stats update
				await checkAndAwardAchievements(userId);
			} catch (error) {
				console.error(`Error updating user stats for ${userId}:`, error);
			}
		}

		console.log(`Analytics update completed. Success: ${successCount}, Errors: ${errorCount}`);

		return {
			success: true,
			processed: postsToUpdate.length,
			successCount,
			errorCount
		};
	} catch (error) {
		console.error('Analytics update job failed:', error);
		return {
			success: false,
			error: error.message
		};
	}
}

export async function initializeAchievements() {
	console.log('Initializing achievements...');

	const achievementData = [
		{
			name: 'First Post',
			description: 'Share your first LinkedIn post',
			icon: '🎉',
			points: 5,
			requirementType: 'posts_count',
			requirementValue: 1
		},
		{
			name: 'Consistent Creator',
			description: 'Post 5 times in a month',
			icon: '📝',
			points: 10,
			requirementType: 'posts_count',
			requirementValue: 5
		},
		{
			name: 'Engagement Magnet',
			description: 'Get 100 total reactions across all posts',
			icon: '🧲',
			points: 15,
			requirementType: 'engagement_total',
			requirementValue: 100
		},
		{
			name: 'Week Warrior',
			description: 'Post for 7 consecutive days',
			icon: '🔥',
			points: 20,
			requirementType: 'streak_days',
			requirementValue: 7
		},
		{
			name: 'Viral Moment',
			description: 'Get 50 reactions on a single post',
			icon: '🚀',
			points: 25,
			requirementType: 'single_post_reactions',
			requirementValue: 50
		},
		{
			name: 'Leaderboard Champion',
			description: 'Reach #1 on the individual leaderboard',
			icon: '👑',
			points: 30,
			requirementType: 'leaderboard_first_place',
			requirementValue: 1
		},
		{
			name: 'Race Winner',
			description: 'Be part of a team that wins a race goal',
			icon: '🏆',
			points: 25,
			requirementType: 'team_race_victory',
			requirementValue: 1
		}
	];

	for (const achievement of achievementData) {
		// Check if achievement exists
		const { data: existing } = await supabaseAdmin
			.from('achievements')
			.select('id')
			.eq('name', achievement.name)
			.single();

		if (existing) {
			// Update existing achievement
			await supabaseAdmin
				.from('achievements')
				.update(achievement)
				.eq('name', achievement.name);
		} else {
			// Create new achievement
			await supabaseAdmin
				.from('achievements')
				.insert(achievement);
		}
	}

	console.log('Achievements initialized');
}

// CLI support for running cron jobs (works in all environments)
const args = process.argv.slice(2);

console.log('🔍 Debug: Script loaded, args:', args);
console.log('🔍 Debug: NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 Debug: SUPABASE_SERVICE_KEY present:', !!process.env.SUPABASE_SERVICE_KEY);
console.log('🔍 Debug: PUBLIC_SUPABASE_URL present:', !!process.env.PUBLIC_SUPABASE_URL);
console.log('🔍 Debug: Checking for --update-analytics flag...');

if (args.includes('--update-analytics')) {
	console.log('✅ Debug: Found --update-analytics flag, starting job...');
	(async () => {
		try {
			console.log('🚀 Starting analytics update job...');
			console.log('📋 Step 1: Initializing achievements...');
			await initializeAchievements();
			console.log('✅ Step 1 completed: Achievements initialized');
			
			console.log('📋 Step 2: Starting post analytics update...');
			const result = await updateAllPostAnalytics();
			console.log('✅ Analytics update completed:', result);
			process.exit(result.success ? 0 : 1);
		} catch (error) {
			console.error('❌ Analytics update failed:', error);
			console.error('❌ Error stack:', error.stack);
			process.exit(1);
		}
	})();
} else {
	console.log('❌ Debug: No --update-analytics flag found in args:', args);
}

if (args.includes('--init-achievements')) {
	(async () => {
		try {
			console.log('🚀 Starting achievements initialization...');
			await initializeAchievements();
			console.log('✅ Achievements initialization completed');
			process.exit(0);
		} catch (error) {
			console.error('❌ Achievements initialization failed:', error);
			process.exit(1);
		}
	})();
}
