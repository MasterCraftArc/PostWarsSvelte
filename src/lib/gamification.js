import { supabaseAdmin } from './supabase-node.js';
import { randomUUID } from 'crypto';

export const SCORING_CONFIG = {
	// Base points for posting
	BASE_POST_POINTS: 1,

	// Engagement multipliers
	REACTION_POINTS: 0.1, // 200 reactions * 0.1 = 20 points
	COMMENT_POINTS: 0.5, // 0.5 points per comment
	REPOST_POINTS: 0, // Exclude reposts from earning points

	// Comment activity points (separate from posts)
	COMMENT_ACTIVITY_POINTS: 0.5, // 0.5 base points as requested
	MAX_DAILY_COMMENTS: 5,

	// Streak bonuses
	STREAK_MULTIPLIER: 0.15, // +15% per day streak
	MAX_STREAK_BONUS: 2.0, // Cap at 200% bonus

	// Freshness decay (points decrease over time)
	FRESH_HOURS: 24,
	DECAY_RATE: 0.02 // 2% decay per day after fresh period
};

export function calculatePostScore(postData, userStreak = 0) {
	const { reactions, comments, reposts, timestamp } = postData;

	// Base score
	let score = SCORING_CONFIG.BASE_POST_POINTS;

	// Engagement scoring
	const engagementScore =
		reactions * SCORING_CONFIG.REACTION_POINTS +
		comments * SCORING_CONFIG.COMMENT_POINTS +
		reposts * SCORING_CONFIG.REPOST_POINTS;


	// Streak multiplier
	const streakMultiplier = Math.min(
		1 + userStreak * SCORING_CONFIG.STREAK_MULTIPLIER,
		SCORING_CONFIG.MAX_STREAK_BONUS
	);

	// Apply streak bonus to base score
	const baseWithBonus = score * streakMultiplier;

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
		baseScore: Math.round(score),
		engagementScore: Math.round(engagementScore),
		totalScore: finalScore,
		breakdown: {
			basePoints: score,
			streakMultiplier: streakMultiplier,
			engagementPoints: engagementScore,
			freshnessFactor: freshnessFactor
		}
	};
}

export function calculateUserStreak(userPosts) {
	if (!userPosts || userPosts.length === 0) return 0;

	// Use createdAt (when user submitted to app) instead of postedAt (LinkedIn's timestamp)
	// This avoids timezone issues where late-night posts show as next day
	const sortedPosts = userPosts.sort((a, b) => {
		const aTime = new Date(a.createdAt || a.postedAt);
		const bTime = new Date(b.createdAt || b.postedAt);
		return bTime - aTime;
	});

	// Check if most recent post is within grace period (36 hours to account for all timezones)
	const now = new Date();
	const mostRecentPostTime = new Date(sortedPosts[0].createdAt || sortedPosts[0].postedAt);
	const hoursSinceLastPost = (now - mostRecentPostTime) / (1000 * 60 * 60);

	// If no post in 36 hours, streak is broken
	if (hoursSinceLastPost > 36) {
		return 0;
	}

	// Get unique post dates (handle multiple posts per day)
	// Use 27-hour windows instead of strict calendar days to handle timezone differences
	const uniquePostDays = [];
	const dayThreshold = 27 * 60 * 60 * 1000; // 27 hours in milliseconds

	for (const post of sortedPosts) {
		const postTime = new Date(post.createdAt || post.postedAt);

		// Check if this post is in a new "day" compared to existing days
		const isNewDay = uniquePostDays.every(existingDay => {
			const timeDiff = Math.abs(postTime - existingDay);
			return timeDiff >= dayThreshold;
		});

		if (isNewDay) {
			uniquePostDays.push(postTime);
		}
	}

	// Sort the unique days (newest first)
	uniquePostDays.sort((a, b) => b - a);

	// Calculate streak by checking gaps between consecutive posting days
	let streak = 1; // Start with 1 for the most recent post

	for (let i = 0; i < uniquePostDays.length - 1; i++) {
		const currentDay = uniquePostDays[i];
		const nextDay = uniquePostDays[i + 1];
		const hoursBetween = (currentDay - nextDay) / (1000 * 60 * 60);

		// If gap is more than 36 hours (1.5 days), streak is broken
		// This accounts for: posted Mon 11pm EST, then Wed 6am EST = ~31 hours (still valid)
		if (hoursBetween > 36) {
			break;
		}

		streak++;
	}

	return streak;
}

