# Achievement System Migration Plan

## 📊 Current State Analysis

**Database (Supabase):**
- ❌ 5 achievements with OLD point values: 50, 100, 150, 200, 300
- ❌ Missing 2 new achievements: Leaderboard Champion, Race Winner
- ✅ Schema supports all required fields (requirementType, requirementValue)

**Code (gamification.js):**
- ✅ 7 achievements with NEW point values: 5, 10, 15, 20, 25, 30, 25
- ✅ Includes Leaderboard Champion (30) and Race Winner (25)

**Insert Script (insert-achievements.js):**
- ❌ Only 5 achievements
- ❌ OLD point values (50, 100, 150, 200, 300)
- ❌ Missing Leaderboard Champion and Race Winner

---

## 🎯 Goals

1. **Align database with code** - Update all achievement point values
2. **Add missing achievements** - Insert Leaderboard Champion and Race Winner
3. **Recalculate user points** - Update all users' total_points based on awarded achievements
4. **Keep audit trail** - Don't delete existing user_achievements, just recalculate totals

---

## 📋 Migration Steps

### Step 1: Update insert-achievements.js
**File:** `insert-achievements.js`

**Changes:**
- Update 5 existing achievements with new point values
- Add 2 new achievements (Leaderboard Champion, Race Winner)
- Match exactly with gamification.js

**New point mapping:**
```
First Post:            50 → 5   points
Consistent Creator:   100 → 10  points
Engagement Magnet:    150 → 15  points
Week Warrior:         200 → 20  points
Viral Moment:         300 → 25  points
+ Leaderboard Champion: 30 points (NEW)
+ Race Winner:          25 points (NEW)
```

---

### Step 2: Create Database Migration Script
**File:** `migrate-achievements.js` (NEW)

**Actions:**
1. Update existing 5 achievements with new point values
2. Insert 2 new achievements (Leaderboard Champion, Race Winner)
3. Use proper IDs to maintain referential integrity

**SQL operations:**
```sql
-- Update existing achievements
UPDATE achievements SET points = 5 WHERE name = 'First Post';
UPDATE achievements SET points = 10 WHERE name = 'Consistent Creator';
UPDATE achievements SET points = 15 WHERE name = 'Engagement Magnet';
UPDATE achievements SET points = 20 WHERE name = 'Week Warrior';
UPDATE achievements SET points = 25 WHERE name = 'Viral Moment';

-- Insert new achievements
INSERT INTO achievements (id, name, description, icon, points, requirementType, requirementValue)
VALUES (...);
```

---

### Step 3: Recalculate User Points
**File:** `recalculate-user-points.js` (NEW)

**Logic:**
1. Get all users
2. For each user:
   - Get their awarded achievements from user_achievements
   - Join with achievements table to get current point values
   - Sum up total points
   - Update users.total_points

**Pseudocode:**
```javascript
for each user:
  awarded_achievements = SELECT achievement_id FROM user_achievements WHERE userId = user.id
  total = SUM(achievements.points WHERE id IN awarded_achievements)
  UPDATE users SET total_points = total WHERE id = user.id
```

---

### Step 4: Verification Script
**File:** `verify-achievement-migration.js` (NEW)

**Checks:**
- ✅ All 7 achievements exist in database
- ✅ All achievements have correct point values
- ✅ User total_points match sum of their achievements
- ✅ No orphaned user_achievements records

---

## 🔄 Execution Order

```
1. Run migrate-achievements.js
   → Updates existing achievements
   → Adds new achievements

2. Run recalculate-user-points.js
   → Recalculates all users' total_points

3. Run verify-achievement-migration.js
   → Confirms everything is correct

4. Update insert-achievements.js (for future reference)
   → Keeps script in sync with database
```

---

## ⚠️ Safety Considerations

1. **No data loss** - We're updating, not deleting
2. **Preserve history** - user_achievements table remains unchanged
3. **Reversible** - Can revert point values if needed
4. **Testable** - Verification script confirms success

---

## 📊 Expected Outcomes

**Before:**
- 5 achievements (50-300 points)
- Users have inflated total_points

**After:**
- 7 achievements (5-30 points)
- Users have recalculated total_points based on new values
- Achievement system aligned with gamification.js

---

## 🚀 Ready to Execute?

All scripts will be created with:
- ✅ Error handling
- ✅ Transaction support (where applicable)
- ✅ Verbose logging
- ✅ Rollback capability
