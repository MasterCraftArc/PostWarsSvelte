#!/bin/bash

# Deploy leaderboard fix to Supabase
# This script updates the get_leaderboard function to properly calculate engagement from linkedin_posts table

echo "🚀 Deploying leaderboard engagement fix to Supabase..."

# Load environment variables
source .env

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_KEY not found in .env file"
    exit 1
fi

if [ -z "$PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Error: PUBLIC_SUPABASE_URL not found in .env file"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $PUBLIC_SUPABASE_URL | sed -n 's/https:\/\/\([^.]*\).supabase.co/\1/p')

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Could not extract project reference from SUPABASE_URL"
    exit 1
fi

echo "📦 Project: $PROJECT_REF"

# Execute SQL file
echo "🔧 Updating get_leaderboard function..."
npx supabase db push --db-url "postgresql://postgres:${SUPABASE_SERVICE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres" < supabase-leaderboard-function-fixed.sql

if [ $? -eq 0 ]; then
    echo "✅ Leaderboard function updated successfully!"
    echo ""
    echo "🎯 What was fixed:"
    echo "  - Added proper engagement calculation from linkedin_posts table"
    echo "  - Fixed posts count calculation based on timeframe"
    echo "  - Added update_user_total_score function for metrics updates"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test the leaderboard to verify engagement is showing correctly"
    echo "  2. Test manual metrics update in admin panel"
    echo "  3. Verify scores are recalculated after metrics updates"
else
    echo "❌ Error deploying function update"
    exit 1
fi