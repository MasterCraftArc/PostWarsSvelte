# PostWars - Repository Analysis & Claude Code Documentation

## 🎯 Project Overview

**PostWars** is a gamified LinkedIn engagement platform that transforms LinkedIn posting into a competitive team-based game. Users submit LinkedIn posts, which are scraped for engagement metrics (likes, comments, shares) and converted into points through a sophisticated scoring system.

### Core Features
- **LinkedIn Post Tracking** - Automated scraping of LinkedIn posts for engagement data
- **Gamification System** - Points, streaks, achievements, and leaderboards
- **Team Competition** - Team-based scoring and progress tracking
- **Dashboard & Analytics** - User stats and team performance (currently non-reactive)
- **Role-based Access** - Regular users, team leads, and administrators

## 🏗️ Technical Architecture

### **Framework & Technology Stack**
- **Frontend:** SvelteKit 2.x with Svelte 5
- **Styling:** Tailwind CSS 3.4.10 (stable)
- **Database:** Supabase (PostgreSQL with real-time capabilities - not utilized)
- **Authentication:** Supabase Auth with JWT tokens
- **Deployment:** Netlify with serverless functions
- **Scraping:** Playwright for LinkedIn post automation (GitHub Actions)
- **Testing:** Vitest, Playwright Test, Testing Library

## 📁 Project Structure

### **Core Application Structure**
```
src/
├── routes/                     # SvelteKit file-based routing
│   ├── +layout.svelte         # Global layout with auth state
│   ├── api/                   # API endpoints (serverless functions)
│   │   ├── auth/              # Authentication endpoints
│   │   ├── posts/             # Post submission and management
│   │   ├── dashboard/         # User dashboard data
│   │   ├── leaderboard/       # Scoring and rankings
│   │   ├── teams/             # Team management
│   │   └── admin/             # Admin-only operations
│   ├── dashboard/             # User dashboard page
│   ├── leaderboard/           # Leaderboard visualization
│   └── submit/                # Post submission interface
├── lib/                       # Shared utilities and components
│   ├── components/            # Reusable Svelte components
│   ├── stores/                # Svelte stores (auth only - missing data stores)
│   ├── cron/                  # Background job scripts (GitHub Actions)
│   ├── supabase-*.js          # Database client configurations
│   ├── gamification*.js       # Scoring and achievement logic
│   └── auth-helpers.js        # Authentication utilities
└── hooks.server.js            # SvelteKit server-side hooks
```

### **Database Schema (Supabase)**
- **users** - User profiles, roles, scores, streaks
- **teams** - Team information and leadership
- **linkedin_posts** - Scraped post data and engagement metrics
- **achievements** - User achievements and badges
- **goals** - Team and individual goals
- **jobs** - Background job queue for scraping tasks
- **RLS Policies** - Row-level security for data access control

## 🚨 Critical Issue: Non-Reactive Architecture

### **Current State: Polling-Based System**
The application currently uses **manual data fetching** instead of real-time updates:

**❌ Problems:**
- Dashboard stats only update on page reload
- Leaderboard rankings require manual refresh  
- Team progress not live-updated
- Post analytics need manual "Update" button clicks
- No live notifications for achievements or goal completions

**📍 Affected Components:**
- `src/lib/components/Dashboard.svelte` - Uses `onMount` + `fetch()`
- `src/lib/components/Leaderboard.svelte` - Manual polling only
- `src/lib/components/TeamProgress.svelte` - Static data display
- All components store data as local variables, not reactive stores

### **Missing Real-time Infrastructure:**
- No Supabase real-time subscriptions configured
- No global state management for live data
- No optimistic UI updates
- Manual refresh required for all data changes

## 🔍 Key Technical Patterns

### **1. Authentication Architecture**
```javascript
// Multi-layer auth approach
src/hooks.server.js          // Server-side security headers
src/lib/stores/auth.js       // Client-side reactive auth state (ONLY reactive store)
src/lib/auth-helpers.js      // Server-side auth verification
```

### **2. Gamification System**
```javascript
// Sophisticated scoring algorithm in src/lib/gamification.js
- Base points: 10 per post
- Engagement multipliers: Likes (1x), Comments (3x), Reposts (5x)
- Streak bonuses: +10% per consecutive day (max 200%)
- Word count bonuses: 0.1 points per word over 50 words
- Freshness decay: 2% decay per day after 24 hours
```

