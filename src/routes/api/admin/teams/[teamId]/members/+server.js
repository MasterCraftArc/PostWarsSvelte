import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

// GET /api/admin/teams/[teamId]/members - Get team members
export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const { teamId } = event.params;
	
	// Check if user is admin or team lead of this team
	if (user.role !== 'ADMIN') {
		const { data: team } = await supabaseAdmin
			.from('teams')
			.select('teamLeadId')
			.eq('id', teamId)
			.single();
		
		if (!team || team.teamLeadId !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		// Get team with members
		const { data: team, error } = await supabaseAdmin
			.from('teams')
			.select(`
				*,
				members:users!users_teamId_fkey(id, name, email, role)
			`)
			.eq('id', teamId)
			.single();

		if (error) {
			console.error('Get team members error:', error);
			return json({ error: 'Failed to get team members' }, { status: 500 });
		}

		if (!team) {
			return json({ error: 'Team not found' }, { status: 404 });
		}

		return json({ team });
	} catch (error) {
		console.error('Get team members error:', error);
		return json({ error: 'Failed to get team members' }, { status: 500 });
	}
}

// POST /api/admin/teams/[teamId]/members - Add user to team
export async function POST(event) {
	const user = await getAuthenticatedUser(event);
	console.log('🚀 POST team members - user:', user ? `${user.email} (${user.role})` : 'null');
	
	if (!user) {
		console.log('❌ No user found in POST team members');
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const { teamId } = event.params;
	console.log('⏱️ POST team members - teamId:', teamId, 'user role:', user.role);
	
	// Check if user is admin or team lead of this team
	if (user.role !== 'ADMIN') {
		const { data: team } = await supabaseAdmin
			.from('teams')
			.select('teamLeadId')
			.eq('id', teamId)
			.single();
		
		if (!team || team.teamLeadId !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		const { userIds } = await event.request.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'userIds array is required' }, { status: 400 });
		}

		// Verify team exists
		const { data: team } = await supabaseAdmin
			.from('teams')
			.select('id')
			.eq('id', teamId)
			.single();

		if (!team) {
			return json({ error: 'Team not found' }, { status: 404 });
		}

		// Add users to team
		for (const userId of userIds) {
			await supabaseAdmin
				.from('users')
				.update({ teamId: teamId })
				.eq('id', userId);
		}

		// Get updated team with members
		const { data: updatedTeam } = await supabaseAdmin
			.from('teams')
			.select(`
				*,
				members:users!users_teamId_fkey(id, name, email, role)
			`)
			.eq('id', teamId)
			.single();

		return json({ team: updatedTeam });
	} catch (error) {
		console.error('Add team members error:', error);
		return json({ error: 'Failed to add team members' }, { status: 500 });
	}
}

// DELETE /api/admin/teams/[teamId]/members - Remove user from team
export async function DELETE(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const { teamId } = event.params;
	
	// Check if user is admin or team lead of this team
	if (user.role !== 'ADMIN') {
		const { data: team } = await supabaseAdmin
			.from('teams')
			.select('teamLeadId')
			.eq('id', teamId)
			.single();
		
		if (!team || team.teamLeadId !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		const { userIds } = await event.request.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'userIds array is required' }, { status: 400 });
		}

		// Remove users from team (only if they're currently in this team)
		for (const userId of userIds) {
			await supabaseAdmin
				.from('users')
				.update({ teamId: null })
				.eq('id', userId)
				.eq('teamId', teamId);
		}

		// Get updated team with members
		const { data: updatedTeam } = await supabaseAdmin
			.from('teams')
			.select(`
				*,
				members:users!users_teamId_fkey(id, name, email, role)
			`)
			.eq('id', teamId)
			.single();

		return json({ team: updatedTeam });
	} catch (error) {
		console.error('Remove team members error:', error);
		return json({ error: 'Failed to remove team members' }, { status: 500 });
	}
}