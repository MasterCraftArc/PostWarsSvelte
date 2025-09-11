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

		console.log('Testing achievements for user:', authenticatedUser.id);

		// First, let's manually check what the user has
		const { data: userPosts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('id, reactions, comments, reposts, totalEngagement')
			.eq('userId', authenticatedUser.id);

		const { data: existingAchievements } = await supabaseAdmin
			.from('user_achievements')
			.select(`
				*,
				achievements(*)
			`)
			.eq('userId', authenticatedUser.id);

		const { count: totalAchievements } = await supabaseAdmin
			.from('achievements')
			.select('*', { count: 'exact', head: true });

		// Now try to award achievements
		const newAchievements = await checkAndAwardAchievements(authenticatedUser.id);

		// Check achievements after awarding
		const { data: finalAchievements } = await supabaseAdmin
			.from('user_achievements')
			.select(`
				*,
				achievements(name, icon, points)
			`)
			.eq('userId', authenticatedUser.id);

		return json({
			success: true,
			userId: authenticatedUser.id,
			userPosts: {
				count: userPosts?.length || 0,
				totalReactions: userPosts?.reduce((sum, p) => sum + (p.reactions || 0), 0) || 0,
				data: userPosts?.slice(0, 3) // First 3 posts
			},
			existingAchievements: {
				count: existingAchievements?.length || 0,
				data: existingAchievements
			},
			totalAchievementTypes: totalAchievements || 0,
			newlyAwarded: newAchievements || [],
			finalAchievements: {
				count: finalAchievements?.length || 0,
				data: finalAchievements
			}
		});

	} catch (error) {
		console.error('Test achievements error:', error);
		return json({
			error: 'Test failed',
			details: error.message
		}, { status: 500 });
	}
}