import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		const user = await getAuthenticatedUser(event);
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Get all teams with team lead info and member count
		const { data: teams, error } = await supabaseAdmin
			.from('teams')
			.select(`
				id,
				name,
				description,
				teamLead:users!teams_teamLeadId_fkey(name),
				members:users!users_teamId_fkey(id)
			`)
			.order('name', { ascending: true });

		if (error) {
			console.error('Teams query error:', error);
			return json({ teams: [] });
		}

		// Transform the data
		const teamsData = (teams || []).map(team => ({
			id: team.id,
			name: team.name,
			description: team.description,
			memberCount: team.members?.length || 0,
			teamLead: team.teamLead?.name || 'No Lead'
		}));

		return json({ teams: teamsData });

	} catch (error) {
		console.error('Teams error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}