export async function updateUserStats(userId) {
	const { data: user, error: userError } = await supabaseAdmin
		.from('users')
		.select('id, bestStreak')
		.eq('id', userId)
		.single();

	if (userError || !user) return null;

	const { data: linkedinPosts } = await supabaseAdmin
		.from('linkedin_posts')
		.select('totalScore, postedAt')
		.eq('userId', userId)
		.order('postedAt', { ascending: false });

	// Get comment activities for total score calculation
	const { data: commentActivities } = await supabaseAdmin
		.from('comment_activities')
		.select('points_awarded')
		.eq('user_id', userId);

	if (!linkedinPosts && !commentActivities) return null;

	const currentStreak = calculateUserStreak(linkedinPosts || []);
	const postsScore = (linkedinPosts || []).reduce((sum, post) => sum + (post.totalScore || 0), 0);
	const commentScore = (commentActivities || []).reduce((sum, activity) => sum + (activity.points_awarded || 0), 0);

	// Get achievement points
	const { data: userAchievements } = await supabaseAdmin
		.from('user_achievements')
		.select(`
			achievements (
				points
			)
		`)
		.eq('userId', userId);

	const achievementScore = (userAchievements || []).reduce((sum, ua) => sum + (ua.achievements?.points || 0), 0);
	const totalScore = postsScore + commentScore + achievementScore;

	const thisMonth = new Date();
	thisMonth.setDate(1);
	thisMonth.setHours(0, 0, 0, 0);

	const postsThisMonth = (linkedinPosts || []).filter(
		(post) => new Date(post.postedAt) >= thisMonth
	).length;

	const bestStreak = Math.max(user.bestStreak || 0, currentStreak);

	const { data: updatedUsers, error: updateError } = await supabaseAdmin
		.from('users')
		.update({
			totalScore,
			postsThisMonth,
			currentStreak,
			bestStreak
		})
		.eq('id', userId)
		.select();

	if (updateError) {
		console.error('Error updating user stats:', updateError);
		return null;
	}

	return updatedUsers && updatedUsers.length > 0 ? updatedUsers[0] : null;
}

export const ACHIEVEMENTS = [
	{
		name: 'First Post',
		description: 'Share your first LinkedIn post',
		icon: '🎉',
		points: 5, // Base achievement points
		requirementType: 'posts_count',
		requirementValue: 1
	},
	{
		name: 'Consistent Creator',
		description: 'Post 5 times in a month',
		icon: '📝',
		points: 10, // Build up from base
		requirementType: 'posts_count',
		requirementValue: 5
	},
	{
		name: 'Engagement Magnet',
		description: 'Get 100 total reactions across all posts',
		icon: '🧲',
		points: 15, // Mid-tier achievement
		requirementType: 'engagement_total',
		requirementValue: 100
	},
	{
		name: 'Week Warrior',
		description: 'Post for 7 consecutive days',
		icon: '🔥',
		points: 20, // Higher-tier achievement
		requirementType: 'streak_days',
		requirementValue: 7
	},
	{
		name: 'Viral Moment',
		description: 'Get 50 reactions on a single post',
		icon: '🚀',
		points: 25, // High-tier achievement
		requirementType: 'single_post_reactions',
		requirementValue: 50
	},
	{
		name: 'Leaderboard Champion',
		description: 'Reach #1 on the individual leaderboard',
		icon: '👑',
		points: 30, // Maximum achievement points
		requirementType: 'leaderboard_first_place',
		requirementValue: 1
	},
	{
		name: 'Race Winner',
		description: 'Be part of a team that wins a race goal',
		icon: '🏆',
		points: 25, // High-tier team achievement
		requirementType: 'team_race_victory',
		requirementValue: 1
	}
];

