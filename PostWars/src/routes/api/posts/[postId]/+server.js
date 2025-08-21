import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { updateUserStats } from '$lib/gamification.js';

export async function DELETE({ params, locals }) {
	try {
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { postId } = params;

		// First, verify the post exists and belongs to the current user
		const post = await prisma.linkedinPost.findUnique({
			where: { id: postId },
			select: { userId: true, totalScore: true }
		});

		if (!post) {
			return json({ error: 'Post not found' }, { status: 404 });
		}

		if (post.userId !== locals.user.id) {
			return json({ error: 'Unauthorized - you can only delete your own posts' }, { status: 403 });
		}

		// Delete associated analytics records first (due to foreign key constraints)
		await prisma.postAnalytics.deleteMany({
			where: { postId: postId }
		});

		// Delete the post
		await prisma.linkedinPost.delete({
			where: { id: postId }
		});

		// Update user stats after deletion
		await updateUserStats(locals.user.id);

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