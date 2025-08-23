-- Working dashboard function with fixed SQL
DROP FUNCTION IF EXISTS get_user_dashboard(TEXT);

CREATE OR REPLACE FUNCTION get_user_dashboard(p_user_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  user_record RECORD;
  user_rank INTEGER;
  total_posts INTEGER;
  total_engagement INTEGER;
  monthly_posts INTEGER;
  monthly_engagement INTEGER;
  posts_json JSON;
  achievements_json JSON;
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
  
  -- Get post statistics
  SELECT 
    COUNT(*)::INTEGER,
    COALESCE(SUM("totalEngagement"), 0)::INTEGER,
    COUNT(*) FILTER (WHERE "postedAt" >= date_trunc('month', CURRENT_DATE))::INTEGER,
    COALESCE(SUM("totalEngagement") FILTER (WHERE "postedAt" >= date_trunc('month', CURRENT_DATE)), 0)::INTEGER
  INTO total_posts, total_engagement, monthly_posts, monthly_engagement
  FROM linkedin_posts
  WHERE "userId" = p_user_id;
  
  -- Get recent posts as JSON
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
  )
  INTO posts_json
  FROM (
    SELECT *
    FROM linkedin_posts
    WHERE "userId" = p_user_id
    ORDER BY "postedAt" DESC
    LIMIT 10
  ) recent_posts_subquery;
  
  -- Get recent achievements as JSON
  SELECT json_agg(
    json_build_object(
      'name', name,
      'description', description,
      'icon', icon,
      'points', points,
      'earnedAt', "earnedAt"
    )
  )
  INTO achievements_json
  FROM (
    SELECT a.name, a.description, a.icon, a.points, ua."earnedAt"
    FROM user_achievements ua
    JOIN achievements a ON ua."achievementId" = a.id
    WHERE ua."userId" = p_user_id
    ORDER BY ua."earnedAt" DESC
    LIMIT 5
  ) recent_achievements_subquery;
  
  -- Build final result
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
      'totalPosts', COALESCE(total_posts, 0),
      'totalEngagement', COALESCE(total_engagement, 0),
      'monthlyPosts', COALESCE(monthly_posts, 0),
      'monthlyEngagement', COALESCE(monthly_engagement, 0),
      'averageEngagement', CASE 
        WHEN COALESCE(total_posts, 0) > 0 
        THEN ROUND(COALESCE(total_engagement, 0)::numeric / total_posts, 0)
        ELSE 0 
      END
    ),
    'recentPosts', COALESCE(posts_json, '[]'::json),
    'recentAchievements', COALESCE(achievements_json, '[]'::json)
  )
  INTO result;
  
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