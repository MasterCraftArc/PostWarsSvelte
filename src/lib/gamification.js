import { supabaseAdmin } from './supabase-node.js';

export const SCORING_CONFIG = {
	// Base points for posting
	BASE_POST_POINTS: 1,

	// Engagement multipliers
	REACTION_POINTS: 0.1,
	COMMENT_POINTS: 1,
	REPOST_POINTS: 2,

	// Comment activity points
	COMMENT_ACTIVITY_POINTS: 1,
	MAX_DAILY_COMMENTS: 10,

	// Streak bonuses
	STREAK_MULTIPLIER: 0.1, // +10% per day streak
	MAX_STREAK_BONUS: 1.5, // Cap at 150% bonus

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

	const bestStreak = Math.max(user.bestStreak, currentStreak);

	const { data: updatedUser, error: updateError } = await supabaseAdmin
		.from('users')
		.update({
			totalScore,
			postsThisMonth,
			currentStreak,
			bestStreak
		})
		.eq('id', userId)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating user stats:', updateError);
		return null;
	}

	return updatedUser;
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
	},
	{
		name: 'Leaderboard Champion',
		description: 'Reach #1 on the individual leaderboard',
		icon: '👑',
		points: 500,
		requirementType: 'leaderboard_first_place',
		requirementValue: 1
	},
	{
		name: 'Race Winner',
		description: 'Be part of a team that wins a race goal',
		icon: '🏆',
		points: 250,
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
			.single();

		if (achievementError) {
			const { data: createdAchievement } = await supabaseAdmin
				.from('achievements')
				.insert(achievementData)
				.select('id, name, description, icon, points')
				.single();
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
					id: crypto.randomUUID(),
					userId: userId,
					achievementId: existingAchievement.id
				});

			if (!insertError) {
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

export function calculateCommentActivityScore() {
	return SCORING_CONFIG.COMMENT_ACTIVITY_POINTS;
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

