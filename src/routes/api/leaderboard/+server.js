import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

async function handleTeamCompetition(timeframe, userTeamId) {
	try {
		// Note: Currently using user totalScore (all-time) rather than timeframe-filtered posts
		// This could be enhanced later to filter posts by timeframe for more accurate competition

		// Get all teams first to debug what's being returned
		const { data: allTeams, error: teamsError } = await supabaseAdmin
			.from('teams')
			.select('id, name');

		if (teamsError) {
			console.error('Teams query error:', teamsError);
			return json({ error: `Database error: ${teamsError.message}` }, { status: 500 });
		}

		// Filter out company team from teams list (everyone belongs to both company + regular team)
		const teams = allTeams?.filter(team =>
			team.id !== 'company-team-id' &&
			team.name !== 'Company' &&
			!team.name.toLowerCase().includes('company')
		) || [];

		// Get all users with their team assignments
		const { data: users, error: usersError } = await supabaseAdmin
			.from('users')
			.select('id, totalScore, teamId')
			.not('teamId', 'is', null);

		if (usersError) {
			console.error('Users query error:', usersError);
			return json({ error: `Database error: ${usersError.message}` }, { status: 500 });
		}

		// Group users by team
		const usersByTeam = {};
		users?.forEach(user => {
			if (!usersByTeam[user.teamId]) {
				usersByTeam[user.teamId] = [];
			}
			usersByTeam[user.teamId].push(user);
		});

		// Calculate team scores and rankings
		const teamRankings = teams.map(team => {
			const teamMembers = usersByTeam[team.id] || [];
			const memberCount = teamMembers.length;
			const totalScore = teamMembers.reduce((sum, user) => sum + (user.totalScore || 0), 0);
			const averageScore = memberCount > 0 ? Math.round((totalScore / memberCount) * 10) / 10 : 0;

			return {
				id: team.id,
				name: team.name,
				totalScore,
				memberCount,
				averageScore,
				isUserTeam: team.id === userTeamId
			};
		})
		// Filter out teams with no members
		.filter(team => team.memberCount > 0)
		// Sort by total score descending
		.sort((a, b) => b.totalScore - a.totalScore)
		// Add rank
		.map((team, index) => ({
			...team,
			rank: index + 1
		}));

		const response = json({
			teamRankings,
			scope: 'teams'
		});
		response.headers.set('Cache-Control', 'public, max-age=300');
		return response;

	} catch (error) {
		console.error('Team competition error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function GET(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const timeframe = event.url.searchParams.get('timeframe') || 'all';
		const scope = event.url.searchParams.get('scope') || 'company';

		if (!['all', 'month', 'week'].includes(timeframe)) {
			return json({ error: 'Invalid timeframe. Use: all, month, or week' }, { status: 400 });
		}

		if (!['team', 'company', 'teams'].includes(scope)) {
			return json({ error: 'Invalid scope. Use: team, company, or teams' }, { status: 400 });
		}

		// Check team scope requirements
		if (scope === 'team' && !authenticatedUser.teamId) {
			return json({ error: 'User not assigned to a team' }, { status: 404 });
		}

		// Handle team vs team competition separately
		if (scope === 'teams') {
			return await handleTeamCompetition(timeframe, authenticatedUser.teamId);
		}

		// OPTIMIZED: Single database function call instead of multiple queries
		const { data, error } = await supabaseAdmin.rpc('get_leaderboard', {
			p_timeframe: timeframe,
			p_scope: scope,
			p_team_id: authenticatedUser.teamId,
			p_requesting_user_id: authenticatedUser.id
		});

		if (error) {
			console.error('Leaderboard RPC error:', error);
			return json({ error: `Database error: ${error.message}` }, { status: 500 });
		}

		// Cache response for 5 minutes (leaderboard changes frequently but not every second)
		const response = json(data);
		response.headers.set('Cache-Control', 'public, max-age=300');

		return response;
	} catch (error) {
		console.error('Leaderboard error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
