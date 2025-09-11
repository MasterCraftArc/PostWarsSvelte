import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';
import { checkAndAwardAchievements } from '$lib/gamification.js';

export async function POST(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { userIds } = await event.request.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'userIds array required' }, { status: 400 });
		}

		// Limit to prevent abuse  
		if (userIds.length > 50) {
			return json({ error: 'Maximum 50 userIds allowed' }, { status: 400 });
		}

		const results = [];
		let totalAwarded = 0;

		for (const userId of userIds) {
			try {
				const newAchievements = await checkAndAwardAchievements(userId);
				const count = newAchievements?.length || 0;
				totalAwarded += count;
				
				results.push({
					userId,
					newAchievements: newAchievements || [],
					count
				});
			} catch (error) {
				results.push({
					userId,
					error: error.message,
					count: 0
				});
			}
		}

		return json({
			success: true,
			message: `Auto-awarded achievements for ${userIds.length} users`,
			totalUsersChecked: userIds.length,
			totalAchievementsAwarded: totalAwarded,
			results
		});

	} catch (error) {
		console.error('Auto-award achievements error:', error);
		return json({
			error: 'Internal server error',
			details: error.message
		}, { status: 500 });
	}
}