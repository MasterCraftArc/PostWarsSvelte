# Streak System Testing Guide

This document explains how to test the streak system to prevent regressions.

## 🔥 Critical Issue This Prevents

**Issue**: Users' streaks were resetting to 0 even though they posted daily.

**Root Causes**:
1. New posts with `lastScrapedAt = NULL` were excluded from scraping queue
2. Three files used incorrect streak calculations instead of `calculateUserStreak()`
3. Users' stats weren't updated regularly, causing stale database values

**Impact**:
- Jon Schulman: Had 12-day streak, database showed 0
- Brandt Keller: Had 19-day streak, database showed 0
- Michaela Flatau: Had 19-day streak, database showed 0

---

## 🧪 Running the Tests

### Run All Streak Tests

```bash
npm run test:unit -- streak
```

This runs:
- `streak-calculation.test.js` - Core logic tests
- `streak-calculation-consistency.test.js` - Code consistency checks
- `scraping-queue.test.js` - Scraping queue inclusion tests

### Run Individual Test Files

```bash
# Test core streak calculation logic
npm run test:unit -- tests/unit/streak-calculation.test.js

# Test for incorrect calculation patterns
npm run test:unit -- tests/unit/streak-calculation-consistency.test.js

# Test scraping queue query
npm run test:unit -- tests/unit/scraping-queue.test.js
```

### Run in Watch Mode (during development)

```bash
npm run test:unit -- --watch
```

---

## 📋 What Each Test File Does

### 1. `streak-calculation.test.js`

**Purpose**: Validates `calculateUserStreak()` function works correctly

**Tests**:
- ✅ Returns streak if most recent post is from today
- ✅ Returns streak if most recent post is from yesterday
- ✅ Returns 0 if most recent post is 2+ days old
- ✅ Counts consecutive days correctly
- ✅ Stops counting when gap is detected
- ✅ Handles multiple posts on same day
- ✅ Edge cases (null, empty array, single post)
- ✅ Real-world scenarios (Jon's 12-day streak, Brandt's 19-day streak)
- ✅ Timezone handling (EST)

**How it prevents the bug**: Ensures the core algorithm never breaks

### 2. `streak-calculation-consistency.test.js`

**Purpose**: Ensures all code uses `calculateUserStreak()` instead of incorrect calculations

**Tests**:
- ❌ Detects `Math.max(...userPosts.map(p => p.totalScore))` (wrong!)
- ❌ Detects `userPosts?.length` for streak (wrong!)
- ✅ Verifies all files import `calculateUserStreak` where needed

**How it prevents the bug**: Catches new code that uses incorrect patterns

**What it catches**:
```javascript
// ❌ BAD - Will be caught by test
const streak = Math.max(...posts.map(p => p.totalScore));

// ❌ BAD - Will be caught by test
const streak = userPosts?.length || 0;

// ✅ GOOD - Passes test
const streak = calculateUserStreak(userPosts || []);
```

### 3. `scraping-queue.test.js`

**Purpose**: Ensures new posts with `lastScrapedAt = NULL` are included in scraping

**Tests**:
- ✅ Query uses `.or()` to include NULL values
- ✅ Query uses `nullsFirst: true` to prioritize new posts
- ❌ Detects if someone tries to use `.lt()` alone (excludes NULL)
- ✅ Integration test: NULL posts are included in results

**How it prevents the bug**: Ensures new posts get scraped immediately

**What it catches**:
```javascript
// ❌ BAD - Will be caught by test (excludes NULL)
.lt('lastScrapedAt', oneHourAgo.toISOString())

// ✅ GOOD - Passes test (includes NULL)
.or(`lastScrapedAt.is.null,lastScrapedAt.lt.${oneHourAgo.toISOString()}`)
```

---

## 🚨 Pre-Commit Checklist

Before committing changes that touch:
- `src/lib/gamification.js` (streak calculation)
- `src/lib/cron/update-analytics.js` (scraping queue)
- `src/lib/job-queue.js` (post processing)
- `.github/workflows/process-queued-jobs.yml` (job processing)
- `src/routes/api/posts/update-analytics/+server.js` (analytics API)

**Run these tests**:

```bash
# 1. Run streak tests
npm run test:unit -- streak

# 2. Run full test suite
npm test

# 3. Build to ensure no TypeScript errors
npm run build

# 4. Lint check
npm run lint
```

**All must pass** before committing!

---

## 🔍 Manual Testing

### Test Scenario 1: New Post Scraping

