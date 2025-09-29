-- Migration: Convert scoring fields from INTEGER to DECIMAL for fractional points
-- Run this in your Supabase SQL Editor

-- First, handle the trigger dependency on users.totalScore
-- Drop the trigger temporarily
DROP TRIGGER IF EXISTS trigger_update_goals_on_user_score_update ON "users";

-- Store the trigger function for recreation (if it exists)
-- We'll need to recreate it after the column type change

-- Users table: totalScore field
ALTER TABLE "users"
ALTER COLUMN "totalScore" TYPE DECIMAL(10,2) USING "totalScore"::DECIMAL(10,2);

-- LinkedIn posts table: all score fields
ALTER TABLE "linkedin_posts"
ALTER COLUMN "baseScore" TYPE DECIMAL(10,2) USING "baseScore"::DECIMAL(10,2),
ALTER COLUMN "engagementScore" TYPE DECIMAL(10,2) USING "engagementScore"::DECIMAL(10,2),
ALTER COLUMN "totalScore" TYPE DECIMAL(10,2) USING "totalScore"::DECIMAL(10,2);

-- Comment activities table: points_awarded field (if it exists)
-- First check if the table exists and create it with DECIMAL if it doesn't
DO $$
BEGIN
    -- Check if comment_activities table exists
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'comment_activities') THEN
        -- Table exists, alter the column
        ALTER TABLE "comment_activities"
        ALTER COLUMN "points_awarded" TYPE DECIMAL(10,2) USING "points_awarded"::DECIMAL(10,2);
    ELSE
        -- Table doesn't exist, create it with DECIMAL
        CREATE TABLE "comment_activities" (
            "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
            "user_id" TEXT NOT NULL,
            "target_post_url" TEXT NOT NULL,
            "points_awarded" DECIMAL(10,2) NOT NULL DEFAULT 1.0,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            -- Prevent duplicate submissions
            UNIQUE("user_id", "target_post_url"),
            CONSTRAINT "comment_activities_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "comment_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
        );

        -- Add index for user queries
        CREATE INDEX "comment_activities_user_id_idx" ON "comment_activities" ("user_id");
        CREATE INDEX "comment_activities_created_at_idx" ON "comment_activities" ("created_at");
    END IF;
END $$;

-- Achievements table: points field
ALTER TABLE "achievements"
ALTER COLUMN "points" TYPE DECIMAL(10,2) USING "points"::DECIMAL(10,2);

-- Recreate the trigger function for goal updates (if it was being used)
-- This is a common pattern for updating team/goal progress when user scores change
CREATE OR REPLACE FUNCTION update_goals_on_user_score_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Update any active team goals when a user's score changes
    -- This is a placeholder implementation - customize based on your goal logic
    IF NEW."totalScore" != OLD."totalScore" THEN
        -- Update team score goals for the user's team
        UPDATE goals
        SET "currentValue" = (
            SELECT COALESCE(SUM("totalScore"), 0)
            FROM users
            WHERE "teamId" = NEW."teamId"
        ),
        "updatedAt" = NOW()
        WHERE type = 'TEAM_SCORE'
        AND status = 'ACTIVE'
        AND ("teamId" = NEW."teamId" OR "teamId" IS NULL); -- Handle both team-specific and company-wide goals
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_goals_on_user_score_update
    AFTER UPDATE OF "totalScore" ON "users"
    FOR EACH ROW
    EXECUTE FUNCTION update_goals_on_user_score_update();

-- Verify the changes
SELECT
    table_name,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('users', 'linkedin_posts', 'comment_activities', 'achievements')
AND column_name IN ('totalScore', 'baseScore', 'engagementScore', 'points_awarded', 'points')
ORDER BY table_name, column_name;