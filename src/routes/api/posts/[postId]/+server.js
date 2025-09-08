import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function DELETE(event) {
	try {
		const user = await getAuthenticatedUser(event);
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { postId } = event.params;

		// First, verify the post exists and belongs to the current user
		const { data: post, error: postError } = await supabaseAdmin
			.from('linkedin_posts')
			.select('userId, totalScore')
			.eq('id', postId)
			.single();

		if (postError || !post) {
			return json({ error: 'Post not found' }, { status: 404 });
		}

		if (post.userId !== user.id) {
			return json({ error: 'Unauthorized - you can only delete your own posts' }, { status: 403 });
		}

		// Delete associated analytics records first (cascades should handle this, but being explicit)
		await supabaseAdmin
			.from('post_analytics')
			.delete()
			.eq('postId', postId);

		// Delete the post
		const { error: deleteError } = await supabaseAdmin
			.from('linkedin_posts')
			.delete()
			.eq('id', postId);

		if (deleteError) {
			console.error('Delete error:', deleteError);
			return json({ error: 'Failed to delete post' }, { status: 500 });
		}

		// Update user stats after deletion - recalculate total score
		const { data: remainingPosts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('totalScore')
			.eq('userId', user.id);

		const newTotalScore = remainingPosts?.reduce((sum, post) => sum + (post.totalScore || 0), 0) || 0;

		await supabaseAdmin
			.from('users')
			.update({ totalScore: newTotalScore })
			.eq('id', user.id);

		return json({ 
			success: true, 
			message: 'Post deleted successfully',
			deletedPostScore: post.totalScore
		});

	} catch (error) {
		console.error('Delete post error:', error);
		return json({ error: 'Failed to delete post' }, { status: 500 });
	}
}