1. Create a new post via UI
2. Check database: `lastScrapedAt` should be NULL initially
3. Wait for cron to run (or trigger manually)
4. Post should be scraped within one cron cycle (not delayed)
5. User's `currentStreak` should update correctly

### Test Scenario 2: Daily Poster

1. User posts every day for 7 days
2. Query their posts: Should have 7 posts from consecutive days
3. Run `calculateUserStreak()` on their posts: Should return 7
4. Database `currentStreak` field: Should match calculated value (7)
5. Wait 24 hours, user doesn't post
6. Cron runs: `currentStreak` should still be 7 (yesterday counts)
7. Wait another 24 hours, user doesn't post
8. Cron runs: `currentStreak` should be 0 (2 days ago = broken)

### Test Scenario 3: Recalculation Script

```bash
# Run recalculation for all users
node recalculate-user-points.js

# Check specific user
node -e "
import('./src/lib/gamification.js').then(async (m) => {
  const { calculateUserStreak, supabaseAdmin } = await import('./src/lib/supabase-node.js');
  const { supabaseAdmin: client } = await import('./src/lib/supabase-node.js');
  const { calculateUserStreak: calc } = m;

  const { data: posts } = await client
    .from('linkedin_posts')
    .select('postedAt')
    .eq('userId', 'USER_ID_HERE')
    .order('postedAt', { ascending: false });

  const calculated = calc(posts);

  const { data: user } = await client
    .from('users')
    .select('currentStreak')
    .eq('id', 'USER_ID_HERE')
    .single();

  console.log('Calculated:', calculated);
  console.log('Database:', user.currentStreak);
  console.log('Match:', calculated === user.currentStreak ? '✅' : '❌');
});
"
```

---

## 📊 Continuous Monitoring

### Daily Checks

Add these to your monitoring dashboard:

```sql
-- Check for users with stale currentStreak values
SELECT u.name, u.currentStreak,
       COUNT(lp.id) as post_count,
       MAX(lp.postedAt) as last_post
FROM users u
LEFT JOIN linkedin_posts lp ON lp.userId = u.id
WHERE lp.postedAt >= NOW() - INTERVAL '2 days'
GROUP BY u.id, u.name, u.currentStreak
HAVING u.currentStreak = 0;

-- Should return 0 rows (no users with recent posts but 0 streak)
```

### Alert Conditions

Set up alerts if:
1. More than 3 users have `currentStreak = 0` but posted in last 48 hours
2. Any user's calculated streak ≠ database streak (run comparison script)
3. New posts with `lastScrapedAt = NULL` older than 2 hours

---

## 🛠️ Debugging Failed Tests

### If `streak-calculation.test.js` fails:

**Problem**: Core algorithm is broken
**Fix**: Check `src/lib/gamification.js:67-166` for changes
**Verify**:
- Uses EST timezone (`America/New_York`)
- Checks "today OR yesterday" for freshness
- Counts consecutive calendar days (not hours)

### If `streak-calculation-consistency.test.js` fails:

**Problem**: New code uses incorrect calculation
**Fix**: Replace the flagged pattern with `calculateUserStreak(userPosts || [])`
**Files to check**: Error message shows exact file and line number

### If `scraping-queue.test.js` fails:

**Problem**: Scraping query changed
**Fix**: Ensure query uses `.or()` with NULL check
**File**: `src/lib/cron/update-analytics.js:12-21`

---

## 📝 Adding New Tests

When adding streak-related features:

1. Add unit test to `streak-calculation.test.js`
2. Add consistency check to `streak-calculation-consistency.test.js` if needed
3. Document the new behavior in this file
4. Update CLAUDE.md with the change

Example:
```javascript
it('should handle new feature X', () => {
  const posts = [...];
  const result = calculateUserStreak(posts);
  expect(result).toBe(expectedValue);
});
```

---

## ✅ Success Criteria

Tests are successful if:
- ✅ All 3 test files pass
- ✅ No console errors during test run
- ✅ Coverage includes all edge cases
- ✅ Real-world scenarios (Jon, Brandt) match actual values

Tests have failed if:
- ❌ Any test returns non-zero exit code
- ❌ Consistency test finds incorrect patterns
- ❌ Manual testing shows streak resets for daily posters

---

**Last Updated**: 2025-10-27
**Version**: 1.0
**Related Issue**: Streak Reset Bug (Jon: 0→12, Brandt: 0→19, Michaela: 0→19)
