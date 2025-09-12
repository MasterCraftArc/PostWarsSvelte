# PostWars - Architecture & Development Guidelines



## 🚨 OUTSTANDING ISSUES

### Issue #1: LinkedIn Comment Activity Tracking  
**Problem:** Users cannot earn points for commenting on LinkedIn posts due to LinkedIn's authentication restrictions  
**Root Cause:** LinkedIn blocks all unauthenticated scraping, preventing repost/engagement capture  
**Impact:** Limited gamification options, users can only earn points from posting  
**Status:** 🔥 **CRITICAL** - New feature required to maintain user engagement  

**Proposed Solution:**
Comment activity submission using existing UI pattern - users paste LinkedIn post URL they commented on, system immediately awards points and displays in dashboard (no processing/scraping)

**Technical Implementation Plan:**
1. **Database Schema:** New `comment_activities` table for URL tracking
2. **Scoring System:** Extend existing `gamification.js` with comment activity points
3. **API Endpoint:** `/api/comment-activities/submit` for immediate processing
4. **Dashboard Integration:** Show comment activities alongside posts in dashboard
5. **UI Integration:** Reuse existing post submission form pattern

**Architecture Compliance:**
- Follow TDD methodology (tests first)
- Small batch changes (6 separate PRs, max 5 files each)
- Extend existing files rather than create duplicates
- Use established import patterns
- Single source of truth principle

**Expected Outcomes:**
- Users can earn points for LinkedIn engagement without scraping
- Increased daily app usage through activity logging
- Gamification of community participation
- Workaround for LinkedIn's access restrictions

**Priority:** Must implement to provide alternative engagement tracking

---

## ✅ RESOLVED ISSUES

### ✅ Issue #3: Scoring System Inconsistency (FIXED - Jan 2025)
**Problem:** Two different gamification systems with conflicting scoring  
**Solution:** Consolidated to single `gamification.js` with conservative scoring  
**Files Fixed:** 6 files updated to use consistent scoring algorithm  

### ✅ Issue #4: Architecture Cleanup (FIXED - Jan 2025)  
**Problem:** 11 unused/duplicate files cluttering codebase  
**Solution:** Removed all unused files, cleaned up imports  
**Impact:** -1,293 lines of dead code removed  

### ✅ Issue #5: GitHub Actions Compatibility (FIXED - Jan 2025)  
**Problem:** Import chain issues causing CI/CD failures  
**Solution:** Fixed all workflows to use correct modules  

### ✅ Issue #6: Post Submission Confirmation (FIXED - Jan 2025)
**Problem:** Users receive no confirmation when they submit a post  
**Solution:** Added immediate confirmation and "Recent Posts" section with points breakdown

### ✅ Issue #7: Missing Engagement Rules Documentation (FIXED - Jan 2025)
**Problem:** Users don't understand the scoring system or engagement rules  
**Solution:** Added scoring rules explanation to submit post page with current config

### ✅ Issue #8: Team System Clarity (FIXED - Jan 2025)
**Problem:** Users don't understand team mechanics (Active Goals, team joining/switching)  
**Solution:** Added explanations for Active Goals, Questions sections, and team mechanics

### ✅ Issue #9: Leaderboard Engagement Display (FIXED - Jan 2025)
**Problem:** Leaderboard not showing actual post engagement from database  
**Solution:** Created shared engagement utility in $lib/engagement.js, updated leaderboard to calculate engagement from individual fields (reactions + comments + reposts)

### ✅ Issue #10: User Achievements Display (FIXED - Jan 2025)
**Problem:** Leaderboard lacked recent achievement information for users  
**Solution:** Added achievements store system and API endpoint, integrated recent achievements display in leaderboard with proper Svelte 5 syntax

---

# 🏗️ STRICT ARCHITECTURE GUIDELINES

## 🚫 MANDATORY RULES - NO EXCEPTIONS

### 1. **Single Source of Truth Principle**
```
❌ NEVER create duplicate files with similar functionality
✅ ONE authoritative file per domain (scoring, auth, scraping, etc.)
```

