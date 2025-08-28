# PostWars - Repository Analysis & Claude Code Documentation

## 🎯 Project Overview

**PostWars** is a gamified LinkedIn engagement platform that transforms LinkedIn posting into a competitive team-based game. Users submit LinkedIn posts, which are scraped for engagement metrics (likes, comments, shares) and converted into points through a sophisticated scoring system.

### Core Features
- **LinkedIn Post Tracking** - Automated scraping of LinkedIn posts for engagement data
- **Gamification System** - Points, streaks, achievements, and leaderboards
- **Team Competition** - Team-based scoring and progress tracking
- **Real-time Analytics** - Dashboard with user stats and team performance
- **Role-based Access** - Regular users, team leads, and administrators

## 🏗️ Technical Architecture

### **Framework & Technology Stack**
- **Frontend:** SvelteKit 2.x with Svelte 5
- **Styling:** Tailwind CSS 3.4.10 (stable)
- **Database:** Supabase (PostgreSQL with real-time features)
- **Authentication:** Supabase Auth with JWT tokens
- **Deployment:** Netlify with serverless functions
- **Scraping:** Playwright for LinkedIn post automation
- **Testing:** Vitest, Playwright Test, Testing Library

### **Key Dependencies**
```json
{
  "runtime": ["@supabase/supabase-js", "@supabase/ssr"],
  "ui": ["svelte", "@sveltejs/kit", "tailwindcss"],
  "scraping": ["playwright", "chromium-bidi"],
  "security": ["bcryptjs", "jsonwebtoken"],
  "deployment": ["@sveltejs/adapter-netlify"]
}
```

## 📁 Project Structure Analysis

### **Core Application Structure**
```
src/
├── routes/                     # SvelteKit file-based routing
│   ├── +layout.svelte         # Global layout with auth state
│   ├── +page.svelte           # Home page (authenticated/public views)
│   ├── admin/                 # Admin dashboard and management
│   ├── api/                   # API endpoints (serverless functions)
│   │   ├── auth/              # Authentication endpoints
│   │   ├── posts/             # Post submission and management
│   │   ├── dashboard/         # User dashboard data
│   │   ├── leaderboard/       # Scoring and rankings
│   │   ├── teams/             # Team management
│   │   └── admin/             # Admin-only operations
│   ├── dashboard/             # User dashboard page
│   ├── leaderboard/           # Leaderboard visualization
│   ├── login/ & signup/       # Authentication pages
│   └── submit/                # Post submission interface
├── lib/                       # Shared utilities and components
│   ├── components/            # Reusable Svelte components
│   ├── stores/                # Svelte stores (auth state)
│   ├── supabase-*.js          # Database client configurations
│   ├── linkedin-scraper.js    # Playwright-based web scraping
│   ├── gamification.js        # Scoring and achievement logic
│   ├── job-queue.js           # Background job processing
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

## 🔍 Key Technical Patterns & Architecture Decisions

### **1. Authentication Architecture**
```javascript
// Multi-layer auth approach
src/hooks.server.js          // Server-side security headers (minimal processing)
src/lib/stores/auth.js       // Client-side reactive auth state
src/lib/auth-helpers.js      // Server-side auth verification
```

**Pattern:** Hybrid client/server authentication with minimal server-side processing for performance.

### **2. API Design Pattern**
```javascript
// Consistent API endpoint structure
src/routes/api/{domain}/{action}/+server.js

