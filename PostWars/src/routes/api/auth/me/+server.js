import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
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
			teamId: user.teamId
		}
	});
}