### 2. **Import Consistency Rules**
```typescript
// CLIENT-SIDE (Svelte components, stores)
import { supabase } from '$lib/supabase.js';

// SERVER-SIDE (API routes, Node.js scripts, GitHub Actions)  
import { supabaseAdmin } from '$lib/supabase-node.js';

// GAMIFICATION (everywhere)
import { calculatePostScore } from '$lib/gamification.js';

// SCRAPING (everywhere)
import { scrapeSinglePost } from '$lib/linkedin-scraper.js';
```

### 3. **File Naming Convention**
```
✅ ALLOWED file patterns:
- supabase.js (client-side)
- supabase-node.js (server-side/Node.js)
- gamification.js (single scoring system)
- linkedin-scraper.js (primary scraper)

❌ FORBIDDEN patterns:
- *-node.js AND non-node version (creates confusion)
- *-pool.js variants (adds complexity) 
- *-server.js variants (environment specific)
- copy/duplicate files of any kind
```

### 4. **Database Client Usage**
```typescript
// API ROUTES
import { supabaseAdmin } from '$lib/supabase-node.js';  // ADMIN access

// SVELTE COMPONENTS  
import { supabase } from '$lib/supabase.js';            // CLIENT access

// NO OTHER PATTERNS ALLOWED
```

### 5. **Scoring System Rules**
```typescript
// ONLY ONE scoring configuration allowed
export const SCORING_CONFIG = {
  BASE_POST_POINTS: 1,      // Conservative base scoring
  REACTION_POINTS: 0.1,     // 0.1 points per reaction
  COMMENT_POINTS: 1,        // 1 point per comment  
  REPOST_POINTS: 2,         // 2 points per repost
};

// NO alternative scoring systems permitted
```

---

# 🧪 TEST-DRIVEN DEVELOPMENT (MANDATORY)

## Test-First Development Process

### 1. **Before ANY Code Change**
```bash
# STEP 1: Write failing test first
npm run test:unit -- --reporter verbose

# STEP 2: Write minimal code to pass test
# STEP 3: Refactor while keeping tests green
# STEP 4: Commit only when all tests pass
```

### 2. **Required Test Coverage**
```typescript
// API ENDPOINTS - Must have integration tests
describe('POST /api/posts/submit', () => {
  it('should calculate correct score with gamification.js', async () => {
    // Test scoring consistency
  });
});

// SCORING FUNCTIONS - Must have unit tests  
describe('calculatePostScore', () => {
  it('should return consistent scores with BASE_POST_POINTS: 1', () => {
    // Test algorithm correctness
  });
});

// IMPORT COMPATIBILITY - Must have Node.js tests
describe('GitHub Actions Compatibility', () => {
  it('should import all modules in Node.js environment', async () => {
    // Test import resolution
  });
});
```

### 3. **Test Organization**
```
tests/
├── unit/           # Pure function testing
│   ├── gamification.test.js
│   └── scraping.test.js
├── integration/    # API endpoint testing  
│   ├── posts.test.js
│   └── leaderboard.test.js
└── compatibility/  # Environment testing
    └── github-actions.test.js
```

### 4. **Pre-Commit Requirements**
```bash
# ALL must pass before ANY commit
npm run test:unit        # Unit tests
npm run test:integration # API tests  
npm run build           # Build verification
npm run lint            # Code quality
```

---

# 📦 SMALL BATCH CHANGE POLICY

## Batch Size Limits

### 1. **Maximum Change Scope**
```
✅ ALLOWED per PR:
- 1 feature OR 1 bug fix OR 1 refactor
- Maximum 5 files changed
- Maximum 200 lines net change
- Single functional domain (scoring, auth, scraping)

❌ FORBIDDEN per PR:
- Multiple unrelated changes
- Architecture + feature changes combined
- >10 files modified in single PR
- Breaking changes + new features together
```

### 2. **Change Categories**
```typescript
// CATEGORY A: Critical Fixes (immediate merge)
- Security vulnerabilities
- Production-breaking bugs  
- Data corruption issues

// CATEGORY B: Feature Changes (staged deployment)
- New API endpoints
- UI enhancements
- Algorithm improvements

// CATEGORY C: Architecture Changes (careful review)
- File restructuring
- Import pattern changes
- Database schema updates
```

