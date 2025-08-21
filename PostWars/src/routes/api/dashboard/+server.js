import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';

export async function GET({ locals }) {
	try {
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const userId = locals.user.id;

		// Get user data
		const userData = await prisma.user.findUnique({
			where: { id: userId }
		});

		// Get posts separately 
		const linkedinPosts = await prisma.linkedinPost.findMany({
			where: { userId },
			orderBy: { postedAt: 'desc' },
			take: 10,
			include: {
				analytics: {
					orderBy: { recordedAt: 'desc' },
					take: 2 // Current and previous for growth calculation
				}
			}
		});

		// Get achievements separately
		const userAchievements = await prisma.userAchievement.findMany({
			where: { userId },
			include: {
				achievement: true
			},
			orderBy: { earnedAt: 'desc' }
		});

		if (!userData) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Calculate analytics
		const totalPosts = await prisma.linkedinPost.count({
			where: { userId }
		});

		const totalEngagement = await prisma.linkedinPost.aggregate({
			where: { userId },
			_sum: {
				totalEngagement: true
			}
		});

		const thisMonth = new Date();
		thisMonth.setDate(1);
		thisMonth.setHours(0, 0, 0, 0);

		const monthlyPosts = await prisma.linkedinPost.count({
			where: {
				userId,
				postedAt: { gte: thisMonth }
			}
		});

		const monthlyEngagement = await prisma.linkedinPost.aggregate({
			where: {
				userId,
				postedAt: { gte: thisMonth }
			},
			_sum: {
				totalEngagement: true
			}
		});

		// Get recent activity (posts with growth)
		const recentPosts = linkedinPosts.map((post) => {
			const latestAnalytics = post.analytics[0];
			const previousAnalytics = post.analytics[1];

			let growth = { reactions: 0, comments: 0, reposts: 0 };
			if (latestAnalytics && previousAnalytics) {
				growth = {
					reactions: latestAnalytics.reactions - previousAnalytics.reactions,
					comments: latestAnalytics.comments - previousAnalytics.comments,
					reposts: latestAnalytics.reposts - previousAnalytics.reposts
				};
			}

			return {
				id: post.id,
				url: post.url,
				content: post.content.substring(0, 150) + (post.content.length > 150 ? '...' : ''),
				authorName: post.authorName,
				reactions: post.reactions,
				comments: post.comments,
				reposts: post.reposts,
				totalEngagement: post.totalEngagement,
				totalScore: post.totalScore,
				postedAt: post.postedAt,
				lastScrapedAt: post.lastScrapedAt,
				growth
			};
		});

		// Get user rank
		const userRank =
			(await prisma.user.count({
				where: {
					totalScore: { gt: userData.totalScore }
				}
			})) + 1;

		// Recent achievements
		const recentAchievements = userAchievements.slice(0, 5).map((ua) => ({
			name: ua.achievement.name,
			description: ua.achievement.description,
			icon: ua.achievement.icon,
			points: ua.achievement.points,
			earnedAt: ua.earnedAt
		}));

		return json({
			user: {
				id: userData.id,
				name: userData.name,
				email: userData.email,
				totalScore: userData.totalScore,
				postsThisMonth: userData.postsThisMonth,
				currentStreak: userData.currentStreak,
				bestStreak: userData.bestStreak,
				rank: userRank
			},
			stats: {
				totalPosts,
				totalEngagement: totalEngagement._sum.totalEngagement || 0,
				monthlyPosts,
				monthlyEngagement: monthlyEngagement._sum.totalEngagement || 0,
				averageEngagement:
					totalPosts > 0 ? Math.round((totalEngagement._sum.totalEngagement || 0) / totalPosts) : 0
			},
			recentPosts,
			recentAchievements
		});
	} catch (error) {
		console.error('Dashboard error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
