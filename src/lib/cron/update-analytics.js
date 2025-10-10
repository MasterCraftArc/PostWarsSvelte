import { supabaseAdmin } from '../supabase-node.js';
import { calculatePostScore, updateUserStats } from '../gamification.js';

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
			.limit(50);

		if (postsError) {
			console.error('Error fetching posts to update:', postsError);
			return { success: false, error: postsError.message };
		}

		console.log(`Found ${postsToUpdate.length} posts to update`);

		let successCount = 0;
		let errorCount = 0;

		for (const post of postsToUpdate) {
			try {
				console.log(`Updating post ${post.id} (${post.url})`);

				// Scrape current data
				const { scrapeSinglePost } = await import('../linkedin-scraper.js');
				const currentData = await scrapeSinglePost(post.url, {
					headed: false,
					storageStatePath: 'non-existent-auth-file.json'
				});

				if (!currentData) {
					console.log(`No data extracted for post ${post.id}`);
					continue;
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

				const currentStreak = userPosts.length;
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
					console.error(`Error updating post ${post.id}:`, updateError);
					errorCount++;
					continue;
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
					console.error(`Error creating analytics for post ${post.id}:`, analyticsError);
				}

				successCount++;
				console.log(`Successfully updated post ${post.id}`);

				// Add delay to be respectful to LinkedIn
				await new Promise((resolve) => setTimeout(resolve, 2000));
			} catch (error) {
				console.error(`Error updating post ${post.id}:`, error);
				errorCount++;
			}
		}

		// Update all user stats after post updates
		const uniqueUserIds = [...new Set(postsToUpdate.map((p) => p.userId))];
		console.log(`Updating stats for ${uniqueUserIds.length} users`);

		for (const userId of uniqueUserIds) {
			try {
				await updateUserStats(userId);
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
