import 'dotenv/config';
import fs from 'fs';
import { supabaseAdmin } from './src/lib/supabase-node.js';

async function updateDatabaseWithAccurateScores() {
  console.log('📊 Updating Database with Accurate Historical Scores...\\n');

  // Read the accurate scores file
  const data = JSON.parse(fs.readFileSync('accurate-scores-2025-11-10.json', 'utf8'));

  console.log(`📋 Processing ${data.users.length} users...\\n`);

  let usersUpdated = 0;
  let postsUpdated = 0;
  let commentsUpdated = 0;

  for (const user of data.users) {
    console.log(`Processing: ${user.name}`);

    // Find user in database
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('name', user.name)
      .single();

    if (!dbUser) {
      console.log(`  ⚠️  User not found in database, skipping`);
      continue;
    }

    // Update each scored item in the database
    for (const item of user.scoredItems) {
      if (item.type === 'post') {
        // Find post by URL
        const { data: post } = await supabaseAdmin
          .from('linkedin_posts')
          .select('id')
          .eq('url', item.url)
          .eq('userId', dbUser.id)
          .single();

        if (post) {
          // Update post with accurate score
          const { error } = await supabaseAdmin
            .from('linkedin_posts')
            .update({
              totalScore: item.finalScore,
              engagementScore: item.engagementScore
            })
            .eq('id', post.id);

          if (!error) {
            postsUpdated++;
          } else {
            console.log(`    ❌ Error updating post: ${error.message}`);
          }
        }
      } else if (item.type === 'comment_activity') {
        // Find comment activity by URL
        const { data: activity } = await supabaseAdmin
          .from('comment_activities')
          .select('id')
          .eq('target_post_url', item.url)
          .eq('user_id', dbUser.id)
          .single();

        if (activity) {
          // Update comment activity with accurate score
          const { error } = await supabaseAdmin
            .from('comment_activities')
            .update({
              points_awarded: item.finalScore
            })
            .eq('id', activity.id);

          if (!error) {
            commentsUpdated++;
          } else {
            console.log(`    ❌ Error updating comment: ${error.message}`);
          }
        }
      }
    }

    // Update user's total score
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        totalScore: user.summary.finalTotalScore
      })
      .eq('id', dbUser.id);

    if (!userError) {
      usersUpdated++;
      console.log(`  ✅ ${user.name}: ${user.summary.finalTotalScore} pts (${postsUpdated} posts, ${commentsUpdated} comments updated)`);
    } else {
      console.log(`  ❌ Error updating user: ${userError.message}`);
    }
  }

  console.log(`\\n✅ Database update complete!`);
  console.log(`📊 Summary:`);
  console.log(`   Users updated: ${usersUpdated}`);
  console.log(`   Posts updated: ${postsUpdated}`);
  console.log(`   Comments updated: ${commentsUpdated}`);
}

updateDatabaseWithAccurateScores().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