export async function checkAndAwardAchievements(userId) {
	const { data: user, error: userError } = await supabaseAdmin
		.from('users')
		.select('id, currentStreak')
		.eq('id', userId)
		.single();

	if (userError || !user) return [];

	const { data: linkedinPosts } = await supabaseAdmin
		.from('linkedin_posts')
		.select('totalEngagement, reactions')
		.eq('userId', userId);

	const { data: userAchievements } = await supabaseAdmin
		.from('user_achievements')
		.select('achievementId')
		.eq('userId', userId);

	if (!linkedinPosts) return [];

	const earnedAchievementIds = new Set((userAchievements || []).map((ua) => ua.achievementId));
	const newAchievements = [];

	for (const achievementData of ACHIEVEMENTS) {
		// Check if achievement exists, create if not
		let { data: existingAchievement, error: achievementError } = await supabaseAdmin
			.from('achievements')
			.select('id, name, description, icon, points')
			.eq('name', achievementData.name)
			.maybeSingle();

		// If achievement doesn't exist, create it
		if (!existingAchievement) {
			if (achievementError) {
				console.error(`Error looking up achievement ${achievementData.name}:`, achievementError);
			}

			const { data: createdAchievement, error: createError } = await supabaseAdmin
				.from('achievements')
				.insert(achievementData)
				.select('id, name, description, icon, points')
				.single();

			if (createError) {
				console.error(`Failed to create achievement ${achievementData.name}:`, createError);
				continue;
			}
			existingAchievement = createdAchievement;
		}

		if (!existingAchievement || earnedAchievementIds.has(existingAchievement.id)) continue;

		let isEarned = false;

		switch (achievementData.requirementType) {
			case 'posts_count':
				isEarned = linkedinPosts.length >= achievementData.requirementValue;
				break;

			case 'engagement_total':
				const totalEngagement = linkedinPosts.reduce(
					(sum, post) => sum + (post.totalEngagement || 0),
					0
				);
				isEarned = totalEngagement >= achievementData.requirementValue;
				break;

			case 'streak_days':
				isEarned = user.currentStreak >= achievementData.requirementValue;
				break;

			case 'single_post_reactions':
				const maxReactions = Math.max(...linkedinPosts.map((post) => post.reactions || 0), 0);
				isEarned = maxReactions >= achievementData.requirementValue;
				break;

			case 'leaderboard_first_place':
				// Check if user is currently #1 on individual leaderboard
				const { data: leaderboardData } = await supabaseAdmin.rpc('get_leaderboard', {
					p_timeframe: 'all',
					p_scope: 'company',
					p_team_id: null,
					p_requesting_user_id: userId
				});

				if (leaderboardData?.rankings?.length > 0) {
					const topUser = leaderboardData.rankings[0];
					isEarned = topUser.userId === userId;
				}
				break;

			case 'team_race_victory':
				// Check if user's team has won any completed race goals
				const { data: completedRaceGoals } = await supabaseAdmin
					.from('goals')
					.select('*')
					.is('teamId', null)
					.eq('is_race', true)
					.eq('status', 'COMPLETED');

				if (completedRaceGoals?.length > 0) {
					// Get user's team
					const { data: userTeam } = await supabaseAdmin
						.from('users')
						.select('teamId')
						.eq('id', userId)
						.single();

					if (userTeam?.teamId) {
						// Check if this team won any of the completed races
						for (const raceGoal of completedRaceGoals) {
							// Get final race standings when goal was completed
							const { data: teams } = await supabaseAdmin
								.from('teams')
								.select('id, name')
								.not('id', 'eq', 'company-team-id')
								.not('name', 'ilike', '%company%');

							if (teams) {
								// Calculate each team's progress for this race
								const teamProgress = await Promise.all(teams.map(async team => {
									const { data: members } = await supabaseAdmin
										.from('users')
										.select('id, totalScore')
										.eq('teamId', team.id);

									if (!members || members.length === 0) return null;

									const userIds = members.map(m => m.id);
									let raceValue = 0;

									switch (raceGoal.type) {
										case 'POSTS_COUNT':
											const { count: postCount } = await supabaseAdmin
												.from('linkedin_posts')
												.select('*', { count: 'exact', head: true })
												.in('userId', userIds)
												.gte('createdAt', raceGoal.startDate);
											raceValue = postCount || 0;
											break;

										case 'TOTAL_ENGAGEMENT':
											const { data: engagementData } = await supabaseAdmin
												.from('linkedin_posts')
												.select('totalEngagement')
												.in('userId', userIds)
												.gte('createdAt', raceGoal.startDate);
											raceValue = engagementData?.reduce((sum, post) => sum + (post.totalEngagement || 0), 0) || 0;
											break;

										case 'TEAM_SCORE':
											raceValue = members.reduce((sum, user) => sum + (user.totalScore || 0), 0);
											break;
									}

									return {
										teamId: team.id,
										raceValue,
										progress: raceGoal.targetValue > 0 ? (raceValue / raceGoal.targetValue) * 100 : 0
									};
								}));

								// Filter out null results and sort by progress
								const validTeams = teamProgress
									.filter(team => team !== null)
									.sort((a, b) => b.progress - a.progress || b.raceValue - a.raceValue);

								// Check if user's team won (was first and completed the goal)
								if (validTeams.length > 0 && validTeams[0].teamId === userTeam.teamId && validTeams[0].progress >= 100) {
									isEarned = true;
									break;
								}
							}
						}
					}
				}
				break;
		}

		if (isEarned) {
			const { error: insertError } = await supabaseAdmin
				.from('user_achievements')
				.insert({
					id: randomUUID(),
					userId: userId,
					achievementId: existingAchievement.id,
					earnedAt: new Date().toISOString()
				});

			if (insertError) {
				console.error(`Failed to award achievement ${existingAchievement.name}:`, insertError);
			} else {
				newAchievements.push(existingAchievement);
			}
		}
	}

	return newAchievements;
}

