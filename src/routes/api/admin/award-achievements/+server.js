import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';
import { checkAndAwardAchievements } from '$lib/gamification-node.js';

export async function POST(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser || authenticatedUser.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		const { userId } = await event.request.json();

		if (userId) {
			// Award achievements for a specific user
			console.log('Checking achievements for user:', userId);
			const newAchievements = await checkAndAwardAchievements(userId);
			
			return json({
				success: true,
				message: `Checked achievements for user ${userId}`,
				newAchievements: newAchievements || [],
				count: newAchievements?.length || 0
			});
		} else {
			// Award achievements for all users
			console.log('Checking achievements for all users...');
			
			const { data: users, error: usersError } = await supabaseAdmin
				.from('users')
				.select('id, name');

			if (usersError) {
				return json({ error: 'Failed to fetch users' }, { status: 500 });
			}

			const results = [];
			let totalAwarded = 0;

			for (const user of users || []) {
				try {
					const newAchievements = await checkAndAwardAchievements(user.id);
					const count = newAchievements?.length || 0;
					totalAwarded += count;
					
					if (count > 0) {
						results.push({
							userId: user.id,
							userName: user.name,
							newAchievements,
							count
						});
					}
				} catch (error) {
					console.error(`Error checking achievements for user ${user.id}:`, error);
					results.push({
						userId: user.id,
						userName: user.name,
						error: error.message,
						count: 0
					});
				}
			}

			return json({
				success: true,
				message: `Checked achievements for ${users?.length || 0} users`,
				totalUsersChecked: users?.length || 0,
				totalAchievementsAwarded: totalAwarded,
				results: results.filter(r => r.count > 0 || r.error) // Only show users who got achievements or had errors
			});
		}

	} catch (error) {
		console.error('Award achievements error:', error);
		return json({
			error: 'Internal server error',
			details: error.message
		}, { status: 500 });
	}
}