import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';
import { supabaseAdmin } from '$lib/supabase-node.js';

export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Get team information if user has a team
	let team = null;
	if (user.teamId) {
		const { data: teamData } = await supabaseAdmin
			.from('teams')
			.select('id, name')
			.eq('id', user.teamId)
			.single();
		team = teamData;
	}

	return json({
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			totalScore: user.totalScore,
			currentStreak: user.currentStreak,
			bestStreak: user.bestStreak,
			teamId: user.teamId,
			team: team
		}
	});
}