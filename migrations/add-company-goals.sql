-- Migration: Add Company Goals Support via Company Team
-- Run this in your Supabase SQL Editor

-- 1. Create a special "Company" team for company-wide goals
INSERT INTO "teams" (id, name, description, "teamLeadId") 
VALUES (
    'company-team-id', 
    'Company', 
    'Virtual team representing all company members for company-wide goals', 
    NULL
) ON CONFLICT (id) DO NOTHING;

-- 2. Add all existing users to the Company team (keep their original teamId as well)
-- This creates a many-to-many relationship concept using a company team
-- Note: Users will still have their original teamId, but company goals will use the Company team

-- 3. Add index for company team queries
CREATE INDEX IF NOT EXISTS "goals_company_team_idx" ON "goals" ("teamId") WHERE "teamId" = 'company-team-id';

-- 4. For company goals, we'll use teamId = 'company-team-id'
-- The application logic will handle getting all users for company goals