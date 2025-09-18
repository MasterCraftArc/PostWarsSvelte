import { supabaseAdmin } from './supabase-node.js';

/**
 * Team Assignment Configuration
 * Following CLAUDE.md single source of truth principle
 */
export const TEAM_ASSIGNMENT_CONFIG = {
	ASSIGNMENT_METHOD: 'BALANCED_SIZE', // Assign to smallest team
	MAX_TEAM_SIZE: 30, // Prevent teams becoming too large
	MIN_TEAMS_REQUIRED: 6, // Maintain 6 teams minimum
	AUTO_ASSIGN_NEW_USERS: true // Enable auto-assignment
};

/**
 * Get all teams ordered by member count (smallest first)
 * Only includes teams with 'team-' prefix to exclude company team
 */
export async function getTeamsOrderedBySize() {
	const { data: teams, error } = await supabaseAdmin
		.from('teams')
		.select(`
			id,
			name,
			description,
			members:users!users_teamId_fkey(id)
		`)
		.order('name', { ascending: true });

	if (error) {
		throw new Error(`Failed to fetch teams: ${error.message}`);
	}

	// Filter to only team- prefixed teams and calculate member counts
	const assignableTeams = (teams || [])
		.filter((team) => team.id.startsWith('team-'))
		.map((team) => ({
			...team,
			memberCount: team.members?.length || 0
		}))
		.sort((a, b) => a.memberCount - b.memberCount); // Smallest first

	return assignableTeams;
}

/**
 * Assign a user to the team with the smallest member count
 * @param {string} userId - The user ID to assign
 * @returns {Promise<Object>} The assigned team object
 */
export async function assignUserToTeam(userId) {
	if (!userId) {
		throw new Error('User ID is required for team assignment');
	}

	// Get teams ordered by size (smallest first)
	const teams = await getTeamsOrderedBySize();

	if (teams.length === 0) {
		throw new Error('No teams available for assignment');
	}

	// Check if we have minimum required teams
	if (teams.length < TEAM_ASSIGNMENT_CONFIG.MIN_TEAMS_REQUIRED) {
		console.warn(`Only ${teams.length} teams available, expected ${TEAM_ASSIGNMENT_CONFIG.MIN_TEAMS_REQUIRED}`);
	}

	// Select the team with smallest member count
	const targetTeam = teams[0];

	// Check if team is at capacity
	if (targetTeam.memberCount >= TEAM_ASSIGNMENT_CONFIG.MAX_TEAM_SIZE) {
		throw new Error(`All teams are at maximum capacity (${TEAM_ASSIGNMENT_CONFIG.MAX_TEAM_SIZE} members)`);
	}

	// Update user's team assignment
	const { data: updatedUser, error: updateError } = await supabaseAdmin
		.from('users')
		.update({ teamId: targetTeam.id })
		.eq('id', userId);

	if (updateError) {
		throw new Error(`Failed to assign user to team: ${updateError.message}`);
	}

	console.log(`✅ User ${userId} assigned to ${targetTeam.name} (${targetTeam.memberCount + 1} members)`);

	return {
		id: targetTeam.id,
		name: targetTeam.name,
		description: targetTeam.description,
		memberCount: targetTeam.memberCount + 1
	};
}

/**
 * Get all users without team assignment
 */
async function getUsersWithoutTeam() {
	const { data: users, error } = await supabaseAdmin
		.from('users')
		.select('id, name, email')
		.is('teamId', null);

	if (error) {
		throw new Error(`Failed to fetch unassigned users: ${error.message}`);
	}

	return users || [];
}

/**
 * Assign all unassigned users to balanced teams
 * Useful for one-time migration of existing users
 * @returns {Promise<Object>} Summary of assignments
 */
export async function assignAllUnassignedUsers() {
	const unassignedUsers = await getUsersWithoutTeam();

	if (unassignedUsers.length === 0) {
		console.log('✅ All users already have team assignments');
		return { assigned: 0, skipped: 0, total: 0 };
	}

	let assignedCount = 0;
	let skippedCount = 0;

	console.log(`🔄 Assigning ${unassignedUsers.length} unassigned users to teams...`);

	for (const user of unassignedUsers) {
		try {
			await assignUserToTeam(user.id);
			assignedCount++;
		} catch (error) {
			console.error(`❌ Failed to assign user ${user.id} (${user.name}): ${error.message}`);
			skippedCount++;
		}
	}

	const summary = {
		assigned: assignedCount,
		skipped: skippedCount,
		total: unassignedUsers.length
	};

	console.log(`✅ Team assignment complete: ${assignedCount} assigned, ${skippedCount} skipped`);
	return summary;
}

/**
 * Get team assignment statistics
 * Useful for monitoring team balance
 */
export async function getTeamAssignmentStats() {
	const teams = await getTeamsOrderedBySize();
	const unassignedUsers = await getUsersWithoutTeam();

	const stats = {
		totalTeams: teams.length,
		totalAssignedUsers: teams.reduce((sum, team) => sum + team.memberCount, 0),
		totalUnassignedUsers: unassignedUsers.length,
		averageTeamSize: teams.length > 0 ? teams.reduce((sum, team) => sum + team.memberCount, 0) / teams.length : 0,
		smallestTeam: teams[0] || null,
		largestTeam: teams[teams.length - 1] || null,
		teamDistribution: teams.map(team => ({
			id: team.id,
			name: team.name,
			memberCount: team.memberCount
		}))
	};

	return stats;
}