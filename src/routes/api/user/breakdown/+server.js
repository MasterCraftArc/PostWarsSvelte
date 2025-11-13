import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';
import { calculateHistoricalStreak, SCORING_CONFIG } from '$lib/gamification.js';

/**
 * GET /api/user/breakdown
 * Returns a downloadable text file with detailed scoring breakdown for the authenticated user
 */
export async function GET(event) {
	try {
		// Authenticate user
		const user = await getAuthenticatedUser(event);
		if (!user) {
			return new Response('Authentication required', { status: 401 });
		}

		// Fetch user data
		const { data: userData, error: userError } = await supabaseAdmin
			.from('users')
			.select('id, name, teamId')
			.eq('id', user.id)
			.single();

		if (userError || !userData) {
			return new Response('User not found', { status: 404 });
		}

		// Fetch user's posts
		const { data: posts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('*')
			.eq('userId', user.id)
			.order('postedAt', { ascending: true });

		// Fetch user's comment activities
		const { data: commentActivities } = await supabaseAdmin
			.from('comment_activities')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: true });

		// Fetch user's achievements
		const { data: userAchievements } = await supabaseAdmin
			.from('user_achievements')
			.select(`
				achievements (
					name,
					points
				)
			`)
			.eq('userId', user.id);

		// Calculate scoring for each item
		const scoredItems = [];
		let totalPostScore = 0;
		let totalCommentActivityScore = 0;
		let maxStreakAchieved = 1;

		// Helper function to convert date to YYYY-MM-DD
		function toDateKey(date) {
			return new Date(date).toISOString().split('T')[0];
		}

		// Process posts
		if (posts && posts.length > 0) {
			for (const post of posts) {
				const postDate = toDateKey(post.postedAt);
				const streak = await calculateHistoricalStreak(user.id, postDate);
				maxStreakAchieved = Math.max(maxStreakAchieved, streak);

				// Calculate streak multiplier
				const multiplier = Math.min(
					1 + streak * SCORING_CONFIG.STREAK_MULTIPLIER,
					SCORING_CONFIG.MAX_STREAK_BONUS
				);

				// Calculate base score with multiplier
				const rawBaseScore = SCORING_CONFIG.BASE_POST_POINTS;
				const baseScore = rawBaseScore * multiplier;

				// Calculate engagement score
				const engagementScore =
					post.reactions * SCORING_CONFIG.REACTION_POINTS +
					post.comments * SCORING_CONFIG.COMMENT_POINTS;

				// Calculate total score
				const calculatedScore = baseScore + engagementScore;
				const finalScore = Math.ceil(calculatedScore);

				totalPostScore += finalScore;

				scoredItems.push({
					type: 'post',
					date: postDate,
					url: post.url,
					streak: streak,
					multiplier: parseFloat(multiplier.toFixed(2)),
					rawBaseScore: rawBaseScore,
					baseScoreWithMultiplier: parseFloat(baseScore.toFixed(2)),
					reactions: post.reactions,
					comments: post.comments,
					engagementScore: parseFloat(engagementScore.toFixed(2)),
					calculatedScore: parseFloat(calculatedScore.toFixed(2)),
					finalScore: finalScore
				});
			}
		}

		// Process comment activities
		if (commentActivities && commentActivities.length > 0) {
			for (const activity of commentActivities) {
				const activityDate = toDateKey(activity.created_at);
				const streak = await calculateHistoricalStreak(user.id, activityDate);
				maxStreakAchieved = Math.max(maxStreakAchieved, streak);

				// Calculate streak multiplier
				const multiplier = Math.min(
					1 + streak * SCORING_CONFIG.STREAK_MULTIPLIER,
					SCORING_CONFIG.MAX_STREAK_BONUS
				);

				// Calculate score
				const rawBaseScore = SCORING_CONFIG.COMMENT_ACTIVITY_POINTS;
				const calculatedScore = rawBaseScore * multiplier;
				const finalScore = Math.ceil(calculatedScore);

				totalCommentActivityScore += finalScore;

				scoredItems.push({
					type: 'comment_activity',
					date: activityDate,
					url: activity.target_post_url,
					streak: streak,
					multiplier: parseFloat(multiplier.toFixed(2)),
					rawBaseScore: rawBaseScore,
					calculatedScore: parseFloat(calculatedScore.toFixed(2)),
					finalScore: finalScore
				});
			}
		}

		// Sort scored items by date
		scoredItems.sort((a, b) => new Date(a.date) - new Date(b.date));

		// Calculate achievement points
		const achievementScore = userAchievements?.reduce(
			(sum, ua) => sum + (ua.achievements?.points || 0),
			0
		) || 0;

		// Calculate final total
		const finalTotalScore = totalPostScore + totalCommentActivityScore + achievementScore;

		// Generate text breakdown
		const lines = [];

		// Header
		lines.push('═'.repeat(80));
		lines.push(`PostWars - Score Breakdown for ${userData.name}`);
		lines.push('═'.repeat(80));
		lines.push(`Team: ${userData.teamId || 'No Team'}`);
		lines.push(`Generated: ${new Date().toLocaleString()}`);
		lines.push('');

		// Summary
		lines.push('📊 SUMMARY');
		lines.push('─'.repeat(80));
		lines.push(`Total Posts: ${posts?.length || 0}`);
		lines.push(`Total Comment Activities: ${commentActivities?.length || 0}`);
		lines.push(`Max Streak Achieved: ${maxStreakAchieved} days`);
		lines.push('');
		lines.push(`Post Points: ${totalPostScore} pts`);
		lines.push(`Comment Points: ${totalCommentActivityScore} pts`);
		lines.push(`Achievement Points: ${achievementScore} pts`);
		lines.push('─'.repeat(80));
		lines.push(`FINAL TOTAL: ${finalTotalScore} points`);
		lines.push('═'.repeat(80));
		lines.push('');

		// Detailed breakdown
		if (scoredItems.length > 0) {
			lines.push('📝 DETAILED BREAKDOWN');
			lines.push('');

			let postIndex = 0;
			let commentIndex = 0;

			scoredItems.forEach((item) => {
				if (item.type === 'post') {
					postIndex++;
					lines.push(`Post #${postIndex} - ${item.date}`);
					lines.push(`  URL: ${item.url}`);
					lines.push(`  Streak: ${item.streak} days (${item.multiplier}x multiplier)`);
					lines.push(`  Engagement: ${item.reactions} reactions, ${item.comments} comments`);
					lines.push(`  Base Score: ${item.rawBaseScore} pts × ${item.multiplier} = ${item.baseScoreWithMultiplier} pts`);
					lines.push(`  Engagement Score: ${item.engagementScore} pts`);
					lines.push(`  Calculated Total: ${item.baseScoreWithMultiplier} + ${item.engagementScore} = ${item.calculatedScore} pts`);
					lines.push(`  ────────────────────────────────────────`);
					lines.push(`  FINAL: ${item.finalScore} pts (rounded up from ${item.calculatedScore})`);
					lines.push('');
				} else if (item.type === 'comment_activity') {
					commentIndex++;
					lines.push(`Comment Activity #${commentIndex} - ${item.date}`);
					lines.push(`  URL: ${item.url}`);
					lines.push(`  Streak: ${item.streak} days (${item.multiplier}x multiplier)`);
					lines.push(`  Base Score: ${item.rawBaseScore} pts × ${item.multiplier} = ${item.calculatedScore} pts`);
					lines.push(`  ────────────────────────────────────────`);
					lines.push(`  FINAL: ${item.finalScore} pts (rounded up from ${item.calculatedScore})`);
					lines.push('');
				}
			});
		} else {
			lines.push('No posts or comment activities recorded.');
			lines.push('');
		}

		// Footer
		lines.push('═'.repeat(80));
		lines.push('Scoring Formula:');
		lines.push('  Posts: (1 base point × streak multiplier) + (reactions × 0.1) + (comments × 0.5)');
		lines.push('  Comments: (0.5 base points × streak multiplier)');
		lines.push('  Streak Multiplier: 1 + (streak × 0.15), capped at 2.0x');
		lines.push('  All scores rounded UP to nearest whole number');
		lines.push('═'.repeat(80));

		// Generate filename with current date
		const today = new Date().toISOString().split('T')[0];
		const filename = `score-breakdown-${today}.txt`;

		// Return as downloadable text file
		return new Response(lines.join('\n'), {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'private, no-cache, no-store, must-revalidate'
			}
		});
	} catch (error) {
		console.error('Error generating breakdown:', error);
		return new Response('Internal server error', { status: 500 });
	}
}
