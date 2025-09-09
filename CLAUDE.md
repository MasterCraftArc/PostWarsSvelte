# PostWars - Architecture & Development Guidelines

## 🚨 OUTSTANDING ISSUES

### Issue #1: Incorrect Engagement Metrics from Scraping  
**Problem:** LinkedIn scraper sometimes pulls incorrect engagement numbers (interpreting timestamps as engagement)  
**Impact:** Inflated scores and incorrect leaderboard rankings  
**Status:** 🔥 **CRITICAL** - Must be fixed before production use  

### Issue #2: Leaderboard Engagement Display  
**Problem:** Leaderboard not showing actual post engagement from database  
**Impact:** Users cannot see real engagement metrics  
**Status:** 🔥 **CRITICAL** - Affects user experience  

### Issue #6: Post Submission Confirmation  
**Problem:** Users receive no confirmation when they submit a post  
**Impact:** Users don't know if their submission was received (scraping happens 1-2x daily)  
**Status:** 🟡 **HIGH** - Poor user experience  
**Requirements:**
- Show immediate confirmation after post submission
- Display all submitted posts in "Recent Posts" section
- Include points breakdown per post for transparency

### Issue #7: Missing Engagement Rules Documentation  
**Problem:** Users don't understand the scoring system or engagement rules  
**Impact:** Users can't optimize their posts or understand point calculations  
**Status:** 🟡 **HIGH** - User confusion  
**Requirements:**
- Add scoring rules explanation to submit post page
- Provide tl;dr + link to full documentation
- Show current scoring config (BASE_POST_POINTS: 1, REACTION_POINTS: 0.1, etc.)

### Issue #8: Team System Clarity  
**Problem:** Users don't understand team mechanics (Active Goals, team joining/switching)  
**Impact:** Users confused about team features and how to participate  
**Status:** 🟡 **HIGH** - Feature adoption blocker  
**Requirements:**
- Explain what "Active Goals" and "Questions" sections mean
- Clarify team assignment process
- Add team joining/switching functionality or explanation

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

1. **Fix Engagement Metrics Scraping**
   - Add validation for realistic engagement numbers
   - Prevent timestamp parsing as engagement counts
   - Test with real LinkedIn posts

2. **Fix Leaderboard Display** 
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
**Critical Issues:** 2 remaining  
**High Priority Issues:** 3 new (user feedback)  
**Technical Debt:** Low  