### **3. Scraping Architecture**
```javascript
// GitHub Actions-based scraping (solves Netlify Functions limitations)
.github/workflows/
├── update-analytics.yml     # Automated post analytics updates
├── update-goals.yml         # Daily goal progress updates  
├── scrape-linkedin-post.yml # Individual post scraping
└── process-queued-jobs.yml  # Background job processing
```

### **4. Database Clients**
```javascript
// Dual client configuration for different contexts
src/lib/supabase.js          // Browser client (auth only)
src/lib/supabase-server.js   // SvelteKit server functions (has $env imports)
src/lib/supabase-node.js     # Node.js scripts/cron jobs (process.env)
```

## ⚠️ Known Issues & Technical Debt

### **1. Non-Reactive Data Architecture** ⭐ **CRITICAL**
**Problem:** All data updates require manual refresh - no live updates
**Impact:** Poor user experience, stale data, missed real-time competition aspects
**Solution:** Implement Supabase real-time subscriptions + reactive stores

### **2. Playwright Bundling Issue**
**Status:** ✅ **RESOLVED** via GitHub Actions workflows
**Solution:** External scraping service handles all LinkedIn data collection

### **3. Module Resolution in GitHub Actions**
**Problem:** SvelteKit `$env` imports conflict with Node.js cron scripts
**Status:** Requires proper use of `supabase-node.js` vs `supabase-server.js`

### **4. Rate Limiting Implementation**
**Current:** In-memory rate limiting (resets on function cold starts)
**Improvement Needed:** Persistent rate limiting with database storage

## 🎯 PRIORITY: Real-time Implementation Plan

### **Phase 1: Core Real-time Infrastructure**
1. **Create Global Data Stores**
   ```javascript
   // src/lib/stores/dashboard.js
   export const dashboardData = writable(null);
   export const leaderboardData = writable([]);
   export const teamProgress = writable(null);
   ```

2. **Implement Supabase Real-time Subscriptions**
   ```javascript
   // Example: Real-time leaderboard updates
   const channel = supabase
     .channel('leaderboard-changes')
     .on('postgres_changes', { 
       event: 'UPDATE', 
       schema: 'public', 
       table: 'users' 
     }, payload => {
       // Update leaderboard data reactively
     })
     .subscribe()
   ```

3. **Replace Manual Fetch Calls**
   - Remove `onMount` + `fetch()` patterns
   - Replace with real-time listeners
   - Update stores automatically on database changes

### **Phase 2: Component Reactivity**
- Dashboard auto-updates for scores, streaks, recent posts
- Leaderboard live rankings without manual refresh
- Team progress real-time tracking
- Post analytics auto-sync from LinkedIn scraping

### **Phase 3: Advanced Features**
- Live notifications for achievements
- Real-time goal progress updates
- Optimistic UI updates for user actions
- Live team competition updates

## 📝 Development Guidelines

### **Critical Patterns to Follow**
1. **Always use reactive stores** for data that changes over time
2. **Implement real-time subscriptions** for live database changes  
3. **Use correct Supabase client** for each context:
   - `supabase.js` - Browser/auth
   - `supabase-server.js` - SvelteKit server functions  
   - `supabase-node.js` - Node.js cron scripts
4. **Optimize for real-time UX** - assume data changes frequently

### **Database Patterns**
- **Supabase RLS** for data access security
- **Real-time subscriptions** for live data updates
- **UUID primary keys** for all entities
- **Timestamp tracking** (createdAt, updatedAt) for change detection

## 🚀 Quick Commands

```bash
# Development
npm run dev                          # Start development server
npm run build                        # Build for production

# Cron Jobs (GitHub Actions)
npm run cron:update-analytics        # Update post analytics
npm run cron:update-goals           # Update team goal progress

# Database
npm run deploy:db                    # Deploy database schema
```

### **Key Files for Understanding**
1. **`src/lib/stores/auth.js`** - Auth state management (only reactive store currently)
2. **`src/lib/components/Dashboard.svelte`** - Main dashboard (needs real-time updates)
3. **`src/lib/gamification.js`** - Core scoring logic
4. **`src/lib/supabase-*.js`** - Database client configurations
5. **`.github/workflows/`** - Background job automation

### **Environment Variables Required**
```env
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

---

**IMMEDIATE ACTION NEEDED:** Transform static dashboard into reactive, live-updating gamification platform by implementing Supabase real-time subscriptions and global state management.