import 'dotenv/config';
import fs from 'fs';
import { supabaseAdmin } from './src/lib/supabase-node.js';
import { SCORING_CONFIG } from './src/lib/gamification.js';

// Helper: Convert date to YYYY-MM-DD string
function toDateKey(date) {
  return new Date(date).toISOString().split('T')[0];
}

// Helper: Check if two dates are consecutive days
function isConsecutive(date1, date2) {
  // Parse as UTC midnight to avoid timezone issues
  const d1 = new Date(date1 + 'T00:00:00Z');
  const d2 = new Date(date2 + 'T00:00:00Z');

  // Calculate difference in milliseconds
  const diffMs = d2 - d1; // Don't use Math.abs - we want forward progression

  // Convert to days (should be exactly 1 for consecutive)
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays === 1;
}

async function calculateAccurateScores() {
  console.log('📊 Calculating Accurate Scores with Historical Streaks...\n');

  const results = {
    generatedAt: new Date().toISOString(),
    users: []
  };

  // Fetch all users
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, name, teamId')
    .order('name', { ascending: true });

  if (usersError) {
    console.log('❌ Error fetching users:', usersError);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ No users found');
    return;
  }

  console.log(`📋 Processing ${users.length} users...\n`);

  for (const user of users) {
    console.log(`Processing: ${user.name}`);

    // Get all posts
    const { data: posts } = await supabaseAdmin
      .from('linkedin_posts')
      .select('*')
      .eq('userId', user.id)
      .order('postedAt', { ascending: true });

    // Get all comment activities
    const { data: commentActivities } = await supabaseAdmin
      .from('comment_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    // Get achievements
    const { data: achievements } = await supabaseAdmin
      .from('user_achievements')
      .select(`
        *,
        achievement:achievements(*)
      `)
      .eq('userId', user.id);

    let achievementScore = 0;
    if (achievements && achievements.length > 0) {
      achievements.forEach(ua => {
        achievementScore += ua.achievement?.points || 0;
      });
    }

    // Merge posts and comment activities into timeline
    const timeline = [];

    if (posts && posts.length > 0) {
      posts.forEach(post => {
        timeline.push({
          type: 'post',
          date: toDateKey(post.postedAt),
          data: post
        });
      });
    }

    if (commentActivities && commentActivities.length > 0) {
      commentActivities.forEach(activity => {
        timeline.push({
          type: 'comment_activity',
          date: toDateKey(activity.created_at),
          data: activity
        });
      });
    }

    // Sort timeline by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Extract unique dates
    const uniqueDates = [...new Set(timeline.map(item => item.date))].sort();

    // Calculate streak for each date
    const dateStreaks = {};
    let currentStreak = 0;
    let previousDate = null;

    for (const date of uniqueDates) {
      if (previousDate === null) {
        // First date
        currentStreak = 1;
      } else if (isConsecutive(previousDate, date)) {
        // Consecutive day
        currentStreak += 1;
      } else {
        // Gap - reset streak
        currentStreak = 1;
      }

      dateStreaks[date] = currentStreak;
      previousDate = date;
    }

    // Calculate scores for each item
    const scoredItems = [];
    let totalPostScore = 0;
    let totalCommentActivityScore = 0;

    for (const item of timeline) {
      const streak = dateStreaks[item.date] || 1;
      const multiplier = Math.min(
        1 + streak * SCORING_CONFIG.STREAK_MULTIPLIER,
        SCORING_CONFIG.MAX_STREAK_BONUS
      );

      if (item.type === 'post') {
        const post = item.data;
        const reactions = post.reactions || 0;
        const comments = post.comments || 0;
        const reposts = post.reposts || 0;

        const rawBaseScore = SCORING_CONFIG.BASE_POST_POINTS;
        const baseScore = rawBaseScore * multiplier;
        const engagementScore =
          reactions * SCORING_CONFIG.REACTION_POINTS +
          comments * SCORING_CONFIG.COMMENT_POINTS +
          reposts * SCORING_CONFIG.REPOST_POINTS;
        const calculatedScore = baseScore + engagementScore;
        const finalScore = Math.ceil(calculatedScore);

        totalPostScore += finalScore;

        scoredItems.push({
          type: 'post',
          date: item.date,
          streak: streak,
          multiplier: parseFloat(multiplier.toFixed(2)),
          reactions: reactions,
          comments: comments,
          reposts: reposts,
          rawBaseScore: rawBaseScore,
          baseScoreWithMultiplier: parseFloat(baseScore.toFixed(2)),
          engagementScore: parseFloat(engagementScore.toFixed(2)),
          calculatedScore: parseFloat(calculatedScore.toFixed(2)),
          finalScore: finalScore,
          url: post.url
        });
      } else if (item.type === 'comment_activity') {
        const rawBaseScore = SCORING_CONFIG.COMMENT_ACTIVITY_POINTS;
        const calculatedScore = rawBaseScore * multiplier;
        const finalScore = Math.ceil(calculatedScore);

        totalCommentActivityScore += finalScore;

        scoredItems.push({
          type: 'comment_activity',
          date: item.date,
          streak: streak,
          multiplier: parseFloat(multiplier.toFixed(2)),
          rawBaseScore: rawBaseScore,
          calculatedScore: parseFloat(calculatedScore.toFixed(2)),
          finalScore: finalScore,
          url: item.data.target_post_url
        });
      }
    }

    const finalTotalScore = totalPostScore + totalCommentActivityScore + achievementScore;

    // Add user results
    results.users.push({
      name: user.name,
      teamId: user.teamId,
      scoredItems: scoredItems,
      summary: {
        totalPosts: (posts?.length || 0),
        totalCommentActivities: (commentActivities?.length || 0),
        postScore: totalPostScore,
        commentActivityScore: totalCommentActivityScore,
        achievementScore: achievementScore,
        finalTotalScore: finalTotalScore,
        maxStreakAchieved: Math.max(...Object.values(dateStreaks), 0)
      }
    });

    console.log(`  ✅ ${user.name}: ${finalTotalScore} pts (${posts?.length || 0} posts, ${commentActivities?.length || 0} comments)`);
  }

  // Save to JSON file
  const filename = `accurate-scores-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));

  console.log(`\n✅ Calculation complete!`);
  console.log(`📄 Results saved to: ${filename}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Users processed: ${results.users.length}`);
  console.log(`   Total items scored: ${results.users.reduce((sum, u) => sum + u.scoredItems.length, 0)}`);
}

calculateAccurateScores().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