// Example: POST /api/posts/submit
// - Authentication check via getAuthenticatedUser()
// - Rate limiting (user + IP based)
// - Input validation and sanitization
// - Database operations via Supabase Admin client
// - Error handling with sanitized responses
```

### **3. Scraping Architecture**
```javascript
// Job queue system for LinkedIn scraping
src/lib/job-queue.js           // Queue management and job processing
src/lib/linkedin-scraper.js    // Playwright-based scraping logic
src/lib/worker.js              // Background worker processes
```

**Challenge Identified:** Playwright cannot be bundled into Netlify Functions due to binary dependencies. Current implementation may require GitHub Actions or external service for scraping.

### **4. Gamification System**
```javascript
// Sophisticated scoring algorithm
src/lib/gamification.js
- Base points: 10 per post
- Engagement multipliers: Likes (1x), Comments (3x), Reposts (5x)
- Streak bonuses: +10% per consecutive day (max 200%)
- Word count bonuses: 0.1 points per word over 50 words
- Freshness decay: 2% decay per day after 24 hours
```

### **5. Security Implementation**
```javascript
// Multi-layered security approach
- Content Security Policy (CSP) headers
- Rate limiting (per-user and IP-based)
- Input sanitization and validation
- Supabase RLS policies
- JWT token authentication
- HTTPS enforcement in production
```

## 🚀 Deployment Configuration

### **Netlify Setup**
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "build"
  functions = ".netlify/functions"

[build.environment]
  NODE_VERSION = "22"
  SECRETS_SCAN_ENABLED = "false"
```

**Custom Build Process:**
```json
// package.json
"build": "vite build && npm run build:fix-netlify",
"build:fix-netlify": "mkdir -p .netlify/functions && cp .netlify/functions-internal/sveltekit-render.mjs .netlify/functions/ && cp .netlify/functions-internal/sveltekit-render.json .netlify/functions/ && echo '* /.netlify/functions/sveltekit-render 200' > build/_redirects"
```

**Critical Deployment Files:**
- `deploy-db.sh` - Database deployment script
- `supabase-schema.sql` - Complete database schema
- `netlify.toml` - Netlify configuration
- Custom build script for SvelteKit Netlify adapter compatibility

## 🔧 Development & Testing

### **Available Scripts**
```json
{
  "dev": "vite dev",                           // Development server
  "build": "vite build && npm run build:fix-netlify",
  "test": "npm run test:unit -- --run && npm run test:e2e",
  "worker": "node src/lib/worker.js",          // Background job processor
  "cron:update-analytics": "...",              // Analytics updates
  "deploy:db": "./deploy-db.sh",               // Database deployment
  "deploy:netlify": "netlify deploy --prod --dir=build"
}
```

### **Testing Setup**
- **Unit Tests:** Vitest with JSdom
- **E2E Tests:** Playwright
- **Component Tests:** Testing Library Svelte
- **API Tests:** Custom test suite for authentication endpoints

## 📊 Core Business Logic

### **Scoring Algorithm**
```javascript
function calculatePostScore(postData, userStreak = 0) {
  let score = 10; // Base points
  
  // Engagement scoring
  score += (reactions * 1) + (comments * 3) + (reposts * 5);
  
  // Streak bonus (max 200%)
  const streakBonus = Math.min(userStreak * 0.1, 2.0);
  score *= (1 + streakBonus);
  
  // Word count bonus
  if (word_count > 50) {
    score += (word_count - 50) * 0.1;
  }
  
  // Freshness decay
  const hoursOld = (Date.now() - timestamp) / (1000 * 60 * 60);
  if (hoursOld > 24) {
    const decayFactor = Math.pow(0.98, hoursOld - 24);
    score *= decayFactor;
  }
  
  return Math.round(score);
}
```

### **User Progression System**
- **Streaks:** Consecutive posting days with bonus multipliers
- **Achievements:** Milestone-based badge system
- **Leaderboards:** Individual and team-based rankings
- **Team Goals:** Collaborative objectives and challenges

## ⚠️ Known Issues & Technical Debt

### **1. Playwright Bundling Issue**
**Problem:** Playwright cannot be bundled into Netlify Functions due to binary dependencies.
**Current Status:** Build process excludes Playwright from function bundle.
**Solution:** Requires external scraping service (GitHub Actions recommended).

### **2. Authentication Complexity**
**Problem:** Server-side auth processing can cause cold start delays.
**Current Solution:** Minimal server-side processing, client-side auth state management.

