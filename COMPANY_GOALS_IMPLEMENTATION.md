# PostWars Company Goals Implementation Plan

## 🎯 Current Problem Analysis

### **Issues Identified:**
1. **Company goals exist but aren't visible to users** - Users see "team not found" instead of company goals
2. **No automatic contribution** - User posts don't automatically count toward company goals
3. **Admin interface incomplete** - Can create company goals but they're not properly integrated
4. **Not reactive** - Changes to posts don't update company goal progress in real-time

### **Current Architecture Issues:**
- `TeamProgress.svelte` only looks for team goals, ignores company goals
- `team-progress` API endpoint only returns team data
- Company goals use `teamId = 'company-team-id'` but this isn't properly handled
- No real-time updates when posts are created/updated

---

## 📋 IMPLEMENTATION PLAN

### **Phase 1: Database & API Foundation**

#### **Step 1.1: Ensure Company Team Exists**
```sql
-- Make sure the company team exists for company goals
INSERT INTO "teams" (id, name, description, "teamLeadId") 
VALUES (
    'company-team-id', 
    'Company Goals', 
    'Company-wide goals that apply to all users', 
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;
```

#### **Step 1.2: Update team-progress API to Include Company Goals**
**File: `src/routes/api/team-progress/+server.js`**

**Current behavior:** Only shows team goals, fails for users without teams  
**New behavior:** Always show company goals + team goals (if user has team)

```javascript
// New API response structure:
{
  companyGoals: [...], // Always included for all users
  team: {...},         // User's team info (null if no team)
  teamGoals: [...],    // Team-specific goals (empty if no team)
  members: [...],      // Team members (empty if no team)
  stats: {...}         // Combined team stats
}
```

#### **Step 1.3: Create Company Goals Display Component**
**File: `src/lib/components/CompanyGoals.svelte`**

- Shows company-wide goals for all users
- Real-time progress updates
- Beautiful progress bars and achievement display

---

### **Phase 2: Automatic Post Contribution System**

#### **Step 2.1: Database Triggers for Real-time Updates**
```sql
-- Function to update company goal progress when posts change
CREATE OR REPLACE FUNCTION update_company_goals_progress()
RETURNS TRIGGER AS $$
DECLARE
    company_goals RECORD;
BEGIN
    -- Update all active company goals when any post changes
    FOR company_goals IN 
        SELECT * FROM goals 
        WHERE status = 'ACTIVE' AND "teamId" = 'company-team-id'
    LOOP
        PERFORM update_single_goal_progress(company_goals.id);
    END LOOP;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update company goals
CREATE TRIGGER update_company_goals_on_post_change
    AFTER INSERT OR UPDATE OR DELETE ON linkedin_posts
    FOR EACH STATEMENT 
    EXECUTE FUNCTION update_company_goals_progress();
```

#### **Step 2.2: Real-time Goal Progress Function**
```sql
-- Function to calculate and update a single goal's progress
CREATE OR REPLACE FUNCTION update_single_goal_progress(goal_id TEXT)
RETURNS VOID AS $$
DECLARE
    goal RECORD;
    current_value INTEGER := 0;
    user_ids UUID[];
BEGIN
    -- Get goal details
    SELECT * INTO goal FROM goals WHERE id = goal_id;
    
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Get applicable user IDs
    IF goal."teamId" = 'company-team-id' THEN
        -- Company goal: all users
        SELECT ARRAY_AGG(id) INTO user_ids FROM users;
    ELSE
        -- Team goal: team members only
        SELECT ARRAY_AGG(id) INTO user_ids 
        FROM users WHERE "teamId" = goal."teamId";
    END IF;
    
    -- Calculate current progress based on goal type
    CASE goal.type
        WHEN 'POSTS_COUNT' THEN
            SELECT COUNT(*) INTO current_value
            FROM linkedin_posts 
            WHERE "userId" = ANY(user_ids)
            AND "createdAt" >= goal."startDate";
            
        WHEN 'TOTAL_ENGAGEMENT' THEN
            SELECT COALESCE(SUM("totalEngagement"), 0) INTO current_value
            FROM linkedin_posts 
            WHERE "userId" = ANY(user_ids)
            AND "createdAt" >= goal."startDate";
            
        WHEN 'AVERAGE_ENGAGEMENT' THEN
            SELECT COALESCE(AVG("totalEngagement"), 0)::INTEGER INTO current_value
            FROM linkedin_posts 
            WHERE "userId" = ANY(user_ids)
            AND "createdAt" >= goal."startDate";
            
        WHEN 'TEAM_SCORE' THEN
            SELECT COALESCE(SUM("totalScore"), 0) INTO current_value
            FROM users WHERE id = ANY(user_ids);
    END CASE;
    
    -- Update goal progress
    UPDATE goals 
    SET 
        "currentValue" = current_value,
        status = CASE 
            WHEN current_value >= "targetValue" THEN 'COMPLETED'::GoalStatus
            ELSE 'ACTIVE'::GoalStatus
        END,
        "updatedAt" = NOW()
    WHERE id = goal_id;
END;
$$ LANGUAGE plpgsql;
```

