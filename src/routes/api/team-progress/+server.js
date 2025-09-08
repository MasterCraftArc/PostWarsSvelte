import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		const user = await getAuthenticatedUser(event);
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Get user's team information
		const { data: userTeam, error: userError } = await supabaseAdmin
			.from('users')
			.select('teamId, team:teams!users_teamId_fkey(*)')
			.eq('id', user.id)
			.single();

		if (userError || !userTeam?.teamId) {
			return json({ 
				message: 'User not assigned to a team',
				team: null,
				goals: [],
				members: [],
				stats: {
					totalMembers: 0,
					totalScore: 0,
					averageScore: 0,
					totalPostsThisMonth: 0,
					averageStreak: 0
				}
			});
		}

		// Get team with members and active goals
		const { data: teamData, error: teamError } = await supabaseAdmin
			.from('teams')
			.select(`
				*,
				members:users!users_teamId_fkey(id, name, email, totalScore, currentStreak, postsThisMonth),
				goals!goals_teamId_fkey(*)
			`)
			.eq('id', userTeam.teamId)
			.single();

		if (teamError || !teamData) {
			return json({ error: 'Team not found' }, { status: 404 });
		}

		// Filter to only active goals
		const activeGoals = (teamData.goals || []).filter(goal => goal.status === 'ACTIVE');

		// Calculate team stats
		const members = teamData.members || [];
		const totalMembers = members.length;
		const totalScore = members.reduce((sum, member) => sum + (member.totalScore || 0), 0);
		const averageScore = totalMembers > 0 ? Math.round(totalScore / totalMembers) : 0;
		const totalPostsThisMonth = members.reduce((sum, member) => sum + (member.postsThisMonth || 0), 0);
		const averageStreak = totalMembers > 0 ? Math.round(members.reduce((sum, member) => sum + (member.currentStreak || 0), 0) / totalMembers) : 0;

		return json({
			team: {
				id: teamData.id,
				name: teamData.name,
				description: teamData.description
			},
			goals: activeGoals,
			members,
			stats: {
				totalMembers,
				totalScore,
				averageScore,
				totalPostsThisMonth,
				averageStreak
			}
		});

	} catch (error) {
		console.error('Team progress error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}