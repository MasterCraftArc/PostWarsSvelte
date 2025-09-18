import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';

export async function GET({ params }) {
	const { teamId } = params;

	try {
		// Get team members ordered by totalScore descending
		const { data: members, error } = await supabaseAdmin
			.from('users')
			.select('id, name, email, totalScore, currentStreak, bestStreak')
			.eq('teamId', teamId)
			.order('totalScore', { ascending: false });

		if (error) {
			throw error;
		}

		// Get team information
		const { data: team, error: teamError } = await supabaseAdmin
			.from('teams')
			.select('id, name')
			.eq('id', teamId)
			.single();

		if (teamError) {
			throw teamError;
		}

		return json({
			team,
			members: members || []
		});
	} catch (error) {
		console.error('Error fetching team members:', error);
		return json({ error: 'Failed to fetch team members' }, { status: 500 });
	}
}