### 3. **Branch Naming Convention**
```bash
# CRITICAL FIXES
fix/scoring-inconsistency
fix/security-auth-bypass

# FEATURES  
feat/user-achievements
feat/team-leaderboards

# ARCHITECTURE
refactor/consolidate-imports
refactor/remove-unused-files

# NEVER mix categories in single branch
```

---

# 🎯 CURRENT SYSTEM STATE

## ✅ Verified Architecture (as of Jan 2025)

### **Scoring System**
- **Active:** `src/lib/gamification.js` 
- **Configuration:** BASE_POST_POINTS: 1, REACTION_POINTS: 0.1
- **Used by:** 6 files (all consistent)
- **Status:** ✅ Clean, no duplicates

### **Database Clients**  
- **Client-side:** `src/lib/supabase.js` (RLS, browser)
- **Server-side:** `src/lib/supabase-node.js` (Admin, Node.js)
- **Status:** ✅ Clean separation, no conflicts

### **Scraping System**
- **Active:** `src/lib/linkedin-scraper.js`
- **Status:** ✅ Clean import chain, GitHub Actions compatible

### **GitHub Actions**
- **Status:** ✅ All 6 workflows use correct imports
- **Compatibility:** ✅ Verified Node.js environment compatibility

## 📊 Code Quality Metrics

```
Total Files: ~200 files
Dead Code Removed: 1,293 lines  
Unused Files Deleted: 11 files
Import Consistency: 100%
Test Coverage: ⚠️ Needs improvement
Architecture Violations: 0
```

---

# ⚡ IMMEDIATE PRIORITIES

## 🔥 Critical (Must Fix This Sprint)

1. **Implement Comment Activity Tracking**
   - Complete 6-PR implementation plan (see Outstanding Issues)
   - Enable users to earn points for commenting on LinkedIn posts
   - Workaround LinkedIn's authentication restrictions
   - Must follow TDD and small batch policies

2. **Fix Engagement Metrics Scraping**
   - Add validation for realistic engagement numbers
   - Prevent timestamp parsing as engagement counts  
   - Test with real LinkedIn posts

3. **Fix Leaderboard Display**
   - Aggregate actual engagement from linkedin_posts table
   - Display real likes/comments/reposts breakdown
   - Test calculation accuracy

## 🚧 High Priority (Next Sprint)

1. **Implement Test Coverage**
   - Add unit tests for gamification.js
   - Add integration tests for scoring APIs  
   - Add GitHub Actions compatibility tests

2. **Security Hardening**
   - Remove console.log statements from production
   - Sanitize error responses
   - Add comprehensive input validation

---

# 📋 COMMENT ACTIVITY TRACKING - IMPLEMENTATION PLAN

## 🎯 Implementation Strategy (3 Small PRs)

### **PR #1: Database Schema + Tests** 
**Branch:** `feat/comment-activity-schema`  
**Files:** 1 migration + 1 test file  
**Lines:** ~50 lines  
**TDD Order:**
1. Write failing test for `comment_activities` table
2. Create database migration following posts table pattern
3. Verify test passes

**Schema:** (Simple tracking table)
```sql
CREATE TABLE comment_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_post_url TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 2,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate submissions
  UNIQUE(user_id, target_post_url)
);
```

### **PR #2: API Endpoint + Scoring**
**Branch:** `feat/comment-activity-api`  
**Files:** `src/routes/api/comment-activities/submit/+server.js` + `src/lib/gamification.js` update + tests  
**Lines:** ~80 lines  
**TDD Order:**
1. Write failing integration test
2. Implement immediate processing (no job queue)
3. Add comment activity points to scoring system

**API Endpoint:** (Immediate processing, no scraping)
```javascript
export async function POST({ request, locals }) {
  const { targetPostUrl } = await request.json();
  
  // Validate URL format
  // Check for duplicates
  // Award points immediately
  // Save to comment_activities table
  // Return success with points awarded
}
```

