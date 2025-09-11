import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		// Check authentication
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Fetch posts with basic user information for engagement calculation
		const { data: posts, error } = await supabaseAdmin
			.from('linkedin_posts')
			.select(`
				id,
				userId,
				reactions,
				comments,
				reposts,
				createdAt,
				user:users(id, name)
			`)
			.order('createdAt', { ascending: false })
			.limit(500);

		if (error) {
			console.error('Error fetching posts:', error);
			return json({ error: 'Failed to fetch posts' }, { status: 500 });
		}

		// Format the response
		const formattedPosts = posts.map(post => ({
			id: post.id,
			userId: post.userId,
			reactions: post.reactions || 0,
			comments: post.comments || 0,
			reposts: post.reposts || 0,
			createdAt: post.createdAt,
			userName: post.user?.name || 'Unknown'
		}));

		return json({ posts: formattedPosts });

	} catch (error) {
		console.error('Error in posts GET:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}