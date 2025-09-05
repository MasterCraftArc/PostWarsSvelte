import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';
import { calculatePostScore } from '$lib/gamification-node.js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_KEY } from '$env/static/private';

// Maximum reasonable engagement limits to prevent data corruption
const ENGAGEMENT_LIMITS = {
	reactions: 100000,    // 100k max reactions
	comments: 10000,      // 10k max comments  
	reposts: 5000,        // 5k max reposts
	totalEngagement: 200000 // 200k max total
};

export async function POST(event) {
	try {
		console.log('=== UPDATE METRICS API START ===');
		
		// Log environment variables (safely)
		console.log('Environment Check:', {
			hasSupabaseUrl: !!PUBLIC_SUPABASE_URL,
			hasAnonKey: !!PUBLIC_SUPABASE_ANON_KEY, 
			hasServiceKey: !!SUPABASE_SERVICE_KEY,
			supabaseUrl: PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
			domain: event.url.hostname,
			origin: event.request.headers.get('origin'),
			userAgent: event.request.headers.get('user-agent')?.substring(0, 50)
		});
		
		// Check authentication
		console.log('Step 1: Checking authentication...');
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}
		console.log('Step 1: Authentication successful', authenticatedUser.email);

		// Check admin role
		console.log('Step 2: Checking admin role...');
		if (authenticatedUser.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}
		console.log('Step 2: Admin role confirmed');

		console.log('Step 3: Parsing request body...');
		const body = await event.request.json();
		const { postId, reactions, comments, reposts, reason } = body;
		console.log('Step 3: Request body parsed', { postId, reactions, comments, reposts });

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
		console.log('Step 4: Fetching current post data...');
		let currentPost;
		try {
			const { data: fetchedPost, error: fetchError } = await supabaseAdmin
				.from('linkedin_posts')
				.select('*')
				.eq('id', postId)
				.single();

			if (fetchError || !fetchedPost) {
				console.log('Step 4: Post fetch failed', fetchError);
				return json({ error: 'Post not found' }, { status: 404 });
			}
			currentPost = fetchedPost;
			console.log('Step 4: Post fetched successfully', currentPost.id);
		} catch (dbError) {
			console.error('Step 4: Database error during post fetch:', dbError);
			return json({ error: 'Database connection error' }, { status: 500 });
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
		console.log('Step 5: Starting score calculation...');
		try {
			// Get user's current streak for score calculation
			console.log('Step 5a: Fetching user streak...');
			const { data: userData } = await supabaseAdmin
				.from('users')
				.select('currentStreak')
				.eq('id', currentPost.userId)
				.single();

			// Cap user streak to prevent explosive scoring
			const userStreak = Math.min(userData?.currentStreak || 0, 10);
			console.log('Step 5b: User streak calculated:', userStreak);

			// Log values for debugging
			console.log('Step 5c: Preparing score calculation with:', {
				reactions: updateData.reactions,
				comments: updateData.comments,
				reposts: updateData.reposts,
				userStreak,
				wordCount: currentPost.wordCount,
				timestamp: new Date(currentPost.postedAt).getTime()
			});

			// Calculate new scores
			console.log('Step 5d: Calling calculatePostScore...');
			const scoreData = calculatePostScore({
				reactions: updateData.reactions,
				comments: updateData.comments,
				reposts: updateData.reposts,
				wordCount: currentPost.wordCount,
				timestamp: new Date(currentPost.postedAt).getTime()
			}, userStreak);

			console.log('Step 5e: Score calculation result:', scoreData);

			updateData.baseScore = Math.round(scoreData.breakdown.basePoints);
			updateData.engagementScore = Math.round(scoreData.breakdown.engagementPoints);
			updateData.totalScore = scoreData.totalScore;
			
			console.log('Step 5f: Score calculation completed successfully');
		} catch (scoreError) {
			console.error('Step 5: Score calculation failed:', scoreError);
			return json({ error: 'Score calculation error', details: scoreError.message }, { status: 500 });
		}

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
		try {
			await supabaseAdmin
				.from('audit_logs')
				.insert(auditEntry);
		} catch (err) {
			// Log to console if audit table doesn't exist
			console.log('Audit log entry:', auditEntry);
			console.error('Could not write to audit_logs:', err.message);
		}

		// Update user's total score
		console.log('Updating user total score for userId:', currentPost.userId);
		const { error: rpcError } = await supabaseAdmin.rpc('update_user_total_score', {
			p_user_id: currentPost.userId
		});

		if (rpcError) {
			console.error('Could not update user total score:', rpcError);
		} else {
			console.log('Successfully updated user total score');
			
			// Verify the update worked by fetching the user's new total score
			const { data: updatedUser } = await supabaseAdmin
				.from('users')
				.select('totalScore, name')
				.eq('id', currentPost.userId)
				.single();
			
			console.log('User total score after update:', {
				userId: currentPost.userId,
				userName: updatedUser?.name,
				newTotalScore: updatedUser?.totalScore
			});
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
		console.error('=== CRITICAL ERROR ===');
		console.error('Error in update post metrics:', error);
		console.error('Error stack:', error.stack);
		
		// Return detailed error info for debugging
		return json({ 
			error: 'Internal server error', 
			details: error.message,
			stack: error.stack,
			name: error.name,
			environment: {
				hasSupabaseUrl: !!PUBLIC_SUPABASE_URL,
				hasAnonKey: !!PUBLIC_SUPABASE_ANON_KEY,
				hasServiceKey: !!SUPABASE_SERVICE_KEY,
				nodeEnv: process.env.NODE_ENV,
				netlifyContext: process.env.CONTEXT
			},
			debug: 'This is a debug response to diagnose the 500 error'
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