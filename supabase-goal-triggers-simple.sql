-- Simple Goal Auto-Update Function and Triggers for Supabase
-- Run this entire script in your Supabase SQL Editor

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_goals_on_post_insert ON linkedin_posts;
DROP TRIGGER IF EXISTS trigger_update_goals_on_post_update ON linkedin_posts;
DROP TRIGGER IF EXISTS trigger_update_goals_on_user_score_update ON users;
DROP FUNCTION IF EXISTS update_all_goals_progress();

-- Create the goal update function
CREATE OR REPLACE FUNCTION update_all_goals_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    goal_record RECORD;
    current_value INTEGER;
    user_ids UUID[];
    is_completed BOOLEAN;
    new_status TEXT;
BEGIN
    -- Loop through all active goals
    FOR goal_record IN 
        SELECT * FROM goals WHERE status = 'ACTIVE'
    LOOP
        current_value := 0;
        
        -- Get user IDs based on goal scope
        IF goal_record."teamId" = 'company-team-id' THEN
            SELECT ARRAY(SELECT id FROM users) INTO user_ids;
        ELSE
            SELECT ARRAY(SELECT id FROM users WHERE "teamId" = goal_record."teamId") INTO user_ids;
        END IF;
        
        -- Skip if no users found
        IF array_length(user_ids, 1) IS NULL OR array_length(user_ids, 1) = 0 THEN
            CONTINUE;
        END IF;
        
        -- Calculate current value based on goal type
        CASE goal_record.type
            WHEN 'POSTS_COUNT' THEN
                SELECT COUNT(*) INTO current_value
                FROM linkedin_posts 
                WHERE "userId" = ANY(user_ids)
                AND "createdAt" >= goal_record."startDate";
                
            WHEN 'TOTAL_ENGAGEMENT' THEN
                SELECT COALESCE(SUM("totalEngagement"), 0) INTO current_value
                FROM linkedin_posts 
                WHERE "userId" = ANY(user_ids)
                AND "createdAt" >= goal_record."startDate";
                
            WHEN 'AVERAGE_ENGAGEMENT' THEN
                SELECT COALESCE(ROUND(AVG("totalEngagement")), 0) INTO current_value
                FROM linkedin_posts 
                WHERE "userId" = ANY(user_ids)
                AND "createdAt" >= goal_record."startDate"
                AND "totalEngagement" IS NOT NULL;
                
            WHEN 'TEAM_SCORE' THEN
                SELECT COALESCE(SUM("totalScore"), 0) INTO current_value
                FROM users 
                WHERE id = ANY(user_ids);
                
            ELSE
                current_value := 0;
        END CASE;
        
        -- Update the goal
        is_completed := current_value >= goal_record."targetValue";
        new_status := CASE WHEN is_completed THEN 'COMPLETED' ELSE 'ACTIVE' END;
        
        UPDATE goals 
        SET 
            "currentValue" = current_value,
            "status" = new_status,
            "updatedAt" = NOW()
        WHERE id = goal_record.id;
        
    END LOOP;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for automatic updates
CREATE TRIGGER trigger_update_goals_on_post_insert
    AFTER INSERT ON linkedin_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_all_goals_progress();

CREATE TRIGGER trigger_update_goals_on_post_update
    AFTER UPDATE OF "totalEngagement", "reactions", "comments", "reposts" ON linkedin_posts
    FOR EACH ROW
    WHEN (
        OLD."totalEngagement" IS DISTINCT FROM NEW."totalEngagement" OR
        OLD."reactions" IS DISTINCT FROM NEW."reactions" OR
        OLD."comments" IS DISTINCT FROM NEW."comments" OR
        OLD."reposts" IS DISTINCT FROM NEW."reposts"
    )
    EXECUTE FUNCTION update_all_goals_progress();

CREATE TRIGGER trigger_update_goals_on_user_score_update
    AFTER UPDATE OF "totalScore" ON users
    FOR EACH ROW
    WHEN (OLD."totalScore" IS DISTINCT FROM NEW."totalScore")
    EXECUTE FUNCTION update_all_goals_progress();

-- Test the function (optional)
-- SELECT update_all_goals_progress();