---

### **Phase 3: Frontend Integration**

#### **Step 3.1: Update Dashboard to Show Company Goals**
**File: `src/lib/components/Dashboard.svelte`**

Add company goals section above or alongside team progress:

```svelte
<!-- Company Goals Section (Always Visible) -->
<CompanyGoals />

<!-- Team Progress Section (Only if user has team) -->
{#if dashboardData.team}
    <TeamProgress />
{/if}
```

#### **Step 3.2: Create CompanyGoals Component**
**File: `src/lib/components/CompanyGoals.svelte`**

```svelte
<script>
    import { onMount, onDestroy } from 'svelte';
    import { user } from '$lib/stores/auth.js';
    import { supabase } from '$lib/supabase.js';
    import { authenticatedRequest } from '$lib/api.js';
    import ProgressBar from './ProgressBar.svelte';
    
    let companyGoals = [];
    let loading = true;
    let goalSubscription;
    
    onMount(() => {
        loadCompanyGoals();
        setupRealTimeSubscriptions();
    });
    
    function setupRealTimeSubscriptions() {
        // Subscribe to company goal changes
        goalSubscription = supabase
            .channel('company_goals')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'goals',
                filter: 'teamId=eq.company-team-id'
            }, (payload) => {
                console.log('Company goal updated:', payload);
                loadCompanyGoals(); // Refresh goals
            })
            .subscribe();
    }
    
    onDestroy(() => {
        if (goalSubscription) goalSubscription.unsubscribe();
    });
    
    async function loadCompanyGoals() {
        try {
            const data = await authenticatedRequest('/api/company-goals');
            companyGoals = data.goals || [];
        } catch (err) {
            console.error('Failed to load company goals:', err);
        }
        loading = false;
    }
</script>

<div class="rounded-xl p-6 shadow-lg backdrop-blur-md"
     style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;">
    
    <h2 class="text-2xl font-bold mb-4" style="color:#fdfdfd;">
        🏢 Company Goals
    </h2>
    
    {#if loading}
        <div class="flex justify-center py-4">
            <div class="animate-spin h-8 w-8 border-2 border-blue-500"></div>
        </div>
    {:else if companyGoals.length === 0}
        <p style="color:#94a3b8;">No active company goals at the moment.</p>
    {:else}
        <div class="space-y-4">
            {#each companyGoals as goal}
                <div class="rounded-lg p-4" 
                     style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
                    
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-semibold" style="color:#fdfdfd;">{goal.title}</h3>
                        <span class="text-sm" style="color:#94a3b8;">
                            {getDaysRemaining(goal.endDate)} days left
                        </span>
                    </div>
                    
                    {#if goal.description}
                        <p class="text-sm mb-3" style="color:#cbd5e1;">{goal.description}</p>
                    {/if}
                    
                    <ProgressBar 
                        current={goal.currentValue}
                        target={goal.targetValue}
                        label={getGoalTypeLabel(goal.type)}
                        color={goal.status === 'COMPLETED' ? '#22c55e' : '#24b0ff'}
                    />
                </div>
            {/each}
        </div>
    {/if}
</div>
```

#### **Step 3.3: Create Company Goals API Endpoint**
**File: `src/routes/api/company-goals/+server.js`**

