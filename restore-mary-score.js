import 'dotenv/config';
import { supabaseAdmin } from './src/lib/supabase-node.js';

async function restoreMaryScore() {
  console.log('🔧 Restoring Mary Parsons\' Score to 200...\n');

  // Find Mary
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name, totalScore')
    .ilike('name', '%Mary%Parsons%');

  if (!users || users.length === 0) {
    console.log('❌ Could not find Mary Parsons');
    return;
  }

  const mary = users[0];
  console.log('👤 Found: Mary Parsons');
  console.log(`   Current Score: ${mary.totalScore}`);

  // Update score to 200
  const { error } = await supabaseAdmin
    .from('users')
    .update({ totalScore: 200 })
    .eq('id', mary.id);

  if (error) {
    console.log('❌ Error updating score:', error);
    return;
  }

  console.log('✅ Score updated successfully!');
  console.log(`   New Score: 200`);
  console.log(`   Points Added: ${200 - mary.totalScore}`);

  // Verify the update
  const { data: updated } = await supabaseAdmin
    .from('users')
    .select('totalScore')
    .eq('id', mary.id)
    .single();

  console.log('\n📊 Verification:');
  console.log(`   Database shows: ${updated?.totalScore} points`);
}

restoreMaryScore().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
