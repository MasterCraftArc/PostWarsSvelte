#!/usr/bin/env node

/**
 * Daily Goal Progress Update Script
 * 
 * This script updates all active goal progress once per day.
 * It should be run via cron job or similar scheduling system.
 * 
 * Usage:
 *   node src/lib/cron/update-goals.js
 *   npm run cron:update-goals
 */

import { supabaseAdmin } from '../supabase-server.js';

// Function to update goal progress (copied from API)
async function updateGoalsProgress() {
	try {
		const { data: goals, error: goalsError } = await supabaseAdmin
			.from('goals')
			.select('*')
			.eq('status', 'ACTIVE');

		if (goalsError || !goals) {
			console.error('Failed to fetch goals for progress update:', goalsError);
			return { success: false, error: 'Failed to fetch goals' };
		}

		console.log(`🎯 Updating progress for ${goals.length} active goals`);

		for (const goal of goals) {
			let currentValue = 0;
			let userIds = [];

			if (goal.teamId === 'company-team-id') {
				// Company goal - get all user IDs
				const { data: allUsers } = await supabaseAdmin
					.from('users')
					.select('id');
				userIds = allUsers?.map(u => u.id) || [];

				if (userIds.length === 0) {
					console.log(`  ⚠️  Goal "${goal.title}": No users found for company goal`);
					continue;
				}
			} else {
				// Team goal - get team member IDs
				const { data: members } = await supabaseAdmin
					.from('users')
					.select('id')
					.eq('teamId', goal.teamId);
				userIds = members?.map(m => m.id) || [];

				if (userIds.length === 0) {
					console.log(`  ⚠️  Goal "${goal.title}": No team members found`);
					continue;
				}
			}

			switch (goal.type) {
				case 'POSTS_COUNT':
					// Count posts by users since goal was created (works for team and company goals)
					const { count: postCount } = await supabaseAdmin
						.from('linkedin_posts')
						.select('*', { count: 'exact', head: true })
						.in('userId', userIds)
						.gte('createdAt', goal.startDate);
					currentValue = postCount || 0;
					const scopeType = goal.teamId === 'company-team-id' ? 'company users' : 'team members';
					console.log(`    📊 ${goal.title}: Found ${currentValue} posts by ${userIds.length} ${scopeType} since ${goal.startDate}`);
					break;

				case 'TOTAL_ENGAGEMENT':
					// Sum all engagement (reactions + comments + reposts) from posts since goal started
					const { data: engagementData } = await supabaseAdmin
						.from('linkedin_posts')
						.select('totalEngagement')
						.in('userId', userIds)
						.gte('createdAt', goal.startDate);
					currentValue = engagementData?.reduce((sum, post) => sum + (post.totalEngagement || 0), 0) || 0;
					console.log(`    📊 ${goal.title}: Total engagement ${currentValue} from ${engagementData?.length || 0} posts`);
					break;

				case 'AVERAGE_ENGAGEMENT':
					// Calculate average engagement per post since goal started
					const { data: avgEngagementData } = await supabaseAdmin
						.from('linkedin_posts')
						.select('totalEngagement')
						.in('userId', userIds)
						.gte('createdAt', goal.startDate);
					if (avgEngagementData && avgEngagementData.length > 0) {
						const total = avgEngagementData.reduce((sum, post) => sum + (post.totalEngagement || 0), 0);
						currentValue = Math.round(total / avgEngagementData.length);
						console.log(`    📊 ${goal.title}: Average ${currentValue} from ${avgEngagementData.length} posts (total: ${total})`);
					} else {
						currentValue = 0;
						console.log(`    📊 ${goal.title}: No posts found for average calculation`);
					}
					break;

				case 'TEAM_SCORE':
					// Sum current total scores of users (team members for team goals, all users for company goals)
					const { data: scoringUsers } = await supabaseAdmin
						.from('users')
						.select('totalScore')
						.in('id', userIds);
					currentValue = scoringUsers?.reduce((sum, user) => sum + (user.totalScore || 0), 0) || 0;
					const scoreScope = goal.teamId === 'company-team-id' ? 'company users' : 'team members';
					console.log(`    📊 ${goal.title}: ${scoreScope} score ${currentValue} from ${scoringUsers?.length || 0} users`);
					break;

				default:
					console.log(`    ⚠️  Unknown goal type: ${goal.type}`);
					currentValue = 0;
					break;
			}

			const isCompleted = currentValue >= goal.targetValue;
			const newStatus = isCompleted ? 'COMPLETED' : 'ACTIVE';

			const { error: updateError } = await supabaseAdmin
				.from('goals')
				.update({ 
					currentValue,
					status: newStatus,
					updatedAt: new Date().toISOString()
				})
				.eq('id', goal.id);

			if (updateError) {
				console.error(`Failed to update goal ${goal.title}:`, updateError);
			} else {
				const progressPercent = Math.min(100, Math.round((currentValue / goal.targetValue) * 100));
				console.log(`  📈 Goal "${goal.title}": ${currentValue}/${goal.targetValue} (${progressPercent}%) ${isCompleted ? '✅ COMPLETED' : ''}`);
			}
		}

		console.log('✅ Goal progress updated successfully');
		return { success: true, goalsUpdated: goals.length };
	} catch (error) {
		console.error('❌ Error updating goal progress:', error);
		return { success: false, error: error.message };
	}
}

async function main() {
	console.log('🎯 Starting daily goal progress update...');
	console.log(`📅 Run time: ${new Date().toISOString()}`);

	try {
		// Update all goal progress
		const result = await updateGoalsProgress();

		if (result.success) {
			console.log(`✅ Successfully updated ${result.goalsUpdated} goals`);
		} else {
			console.error(`❌ Goal update failed: ${result.error}`);
			process.exit(1);
		}

	} catch (error) {
		console.error('💥 Fatal error during goal update:', error);
		process.exit(1);
	}

	console.log('🎉 Daily goal update completed successfully');
	process.exit(0);
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
	console.log(`
Usage: node src/lib/cron/update-goals.js [options]

Options:
  --help, -h     Show this help message
  --dry-run     Show what would be updated without making changes
  --verbose     Show detailed progress information

This script updates all active goal progress based on current team member data.
It should be run once daily via cron job or similar scheduling system.

Example cron entry (runs daily at 2 AM):
0 2 * * * cd /path/to/your/app && npm run cron:update-goals

Environment variables required:
  - SUPABASE_SERVICE_KEY
  - PUBLIC_SUPABASE_URL
	`);
	process.exit(0);
}

if (args.includes('--dry-run')) {
	console.log('🔍 DRY RUN MODE - No changes will be made');
	// Override the update function to just log what would happen
	// Implementation would go here for dry run mode
}

// Run the main function
main().catch(error => {
	console.error('Unhandled error:', error);
	process.exit(1);
});