### **3. Rate Limiting Implementation**
**Current:** In-memory rate limiting (resets on function cold starts).
**Improvement Needed:** Persistent rate limiting with Redis or database storage.

### **4. Job Queue Scalability**
**Current:** In-memory job queue with single worker process.
**Scalability Concern:** Cannot handle high-volume concurrent scraping jobs.
**Recommended:** External job queue service (Bull, AWS SQS, or GitHub Actions).

## 🛡️ Security Analysis

### **Implemented Security Measures**
✅ **Authentication:** Supabase JWT with secure session management  
✅ **Authorization:** Role-based access control (REGULAR, TEAM_LEAD, ADMIN)  
✅ **Input Validation:** Comprehensive input sanitization  
✅ **Rate Limiting:** User and IP-based limits  
✅ **Security Headers:** CSP, XSS protection, HTTPS enforcement  
✅ **Database Security:** Supabase RLS policies  

### **Security Configurations**
```javascript
// Content Security Policy
"default-src 'self'",
"script-src 'self' 'unsafe-inline'",  // Required for SvelteKit
"style-src 'self' 'unsafe-inline'",   // Required for component styles
"connect-src 'self' https://your-supabase-project.supabase.co"
```

## 🎯 Recommended Improvements

### **Performance Optimizations**
1. **Implement caching** for leaderboard and dashboard data
2. **Add database connection pooling** for Supabase queries
3. **Optimize bundle size** by removing unused dependencies
4. **Add service worker** for offline capability

### **Scalability Enhancements**
1. **External scraping service** (GitHub Actions implementation)
2. **Persistent job queue** with retry logic
3. **Database query optimization** with indexes
4. **CDN integration** for static assets

### **Feature Completeness**
1. **Real-time updates** using Supabase subscriptions
2. **Mobile responsive improvements**
3. **Advanced analytics** and reporting
4. **Team management interface** for team leads

## 📝 Development Guidelines

### **Code Standards**
- **ESLint + Prettier** for code formatting
- **TypeScript-style JSDoc** for function documentation  
- **Consistent error handling** with sanitized responses
- **Environment-based configuration** (development/production)

### **Database Patterns**
- **Supabase RLS** for data access security
- **Enum types** for status fields and roles
- **UUID primary keys** for all entities
- **Timestamp tracking** (createdAt, updatedAt)

### **API Conventions**
- **RESTful endpoint design** (`/api/domain/action`)
- **Consistent response formats** with error objects
- **Authentication middleware** for protected routes
- **Rate limiting** on user-facing endpoints

## 🏆 Production Readiness Assessment

### **✅ Ready for Production**
- Authentication and authorization system
- Core gamification logic
- User interface and experience
- Database schema and security
- Basic deployment configuration

### **⚠️ Requires Attention**
- LinkedIn scraping reliability (Playwright bundling)
- Scalable job processing system
- Advanced error monitoring
- Performance optimization under load
- Comprehensive logging and monitoring

### **🔄 Future Enhancements**
- Real-time collaboration features  
- Advanced team management tools
- Integration with other social platforms
- AI-powered content suggestions
- Advanced analytics and insights

---

## 📚 For Claude Code Users

### **Quick Commands**
```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run test                   # Run all tests

# Database
npm run deploy:db              # Deploy database schema
chmod +x deploy-db.sh          # Make deployment script executable

# Deployment
npm run deploy:netlify         # Deploy to Netlify
```

### **Key Files for Understanding**
1. **`src/routes/+page.svelte`** - Main application entry point
2. **`src/lib/supabase.js`** - Database configuration
3. **`src/lib/gamification.js`** - Core scoring logic
4. **`src/routes/api/posts/submit/+server.js`** - Post submission API
5. **`netlify.toml`** - Deployment configuration

### **Environment Variables Required**
```env
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
```


This documentation provides a comprehensive overview of the PostWars codebase, its architecture, and technical implementation details for effective development and maintenance.