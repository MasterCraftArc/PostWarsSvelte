import { supabaseAdmin as supabase } from './src/lib/supabase-node.js';

function calculateStreakFromPosts(posts) {
  if (!posts || posts.length === 0) return 0;

  // Sort by postedAt descending
  const sortedPosts = posts.sort((a, b) => {
    return new Date(b.postedAt) - new Date(a.postedAt);
  });

  // Check if most recent post is from today or yesterday (EST)
  const now = new Date();
  const todayEST = now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [todayMonth, todayDay, todayYear] = todayEST.split('/');
  const todayKey = `${todayYear}-${todayMonth}-${todayDay}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEST = yesterday.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [yesterdayMonth, yesterdayDay, yesterdayYear] = yesterdayEST.split('/');
  const yesterdayKey = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;

  // Get most recent post date
  const mostRecentPostTime = new Date(sortedPosts[0].postedAt);
  const mostRecentEST = mostRecentPostTime.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [recentMonth, recentDay, recentYear] = mostRecentEST.split('/');
  const recentKey = `${recentYear}-${recentMonth}-${recentDay}`;

  // If most recent post is NOT from today or yesterday, streak is broken
  if (recentKey !== todayKey && recentKey !== yesterdayKey) {
    return 0;
  }

  // Get unique calendar dates
  const uniqueDates = new Set();
  for (const post of sortedPosts) {
    const postTime = new Date(post.postedAt);
    const estDate = postTime.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [month, day, year] = estDate.split('/');
    const dateKey = `${year}-${month}-${day}`;
    uniqueDates.add(dateKey);
  }

  const sortedDates = Array.from(uniqueDates).sort().reverse();
  if (sortedDates.length === 0) return 0;
  if (sortedDates.length === 1) return 1;

  // Calculate streak
  let streak = 1;
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const currentDate = new Date(sortedDates[i]);
    const nextDate = new Date(sortedDates[i + 1]);
    const daysDiff = Math.round((currentDate - nextDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function restoreAllStreaks() {
  console.log('🚨 RESTORING ALL STREAKS\n');

  // Get all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, currentStreak');

  if (usersError) {
    console.error('❌ Failed to fetch users:', usersError.message);
    process.exit(1);
  }

  console.log(`📊 Found ${users.length} users\n`);

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      // Get user's posts
      const { data: posts, error: postsError } = await supabase
        .from('linkedin_posts')
        .select('postedAt')
        .eq('userId', user.id)
        .order('postedAt', { ascending: false });

      if (postsError) {
        console.error(`❌ ${user.name}: ${postsError.message}`);
        continue;
      }

      if (!posts || posts.length === 0) {
        console.log(`⚪ ${user.name.padEnd(25)}: No posts`);
        skipped++;
        continue;
      }

      // Calculate correct streak
      const correctStreak = calculateStreakFromPosts(posts);
      const oldStreak = user.currentStreak || 0;

      // Update if different
      if (correctStreak !== oldStreak) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ currentStreak: correctStreak })
          .eq('id', user.id);

        if (updateError) {
          console.error(`❌ ${user.name}: ${updateError.message}`);
        } else {
          console.log(`✅ ${user.name.padEnd(25)}: ${oldStreak} → ${correctStreak}`);
          updated++;
        }
      } else {
        console.log(`⚪ ${user.name.padEnd(25)}: ${oldStreak} (correct)`);
        skipped++;
      }
    } catch (error) {
      console.error(`❌ ${user.name}: ${error.message}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅ Restoration complete!`);
  console.log(`   Updated: ${updated} users`);
  console.log(`   Unchanged: ${skipped} users`);
  console.log('─'.repeat(60));
}

restoreAllStreaks();
