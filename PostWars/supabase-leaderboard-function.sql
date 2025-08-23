-- Optimized leaderboard function using window functions and efficient ranking
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
BEGIN
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
          'memberCount', COUNT(u.id)
        ) as team_info,
        json_agg(
          json_build_object(
            'rank', ROW_NUMBER() OVER (ORDER BY u."totalScore" DESC),
            'id', u.id,
            'name', COALESCE(u.name, split_part(u.email, '@', 1)),
            'email', u.email,
            'teamName', t.name,
            'totalScore', u."totalScore",
            'postsThisMonth', u."postsThisMonth", 
            'currentStreak', u."currentStreak",
            'postsInTimeframe', 0, -- TODO: Calculate based on timeframe
            'engagementInTimeframe', 0, -- TODO: Calculate based on timeframe
            'achievements', '[]'::json, -- TODO: Load achievements separately if needed
            'isCurrentUser', (u.id = p_requesting_user_id)
          ) ORDER BY u."totalScore" DESC
        ) as leaderboard,
        -- Calculate requesting user's rank
        (ROW_NUMBER() OVER (ORDER BY u."totalScore" DESC) + 
         CASE WHEN u.id = p_requesting_user_id THEN 0 ELSE 999999 END
        ) as user_rank
      FROM users u
      INNER JOIN users requesting_user ON requesting_user.id = p_requesting_user_id
      INNER JOIN teams t ON u."teamId" = t.id AND t.id = requesting_user."teamId"
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
          'postsInTimeframe', 0,
          'engagementInTimeframe', 0,
          'achievements', '[]'::json,
          'isCurrentUser', (ranked_users.id = p_requesting_user_id)
        ) ORDER BY ranked_users.rank
      ),
      'userRank', (
        SELECT rank FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "totalScore" DESC) as rank
          FROM users
        ) user_ranks WHERE id = p_requesting_user_id
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
        ROW_NUMBER() OVER (ORDER BY u."totalScore" DESC) as rank
      FROM users u
      LEFT JOIN teams t ON u."teamId" = t.id
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