export async function getLeaderboardData(timeframe = 'all', userIds = null) {
	let dateFilter = '';

	if (timeframe === 'month') {
		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);
		dateFilter = startOfMonth.toISOString();
	} else if (timeframe === 'week') {
		const startOfWeek = new Date();
		startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
		startOfWeek.setHours(0, 0, 0, 0);
		dateFilter = startOfWeek.toISOString();
	}

	// Build user query
	let userQuery = supabaseAdmin
		.from('users')
		.select(`
			id,
			name,
			email,
			totalScore,
			postsThisMonth,
			currentStreak,
			team:teams(name)
		`)
		.order('totalScore', { ascending: false })
		.limit(50);

	// Filter by specific user IDs if provided (for team leaderboard)
	if (userIds && userIds.length > 0) {
		userQuery = userQuery.in('id', userIds);
	}

	const { data: users, error: usersError } = await userQuery;

	if (usersError || !users) {
		console.error('Error fetching leaderboard users:', usersError);
		return [];
	}

	// Fetch posts and achievements for each user
	const enhancedUsers = await Promise.all(
		users.map(async (user) => {
			// Fetch posts with date filter if applicable
			let postsQuery = supabaseAdmin
				.from('linkedin_posts')
				.select('totalEngagement, totalScore, createdAt')
				.eq('userId', user.id)
				.order('createdAt', { ascending: false });

			if (dateFilter) {
				postsQuery = postsQuery.gte('createdAt', dateFilter);
			}

			const { data: linkedinPosts } = await postsQuery;

			// Fetch user achievements
			const { data: userAchievements } = await supabaseAdmin
				.from('user_achievements')
				.select(`
					*,
					achievement:achievements(*)
				`)
				.eq('userId', user.id);

			return {
				...user,
				linkedinPosts: linkedinPosts || [],
				achievements: userAchievements || []
			};
		})
	);

	return enhancedUsers;
}

