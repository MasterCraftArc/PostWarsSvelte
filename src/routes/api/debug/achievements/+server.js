import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Check if achievements table has data
		const { data: allAchievements, error: achievementsError } = await supabaseAdmin
			.from('achievements')
			.select('*')
			.limit(10);

		// Check if user has any achievements
		const { data: userAchievements, error: userAchError } = await supabaseAdmin
			.from('user_achievements')
			.select(`
				*,
				achievement:achievements(*)
			`)
			.eq('userId', authenticatedUser.id);

		// Check if user_achievements table has any data
		const { count: totalUserAchievements } = await supabaseAdmin
			.from('user_achievements')
			.select('*', { count: 'exact', head: true });

		// Test the dashboard RPC function
		const { data: dashboardData, error: dashboardError } = await supabaseAdmin
			.rpc('get_user_dashboard', {
				p_user_id: authenticatedUser.id
			});

		return json({
			achievements: {
				total: allAchievements?.length || 0,
				data: allAchievements,
				error: achievementsError
			},
			userAchievements: {
				count: userAchievements?.length || 0,
				data: userAchievements,
				error: userAchError
			},
			globalUserAchievements: {
				total: totalUserAchievements || 0
			},
			dashboardRPC: {
				success: !dashboardError,
				error: dashboardError,
				hasAchievements: dashboardData?.recentAchievements?.length || 0
			}
		});
		
	} catch (error) {
		return json({
			error: 'Debug failed',
			details: error.message
		}, { status: 500 });
	}
}