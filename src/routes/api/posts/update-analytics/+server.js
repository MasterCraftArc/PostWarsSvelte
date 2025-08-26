import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { calculatePostScore } from '$lib/gamification.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function POST(event) {
	try {
		const user = await getAuthenticatedUser(event);
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { postId } = await event.request.json();

		if (!postId) {
			return json({ error: 'Post ID required' }, { status: 400 });
		}

		// Get the post with latest analytics
		const { data: post, error: postError } = await supabaseAdmin
			.from('linkedin_posts')
			.select(`
				*,
				analytics:post_analytics(*)
			`)
			.eq('id', postId)
			.eq('userId', user.id)
			.single();

		if (postError || !post) {
			return json({ error: 'Post not found' }, { status: 404 });
		}

		// Sort analytics by recordedAt desc and get the latest
		const sortedAnalytics = (post.analytics || []).sort((a, b) => 
			new Date(b.recordedAt) - new Date(a.recordedAt)
		);

		// Use the job queue system for scraping with proper error handling
		let currentData;
		try {
			const { scrapeSinglePostQueued } = await import('$lib/linkedin-scraper-pool.js');
			currentData = await scrapeSinglePostQueued(post.url, user.id);
		} catch (scrapeError) {
			return json(
				{
					error: 'Failed to fetch updated post data: ' + scrapeError.message
				},
				{ status: 500 }
			);
		}

		if (!currentData) {
			return json({ error: 'No data could be extracted from the post' }, { status: 400 });
		}

		// Calculate growth since last check
		const lastAnalytics = sortedAnalytics[0];
		const reactionGrowth = currentData.reactions - (lastAnalytics?.reactions || post.reactions);
		const commentGrowth = currentData.comments - (lastAnalytics?.comments || post.comments);
		const repostGrowth = currentData.reposts - (lastAnalytics?.reposts || post.reposts);

		// Recalculate scoring with current engagement
		const { data: userPosts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('*')
			.eq('userId', user.id)
			.order('postedAt', { ascending: false });

		const currentStreak = userPosts?.length || 0;
		const scoring = calculatePostScore(
			{
				word_count: post.wordCount,
				reactions: currentData.reactions,
				comments: currentData.comments,
				reposts: currentData.reposts,
				timestamp: post.postedAt // Already a string from DB
			},
			currentStreak
		);

		// Update post with new engagement data
		const { data: updatedPost, error: updateError } = await supabaseAdmin
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
			.eq('id', postId)
			.select()
			.single();

		if (updateError) {
			console.error('Update post error:', updateError);
			return json({ error: 'Failed to update post' }, { status: 500 });
		}

		// Create new analytics record
		const { randomUUID } = await import('crypto');
		const analyticsId = randomUUID();

		const { error: analyticsError } = await supabaseAdmin
			.from('post_analytics')
			.insert({
				id: analyticsId,
				postId: postId,
				reactions: currentData.reactions,
				comments: currentData.comments,
				reposts: currentData.reposts,
				totalEngagement: currentData.total_engagement,
				reactionGrowth,
				commentGrowth,
				repostGrowth
			});

		if (analyticsError) {
			console.error('Analytics creation error:', analyticsError);
		}

		// Update user stats - calculate total score from all posts
		const { data: allUserPosts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('totalScore')
			.eq('userId', user.id);

		const totalUserScore = allUserPosts?.reduce((sum, post) => sum + (post.totalScore || 0), 0) || 0;

		await supabaseAdmin
			.from('users')
			.update({ totalScore: totalUserScore })
			.eq('id', user.id);

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
