import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		// Get active race goal
		const { data: raceGoal, error: goalError } = await supabaseAdmin
			.from('goals')
			.select('*')
			.is('teamId', null)
			.eq('status', 'ACTIVE')
			.eq('is_race', true)
			.single();

		if (goalError && goalError.code !== 'PGRST116') {
			console.error('Error fetching active race goal:', goalError);
			return json({ error: 'Failed to fetch race goal' }, { status: 500 });
		}

		// No active race goal
		if (!raceGoal) {
			return json({ raceGoal: null });
		}

		// Get all teams (exclude company team)
		const { data: teams, error: teamsError } = await supabaseAdmin
			.from('teams')
			.select('id, name')
			.not('id', 'eq', 'company-team-id')
			.not('name', 'ilike', '%company%');

		if (teamsError) {
			console.error('Error fetching teams:', teamsError);
			return json({ error: 'Failed to fetch teams' }, { status: 500 });
		}

		// Calculate each team's progress toward the race goal
		const teamProgress = await Promise.all(teams.map(async team => {
			// Get team members
			const { data: members } = await supabaseAdmin
				.from('users')
				.select('id')
				.eq('teamId', team.id);

			if (!members || members.length === 0) {
				return {
					teamId: team.id,
					teamName: team.name,
					progress: 0,
					currentValue: 0,
					memberCount: 0
				};
			}

			const userIds = members.map(m => m.id);
			let currentValue = 0;

			// Calculate progress based on goal type
			switch (raceGoal.type) {
				case 'POSTS_COUNT':
					const { count: postCount } = await supabaseAdmin
						.from('linkedin_posts')
						.select('*', { count: 'exact', head: true })
						.in('userId', userIds)
						.gte('createdAt', raceGoal.startDate);
					currentValue = postCount || 0;
					break;

				case 'TOTAL_ENGAGEMENT':
					const { data: engagementData } = await supabaseAdmin
						.from('linkedin_posts')
						.select('totalEngagement')
						.in('userId', userIds)
						.gte('createdAt', raceGoal.startDate);
					currentValue = engagementData?.reduce((sum, post) => sum + (post.totalEngagement || 0), 0) || 0;
					break;

				case 'TEAM_SCORE':
					// For team score, use current total scores (not time-filtered)
					const { data: scoringUsers } = await supabaseAdmin
						.from('users')
						.select('totalScore')
						.in('id', userIds);
					currentValue = scoringUsers?.reduce((sum, user) => sum + (user.totalScore || 0), 0) || 0;
					break;

				default:
					currentValue = 0;
					break;
			}

			const progress = raceGoal.targetValue > 0 ? Math.min(100, (currentValue / raceGoal.targetValue) * 100) : 0;

			return {
				teamId: team.id,
				teamName: team.name,
				progress: Math.round(progress * 10) / 10, // Round to 1 decimal
				currentValue,
				memberCount: members.length
			};
		}));

		// Sort teams by progress (highest first)
		const rankedTeams = teamProgress
			.filter(team => team.memberCount > 0) // Only teams with members
			.sort((a, b) => b.progress - a.progress || b.currentValue - a.currentValue)
			.map((team, index) => ({
				...team,
				rank: index + 1,
				isWinning: index === 0 && team.progress > 0
			}));

		return json({
			raceGoal: {
				...raceGoal,
				progressPercent: Math.max(...rankedTeams.map(t => t.progress), 0),
				daysLeft: Math.max(0, Math.ceil((new Date(raceGoal.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
			},
			teamProgress: rankedTeams,
			totalTeams: rankedTeams.length
		});

	} catch (error) {
		console.error('Race goal API error:', error);
		return json({ error: 'Failed to fetch race goal data' }, { status: 500 });
	}
}