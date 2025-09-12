import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { calculateCommentActivityScore, updateUserStats } from '$lib/gamification.js';

export async function POST({ request, locals }) {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { targetPostUrl } = await request.json();

		// Validate required fields
		if (!targetPostUrl) {
			return json({ error: 'LinkedIn post URL is required' }, { status: 400 });
		}

		// Validate LinkedIn URL format
		const linkedinUrlPattern = /^https:\/\/(www\.)?linkedin\.com\/posts\/.*$/;
		if (!linkedinUrlPattern.test(targetPostUrl)) {
			return json({ error: 'Invalid LinkedIn post URL format' }, { status: 400 });
		}

		// Check for duplicate submission
		const { data: existingActivity } = await supabaseAdmin
			.from('comment_activities')
			.select('id')
			.eq('user_id', locals.user.id)
			.eq('target_post_url', targetPostUrl)
			.single();

		if (existingActivity) {
			return json({ error: 'You have already logged activity for this post' }, { status: 409 });
		}

		// Calculate points
		const pointsAwarded = calculateCommentActivityScore();

		// Create comment activity record
		const { data: activity, error: insertError } = await supabaseAdmin
			.from('comment_activities')
			.insert({
				user_id: locals.user.id,
				target_post_url: targetPostUrl,
				points_awarded: pointsAwarded
			})
			.select()
			.single();

		if (insertError) {
			console.error('Error creating comment activity:', insertError);
			return json({ error: 'Failed to log comment activity' }, { status: 500 });
		}

		// Update user stats
		try {
			await updateUserStats(locals.user.id);
		} catch (statsError) {
			console.error('Error updating user stats:', statsError);
			// Don't fail the request if stats update fails
		}

		return json({
			success: true,
			activity,
			points_awarded: pointsAwarded,
			message: `Comment activity logged! You earned ${pointsAwarded} points.`
		});

	} catch (error) {
		console.error('Comment activity submission error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}