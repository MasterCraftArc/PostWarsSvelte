import 'dotenv/config';
import { supabaseAdmin } from './src/lib/supabase-node.js';

async function checkMikeDates() {
  console.log('🔍 Checking Mike\'s Post Dates...\n');

  // Find Mike
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .ilike('name', '%Mike%')
    .limit(10);

  console.log('Users found:', users?.map(u => u.name));

  const mike = users?.find(u => u.name === 'Mike');

  if (!mike) {
    console.log('❌ Mike not found');
    return;
  }

  console.log(`\nFound: ${mike.name} (${mike.id})\n`);

  // Get all posts
  const { data: posts } = await supabaseAdmin
    .from('linkedin_posts')
    .select('postedAt, reactions, comments')
    .eq('userId', mike.id)
    .order('postedAt', { ascending: true });

  console.log(`Posts: ${posts?.length || 0}\n`);

  if (posts && posts.length > 0) {
    posts.forEach((post, i) => {
      const date = new Date(post.postedAt);
      console.log(`${i + 1}. ${date.toISOString().split('T')[0]} (${date.toLocaleDateString()}) - R:${post.reactions}, C:${post.comments}`);
    });

    // Check for gaps
    console.log('\n📅 Checking for consecutive days:');
    for (let i = 1; i < posts.length; i++) {
      const prev = new Date(posts[i-1].postedAt);
      const curr = new Date(posts[i].postedAt);
      const diffMs = curr - prev;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      const prevDate = prev.toISOString().split('T')[0];
      const currDate = curr.toISOString().split('T')[0];

      console.log(`  ${prevDate} → ${currDate}: ${diffDays.toFixed(1)} days apart ${diffDays === 1 ? '✅ consecutive' : '❌ GAP'}`);
    }
  }

  // Get comment activities
  const { data: comments } = await supabaseAdmin
    .from('comment_activities')
    .select('created_at')
    .eq('user_id', mike.id)
    .order('created_at', { ascending: true });

  console.log(`\nComment Activities: ${comments?.length || 0}`);
}

checkMikeDates().catch(console.error);
