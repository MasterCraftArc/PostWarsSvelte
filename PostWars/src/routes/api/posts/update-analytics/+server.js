import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { scrapeSinglePost } from '$lib/linkedin-scraper.js';
import { calculatePostScore, updateUserStats } from '$lib/gamification.js';

export async function POST({ request, locals }) {
	try {
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { postId } = await request.json();

		if (!postId) {
			return json({ error: 'Post ID required' }, { status: 400 });
		}

		// Get the post
		const post = await prisma.linkedinPost.findFirst({
			where: {
				id: postId,
				userId: locals.user.id // Ensure user owns the post
			},
			include: {
				analytics: {
					orderBy: { recordedAt: 'desc' },
					take: 1
				}
			}
		});

		if (!post) {
			return json({ error: 'Post not found' }, { status: 404 });
		}

		// Scrape current data
		let currentData;
		try {
			currentData = await scrapeSinglePost(post.url, {
				headed: false,
				storageStatePath: 'linkedin_auth_state.json'
			});
		} catch (scrapeError) {
			console.error('Analytics update scraping failed:', scrapeError);
			return json(
				{
					error: 'Failed to fetch updated post data'
				},
				{ status: 400 }
			);
		}

		if (!currentData) {
			return json({ error: 'No data could be extracted' }, { status: 400 });
		}

		// Calculate growth since last check
		const lastAnalytics = post.analytics[0];
		const reactionGrowth = currentData.reactions - (lastAnalytics?.reactions || post.reactions);
		const commentGrowth = currentData.comments - (lastAnalytics?.comments || post.comments);
		const repostGrowth = currentData.reposts - (lastAnalytics?.reposts || post.reposts);

		// Recalculate scoring with current engagement
		const userPosts = await prisma.linkedinPost.findMany({
			where: { userId: locals.user.id },
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
		const updatedPost = await prisma.linkedinPost.update({
			where: { id: postId },
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
				postId: postId,
				reactions: currentData.reactions,
				comments: currentData.comments,
				reposts: currentData.reposts,
				totalEngagement: currentData.total_engagement,
				reactionGrowth,
				commentGrowth,
				repostGrowth
			}
		});

		// Update user stats
		await updateUserStats(locals.user.id);

		return json({
			post: updatedPost,
			growth: {
				reactions: reactionGrowth,
				comments: commentGrowth,
				reposts: repostGrowth,
				total: reactionGrowth + commentGrowth + repostGrowth
			},
			scoring: scoring
		});
	} catch (error) {
		console.error('Update analytics error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
