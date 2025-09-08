#!/usr/bin/env node

// Standalone scraping script that bypasses all SvelteKit infrastructure
// Uses only relative imports to avoid any module resolution issues

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
  try {
    const jobId = process.argv[2];
    const linkedinUrl = process.argv[3];
    const userId = process.argv[4];
    
    if (!jobId || !linkedinUrl || !userId) {
      throw new Error('Missing required arguments: jobId, linkedinUrl, userId');
    }
    
    console.log('🔄 Starting LinkedIn scraping for job', jobId);
    
    // Environment check
    const url = process.env.PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    console.log('Environment check - URL present:', !!url, 'KEY present:', !!key);
    
    // Import modules using absolute paths to avoid any resolution issues
    const supabaseNodePath = resolve(__dirname, 'src/lib/supabase-node.js');
    const scraperPoolPath = resolve(__dirname, 'src/lib/linkedin-scraper-pool.js');
    const gamificationPath = resolve(__dirname, 'src/lib/gamification-node.js');
    
    console.log('Importing modules...');
    const { supabaseAdmin } = await import(supabaseNodePath);
    const { scrapeSinglePostQueued } = await import(scraperPoolPath);
    const { 
      calculatePostScore, 
      updateUserStats, 
      checkAndAwardAchievements 
    } = await import(gamificationPath);
    const { randomUUID } = await import('crypto');
    
    console.log('✅ All modules imported successfully');
    
    // Scrape the LinkedIn post
    console.log('📡 Scraping LinkedIn post:', linkedinUrl);
    const scrapedData = await scrapeSinglePostQueued(linkedinUrl, userId);
    
    if (!scrapedData) {
      throw new Error('No data could be extracted from the post');
    }
    
    console.log('✅ Successfully scraped data:', {
      reactions: scrapedData.reactions,
      comments: scrapedData.comments,
      reposts: scrapedData.reposts,
      wordCount: scrapedData.word_count
    });
    
    // Get user's current streak for scoring
    const { data: userPosts } = await supabaseAdmin
      .from('linkedin_posts')
      .select('totalScore, postedAt')
      .eq('userId', userId)
      .order('postedAt', { ascending: false });
    
    const currentStreak = userPosts && userPosts.length > 0 ? 
      Math.max(...userPosts.map((p) => p.totalScore)) : 0;
    
    // Calculate scoring
    const scoring = calculatePostScore({
      word_count: scrapedData.word_count,
      reactions: scrapedData.reactions,
      comments: scrapedData.comments,
      reposts: scrapedData.reposts,
      timestamp: scrapedData.timestamp
    }, currentStreak);
    
    console.log('🎯 Calculated scores:', scoring);
    
    // Save to database
    const linkedinId = scrapedData.id || scrapedData.linkedinId;
    let savedPost = null;
    
    // First try to find existing post
    const { data: existingPost } = await supabaseAdmin
      .from('linkedin_posts')
      .select('id')
      .eq('linkedinId', linkedinId)
      .single();
    
    if (existingPost) {
      // Update existing post
      const { data: updatedPost, error: updateError } = await supabaseAdmin
        .from('linkedin_posts')
        .update({
          reactions: scrapedData.reactions,
          comments: scrapedData.comments,
          reposts: scrapedData.reposts,
          totalEngagement: scrapedData.total_engagement,
          baseScore: scoring.baseScore,
          engagementScore: scoring.engagementScore,
          totalScore: scoring.totalScore,
          lastScrapedAt: new Date().toISOString()
        })
        .eq('linkedinId', linkedinId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      savedPost = updatedPost;
      console.log('📝 Updated existing post in database');
    } else {
      // Create new post
      const postId = randomUUID();
      
      const { data: newPost, error: createError } = await supabaseAdmin
        .from('linkedin_posts')
        .insert({
          id: postId,
          userId,
          linkedinId: linkedinId,
          url: linkedinUrl,
          content: scrapedData.text || scrapedData.content,
          authorName: scrapedData.author || scrapedData.authorName,
          reactions: scrapedData.reactions,
          comments: scrapedData.comments,
          reposts: scrapedData.reposts,
          totalEngagement: scrapedData.total_engagement,
          baseScore: scoring.baseScore,
          engagementScore: scoring.engagementScore,
          totalScore: scoring.totalScore,
          wordCount: scrapedData.word_count,
          charCount: scrapedData.char_count,
          postedAt: new Date(scrapedData.timestamp || scrapedData.postedAt).toISOString(),
          lastScrapedAt: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) throw createError;
      savedPost = newPost;
      console.log('✨ Created new post in database');
    }
    
    // Create analytics record
    try {
      const analyticsId = randomUUID();
      
      const { error: analyticsError } = await supabaseAdmin
        .from('post_analytics')
        .insert({
          id: analyticsId,
          postId: savedPost.id,
          reactions: scrapedData.reactions,
          comments: scrapedData.comments,
          reposts: scrapedData.reposts,
          totalEngagement: scrapedData.total_engagement,
          reactionGrowth: 0,
          commentGrowth: 0,
          repostGrowth: 0
        });
      
      if (analyticsError) {
        console.log('Analytics creation failed:', analyticsError.message);
      } else {
        console.log('📊 Created analytics record');
      }
    } catch (analyticsError) {
      console.log('Analytics creation failed:', analyticsError.message);
    }
    
    // Update user stats
    try {
      console.log('👤 Updating user stats...');
      await updateUserStats(userId);
      console.log('✅ User stats updated');
    } catch (error) {
      console.error('⚠️  User stats update failed:', error.message);
    }
    
    // Check for new achievements
    let newAchievements = [];
    try {
      console.log('🏆 Checking for new achievements...');
      newAchievements = await checkAndAwardAchievements(userId);
      console.log('✅ Achievements checked');
    } catch (error) {
      console.error('⚠️  Achievement check failed:', error.message);
    }
    
    // Update job status to completed
    try {
      const { error: jobUpdateError } = await supabaseAdmin
        .from('jobs')
        .update({ 
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          result: JSON.stringify({
            post: savedPost,
            scoring: scoring,
            newAchievements: newAchievements
          })
        })
        .eq('id', jobId);
      
      if (jobUpdateError) throw jobUpdateError;
      console.log('✅ Job status updated to COMPLETED');
    } catch (error) {
      console.error('⚠️  Job status update failed:', error.message);
    }
    
    console.log('🎉 Scraping workflow completed successfully');
    
  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Update job status to failed
    try {
      const supabaseNodePath = resolve(__dirname, 'src/lib/supabase-node.js');
      const { supabaseAdmin } = await import(supabaseNodePath);
      await supabaseAdmin
        .from('jobs')
        .update({ 
          status: 'FAILED',
          failedAt: new Date().toISOString(),
          error: error.message
        })
        .eq('id', process.argv[2]);
    } catch (updateError) {
      console.error('Failed to update job status:', updateError.message);
    }
    
    process.exit(1);
  }
})();