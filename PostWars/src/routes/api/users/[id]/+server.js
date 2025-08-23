import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';

export async function GET({ params }) {
	try {
		const { id } = params;

		if (!id) {
			return json({ error: 'User ID required' }, { status: 400 });
		}

		const { data: user, error } = await supabaseAdmin
			.from('users')
			.select('id, email, name, role, totalScore, currentStreak, bestStreak, teamId, createdAt')
			.eq('id', id)
			.single();

		if (error || !user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		return json({ user });
	} catch (error) {
		console.error('Error fetching user:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}