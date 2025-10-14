import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		const user = await getAuthenticatedUser(event);

		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Fetch all teams (excluding company team)
		const { data: teams, error: teamsError } = await supabaseAdmin
			.from('teams')
			.select('id, name')
			.neq('id', 'company-team-id')
			.order('name');

		if (teamsError) {
			console.error('Error fetching teams:', teamsError);
			return json({ error: 'Failed to fetch teams' }, { status: 500 });
		}

		// Fetch all users to calculate team scores
		const { data: allUsers, error: usersError } = await supabaseAdmin
			.from('users')
			.select('teamId, totalScore, name');

		if (usersError) {
			console.error('Error fetching users:', usersError);
			return json({ error: 'Failed to fetch users' }, { status: 500 });
		}

		// Find Rob's score
		const robUser = allUsers.find(u =>
			u.name === 'Rob Slaughter' ||
			u.name === 'Rob' ||
			u.name?.toLowerCase().includes('rob slaughter')
		);
		const robScore = robUser?.totalScore || 0;

		console.log('[TeamVsRob API] Rob score:', robScore, 'from user:', robUser?.name);

		// Calculate each team's score
		const teamScores = teams.map(team => {
			const teamMembers = allUsers.filter(u => u.teamId === team.id);
			const totalScore = teamMembers.reduce((sum, member) => sum + (member.totalScore || 0), 0);

			console.log('[TeamVsRob API] Team:', team.name, 'score:', totalScore, 'members:', teamMembers.length);

			return {
				id: team.id,
				name: team.name,
				score: totalScore
			};
		});

		return json({
			success: true,
			teams: teamScores,
			robScore
		});

	} catch (error) {
		console.error('Team vs Rob API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
