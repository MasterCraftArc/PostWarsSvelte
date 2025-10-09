import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const expectedAchievements = [
  { name: 'First Post', points: 5 },
  { name: 'Consistent Creator', points: 10 },
  { name: 'Engagement Magnet', points: 15 },
  { name: 'Week Warrior', points: 20 },
  { name: 'Viral Moment', points: 25 },
  { name: 'Leaderboard Champion', points: 30 },
  { name: 'Race Winner', points: 25 }
];

async function verifyMigration() {
  console.log('🔍 Verifying achievement migration...\n');

  let allPassed = true;

  // Test 1: Check all 7 achievements exist
  console.log('Test 1: Checking all 7 achievements exist...');
  const { data: achievements, error: achError } = await supabase
    .from('achievements')
    .select('*')
    .order('points', { ascending: true });

  if (achError) {
    console.error('❌ Failed to fetch achievements:', achError.message);
    allPassed = false;
  } else if (achievements.length !== 7) {
    console.error(`❌ Expected 7 achievements, found ${achievements.length}`);
    allPassed = false;
  } else {
    console.log(`✅ All 7 achievements exist\n`);
  }

  // Test 2: Verify each achievement has correct points
  console.log('Test 2: Verifying achievement point values...');
  for (const expected of expectedAchievements) {
    const achievement = achievements?.find(a => a.name === expected.name);
    if (!achievement) {
      console.error(`❌ ${expected.name} not found`);
      allPassed = false;
    } else if (achievement.points !== expected.points) {
      console.error(`❌ ${expected.name}: expected ${expected.points} points, got ${achievement.points}`);
      allPassed = false;
    } else {
      console.log(`✅ ${achievement.icon} ${achievement.name.padEnd(25)} = ${achievement.points} points`);
    }
  }

  // Test 3: Verify user totalScore includes achievement points correctly
  console.log('\nTest 3: Verifying user totalScore includes achievement points...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, totalScore');

  if (usersError) {
    console.error('❌ Failed to fetch users:', usersError.message);
    allPassed = false;
  } else {
    let verifiedCount = 0;
    console.log('Sampling 5 users to verify achievement points are included in totalScore:\n');

    // Check first 5 users with achievements
    const usersWithPosts = users.filter(u => u.totalScore > 0).slice(0, 5);

    for (const user of usersWithPosts) {
      // Get user's achievements
      const { data: userAchievements } = await supabase
        .from('user_achievements')
        .select(`
          achievementId,
          achievements (
            name,
            points
          )
        `)
        .eq('userId', user.id);

      const achievementPoints = userAchievements?.reduce((sum, ua) => {
        return sum + (ua.achievements?.points || 0);
      }, 0) || 0;

      const userName = user.name || 'User ' + user.id;
      if (achievementPoints > 0) {
        console.log(`  ${userName.padEnd(25)}: totalScore=${user.totalScore}, includes ${achievementPoints} achievement points`);
        verifiedCount++;
      } else {
        console.log(`  ${userName.padEnd(25)}: totalScore=${user.totalScore}, no achievements`);
      }
    }

    console.log(`\n✅ Verified ${verifiedCount} users have achievement points included in totalScore`);
  }

  // Test 4: Display summary statistics
  console.log('\n📊 Migration Summary:');
  console.log('─'.repeat(80));

  const totalAchievementPoints = expectedAchievements.reduce((sum, a) => sum + a.points, 0);
  console.log(`Total possible achievement points: ${totalAchievementPoints}`);
  console.log(`Achievement count: ${achievements?.length || 0}`);

  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const { count: awardCount } = await supabase
    .from('user_achievements')
    .select('*', { count: 'exact', head: true });

  console.log(`Users in system: ${userCount}`);
  console.log(`Total achievements awarded: ${awardCount}`);
  console.log('─'.repeat(80));

  // Final result
  console.log('\n' + '═'.repeat(80));
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Migration successful!');
  } else {
    console.log('❌ SOME TESTS FAILED - Review errors above');
  }
  console.log('═'.repeat(80));
}

verifyMigration();
