import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		// Check authentication
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Check admin role
		if (authenticatedUser.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		// Fetch posts with user information
		const { data: posts, error } = await supabaseAdmin
			.from('linkedin_posts')
			.select(`
				*,
				user:users(id, name, email)
			`)
			.order('createdAt', { ascending: false })
			.limit(100);

		if (error) {
			console.error('Error fetching posts:', error);
			return json({ error: 'Failed to fetch posts' }, { status: 500 });
		}

		// Format the response
		const formattedPosts = posts.map(post => ({
			...post,
			userName: post.user?.name || 'Unknown',
			userEmail: post.user?.email || 'Unknown'
		}));

		return json({ posts: formattedPosts });

	} catch (error) {
		console.error('Error in admin posts GET:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}