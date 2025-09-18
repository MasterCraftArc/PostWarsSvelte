import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';

export async function GET({ params }) {
	try {
		const { id } = params;

		if (!id) {
			return json({ error: 'User ID required' }, { status: 400 });
		}

		console.log('Looking for user with ID:', id);

		const { data: user, error } = await supabaseAdmin
			.from('users')
			.select(`
				id,
				email,
				name,
				role,
				totalScore,
				currentStreak,
				bestStreak,
				teamId,
				createdAt,
				teams!users_teamId_fkey (
					name
				)
			`)
			.eq('id', id)
			.single();

		console.log('User query result:', { user, error });

		if (error || !user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Format the response with team name
		const userData = {
			...user,
			teamName: user.teams?.name || 'No Team'
		};

		return json({ user: userData });
	} catch (error) {
		console.error('Error fetching user:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}