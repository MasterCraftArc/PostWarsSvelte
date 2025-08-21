import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { scrapeSinglePost } from '$lib/linkedin-scraper.js';
import {
	calculatePostScore,
	updateUserStats,
	checkAndAwardAchievements
} from '$lib/gamification.js';

export async function POST({ request, locals }) {
	try {
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { linkedinUrl } = await request.json();

		if (!linkedinUrl || !linkedinUrl.includes('linkedin.com')) {
			return json({ error: 'Valid LinkedIn URL required' }, { status: 400 });
		}

		// Check if post already exists
		const existingPost = await prisma.linkedinPost.findUnique({
			where: { url: linkedinUrl }
		});

		if (existingPost) {
			return json({ error: 'Post already tracked' }, { status: 409 });
		}

		// Scrape the LinkedIn post
		console.log(`Scraping post for user ${locals.user.id}: ${linkedinUrl}`);

		let scrapedData;
		try {
			scrapedData = await scrapeSinglePost(linkedinUrl, {
				headed: false,
				storageStatePath: 'linkedin_auth_state.json'
			});
		} catch (scrapeError) {
			console.error('Scraping failed:', scrapeError);
			return json(
				{
					error: 'Failed to scrape LinkedIn post. Please ensure the URL is accessible.'
				},
				{ status: 400 }
			);
		}

		if (!scrapedData) {
			return json({ error: 'No data could be extracted from the post' }, { status: 400 });
		}

		// Get user's current streak for scoring
		const userPosts = await prisma.linkedinPost.findMany({
			where: { userId: locals.user.id },
			orderBy: { postedAt: 'desc' }
		});

		const currentStreak =
			userPosts.length > 0 ? Math.max(...userPosts.map((p) => p.totalScore)) : 0;

		// Calculate scoring
		const scoring = calculatePostScore(
			{
				word_count: scrapedData.word_count,
				reactions: scrapedData.reactions,
				comments: scrapedData.comments,
				reposts: scrapedData.reposts,
				timestamp: scrapedData.timestamp
			},
			currentStreak
		);

		// Save to database (upsert to handle duplicates gracefully)
		const savedPost = await prisma.linkedinPost.upsert({
			where: {
				linkedinId: scrapedData.id || scrapedData.linkedinId
			},
			create: {
				userId: locals.user.id,
				linkedinId: scrapedData.id || scrapedData.linkedinId,
				url: linkedinUrl,
				content: scrapedData.text || scrapedData.content,
				authorName: scrapedData.author || scrapedData.authorName,
				reactions: scrapedData.reactions,
				comments: scrapedData.comments,
				reposts: scrapedData.reposts,
				totalEngagement: scrapedData.total_engagement,
				baseScore: scoring.baseScore,
				engagementScore: scoring.engagementScore,
				totalScore: scoring.totalScore,
				wordCount: scrapedData.word_count,
				charCount: scrapedData.char_count,
				postedAt: new Date(scrapedData.timestamp || scrapedData.postedAt),
				lastScrapedAt: new Date()
			},
			update: {
				reactions: scrapedData.reactions,
				comments: scrapedData.comments,
				reposts: scrapedData.reposts,
				totalEngagement: scrapedData.total_engagement,
				baseScore: scoring.baseScore,
				engagementScore: scoring.engagementScore,
				totalScore: scoring.totalScore,
				lastScrapedAt: new Date()
			}
		});

		// Create analytics record for this scraping session
		try {
			await prisma.postAnalytics.create({
				data: {
					postId: savedPost.id,
					reactions: scrapedData.reactions,
					comments: scrapedData.comments,
					reposts: scrapedData.reposts,
					totalEngagement: scrapedData.total_engagement,
					reactionGrowth: 0,
					commentGrowth: 0,
					repostGrowth: 0
				}
			});
		} catch (analyticsError) {
			// Analytics creation failed, but post was saved - continue
			console.log('Analytics creation failed:', analyticsError.message);
		}

		// Update user stats
		await updateUserStats(locals.user.id);

		// Check for new achievements
		const newAchievements = await checkAndAwardAchievements(locals.user.id);

		return json({
			post: savedPost,
			scoring: scoring,
			newAchievements: newAchievements
		});
	} catch (error) {
		console.error('Submit post error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
