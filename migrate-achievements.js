import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateAchievements() {
  console.log('🚀 Starting achievement migration...\n');

  // Step 1: Update existing 5 achievements with new point values
  console.log('📝 Updating existing achievements with new point values...');

  const updates = [
    { id: '550e8400-e29b-41d4-a716-446655440001', name: 'First Post', points: 5 },
    { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Consistent Creator', points: 10 },
    { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Engagement Magnet', points: 15 },
    { id: '550e8400-e29b-41d4-a716-446655440004', name: 'Week Warrior', points: 20 },
    { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Viral Moment', points: 25 }
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from('achievements')
      .update({ points: update.points })
      .eq('id', update.id);

    if (error) {
      console.error(`❌ Failed to update ${update.name}:`, error.message);
    } else {
      console.log(`✅ Updated ${update.name}: 50-300 → ${update.points} points`);
    }
  }

  console.log('\n📥 Inserting new achievements...');

  // Step 2: Insert 2 new achievements
  const newAchievements = [
    {
      id: '550e8400-e29b-41d4-a716-446655440006',
      name: 'Leaderboard Champion',
      description: 'Reach #1 on the individual leaderboard',
      icon: '👑',
      points: 30,
      requirementType: 'leaderboard_first_place',
      requirementValue: 1
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440007',
      name: 'Race Winner',
      description: 'Be part of a team that wins a race goal',
      icon: '🏆',
      points: 25,
      requirementType: 'team_race_victory',
      requirementValue: 1
    }
  ];

  for (const achievement of newAchievements) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('achievements')
      .select('id')
      .eq('id', achievement.id)
      .single();

    if (existing) {
      console.log(`⚠️  ${achievement.name} already exists, skipping...`);
      continue;
    }

    const { error } = await supabase
      .from('achievements')
      .insert(achievement);

    if (error) {
      console.error(`❌ Failed to insert ${achievement.name}:`, error.message);
    } else {
      console.log(`✅ Inserted ${achievement.icon} ${achievement.name} (${achievement.points} points)`);
    }
  }

  console.log('\n✅ Achievement migration completed!');
  console.log('\nNext step: Run recalculate-user-points.js to update user totals');
}

migrateAchievements();