### **PR #3: Dashboard Integration**
**Branch:** `feat/comment-activity-dashboard`  
**Files:** Modify existing dashboard components + extend tests  
**Lines:** ~60 lines added  
**TDD Order:**
1. Write integration tests for dashboard display
2. Add comment activities to existing dashboard queries
3. Display comment activities alongside posts

**Integration:** Add to existing dashboard data fetching
```javascript
// Add to existing dashboard API call
const { data: commentActivities } = await supabase
  .from('comment_activities')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

## 🔄 Development Workflow Per PR

### **Before Starting Each PR:**
```bash
# 1. Ensure on latest main
git checkout main && git pull origin main

# 2. Create feature branch
git checkout -b feat/comment-activity-schema

# 3. Write failing test first (TDD mandatory)
# Edit test file, run: npm run test:unit
# Confirm test fails

# 4. Write minimal code to pass test
# 5. Ensure all tests pass
npm run test:unit && npm run test:integration

# 6. Check build and lint
npm run build && npm run lint

# 7. Commit small batch (<200 lines)
git add . && git commit -m "feat: add comment activity schema"

# 8. Push and create PR
git push -u origin feat/comment-activity-schema
```

## 📋 Architecture Compliance Checklist

### **Each PR Must:**
- [ ] Follow TDD (tests written first)
- [ ] Stay under 200 lines net change
- [ ] Modify maximum 5 files
- [ ] Use existing import patterns
- [ ] Extend existing files vs creating duplicates
- [ ] Pass all existing tests
- [ ] Include proper error handling
- [ ] Follow single responsibility principle

### **Import Pattern Compliance:**
```javascript
// Server-side (API routes)
import { supabaseAdmin } from '$lib/supabase-node.js';
import { calculateCommentActivityScore } from '$lib/gamification.js';

// Client-side (Svelte components) 
import { supabase } from '$lib/supabase.js';
```

## 🎯 Success Metrics

### **Technical:**
- All 6 PRs merged without architecture violations
- 100% test coverage for new functionality
- Zero breaking changes to existing features
- Clean build and lint on all commits

### **User Experience:**
- Users submit comment activity URLs like regular posts
- Same familiar workflow as post submission
- Activities appear in dashboard alongside posts
- Clear processing status and point awards

### **Business:**
- Alternative engagement tracking established
- Reduced dependency on LinkedIn scraping
- Leverages existing job queue infrastructure
- Consistent user experience across features

---

# 🛠️ DEVELOPMENT WORKFLOW

## Before Starting Work

```bash
# 1. Pull latest changes
git checkout main && git pull origin main

# 2. Create focused branch  
git checkout -b fix/specific-issue-name

# 3. Write failing test first
npm run test:unit

# 4. Implement minimal fix
# 5. Verify tests pass
# 6. Commit small batch
```

## Before Submitting PR

```bash
# 1. Run full test suite
npm test

# 2. Verify build works
npm run build  

# 3. Check architecture compliance
npm run lint

# 4. Verify no unused imports
# 5. Confirm single responsibility principle
```

## PR Requirements

```markdown
## Change Summary
- [ ] Single functional change
- [ ] Tests added/updated  
- [ ] Architecture guidelines followed
- [ ] <200 lines net change
- [ ] No duplicate functionality created

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass  
- [ ] Manual testing completed

## Architecture Compliance
- [ ] Follows import patterns
- [ ] No duplicate files created
- [ ] Single source of truth maintained
```

---

# 🔒 NON-NEGOTIABLES

1. **NO duplicate functionality** - Ever. Delete or consolidate immediately.
2. **NO architecture violations** - Follow import patterns strictly.  
3. **NO untested code** - Write tests first, code second.
4. **NO large batch changes** - Keep PRs small and focused.
5. **NO production secrets** - Use .gitignore and environment variables.

**Violation of any non-negotiable = immediate PR rejection**

---

**Last Updated:** January 2025  
**Architecture Status:** ✅ Clean  
**Critical Issues:** 1 remaining (Comment Activity Tracking implementation)  
**High Priority Issues:** 2 (Engagement metrics validation, Leaderboard display)
**Technical Debt:** Low
- claude.md