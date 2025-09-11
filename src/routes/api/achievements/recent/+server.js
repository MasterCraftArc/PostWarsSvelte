import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function POST(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { userIds } = await event.request.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'userIds array is required' }, { status: 400 });
		}

		// Limit to prevent abuse
		if (userIds.length > 100) {
			return json({ error: 'Maximum 100 userIds allowed' }, { status: 400 });
		}

		// Fetch most recent achievement for each user
		const { data, error } = await supabaseAdmin
			.from('user_achievements')
			.select(
				`
				userId,
				earnedAt,
				achievements (
					name,
					icon,
					points
				)
			`
			)
			.in('userId', userIds)
			.order('earnedAt', { ascending: false });

		if (error) {
			return json({ error: 'Database error' }, { status: 500 });
		}

		// Group by userId and get most recent for each
		const userAchievements = {};

		if (data) {
			data.forEach((item) => {
				const userId = item.userId;
				// Only store if this is the first (most recent) achievement for this user
				if (!userAchievements[userId]) {
					userAchievements[userId] = {
						name: item.achievements.name,
						icon: item.achievements.icon,
						points: item.achievements.points,
						earnedAt: item.earnedAt
					};
				}
			});
		}

		return json({
			success: true,
			achievements: userAchievements
		});
	} catch (error) {
		console.error('Recent achievements API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