```javascript
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
    try {
        const user = await getAuthenticatedUser(event);
        if (!user) {
            return json({ error: 'Authentication required' }, { status: 401 });
        }

        // Get all active company goals
        const { data: goals, error } = await supabaseAdmin
            .from('goals')
            .select('*')
            .eq('teamId', 'company-team-id')
            .eq('status', 'ACTIVE')
            .order('createdAt', { ascending: false });

        if (error) {
            return json({ error: 'Failed to fetch company goals' }, { status: 500 });
        }

        return json({ goals: goals || [] });
    } catch (error) {
        console.error('Company goals error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

---

### **Phase 4: Admin Interface Enhancement**

#### **Step 4.1: Fix Admin Goal Creation**
**File: `src/routes/admin/+page.svelte`**

The admin interface already supports company goals, but we need to ensure it's working properly:

```svelte
<!-- In the goal creation form, this already exists: -->
<select bind:value={newGoal.teamId}>
    <option value="" class="text-slate-900">Select Team</option>
    <option value="company" class="text-slate-900">🏢 Company-wide Goal</option>
    {#each teams as team}
        <option value={team.id} class="text-slate-900">{team.name}</option>
    {/each}
</select>
```

The backend already converts `teamId = "company"` to `"company-team-id"` so this should work.

#### **Step 4.2: Add Company Goals Management Section**
Add a dedicated section in admin for managing company goals:

```svelte
<!-- Company Goals Section -->
<div class="rounded-xl p-6 shadow-lg backdrop-blur-md"
     style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;">
    
    <h2 class="text-2xl font-semibold mb-4" style="color:#fdfdfd;">
        🏢 Company Goals
    </h2>
    
    <div class="space-y-4">
        {#each goals.filter(g => g.teamId === 'company-team-id') as goal}
            <!-- Company goal display -->
        {/each}
    </div>
</div>
```

---

### **Phase 5: Real-time Updates**

#### **Step 5.1: Enable Real-time for Goals Table**
```sql
-- Enable real-time subscriptions for goals
ALTER PUBLICATION supabase_realtime ADD TABLE goals;
```

#### **Step 5.2: Post Contribution Notifications**
When users create posts, they should see immediate feedback that they contributed to company goals:

```javascript
// In post submission success handler
if (response.companyGoalsUpdated) {
    showNotification(`Your post contributed to ${response.companyGoalsUpdated.length} company goals!`);
}
```

---

## 🔄 IMPLEMENTATION STEPS (In Order)

### **Step 1: Database Setup**
1. Run company team creation SQL
2. Add database triggers for real-time goal updates
3. Enable real-time for goals table

### **Step 2: Backend APIs**
1. Create `/api/company-goals` endpoint
2. Update existing goal creation/management APIs
3. Add goal progress update functions

### **Step 3: Frontend Components**
1. Create `CompanyGoals.svelte` component
2. Update `Dashboard.svelte` to include company goals
3. Add real-time subscriptions

### **Step 4: Admin Interface**
1. Verify company goal creation works
2. Add company goals management section
3. Add progress monitoring for admins

### **Step 5: Testing & Polish**
1. Test company goal creation from admin
2. Test automatic progress updates when posts are created
3. Test real-time updates across multiple users
4. Add notifications and feedback

---

## 🎯 Expected Results

### **For Users:**
- ✅ See company goals on their dashboard (even without a team)
- ✅ Automatic contribution to company goals when posting
- ✅ Real-time progress updates
- ✅ Achievement notifications

### **For Admins:**
- ✅ Easy company goal creation and management
- ✅ Real-time progress monitoring
- ✅ Company-wide engagement tracking

### **Technical Benefits:**
- ✅ Reactive system - no more cron jobs for basic goal updates
- ✅ Real-time user engagement
- ✅ Scalable architecture that works for any number of users

---

## ⚠️ Migration Considerations

### **Existing Data:**
- Existing company goals should work immediately
- Users will start seeing company goals after frontend update
- No data migration needed

### **Performance:**
- Database triggers are efficient for real-time updates
- Real-time subscriptions handle UI updates
- Goal progress calculated instantly when posts change

---

This plan creates a fully reactive company goals system where every user's posts automatically contribute to company objectives, with real-time progress updates and a great admin experience.