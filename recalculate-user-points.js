import { updateUserStats } from './src/lib/gamification.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function recalculateUserPoints() {
  console.log('🔄 Starting user points recalculation...\n');
  console.log('Using updateUserStats() to recalculate totalScore (posts + comments + achievements)\n');

  // Get all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, totalScore');

  if (usersError) {
    console.error('❌ Failed to fetch users:', usersError.message);
    return;
  }

  console.log(`📊 Found ${users.length} users to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const oldTotalScore = user.totalScore || 0;

    try {
      // Call updateUserStats which recalculates totalScore including achievement points
      const result = await updateUserStats(user.id);

      if (result) {
        const newTotalScore = result.totalScore || 0;
        if (newTotalScore !== oldTotalScore) {
          console.log(`✅ ${(user.name || 'User ' + user.id).padEnd(25)}: ${oldTotalScore} → ${newTotalScore} points`);
        } else {
          console.log(`⚪ ${(user.name || 'User ' + user.id).padEnd(25)}: ${oldTotalScore} points (unchanged)`);
        }
        successCount++;
      } else {
        console.log(`⚠️  ${(user.name || 'User ' + user.id).padEnd(25)}: No posts/activities found`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ ${(user.name || 'User ' + user.id).padEnd(25)}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`✅ Recalculation complete!`);
  console.log(`   Successful: ${successCount} users`);
  console.log(`   Errors: ${errorCount} users`);
  console.log(`   Total: ${users.length} users`);
  console.log('─'.repeat(80));
  console.log('\nNext step: Run verify-achievement-migration.js to verify everything is correct');
}

recalculateUserPoints();
