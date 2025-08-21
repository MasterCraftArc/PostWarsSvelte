import { json } from '@sveltejs/kit';
import { getLeaderboardData } from '$lib/gamification.js';

export async function GET({ url, locals }) {
	try {
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const timeframe = url.searchParams.get('timeframe') || 'all';

		if (!['all', 'month', 'week'].includes(timeframe)) {
			return json({ error: 'Invalid timeframe. Use: all, month, or week' }, { status: 400 });
		}

		const leaderboardData = await getLeaderboardData(timeframe);

		// Transform the data for frontend consumption
		const leaderboard = leaderboardData.map((user, index) => {
			const timeframePosts = user.linkedinPosts;
			const timeframeScore = timeframePosts.reduce((sum, post) => sum + post.totalScore, 0);
			const timeframeEngagement = timeframePosts.reduce(
				(sum, post) => sum + post.totalEngagement,
				0
			);

			return {
				rank: index + 1,
				id: user.id,
				name: user.name || user.email.split('@')[0],
				email: user.email,
				totalScore: timeframe === 'all' ? user.totalScore : timeframeScore,
				postsThisMonth: user.postsThisMonth,
				currentStreak: user.currentStreak,
				postsInTimeframe: timeframePosts.length,
				engagementInTimeframe: timeframeEngagement,
				achievements: user.achievements.map((ua) => ({
					name: ua.achievement.name,
					description: ua.achievement.description,
					icon: ua.achievement.icon,
					points: ua.achievement.points,
					earnedAt: ua.earnedAt
				})),
				isCurrentUser: user.id === locals.user.id
			};
		});

		return json({
			timeframe,
			leaderboard,
			userRank: leaderboard.find((u) => u.isCurrentUser)?.rank || null
		});
	} catch (error) {
		console.error('Leaderboard error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
