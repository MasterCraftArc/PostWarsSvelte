import { prisma } from '../prisma/index.js';
import { scrapeSinglePost } from '../linkedin-scraper.js';
import { calculatePostScore, updateUserStats } from '../gamification.js';

export async function updateAllPostAnalytics() {
	console.log('Starting analytics update job...');

	try {
		// Get all posts that need updating (older than 1 hour since last scrape)
		const oneHourAgo = new Date();
		oneHourAgo.setHours(oneHourAgo.getHours() - 1);

		const postsToUpdate = await prisma.linkedinPost.findMany({
			where: {
				lastScrapedAt: { lt: oneHourAgo }
			},
			include: {
				user: true,
				analytics: {
					orderBy: { recordedAt: 'desc' },
					take: 1
				}
			},
			orderBy: { lastScrapedAt: 'asc' }, // Oldest first
			take: 50 // Limit to prevent overwhelming LinkedIn
		});

		console.log(`Found ${postsToUpdate.length} posts to update`);

		let successCount = 0;
		let errorCount = 0;

		for (const post of postsToUpdate) {
			try {
				console.log(`Updating post ${post.id} (${post.url})`);

				// Scrape current data
				const currentData = await scrapeSinglePost(post.url, {
					headed: false,
					storageStatePath: 'linkedin_auth_state.json'
				});

				if (!currentData) {
					console.log(`No data extracted for post ${post.id}`);
					continue;
				}

				// Calculate growth since last check
				const lastAnalytics = post.analytics[0];
				const reactionGrowth = currentData.reactions - (lastAnalytics?.reactions || post.reactions);
				const commentGrowth = currentData.comments - (lastAnalytics?.comments || post.comments);
				const repostGrowth = currentData.reposts - (lastAnalytics?.reposts || post.reposts);

				// Recalculate scoring with current engagement
				const userPosts = await prisma.linkedinPost.findMany({
					where: { userId: post.userId },
					orderBy: { postedAt: 'desc' }
				});

				const currentStreak = userPosts.length;
				const scoring = calculatePostScore(
					{
						word_count: post.wordCount,
						reactions: currentData.reactions,
						comments: currentData.comments,
						reposts: currentData.reposts,
						timestamp: post.postedAt.toISOString()
					},
					currentStreak
				);

				// Update post with new engagement data
				await prisma.linkedinPost.update({
					where: { id: post.id },
					data: {
						reactions: currentData.reactions,
						comments: currentData.comments,
						reposts: currentData.reposts,
						totalEngagement: currentData.total_engagement,
						engagementScore: scoring.engagementScore,
						totalScore: scoring.totalScore,
						lastScrapedAt: new Date()
					}
				});

				// Create new analytics record
				await prisma.postAnalytics.create({
					data: {
						postId: post.id,
						reactions: currentData.reactions,
						comments: currentData.comments,
						reposts: currentData.reposts,
						totalEngagement: currentData.total_engagement,
						reactionGrowth,
						commentGrowth,
						repostGrowth
					}
				});

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
			points: 50,
			requirementType: 'posts_count',
			requirementValue: 1
		},
		{
			name: 'Consistent Creator',
			description: 'Post 5 times in a month',
			icon: '📝',
			points: 100,
			requirementType: 'posts_count',
			requirementValue: 5
		},
		{
			name: 'Engagement Magnet',
			description: 'Get 100 total reactions across all posts',
			icon: '🧲',
			points: 150,
			requirementType: 'engagement_total',
			requirementValue: 100
		},
		{
			name: 'Week Warrior',
			description: 'Post for 7 consecutive days',
			icon: '🔥',
			points: 200,
			requirementType: 'streak_days',
			requirementValue: 7
		},
		{
			name: 'Viral Moment',
			description: 'Get 50 reactions on a single post',
			icon: '🚀',
			points: 300,
			requirementType: 'single_post_reactions',
			requirementValue: 50
		}
	];

	for (const achievement of achievementData) {
		await prisma.achievement.upsert({
			where: { name: achievement.name },
			update: achievement,
			create: achievement
		});
	}

	console.log('Achievements initialized');
}

// CLI support for running cron jobs manually
if (process.env.NODE_ENV !== 'production') {
	const args = process.argv.slice(2);

	if (args.includes('--update-analytics')) {
		(async () => {
			await initializeAchievements();
			const result = await updateAllPostAnalytics();
			console.log('Final result:', result);
			process.exit(result.success ? 0 : 1);
		})();
	}

	if (args.includes('--init-achievements')) {
		(async () => {
			await initializeAchievements();
			console.log('Done');
			process.exit(0);
		})();
	}
}
