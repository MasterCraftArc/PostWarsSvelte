-- Fixed leaderboard function that properly calculates engagement from linkedin_posts table
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_timeframe TEXT DEFAULT 'all',
  p_scope TEXT DEFAULT 'company',
  p_team_id TEXT DEFAULT NULL,
  p_requesting_user_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  team_info JSON DEFAULT NULL;
  date_filter TIMESTAMP DEFAULT NULL;
BEGIN
  -- Calculate date filter based on timeframe
  IF p_timeframe = 'week' THEN
    date_filter := NOW() - INTERVAL '7 days';
  ELSIF p_timeframe = 'month' THEN
    date_filter := NOW() - INTERVAL '30 days';
  ELSE
    date_filter := '2000-01-01'::TIMESTAMP; -- All time
  END IF;

  -- Build leaderboard based on scope
  IF p_scope = 'team' AND p_requesting_user_id IS NOT NULL THEN
    -- Get user's team leaderboard
    SELECT json_build_object(
      'timeframe', p_timeframe,
      'scope', p_scope,
      'teamInfo', team_data.team_info,
      'leaderboard', team_data.leaderboard,
      'userRank', team_data.user_rank
    ) INTO result
    FROM (
      SELECT 
        json_build_object(
          'id', t.id,
          'name', t.name,
          'memberCount', COUNT(DISTINCT u.id)
        ) as team_info,
        json_agg(
          json_build_object(
            'rank', user_stats.rank,
            'id', user_stats.user_id,
            'name', user_stats.user_name,
            'email', user_stats.user_email,
            'teamName', t.name,
            'totalScore', user_stats.total_score,
            'postsThisMonth', user_stats.posts_this_month,
            'currentStreak', user_stats.current_streak,
            'postsInTimeframe', user_stats.posts_count,
            'engagementInTimeframe', user_stats.total_engagement,
            'achievements', '[]'::json,
            'isCurrentUser', (user_stats.user_id = p_requesting_user_id)
          ) ORDER BY user_stats.rank
        ) as leaderboard,
        -- Calculate requesting user's rank
        MIN(CASE WHEN user_stats.user_id = p_requesting_user_id THEN user_stats.rank ELSE NULL END) as user_rank
      FROM (
        SELECT 
          u.id as user_id,
          COALESCE(u.name, split_part(u.email, '@', 1)) as user_name,
          u.email as user_email,
          u."totalScore" as total_score,
          u."postsThisMonth" as posts_this_month,
          u."currentStreak" as current_streak,
          COALESCE(post_stats.posts_count, 0) as posts_count,
          COALESCE(post_stats.total_engagement, 0) as total_engagement,
          ROW_NUMBER() OVER (ORDER BY u."totalScore" DESC) as rank
        FROM users u
        INNER JOIN users requesting_user ON requesting_user.id = p_requesting_user_id
        LEFT JOIN (
          SELECT 
            "userId",
            COUNT(*) as posts_count,
            SUM("totalEngagement") as total_engagement
          FROM linkedin_posts
          WHERE "postedAt" >= date_filter
          GROUP BY "userId"
        ) post_stats ON post_stats."userId" = u.id
        WHERE u."teamId" = requesting_user."teamId"
      ) user_stats
      INNER JOIN teams t ON t.id = user_stats.user_id
      GROUP BY t.id, t.name
    ) team_data;
    
  ELSIF p_scope = 'company' THEN
    -- Company-wide leaderboard
    SELECT json_build_object(
      'timeframe', p_timeframe,
      'scope', p_scope,
      'teamInfo', NULL,
      'leaderboard', json_agg(
        json_build_object(
          'rank', ranked_users.rank,
          'id', ranked_users.id,
          'name', ranked_users.name,
          'email', ranked_users.email,
          'teamName', ranked_users.team_name,
          'totalScore', ranked_users.total_score,
          'postsThisMonth', ranked_users.posts_this_month,
          'currentStreak', ranked_users.current_streak,
          'postsInTimeframe', ranked_users.posts_count,
          'engagementInTimeframe', ranked_users.total_engagement,
          'achievements', '[]'::json,
          'isCurrentUser', (ranked_users.id = p_requesting_user_id)
        ) ORDER BY ranked_users.rank
      ),
      'userRank', (
        SELECT rank FROM (
          SELECT 
            u.id,
            ROW_NUMBER() OVER (ORDER BY u."totalScore" DESC) as rank
          FROM users u
        ) user_ranks 
        WHERE id = p_requesting_user_id
      )
    ) INTO result
    FROM (
      SELECT 
        u.id,
        COALESCE(u.name, split_part(u.email, '@', 1)) as name,
        u.email,
        COALESCE(t.name, 'No Team') as team_name,
        u."totalScore" as total_score,
        u."postsThisMonth" as posts_this_month,
        u."currentStreak" as current_streak,
        COALESCE(post_stats.posts_count, 0) as posts_count,
        COALESCE(post_stats.total_engagement, 0) as total_engagement,
        ROW_NUMBER() OVER (ORDER BY u."totalScore" DESC) as rank
      FROM users u
      LEFT JOIN teams t ON u."teamId" = t.id
      LEFT JOIN (
        SELECT 
          "userId",
          COUNT(*) as posts_count,
          SUM("totalEngagement") as total_engagement
        FROM linkedin_posts
        WHERE "postedAt" >= date_filter
        GROUP BY "userId"
      ) post_stats ON post_stats."userId" = u.id
      ORDER BY u."totalScore" DESC
      LIMIT 100 -- Limit for performance
    ) ranked_users;
    
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_leaderboard(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard(TEXT, TEXT, TEXT, TEXT) TO anon;

-- Create function to update user total score (for manual metrics update)
CREATE OR REPLACE FUNCTION update_user_total_score(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET "totalScore" = (
    SELECT COALESCE(SUM("totalScore"), 0)
    FROM linkedin_posts
    WHERE "userId" = p_user_id
  )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_user_total_score(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_total_score(TEXT) TO service_role;