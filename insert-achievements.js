import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const achievements = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'First Post',
    description: 'Share your first LinkedIn post',
    icon: '🎉',
    points: 5,
    requirementType: 'posts_count',
    requirementValue: 1
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Consistent Creator',
    description: 'Post 5 times in a month',
    icon: '📝',
    points: 10,
    requirementType: 'posts_count',
    requirementValue: 5
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Engagement Magnet',
    description: 'Get 100 total reactions across all posts',
    icon: '🧲',
    points: 15,
    requirementType: 'engagement_total',
    requirementValue: 100
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'Week Warrior',
    description: 'Post for 7 consecutive days',
    icon: '🔥',
    points: 20,
    requirementType: 'streak_days',
    requirementValue: 7
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: 'Viral Moment',
    description: 'Get 50 reactions on a single post',
    icon: '🚀',
    points: 25,
    requirementType: 'single_post_reactions',
    requirementValue: 50
  },
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

async function insertAchievements() {
  console.log('🎯 Inserting achievement definitions...');
  
  const { data, error } = await supabase
    .from('achievements')
    .insert(achievements)
    .select();
    
  if (error) {
    console.error('❌ Error inserting achievements:', error);
    return;
  }
  
  console.log(`✅ Successfully inserted ${data?.length || 0} achievements:`);
  data?.forEach(achievement => {
    console.log(`  🏆 ${achievement.name} (${achievement.points} points)`);
  });
}

insertAchievements();