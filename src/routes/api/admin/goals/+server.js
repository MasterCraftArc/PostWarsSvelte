import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

// Function to update goal progress
async function updateGoalsProgress() {
	try {
		const { data: goals, error: goalsError } = await supabaseAdmin
			.from('goals')
			.select('*')
			.eq('status', 'ACTIVE');

		if (goalsError || !goals) {
			console.error('Failed to fetch goals for progress update:', goalsError);
			return { success: false, error: 'Failed to fetch goals' };
		}

		console.log(`🎯 Updating progress for ${goals.length} active goals`);

		for (const goal of goals) {
			let currentValue = 0;
			let userIds = [];

			if (goal.teamId === 'company-team-id') {
				// Company goal - get all user IDs
				const { data: allUsers } = await supabaseAdmin
					.from('users')
					.select('id');
				userIds = allUsers?.map(u => u.id) || [];

				if (userIds.length === 0) {
					console.log(`  ⚠️  Goal "${goal.title}": No users found for company goal`);
					continue;
				}
			} else {
				// Team goal - get team member IDs
				const { data: members } = await supabaseAdmin
					.from('users')
					.select('id')
					.eq('teamId', goal.teamId);
				userIds = members?.map(m => m.id) || [];

				if (userIds.length === 0) {
					console.log(`  ⚠️  Goal "${goal.title}": No team members found`);
					continue;
				}
			}

			switch (goal.type) {
				case 'POSTS_COUNT':
					// Count posts by users since goal was created (works for team and company goals)
					const { count: postCount } = await supabaseAdmin
						.from('linkedin_posts')
						.select('*', { count: 'exact', head: true })
						.in('userId', userIds)
						.gte('createdAt', goal.startDate);
					currentValue = postCount || 0;
					const scopeType = goal.teamId === 'company-team-id' ? 'company users' : 'team members';
					console.log(`    📊 ${goal.title}: Found ${currentValue} posts by ${userIds.length} ${scopeType} since ${goal.startDate}`);
					break;

				case 'TOTAL_ENGAGEMENT':
					// Sum all engagement (reactions + comments + reposts) from posts since goal started
					const { data: engagementData } = await supabaseAdmin
						.from('linkedin_posts')
						.select('totalEngagement')
						.in('userId', userIds)
						.gte('createdAt', goal.startDate);
					currentValue = engagementData?.reduce((sum, post) => sum + (post.totalEngagement || 0), 0) || 0;
					console.log(`    📊 ${goal.title}: Total engagement ${currentValue} from ${engagementData?.length || 0} posts`);
					break;

				case 'AVERAGE_ENGAGEMENT':
					// Calculate average engagement per post since goal started
					const { data: avgEngagementData } = await supabaseAdmin
						.from('linkedin_posts')
						.select('totalEngagement')
						.in('userId', userIds)
						.gte('createdAt', goal.startDate);
					if (avgEngagementData && avgEngagementData.length > 0) {
						const total = avgEngagementData.reduce((sum, post) => sum + (post.totalEngagement || 0), 0);
						currentValue = Math.round(total / avgEngagementData.length);
						console.log(`    📊 ${goal.title}: Average ${currentValue} from ${avgEngagementData.length} posts (total: ${total})`);
					} else {
						currentValue = 0;
						console.log(`    📊 ${goal.title}: No posts found for average calculation`);
					}
					break;

				case 'TEAM_SCORE':
					// Sum current total scores of users (team members for team goals, all users for company goals)
					const { data: scoringUsers } = await supabaseAdmin
						.from('users')
						.select('totalScore')
						.in('id', userIds);
					currentValue = scoringUsers?.reduce((sum, user) => sum + (user.totalScore || 0), 0) || 0;
					const scoreScope = goal.teamId === 'company-team-id' ? 'company users' : 'team members';
					console.log(`    📊 ${goal.title}: ${scoreScope} score ${currentValue} from ${scoringUsers?.length || 0} users`);
					break;

				default:
					console.log(`    ⚠️  Unknown goal type: ${goal.type}`);
					currentValue = 0;
					break;
			}

			const isCompleted = currentValue >= goal.targetValue;
			const newStatus = isCompleted ? 'COMPLETED' : 'ACTIVE';

			const { error: updateError } = await supabaseAdmin
				.from('goals')
				.update({ 
					currentValue,
					status: newStatus,
					updatedAt: new Date().toISOString()
				})
				.eq('id', goal.id);

			if (updateError) {
				console.error(`Failed to update goal ${goal.title}:`, updateError);
			} else {
				const progressPercent = Math.min(100, Math.round((currentValue / goal.targetValue) * 100));
				console.log(`  📈 Goal "${goal.title}": ${currentValue}/${goal.targetValue} (${progressPercent}%) ${isCompleted ? '✅ COMPLETED' : ''}`);
			}
		}

		console.log('✅ Goal progress updated successfully');
		return { success: true, goalsUpdated: goals.length };
	} catch (error) {
		console.error('❌ Error updating goal progress:', error);
		return { success: false, error: error.message };
	}
}

