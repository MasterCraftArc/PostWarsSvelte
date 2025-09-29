import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

// POST /api/admin/teams/balance - Balance users across teams
export async function POST(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { targetTeamCount = 3 } = await event.request.json();

		console.log(`🎯 Starting team balancing process - target: ${targetTeamCount} teams`);

		// Get all current teams (excluding company team)
		const { data: allTeams, error: teamsError } = await supabaseAdmin
			.from('teams')
			.select(`
				id,
				name,
				members:users!users_teamId_fkey(id, name, email, totalScore)
			`)
			.neq('id', 'company-team-id');

		if (teamsError) {
			console.error('Error fetching teams:', teamsError);
			return json({ error: 'Failed to fetch teams' }, { status: 500 });
		}

		console.log(`📊 Current teams: ${allTeams?.length || 0}`);

		if (!allTeams || allTeams.length === 0) {
			return json({ error: 'No teams found to balance' }, { status: 404 });
		}

		// Get all users who are not admins
		const { data: allUsers, error: usersError } = await supabaseAdmin
			.from('users')
			.select('id, name, email, teamId, totalScore')
			.neq('role', 'ADMIN')
			.order('totalScore', { ascending: false });

		if (usersError) {
			console.error('Error fetching users:', usersError);
			return json({ error: 'Failed to fetch users' }, { status: 500 });
		}

		console.log(`👥 Total users to balance: ${allUsers?.length || 0}`);

		// If we have more teams than target, consolidate them
		if (allTeams.length > targetTeamCount) {
			console.log(`🏗️ Consolidating from ${allTeams.length} to ${targetTeamCount} teams`);

			// Keep the top N teams (by member count, then alphabetically)
			const teamsWithCounts = allTeams.map(team => ({
				...team,
				memberCount: team.members?.length || 0
			}));

			const keepTeams = teamsWithCounts
				.sort((a, b) => {
					// Sort by member count descending, then by name
					if (b.memberCount !== a.memberCount) {
						return b.memberCount - a.memberCount;
					}
					return a.name.localeCompare(b.name);
				})
				.slice(0, targetTeamCount);

			const deleteTeamIds = allTeams
				.filter(team => !keepTeams.some(kt => kt.id === team.id))
				.map(team => team.id);

			console.log(`🗑️ Teams to keep:`, keepTeams.map(t => t.name));
			console.log(`🗑️ Teams to delete:`, deleteTeamIds);

			// Move users from teams being deleted to remaining teams
			if (deleteTeamIds.length > 0) {
				await supabaseAdmin
					.from('users')
					.update({ teamId: null })
					.in('teamId', deleteTeamIds);

				// Delete goals associated with deleted teams
				await supabaseAdmin
					.from('goals')
					.delete()
					.in('teamId', deleteTeamIds);

				// Delete the teams
				await supabaseAdmin
					.from('teams')
					.delete()
					.in('id', deleteTeamIds);

				console.log(`✅ Deleted ${deleteTeamIds.length} teams`);
			}
		}

		// Get updated teams list after consolidation
		const { data: finalTeams, error: finalTeamsError } = await supabaseAdmin
			.from('teams')
			.select('id, name')
			.neq('id', 'company-team-id')
			.order('name');

		if (finalTeamsError) {
			return json({ error: 'Failed to fetch final teams' }, { status: 500 });
		}

		console.log(`🎯 Final teams for balancing:`, finalTeams.map(t => t.name));

		if (!finalTeams || finalTeams.length === 0) {
			return json({ error: 'No teams available for balancing' }, { status: 404 });
		}

		// Balance users across remaining teams using snake draft algorithm
		// This ensures both team size and skill balance
		const teamAssignments = finalTeams.map(team => ({
			teamId: team.id,
			teamName: team.name,
			users: [],
			totalScore: 0
		}));

		// Sort users by score (highest first) for snake draft
		const sortedUsers = [...(allUsers || [])].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

		// Snake draft assignment
		let currentTeam = 0;
		let direction = 1; // 1 for forward, -1 for backward

		for (let i = 0; i < sortedUsers.length; i++) {
			const user = sortedUsers[i];
			teamAssignments[currentTeam].users.push(user);
			teamAssignments[currentTeam].totalScore += user.totalScore || 0;

			// Move to next team
			currentTeam += direction;

			// If we've reached the end, reverse direction
			if (currentTeam >= teamAssignments.length) {
				currentTeam = teamAssignments.length - 2;
				direction = -1;
			} else if (currentTeam < 0) {
				currentTeam = 1;
				direction = 1;
			}
		}

		console.log('🔄 Team assignments:');
		teamAssignments.forEach(team => {
			console.log(`  ${team.teamName}: ${team.users.length} users, ${team.totalScore} total score`);
		});

		// Apply the assignments to database
		const updatePromises = teamAssignments.flatMap(team =>
			team.users.map(user =>
				supabaseAdmin
					.from('users')
					.update({ teamId: team.teamId })
					.eq('id', user.id)
			)
		);

		await Promise.all(updatePromises);

		console.log('✅ Team balancing completed successfully');

		// Return summary
		const summary = {
			teamsBalanced: teamAssignments.length,
			usersReassigned: sortedUsers.length,
			teamBreakdown: teamAssignments.map(team => ({
				teamName: team.teamName,
				memberCount: team.users.length,
				totalScore: team.totalScore,
				avgScore: team.users.length > 0 ? Math.round(team.totalScore / team.users.length) : 0
			}))
		};

		return json({ success: true, summary });

	} catch (error) {
		console.error('Team balancing error:', error);
		return json({ error: 'Failed to balance teams' }, { status: 500 });
	}
}