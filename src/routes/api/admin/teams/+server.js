import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

// GET /api/admin/teams - List all teams
export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	console.log('🔍 Teams GET API - user:', user ? `${user.email} (${user.role})` : 'null');
	
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Allow admin to see all teams, team leads to see their own team
	if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		let query = supabaseAdmin
			.from('teams')
			.select(`
				*,
				teamLead:users!teams_teamLeadId_fkey(id, name, email),
				members:users!users_teamId_fkey(id, name, email, role),
				goals!goals_teamId_fkey(*)
			`)
			.order('createdAt', { ascending: false });

		// Filter teams based on user role
		if (user.role !== 'ADMIN') {
			query = query.eq('teamLeadId', user.id);
		}

		const { data: teams, error } = await query;
		
		console.log('🔍 Teams query result:', {
			error: error?.message,
			teamsCount: teams?.length || 0,
			userRole: user.role,
			isFiltered: user.role !== 'ADMIN',
			userId: user.id
		});

		// Debug: Show team leads for TEAM_LEAD users
		if (user.role === 'TEAM_LEAD' && teams?.length === 0) {
			console.log('🚨 TEAM_LEAD user found no teams. Checking all teams...');
			const { data: allTeams } = await supabaseAdmin.from('teams').select('id, name, teamLeadId');
			console.log('📊 All teams in database:', allTeams?.map(t => ({
				name: t.name,
				id: t.id,
				teamLeadId: t.teamLeadId,
				matches: t.teamLeadId === user.id
			})));
		}

		if (error) {
			console.error('Supabase error:', error);
			return json({ error: 'Failed to fetch teams' }, { status: 500 });
		}

		// Filter goals to only active ones and add counts
		const processedTeams = (teams || []).map(team => ({
			...team,
			goals: (team.goals || []).filter(goal => goal.status === 'ACTIVE'),
			_count: {
				members: team.members?.length || 0,
				goals: (team.goals || []).filter(goal => goal.status === 'ACTIVE').length
			}
		}));

		return json({ teams: processedTeams });
	} catch (error) {
		console.error('Get teams error:', error);
		return json({ error: 'Failed to fetch teams' }, { status: 500 });
	}
}

// POST /api/admin/teams - Create new team
export async function POST(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	
	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { name, description, teamLeadId } = await event.request.json();

		if (!name) {
			return json({ error: 'Team name is required' }, { status: 400 });
		}

		// Verify team lead exists and is eligible
		if (teamLeadId) {
			const { data: teamLead, error } = await supabaseAdmin
				.from('users')
				.select('*')
				.eq('id', teamLeadId)
				.single();

			if (error || !teamLead) {
				return json({ error: 'Team lead not found' }, { status: 400 });
			}

			if (teamLead.role === 'REGULAR') {
				// Promote user to TEAM_LEAD
				await supabaseAdmin
					.from('users')
					.update({ role: 'TEAM_LEAD' })
					.eq('id', teamLeadId);
			}
		}

		// Generate UUID for the team
		const { randomUUID } = await import('crypto');
		const teamId = randomUUID();

		const { data: team, error: createError } = await supabaseAdmin
			.from('teams')
			.insert({
				id: teamId,
				name,
				description,
				...(teamLeadId && { teamLeadId })
			})
			.select(`
				*,
				teamLead:users!teams_teamLeadId_fkey(id, name, email),
				members:users!users_teamId_fkey(id, name, email)
			`)
			.single();

		if (createError) {
			if (createError.code === '23505') { // Unique violation
				return json({ error: 'Team name already exists' }, { status: 409 });
			}
			console.error('Create team error:', createError);
			return json({ error: 'Failed to create team' }, { status: 500 });
		}

		return json({ team });
	} catch (error) {
		console.error('Create team error:', error);
		return json({ error: 'Failed to create team' }, { status: 500 });
	}
}

// PUT /api/admin/teams - Update existing team
export async function PUT(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	
	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { id, name, description, teamLeadId } = await event.request.json();

		if (!id) {
			return json({ error: 'Team ID is required' }, { status: 400 });
		}

		if (!name) {
			return json({ error: 'Team name is required' }, { status: 400 });
		}

		// Verify team lead exists and is eligible
		if (teamLeadId) {
			const { data: teamLead, error } = await supabaseAdmin
				.from('users')
				.select('*')
				.eq('id', teamLeadId)
				.single();

			if (error || !teamLead) {
				return json({ error: 'Team lead not found' }, { status: 400 });
			}

			// Allow TEAM_LEAD or ADMIN roles to be team leads
			if (teamLead.role === 'REGULAR') {
				// Update user role to TEAM_LEAD if they're being assigned as team lead
				await supabaseAdmin
					.from('users')
					.update({ role: 'TEAM_LEAD' })
					.eq('id', teamLeadId);
			}
		}

		// Update team
		const { data: team, error: updateError } = await supabaseAdmin
			.from('teams')
			.update({
				name,
				description,
				teamLeadId: teamLeadId || null
			})
			.eq('id', id)
			.select(`
				*,
				teamLead:users!teams_teamLeadId_fkey(id, name, email),
				members:users!users_teamId_fkey(id, name, email)
			`)
			.single();

		if (updateError) {
			if (updateError.code === '23505') { // Unique violation
				return json({ error: 'Team name already exists' }, { status: 409 });
			}
			console.error('Update team error:', updateError);
			return json({ error: 'Failed to update team' }, { status: 500 });
		}

		console.log('✅ Team updated successfully:', { teamId: id, teamLeadId, name });

		return json({ team });
	} catch (error) {
		console.error('Update team error:', error);
		return json({ error: 'Failed to update team' }, { status: 500 });
	}
}

// DELETE /api/admin/teams - Delete team
export async function DELETE(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	
	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { id } = await event.request.json();

		if (!id) {
			return json({ error: 'Team ID is required' }, { status: 400 });
		}

		// Remove team association from users first
		await supabaseAdmin
			.from('users')
			.update({ teamId: null })
			.eq('teamId', id);

		// Delete goals associated with team
		await supabaseAdmin
			.from('goals')
			.delete()
			.eq('teamId', id);

		// Delete the team
		const { error: deleteError } = await supabaseAdmin
			.from('teams')
			.delete()
			.eq('id', id);

		if (deleteError) {
			console.error('Delete team error:', deleteError);
			return json({ error: 'Failed to delete team' }, { status: 500 });
		}

		console.log('✅ Team deleted successfully:', id);

		return json({ success: true });
	} catch (error) {
		console.error('Delete team error:', error);
		return json({ error: 'Failed to delete team' }, { status: 500 });
	}
}