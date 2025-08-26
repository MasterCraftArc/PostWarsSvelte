#!/bin/bash

# Database deployment script for Supabase
# Run this manually when you need to update database schema or functions

echo "🚀 Deploying database changes to Supabase..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Deploy SQL functions
echo "📊 Deploying SQL functions..."

if [ -f "supabase-schema.sql" ]; then
    echo "Deploying schema..."
    supabase db push --file supabase-schema.sql
fi

if [ -f "supabase-dashboard-function-fixed.sql" ]; then
    echo "Deploying dashboard function..."
    supabase db push --file supabase-dashboard-function-fixed.sql
fi

if [ -f "supabase-leaderboard-function.sql" ]; then
    echo "Deploying leaderboard function..."
    supabase db push --file supabase-leaderboard-function.sql
fi

if [ -f "dashboard-function-working.sql" ]; then
    echo "Deploying dashboard working function..."
    supabase db push --file dashboard-function-working.sql
fi

echo "✅ Database deployment complete!"
echo ""
echo "💡 Remember to:"
echo "1. Test the functions in Supabase dashboard"
echo "2. Update environment variables in Netlify if needed"
echo "3. Trigger a new Netlify deploy if database changes affect the app"