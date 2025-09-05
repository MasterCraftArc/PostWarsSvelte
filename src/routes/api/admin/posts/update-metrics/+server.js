import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';
import { calculatePostScore } from '$lib/gamification-node.js';

// Maximum reasonable engagement limits to prevent data corruption
const ENGAGEMENT_LIMITS = {
	reactions: 100000,    // 100k max reactions
	comments: 10000,      // 10k max comments  
	reposts: 5000,        // 5k max reposts
	totalEngagement: 200000 // 200k max total
};

export async function POST(event) {
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

		const body = await event.request.json();
		const { postId, reactions, comments, reposts, reason } = body;

		// Validate input
		if (!postId) {
			return json({ error: 'Post ID is required' }, { status: 400 });
		}

		if (reactions === undefined && comments === undefined && reposts === undefined) {
			return json({ error: 'At least one metric (reactions, comments, reposts) must be provided' }, { status: 400 });
		}

		// Validate engagement limits
		if (reactions !== undefined) {
			if (reactions < 0 || reactions > ENGAGEMENT_LIMITS.reactions) {
				return json({ 
					error: `Reactions must be between 0 and ${ENGAGEMENT_LIMITS.reactions.toLocaleString()}` 
				}, { status: 400 });
			}
		}

		if (comments !== undefined) {
			if (comments < 0 || comments > ENGAGEMENT_LIMITS.comments) {
				return json({ 
					error: `Comments must be between 0 and ${ENGAGEMENT_LIMITS.comments.toLocaleString()}` 
				}, { status: 400 });
			}
		}

		if (reposts !== undefined) {
			if (reposts < 0 || reposts > ENGAGEMENT_LIMITS.reposts) {
				return json({ 
					error: `Reposts must be between 0 and ${ENGAGEMENT_LIMITS.reposts.toLocaleString()}` 
				}, { status: 400 });
			}
		}

		// Fetch current post data
		const { data: currentPost, error: fetchError } = await supabaseAdmin
			.from('linkedin_posts')
			.select('*')
			.eq('id', postId)
			.single();

		if (fetchError || !currentPost) {
			return json({ error: 'Post not found' }, { status: 404 });
		}

		// Prepare update object with new metrics (ensure integer values)
		const updateData = {
			reactions: reactions !== undefined ? parseInt(reactions) : currentPost.reactions,
			comments: comments !== undefined ? parseInt(comments) : currentPost.comments,
			reposts: reposts !== undefined ? parseInt(reposts) : currentPost.reposts,
			updatedAt: new Date().toISOString()
		};

		// Calculate new total engagement
		updateData.totalEngagement = updateData.reactions + updateData.comments + updateData.reposts;

		// Validate total engagement limit
		if (updateData.totalEngagement > ENGAGEMENT_LIMITS.totalEngagement) {
			return json({ 
				error: `Total engagement cannot exceed ${ENGAGEMENT_LIMITS.totalEngagement.toLocaleString()}` 
			}, { status: 400 });
		}

		// Recalculate scores using gamification logic
		
		// Get user's current streak for score calculation
		const { data: userData } = await supabaseAdmin
			.from('users')
			.select('currentStreak')
			.eq('id', currentPost.userId)
			.single();

		// Cap user streak to prevent explosive scoring
		const userStreak = Math.min(userData?.currentStreak || 0, 10);

		// Log values for debugging
		console.log('Debug scoring:', {
			reactions: updateData.reactions,
			comments: updateData.comments,
			reposts: updateData.reposts,
			userStreak,
			wordCount: currentPost.wordCount,
			timestamp: new Date(currentPost.postedAt).getTime()
		});

		// Calculate new scores
		const scoreData = calculatePostScore({
			reactions: updateData.reactions,
			comments: updateData.comments,
			reposts: updateData.reposts,
			wordCount: currentPost.wordCount,
			timestamp: new Date(currentPost.postedAt).getTime()
		}, userStreak);

		console.log('Score calculation result:', scoreData);

		updateData.baseScore = Math.round(scoreData.breakdown.basePoints);
		updateData.engagementScore = Math.round(scoreData.breakdown.engagementPoints);
		updateData.totalScore = scoreData.totalScore;

		// Update the post
		const { data: updatedPost, error: updateError } = await supabaseAdmin
			.from('linkedin_posts')
			.update(updateData)
			.eq('id', postId)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating post metrics:', updateError);
			return json({ error: 'Failed to update post metrics' }, { status: 500 });
		}

		// Create audit log entry
		const auditEntry = {
			entityType: 'POST_METRICS',
			entityId: postId,
			action: 'MANUAL_UPDATE',
			userId: authenticatedUser.id,
			oldData: {
				reactions: currentPost.reactions,
				comments: currentPost.comments,
				reposts: currentPost.reposts,
				totalEngagement: currentPost.totalEngagement,
				totalScore: currentPost.totalScore
			},
			newData: {
				reactions: updateData.reactions,
				comments: updateData.comments,
				reposts: updateData.reposts,
				totalEngagement: updateData.totalEngagement,
				totalScore: updateData.totalScore
			},
			reason: reason || 'Manual metrics correction',
			createdAt: new Date().toISOString()
		};

		// Store audit log (create table if needed)
		await supabaseAdmin
			.from('audit_logs')
			.insert(auditEntry)
			.catch(err => {
				// Log to console if audit table doesn't exist
				console.log('Audit log entry:', auditEntry);
				console.error('Could not write to audit_logs:', err.message);
			});

		// Update user's total score
		console.log('Updating user total score for userId:', currentPost.userId);
		const { error: rpcError } = await supabaseAdmin.rpc('update_user_total_score', {
			p_user_id: currentPost.userId
		});

		if (rpcError) {
			console.error('Could not update user total score:', rpcError);
		} else {
			console.log('Successfully updated user total score');
		}

		return json({
			success: true,
			message: 'Post metrics updated successfully',
			post: updatedPost,
			audit: {
				updatedBy: authenticatedUser.email,
				reason: reason || 'Manual metrics correction',
				timestamp: new Date().toISOString()
			}
		});

	} catch (error) {
		console.error('Error in update post metrics:', error);
		console.error('Error stack:', error.stack);
		return json({ 
			error: 'Internal server error', 
			details: error.message,
			stack: error.stack
		}, { status: 500 });
	}
}

// GET endpoint to retrieve a post's current metrics
export async function GET(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		if (authenticatedUser.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		const postId = event.url.searchParams.get('postId');
		if (!postId) {
			return json({ error: 'Post ID is required' }, { status: 400 });
		}

		const { data: post, error } = await supabaseAdmin
			.from('linkedin_posts')
			.select('*')
			.eq('id', postId)
			.single();

		if (error || !post) {
			return json({ error: 'Post not found' }, { status: 404 });
		}

		return json({ post });

	} catch (error) {
		console.error('Error fetching post metrics:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}