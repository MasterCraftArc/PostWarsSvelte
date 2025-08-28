-- =====================================================
-- AUTO-UPDATE GOAL PROGRESS - DATABASE TRIGGERS
-- =====================================================
-- This creates a PostgreSQL function and triggers that automatically
-- update goal progress whenever posts are inserted/updated in linkedin_posts
-- or when user scores change.

-- Function to update all active goal progress
CREATE OR REPLACE FUNCTION update_all_goals_progress()
RETURNS VOID AS $function$
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
        
        -- Get user IDs based on goal scope (company vs team)
        IF goal_record."teamId" = 'company-team-id' THEN
            -- Company goal - get all user IDs
            SELECT ARRAY(SELECT id FROM users) INTO user_ids;
        ELSE
            -- Team goal - get team member IDs only
            SELECT ARRAY(SELECT id FROM users WHERE "teamId" = goal_record."teamId") INTO user_ids;
        END IF;
        
        -- Skip if no users found
        IF array_length(user_ids, 1) IS NULL OR array_length(user_ids, 1) = 0 THEN
            CONTINUE;
        END IF;
        
        -- Calculate current value based on goal type
        CASE goal_record.type
            WHEN 'POSTS_COUNT' THEN
                -- Count posts by users since goal start date
                SELECT COUNT(*) INTO current_value
                FROM linkedin_posts 
                WHERE "userId" = ANY(user_ids)
                AND "createdAt" >= goal_record."startDate";
                
            WHEN 'TOTAL_ENGAGEMENT' THEN
                -- Sum all engagement from posts since goal start date
                SELECT COALESCE(SUM("totalEngagement"), 0) INTO current_value
                FROM linkedin_posts 
                WHERE "userId" = ANY(user_ids)
                AND "createdAt" >= goal_record."startDate";
                
            WHEN 'AVERAGE_ENGAGEMENT' THEN
                -- Calculate average engagement per post since goal start date
                SELECT COALESCE(ROUND(AVG("totalEngagement")), 0) INTO current_value
                FROM linkedin_posts 
                WHERE "userId" = ANY(user_ids)
                AND "createdAt" >= goal_record."startDate"
                AND "totalEngagement" IS NOT NULL;
                
            WHEN 'TEAM_SCORE' THEN
                -- Sum current total scores of users
                SELECT COALESCE(SUM("totalScore"), 0) INTO current_value
                FROM users 
                WHERE id = ANY(user_ids);
                
            ELSE
                -- Unknown goal type, set to 0
                current_value := 0;
        END CASE;
        
        -- Determine if goal is completed
        is_completed := current_value >= goal_record."targetValue";
        new_status := CASE WHEN is_completed THEN 'COMPLETED' ELSE 'ACTIVE' END;
        
        -- Update the goal with new progress
        UPDATE goals 
        SET 
            "currentValue" = current_value,
            "status" = new_status,
            "updatedAt" = NOW()
        WHERE id = goal_record.id;
        
        -- Log the update (optional, can be removed in production)
        RAISE NOTICE 'Updated goal "%": %/% (%)', 
            goal_record.title, 
            current_value, 
            goal_record."targetValue",
            CASE WHEN is_completed THEN 'COMPLETED' ELSE 'IN PROGRESS' END;
        
    END LOOP;
    
    -- Log completion
    RAISE NOTICE 'Goal progress update completed at %', NOW();
    
END;
$function$ LANGUAGE plpgsql;

-- =====================================================
-- CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_goals_on_post_insert ON linkedin_posts;
DROP TRIGGER IF EXISTS trigger_update_goals_on_post_update ON linkedin_posts;
DROP TRIGGER IF EXISTS trigger_update_goals_on_user_score_update ON users;

-- Trigger 1: When new posts are inserted
CREATE TRIGGER trigger_update_goals_on_post_insert
    AFTER INSERT ON linkedin_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_all_goals_progress();

-- Trigger 2: When posts are updated (engagement changes)
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

-- Trigger 3: When user total scores change (for TEAM_SCORE goals)
CREATE TRIGGER trigger_update_goals_on_user_score_update
    AFTER UPDATE OF "totalScore" ON users
    FOR EACH ROW
    WHEN (OLD."totalScore" IS DISTINCT FROM NEW."totalScore")
    EXECUTE FUNCTION update_all_goals_progress();

-- =====================================================
-- TEST THE FUNCTION (Optional - for verification)
-- =====================================================

-- You can manually test the function by running:
-- SELECT update_all_goals_progress();

-- To see what goals exist:
-- SELECT id, title, type, "currentValue", "targetValue", status, "teamId" FROM goals WHERE status = 'ACTIVE';

-- =====================================================
-- NOTES
-- =====================================================
-- 1. This function will run automatically whenever:
--    - A new post is inserted into linkedin_posts
--    - Post engagement data is updated (reactions, comments, reposts, totalEngagement)
--    - User total scores are updated
--
-- 2. The function handles both company-wide goals (teamId = 'company-team-id')
--    and team-specific goals
--
-- 3. All four goal types are supported:
--    - POSTS_COUNT: Count of posts since goal start date
--    - TOTAL_ENGAGEMENT: Sum of all engagement since goal start date  
--    - AVERAGE_ENGAGEMENT: Average engagement per post since goal start date
--    - TEAM_SCORE: Sum of current user total scores
--
-- 4. Goals are automatically marked as COMPLETED when currentValue >= targetValue
--
-- 5. The function uses proper column name quoting for PostgreSQL compatibility
--
-- 6. RAISE NOTICE statements can be removed in production if you don't want logs