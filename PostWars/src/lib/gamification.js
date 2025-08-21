import { prisma } from './prisma/index.js';

export const SCORING_CONFIG = {
	// Base points for posting
	BASE_POST_POINTS: 10,

	// Engagement multipliers
	REACTION_POINTS: 1,
	COMMENT_POINTS: 3,
	REPOST_POINTS: 5,

	// Streak bonuses
	STREAK_MULTIPLIER: 0.1, // +10% per day streak
	MAX_STREAK_BONUS: 2.0, // Cap at 200% bonus

	// Word count bonuses
	MIN_WORDS_FOR_BONUS: 50,
	WORD_BONUS_POINTS: 0.1, // 0.1 points per word over minimum

	// Freshness decay (points decrease over time)
	FRESH_HOURS: 24,
	DECAY_RATE: 0.02 // 2% decay per day after fresh period
};

export function calculatePostScore(postData, userStreak = 0) {
	const { word_count, reactions, comments, reposts, timestamp } = postData;

	// Base score
	let score = SCORING_CONFIG.BASE_POST_POINTS;

	// Engagement scoring
	const engagementScore =
		reactions * SCORING_CONFIG.REACTION_POINTS +
		comments * SCORING_CONFIG.COMMENT_POINTS +
		reposts * SCORING_CONFIG.REPOST_POINTS;

	// Word count bonus
	const wordBonus =
		word_count > SCORING_CONFIG.MIN_WORDS_FOR_BONUS
			? (word_count - SCORING_CONFIG.MIN_WORDS_FOR_BONUS) * SCORING_CONFIG.WORD_BONUS_POINTS
			: 0;

	// Streak multiplier
	const streakMultiplier = Math.min(
		1 + userStreak * SCORING_CONFIG.STREAK_MULTIPLIER,
		SCORING_CONFIG.MAX_STREAK_BONUS
	);

	// Apply streak bonus to base + word bonus
	const baseWithBonus = (score + wordBonus) * streakMultiplier;

	// Freshness factor
	const postDate = new Date(timestamp);
	const now = new Date();
	const hoursSincePost = (now - postDate) / (1000 * 60 * 60);

	let freshnessFactor = 1;
	if (hoursSincePost > SCORING_CONFIG.FRESH_HOURS) {
		const daysOld = (hoursSincePost - SCORING_CONFIG.FRESH_HOURS) / 24;
		freshnessFactor = Math.max(0.1, 1 - daysOld * SCORING_CONFIG.DECAY_RATE);
	}

	const finalScore = Math.round((baseWithBonus + engagementScore) * freshnessFactor);

	return {
		baseScore: Math.round(score + wordBonus),
		engagementScore: Math.round(engagementScore),
		totalScore: finalScore,
		breakdown: {
			basePoints: score,
			wordBonus: Math.round(wordBonus),
			streakMultiplier: streakMultiplier,
			engagementPoints: engagementScore,
			freshnessFactor: freshnessFactor
		}
	};
}

export function calculateUserStreak(userPosts) {
	if (!userPosts || userPosts.length === 0) return 0;

	// Sort posts by date (newest first)
	const sortedPosts = userPosts.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

	let streak = 0;
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	for (let i = 0; i < sortedPosts.length; i++) {
		const postDate = new Date(sortedPosts[i].postedAt);
		postDate.setHours(0, 0, 0, 0);

		const expectedDate = new Date(today);
		expectedDate.setDate(today.getDate() - i);

		if (postDate.getTime() === expectedDate.getTime()) {
			streak++;
		} else {
			break;
		}
	}

	return streak;
}

export async function updateUserStats(userId) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			linkedinPosts: {
				orderBy: { postedAt: 'desc' }
			}
		}
	});

	if (!user) return null;

	const currentStreak = calculateUserStreak(user.linkedinPosts);
	const totalScore = user.linkedinPosts.reduce((sum, post) => sum + post.totalScore, 0);

	const thisMonth = new Date();
	thisMonth.setDate(1);
	thisMonth.setHours(0, 0, 0, 0);

	const postsThisMonth = user.linkedinPosts.filter(
		(post) => new Date(post.postedAt) >= thisMonth
	).length;

	const bestStreak = Math.max(user.bestStreak, currentStreak);

	return await prisma.user.update({
		where: { id: userId },
		data: {
			totalScore,
			postsThisMonth,
			currentStreak,
			bestStreak
		}
	});
}