export function calculateCommentActivityScore(userStreak = 0) {
	let baseScore = SCORING_CONFIG.COMMENT_ACTIVITY_POINTS;

	// Apply streak multiplier (same as posts)
	const streakMultiplier = Math.min(
		1 + userStreak * SCORING_CONFIG.STREAK_MULTIPLIER,
		SCORING_CONFIG.MAX_STREAK_BONUS
	);

	const finalScore = Math.round(baseScore * streakMultiplier);

	return {
		baseScore: baseScore,
		streakMultiplier: streakMultiplier,
		totalScore: finalScore,
		breakdown: {
			basePoints: baseScore,
			streakBonus: finalScore - baseScore
		}
	};
}

// Function to award Race Winner achievement to all members of winning team
export async function awardRaceWinnerAchievement(raceGoalId) {
	try {
		// Get the completed race goal
		const { data: raceGoal, error: goalError } = await supabaseAdmin
			.from('goals')
			.select('*')
			.eq('id', raceGoalId)
			.eq('is_race', true)
			.eq('status', 'COMPLETED')
			.single();

		if (goalError || !raceGoal) {
			console.log('Race goal not found or not completed:', goalError?.message);
			return;
		}

		// Get all teams (excluding company team)
		const { data: teams, error: teamsError } = await supabaseAdmin
			.from('teams')
			.select('id, name')
			.not('id', 'eq', 'company-team-id')
			.not('name', 'ilike', '%company%');

		if (teamsError || !teams) {
			console.log('Failed to fetch teams:', teamsError?.message);
			return;
		}

		// Calculate final standings for each team
		const teamStandings = await Promise.all(teams.map(async team => {
			const { data: members } = await supabaseAdmin
				.from('users')
				.select('id, totalScore')
				.eq('teamId', team.id);

			if (!members || members.length === 0) return null;

			const userIds = members.map(m => m.id);
			let raceValue = 0;

			switch (raceGoal.type) {
				case 'POSTS_COUNT':
					const { count: postCount } = await supabaseAdmin
						.from('linkedin_posts')
						.select('*', { count: 'exact', head: true })
						.in('userId', userIds)
						.gte('createdAt', raceGoal.startDate);
					raceValue = postCount || 0;
					break;

				case 'TOTAL_ENGAGEMENT':
					const { data: engagementData } = await supabaseAdmin
						.from('linkedin_posts')
						.select('totalEngagement')
						.in('userId', userIds)
						.gte('createdAt', raceGoal.startDate);
					raceValue = engagementData?.reduce((sum, post) => sum + (post.totalEngagement || 0), 0) || 0;
					break;

				case 'TEAM_SCORE':
					raceValue = members.reduce((sum, user) => sum + (user.totalScore || 0), 0);
					break;
			}

			return {
				teamId: team.id,
				teamName: team.name,
				members: members,
				raceValue,
				progress: raceGoal.targetValue > 0 ? (raceValue / raceGoal.targetValue) * 100 : 0
			};
		}));

		// Filter and sort to find the winning team
		const validTeams = teamStandings
			.filter(team => team !== null)
			.sort((a, b) => b.progress - a.progress || b.raceValue - a.raceValue);

		if (validTeams.length === 0) {
			console.log('No valid teams found for race goal');
			return;
		}

		// Check if there's a winner (team that completed the goal)
		const winningTeam = validTeams[0];
		if (winningTeam.progress >= 100) {
			console.log(`🏆 Team "${winningTeam.teamName}" won race goal "${raceGoal.title}"!`);

			// Award Race Winner achievement to all team members
			for (const member of winningTeam.members) {
				await checkAndAwardAchievements(member.id);
			}

			console.log(`✅ Awarded Race Winner achievement to ${winningTeam.members.length} team members`);
		} else {
			console.log('No team completed the race goal yet');
		}
	} catch (error) {
		console.error('Error awarding race winner achievement:', error);
	}
}

