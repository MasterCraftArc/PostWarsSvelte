-- Fixed dashboard function with proper column names and error handling
-- This version matches the actual Supabase schema exactly

DROP FUNCTION IF EXISTS get_user_dashboard(TEXT);

CREATE OR REPLACE FUNCTION get_user_dashboard(p_user_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  user_record RECORD;
  user_rank INTEGER;
BEGIN
  -- Get user record first with exact column names
  SELECT id, name, email, "totalScore", "postsThisMonth", "currentStreak", "bestStreak"
  INTO user_record 
  FROM users 
  WHERE id = p_user_id;
  
  -- If user not found, return error
  IF user_record.id IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Calculate user rank efficiently  
  SELECT COUNT(*) + 1 INTO user_rank 
  FROM users 
  WHERE "totalScore" > user_record."totalScore";
  
  -- Build result with all dashboard data in a single query
  WITH post_stats AS (
    SELECT 
      COUNT(*) as total_posts,
      COALESCE(SUM("totalEngagement"), 0) as total_engagement,
      COUNT(*) FILTER (WHERE "postedAt" >= date_trunc('month', CURRENT_DATE)) as monthly_posts,
      COALESCE(SUM("totalEngagement") FILTER (WHERE "postedAt" >= date_trunc('month', CURRENT_DATE)), 0) as monthly_engagement
    FROM linkedin_posts
    WHERE "userId" = p_user_id
  ),
  recent_posts AS (
    SELECT json_agg(
      json_build_object(
        'id', id,
        'url', url,
        'content', CASE 
          WHEN LENGTH(content) > 150 
          THEN LEFT(content, 150) || '...' 
          ELSE content 
        END,
        'authorName', "authorName",
        'reactions', reactions,
        'comments', comments,
        'reposts', reposts,
        'totalEngagement', "totalEngagement",
        'totalScore', "totalScore",
        'postedAt', "postedAt",
        'lastScrapedAt', "lastScrapedAt",
        'growth', json_build_object('reactions', 0, 'comments', 0, 'reposts', 0)
      )
    ) as posts_json
    FROM (
      SELECT *
      FROM linkedin_posts
      WHERE "userId" = p_user_id
      ORDER BY "postedAt" DESC
      LIMIT 10
    ) ordered_posts
  ),
  recent_achievements AS (
    SELECT json_agg(
      json_build_object(
        'name', name,
        'description', description,
        'icon', icon,
        'points', points,
        'earnedAt', "earnedAt"
      )
    ) as achievements_json
    FROM (
      SELECT a.name, a.description, a.icon, a.points, ua."earnedAt"
      FROM user_achievements ua
      JOIN achievements a ON ua."achievementId" = a.id
      WHERE ua."userId" = p_user_id
      ORDER BY ua."earnedAt" DESC
      LIMIT 5
    ) ordered_achievements
  )
  SELECT json_build_object(
    'user', json_build_object(
      'id', user_record.id,
      'name', user_record.name,
      'email', user_record.email,
      'totalScore', user_record."totalScore",
      'postsThisMonth', user_record."postsThisMonth",
      'currentStreak', user_record."currentStreak",
      'bestStreak', user_record."bestStreak",
      'rank', user_rank
    ),
    'stats', json_build_object(
      'totalPosts', ps.total_posts,
      'totalEngagement', ps.total_engagement,
      'monthlyPosts', ps.monthly_posts,
      'monthlyEngagement', ps.monthly_engagement,
      'averageEngagement', CASE 
        WHEN ps.total_posts > 0 
        THEN ROUND(ps.total_engagement::numeric / ps.total_posts, 0)
        ELSE 0 
      END
    ),
    'recentPosts', COALESCE(rp.posts_json, '[]'::json),
    'recentAchievements', COALESCE(ra.achievements_json, '[]'::json)
  )
  INTO result
  FROM post_stats ps
  CROSS JOIN recent_posts rp
  CROSS JOIN recent_achievements ra;
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 'Function error: ' || SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_dashboard(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dashboard(TEXT) TO anon;