// GET /api/admin/goals - List all goals
export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	
	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		// Update all goal progress before fetching
		console.log('🎯 Updating goal progress for admin view...');
		await updateGoalsProgress();

		const { data: goals, error } = await supabaseAdmin
			.from('goals')
			.select(`
				*,
				team:teams(id, name)
			`)
			.order('createdAt', { ascending: false });

		if (error) {
			console.error('Supabase error:', error);
			return json({ error: 'Failed to fetch goals' }, { status: 500 });
		}

		return json({ goals: goals || [] });
	} catch (error) {
		console.error('Get goals error:', error);
		return json({ error: 'Failed to fetch goals' }, { status: 500 });
	}
}

// POST /api/admin/goals - Create new goal
export async function POST(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Allow admin and team leads to create goals
	if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const { 
			title, 
			description, 
			type, 
			targetValue, 
			teamId, 
			endDate 
		} = await event.request.json();

		if (!title || !type || !targetValue || !endDate) {
			return json({ 
				error: 'Title, type, targetValue, and endDate are required' 
			}, { status: 400 });
		}

		// Handle team vs company goals
		let finalTeamId = teamId;
		
		if (teamId && teamId !== 'company-team-id') {
			// Regular team goal - verify team exists and user has permission
			const { data: team, error: teamError } = await supabaseAdmin
				.from('teams')
				.select('id, teamLeadId')
				.eq('id', teamId)
				.single();

			if (teamError || !team) {
				return json({ error: 'Team not found' }, { status: 404 });
			}

			// Team leads can only create goals for their own team
			if (user.role === 'TEAM_LEAD' && team.teamLeadId !== user.id) {
				return json({ error: 'You can only create goals for your own team' }, { status: 403 });
			}
		} else if (!teamId || teamId === 'company') {
			// Company goal - only admins can create
			if (user.role !== 'ADMIN') {
				return json({ error: 'Only admins can create company-wide goals' }, { status: 403 });
			}
			// Use the special company team ID
			finalTeamId = 'company-team-id';
		}

		// Generate UUID for the goal
		const { randomUUID } = await import('crypto');
		const goalId = randomUUID();

		const { data: goal, error: goalError } = await supabaseAdmin
			.from('goals')
			.insert({
				id: goalId,
				title,
				description,
				type,
				targetValue: parseInt(targetValue),
				teamId: finalTeamId,
				endDate: new Date(endDate).toISOString()
			})
			.select(`
				*,
				team:teams(id, name)
			`)
			.single();

		if (goalError) {
			console.error('Create goal error:', goalError);
			return json({ error: 'Failed to create goal' }, { status: 500 });
		}

		return json({ goal });
	} catch (error) {
		console.error('Create goal error:', error);
		return json({ error: 'Failed to create goal' }, { status: 500 });
	}
}

// DELETE /api/admin/goals - Delete goal
export async function DELETE(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	
	if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const { id } = await event.request.json();

		if (!id) {
			return json({ error: 'Goal ID is required' }, { status: 400 });
		}

		// Get goal to check permissions
		const { data: goal, error: goalError } = await supabaseAdmin
			.from('goals')
			.select('*, team:teams!goals_teamId_fkey(teamLeadId)')
			.eq('id', id)
			.single();

		if (goalError || !goal) {
			return json({ error: 'Goal not found' }, { status: 404 });
		}

		// Team leads can only delete goals for their own team
		if (user.role === 'TEAM_LEAD' && goal.team.teamLeadId !== user.id) {
			return json({ error: 'You can only delete goals for your own team' }, { status: 403 });
		}

		// Delete the goal
		const { error: deleteError } = await supabaseAdmin
			.from('goals')
			.delete()
			.eq('id', id);

		if (deleteError) {
			console.error('Delete goal error:', deleteError);
			return json({ error: 'Failed to delete goal' }, { status: 500 });
		}

		console.log('✅ Goal deleted successfully:', id);

		return json({ success: true });
	} catch (error) {
		console.error('Delete goal error:', error);
		return json({ error: 'Failed to delete goal' }, { status: 500 });
	}
}