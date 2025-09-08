import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function POST(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser || authenticatedUser.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		const { userId } = await event.request.json();
		if (!userId) {
			return json({ error: 'userId required' }, { status: 400 });
		}

		// Test the RPC function
		console.log('Testing update_user_total_score for userId:', userId);
		
		const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('update_user_total_score', {
			p_user_id: userId
		});

		// Fetch user data to see current state
		const { data: userData, error: userError } = await supabaseAdmin
			.from('users')
			.select('id, name, totalScore')
			.eq('id', userId)
			.single();

		// Fetch user's posts to manually calculate what the score should be
		const { data: postsData, error: postsError } = await supabaseAdmin
			.from('linkedin_posts')
			.select('totalScore')
			.eq('userId', userId);

		const expectedTotal = postsData?.reduce((sum, post) => sum + (post.totalScore || 0), 0) || 0;

		return json({
			rpc: {
				success: !rpcError,
				error: rpcError?.message,
				data: rpcData
			},
			user: {
				success: !userError,
				error: userError?.message,
				data: userData
			},
			posts: {
				success: !postsError,
				error: postsError?.message,
				count: postsData?.length || 0,
				totalScore: expectedTotal
			},
			comparison: {
				userTotalScore: userData?.totalScore,
				expectedTotalScore: expectedTotal,
				matches: userData?.totalScore === expectedTotal
			}
		});

	} catch (error) {
		return json({
			error: 'Test failed',
			details: error.message,
			stack: error.stack
		}, { status: 500 });
	}
}