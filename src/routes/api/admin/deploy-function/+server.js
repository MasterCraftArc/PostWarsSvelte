import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function POST(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser || authenticatedUser.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		// Since we can't execute arbitrary SQL through Supabase client,
		// let's just implement the user score update logic directly
		const { userId } = await event.request.json();
		
		if (!userId) {
			return json({ error: 'userId required for testing' }, { status: 400 });
		}

		// Manual implementation of update_user_total_score
		console.log('Updating user total score for:', userId);
		
		// Get all posts for the user
		const { data: userPosts, error: postsError } = await supabaseAdmin
			.from('linkedin_posts')
			.select('totalScore')
			.eq('userId', userId);
		
		if (postsError) {
			return json({ error: 'Failed to fetch user posts', details: postsError }, { status: 500 });
		}

		// Calculate total score
		const newTotalScore = userPosts?.reduce((sum, post) => sum + (post.totalScore || 0), 0) || 0;
		
		// Update user's total score
		const { data: updatedUser, error: updateError } = await supabaseAdmin
			.from('users')
			.update({ totalScore: newTotalScore })
			.eq('id', userId)
			.select('id, name, totalScore')
			.single();
		
		if (updateError) {
			return json({ error: 'Failed to update user score', details: updateError }, { status: 500 });
		}

		return json({
			success: true,
			message: 'User score updated successfully (manual implementation)',
			user: updatedUser,
			postsCount: userPosts?.length || 0,
			calculatedScore: newTotalScore
		});
		
	} catch (error) {
		console.error('Deploy function error:', error);
		return json({ 
			error: 'Internal server error', 
			details: error.message 
		}, { status: 500 });
	}
}