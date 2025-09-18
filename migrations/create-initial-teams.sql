-- Migration: Create Initial Teams for Auto-Assignment
-- Run this in your Supabase SQL Editor

-- Create 6 balanced teams for user auto-assignment
INSERT INTO "teams" (id, name, description, "createdAt", "updatedAt")
VALUES
    ('team-dragons', 'Team Dragons', 'Fierce competitors breathing fire', NOW(), NOW()),
    ('team-phoenixes', 'Team Phoenixes', 'Rising from challenges stronger', NOW(), NOW()),
    ('team-unicorns', 'Team Unicorns', 'Magical innovators and creators', NOW(), NOW()),
    ('team-lions', 'Team Lions', 'Bold leaders of the pride', NOW(), NOW()),
    ('team-eagles', 'Team Eagles', 'Soaring above the competition', NOW(), NOW()),
    ('team-wolves', 'Team Wolves', 'Strategic pack hunters', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Add index for team assignment queries
CREATE INDEX IF NOT EXISTS "users_team_assignment_idx" ON "users" ("teamId") WHERE "teamId" IS NOT NULL;

-- Add index for team member count queries (for balanced assignment)
CREATE INDEX IF NOT EXISTS "teams_member_count_idx" ON "teams" (id);

-- Verify teams were created successfully
-- This will show 6 teams (plus any existing teams like 'company-team-id')
SELECT
    id,
    name,
    description,
    (SELECT COUNT(*) FROM users WHERE "teamId" = teams.id) as member_count
FROM teams
WHERE id LIKE 'team-%'
ORDER BY name;