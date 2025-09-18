import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function POST(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { userIds, limit = 1 } = await event.request.json();

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
					points,
					description
				)
			`
			)
			.in('userId', userIds)
			.order('earnedAt', { ascending: false });

		if (error) {
			return json({ error: 'Database error' }, { status: 500 });
		}

		// Group by userId and get achievements for each (limited by limit parameter)
		const userAchievements = {};

		if (data) {
			data.forEach((item) => {
				const userId = item.userId;

				if (!userAchievements[userId]) {
					userAchievements[userId] = [];
				}

				// Add achievement if we haven't reached the limit for this user
				if (userAchievements[userId].length < limit) {
					userAchievements[userId].push({
						name: item.achievements.name,
						icon: item.achievements.icon,
						points: item.achievements.points,
						earnedAt: item.earnedAt,
						description: item.achievements.description || ''
					});
				}
			});
		}

		// For single user requests with limit 1, return the achievement directly (backward compatibility)
		if (userIds.length === 1 && limit === 1) {
			const userId = userIds[0];
			const achievements = userAchievements[userId];
			if (achievements && achievements.length > 0) {
				userAchievements[userId] = achievements[0];
			}
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
