import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

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

		if (!title || !type || !targetValue || !teamId || !endDate) {
			return json({ 
				error: 'Title, type, targetValue, teamId, and endDate are required' 
			}, { status: 400 });
		}

		// Verify team exists and user has permission
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
				teamId,
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