export const ACHIEVEMENTS = [
	{
		name: 'First Post',
		description: 'Share your first LinkedIn post',
		icon: '🎉',
		points: 50,
		requirementType: 'posts_count',
		requirementValue: 1
	},
	{
		name: 'Consistent Creator',
		description: 'Post 5 times in a month',
		icon: '📝',
		points: 100,
		requirementType: 'posts_count',
		requirementValue: 5
	},
	{
		name: 'Engagement Magnet',
		description: 'Get 100 total reactions across all posts',
		icon: '🧲',
		points: 150,
		requirementType: 'engagement_total',
		requirementValue: 100
	},
	{
		name: 'Week Warrior',
		description: 'Post for 7 consecutive days',
		icon: '🔥',
		points: 200,
		requirementType: 'streak_days',
		requirementValue: 7
	},
	{
		name: 'Viral Moment',
		description: 'Get 50 reactions on a single post',
		icon: '🚀',
		points: 300,
		requirementType: 'single_post_reactions',
		requirementValue: 50
	}
];

export async function checkAndAwardAchievements(userId) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			linkedinPosts: true,
			achievements: {
				include: {
					achievement: true
				}
			}
		}
	});

	if (!user) return [];

	const earnedAchievementIds = new Set(user.achievements.map((ua) => ua.achievementId));

	const newAchievements = [];

	for (const achievementData of ACHIEVEMENTS) {
		// Skip if already earned
		const existingAchievement = await prisma.achievement.findUnique({
			where: { name: achievementData.name }
		});

		if (!existingAchievement) {
			// Create achievement if it doesn't exist
			await prisma.achievement.create({
				data: achievementData
			});
			continue;
		}

		if (earnedAchievementIds.has(existingAchievement.id)) continue;

		let isEarned = false;

		switch (achievementData.requirementType) {
			case 'posts_count':
				isEarned = user.linkedinPosts.length >= achievementData.requirementValue;
				break;

			case 'engagement_total':
				const totalEngagement = user.linkedinPosts.reduce(
					(sum, post) => sum + post.totalEngagement,
					0
				);
				isEarned = totalEngagement >= achievementData.requirementValue;
				break;

			case 'streak_days':
				isEarned = user.currentStreak >= achievementData.requirementValue;
				break;

			case 'single_post_reactions':
				const maxReactions = Math.max(...user.linkedinPosts.map((post) => post.reactions), 0);
				isEarned = maxReactions >= achievementData.requirementValue;
				break;
		}

		if (isEarned) {
			await prisma.userAchievement.create({
				data: {
					userId: userId,
					achievementId: existingAchievement.id
				}
			});

			newAchievements.push(existingAchievement);
		}
	}

	return newAchievements;
}

export function getLeaderboardData(timeframe = 'all') {
	const dateFilter = {};

	if (timeframe === 'month') {
		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);
		dateFilter.createdAt = { gte: startOfMonth };
	} else if (timeframe === 'week') {
		const startOfWeek = new Date();
		startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
		startOfWeek.setHours(0, 0, 0, 0);
		dateFilter.createdAt = { gte: startOfWeek };
	}

	return prisma.user.findMany({
		select: {
			id: true,
			name: true,
			email: true,
			totalScore: true,
			postsThisMonth: true,
			currentStreak: true,
			linkedinPosts: {
				select: {
					totalEngagement: true,
					totalScore: true,
					createdAt: true
				},
				where: dateFilter,
				orderBy: { createdAt: 'desc' }
			},
			achievements: {
				include: {
					achievement: true
				}
			}
		},
		orderBy: { totalScore: 'desc' },
		take: 50
	});
}
