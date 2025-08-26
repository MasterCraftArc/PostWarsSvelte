import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { teamId } = event.params;
		const timeframe = event.url.searchParams.get('timeframe') || 'all';

		if (!['all', 'month', 'week'].includes(timeframe)) {
			return json({ error: 'Invalid timeframe. Use: all, month, or week' }, { status: 400 });
		}

		// Get the team and its members
		const { data: team, error } = await supabaseAdmin
			.from('teams')
			.select(`
				id,
				name,
				description,
				teamLead:users!teams_teamLeadId_fkey(id, name),
				members:users!users_teamId_fkey(id, name, email, totalScore, postsThisMonth, currentStreak)
			`)
			.eq('id', teamId)
			.single();

		if (error || !team) {
			return json({ error: 'Team not found' }, { status: 404 });
		}

		const teamInfo = {
			id: team.id,
			name: team.name,
			description: team.description,
			memberCount: team.members?.length || 0,
			teamLead: team.teamLead
		};

		// Transform team members into leaderboard format
		const leaderboard = (team.members || [])
			.sort((a, b) => b.totalScore - a.totalScore)
			.map((user, index) => ({
				rank: index + 1,
				id: user.id,
				name: user.name || user.email.split('@')[0],
				email: user.email,
				teamName: team.name,
				totalScore: user.totalScore,
				postsThisMonth: user.postsThisMonth,
				currentStreak: user.currentStreak,
				postsInTimeframe: 0, // Would need separate query for timeframe data
				engagementInTimeframe: 0, // Would need separate query for timeframe data
				achievements: [], // Would need separate query for achievements
				isCurrentUser: user.id === authenticatedUser.id
			}));

		return json({
			timeframe,
			scope: 'team',
			teamInfo,
			leaderboard,
			userRank: leaderboard.find((u) => u.isCurrentUser)?.rank || null
		});

	} catch (error) {
		console.error('Team leaderboard error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}