#!/usr/bin/env node

/**
 * One-time migration script to assign all existing users to teams
 *
 * Usage:
 *   node migrate-users-to-teams.js
 *
 * This script should be run AFTER:
 * 1. Teams are created in database (via migrations/create-initial-teams.sql)
 * 2. The team assignment utility is deployed
 *
 * This script should be run BEFORE:
 * 1. Enabling auto-assignment in the auth flow
 * 2. Users start getting automatically assigned to teams
 */

import { migrateExistingUsersToTeams, getTeamAssignmentStats } from './src/lib/team-assignment.js';

async function main() {
	console.log('🚀 PostWars Team Migration Script');
	console.log('==================================');

	try {
		// Get current stats before migration
		console.log('\n📊 Current team status:');
		const beforeStats = await getTeamAssignmentStats();

		if (beforeStats.totalUnassignedUsers === 0) {
			console.log('✅ All users are already assigned to teams!');
			console.log('\n📈 Current team distribution:');
			beforeStats.teamDistribution.forEach(team => {
				console.log(`  ${team.name}: ${team.memberCount} members`);
			});
			process.exit(0);
		}

		console.log(`📋 Found ${beforeStats.totalUnassignedUsers} unassigned users`);
		console.log(`🎯 Will distribute across ${beforeStats.totalTeams} teams`);

		// Run the migration
		console.log('\n🔄 Starting migration...');
		const result = await migrateExistingUsersToTeams();

		// Summary
		console.log('\n🎉 Migration Complete!');
		console.log('======================');
		console.log(`✅ Users assigned: ${result.assigned}`);
		console.log(`⚠️ Users skipped: ${result.skipped}`);
		console.log(`⏱️ Duration: ${result.duration}ms`);
		console.log(`📊 Average team size: ${result.finalStats.averageTeamSize.toFixed(1)} members`);

		// Check if teams are balanced (within ±2 members of average)
		const avgSize = result.finalStats.averageTeamSize;
		const imbalanced = result.finalStats.teamDistribution.filter(
			team => Math.abs(team.memberCount - avgSize) > 2
		);

		if (imbalanced.length > 0) {
			console.log('\n⚠️ Team balance warning:');
			imbalanced.forEach(team => {
				const diff = team.memberCount - avgSize;
				console.log(`  ${team.name}: ${team.memberCount} members (${diff > 0 ? '+' : ''}${diff.toFixed(1)})`);
			});
		} else {
			console.log('\n✅ Teams are well balanced!');
		}

		console.log('\n🎯 Next steps:');
		console.log('1. Deploy the auth integration changes');
		console.log('2. New users will be automatically assigned to teams');
		console.log('3. Monitor team balance with getTeamAssignmentStats()');

	} catch (error) {
		console.error('\n❌ Migration failed:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { main };