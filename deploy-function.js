import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing environment variables');
  console.error('Required: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployFunction() {
  try {
    console.log('🚀 Deploying update_user_total_score function...');
    
    // SQL for the function
    const sql = `
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
    `;

    const { data, error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.error('❌ Error deploying function:', error);
      return;
    }

    console.log('✅ Function deployed successfully');
    
    // Test the function
    console.log('🧪 Testing function...');
    const { data: testData, error: testError } = await supabase.rpc('update_user_total_score', {
      p_user_id: 'test-user-id'
    });

    if (testError && !testError.message.includes('violates foreign key constraint')) {
      console.error('❌ Function test failed:', testError);
    } else {
      console.log('✅ Function test passed (or expected FK error)');
    }
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
  }
}

deployFunction();