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

		// Get query parameters
		const url = new URL(event.request.url);
		const userIdParam = url.searchParams.get('userId');

		// Fetch posts with basic user information for engagement calculation
		let query = supabaseAdmin
			.from('linkedin_posts')
			.select(`
				id,
				userId,
				url,
				content,
				reactions,
				comments,
				reposts,
				totalScore,
				createdAt,
				user:users(id, name)
			`)
			.order('createdAt', { ascending: false });

		// Apply filter if userId provided
		if (userIdParam) {
			query = query.eq('userId', userIdParam);
		} else {
			query = query.limit(500);
		}

		const { data: posts, error } = await query;

		if (error) {
			console.error('Error fetching posts:', error);
			return json({ error: 'Failed to fetch posts' }, { status: 500 });
		}

		// Format the response
		const formattedPosts = posts.map(post => ({
			id: post.id,
			userId: post.userId,
			url: post.url,
			content: post.content,
			reactions: post.reactions || 0,
			comments: post.comments || 0,
			reposts: post.reposts || 0,
			totalScore: post.totalScore || 0,
			createdAt: post.createdAt,
			userName: post.user?.name || 'Unknown'
		}));

		return json({ posts: formattedPosts });

	} catch (error) {
		console.error('Error in posts GET:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}