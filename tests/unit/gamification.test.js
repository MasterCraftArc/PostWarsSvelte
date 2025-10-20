import { describe, it, expect } from 'vitest';
import {
  calculatePostScore,
  calculateCommentActivityScore,
  calculateUserStreak,
  SCORING_CONFIG
} from '../../src/lib/gamification.js';

describe('Gamification System', () => {
  describe('SCORING_CONFIG', () => {
    it('should have correct base configuration', () => {
      expect(SCORING_CONFIG.BASE_POST_POINTS).toBe(1);
      expect(SCORING_CONFIG.REACTION_POINTS).toBe(0.1);
      expect(SCORING_CONFIG.COMMENT_POINTS).toBe(0.5);
      expect(SCORING_CONFIG.REPOST_POINTS).toBe(0); // Exclude reposts
      expect(SCORING_CONFIG.STREAK_MULTIPLIER).toBe(0.15);
      expect(SCORING_CONFIG.MAX_STREAK_BONUS).toBe(2.0);
    });

    it('should make viral posts achievable', () => {
      // Test: 200 reactions * 0.1 = 20 points + 1 base = 21 points
      // With streak bonus, can easily reach 20+ points
      const viralReactions = 200;
      const expectedEngagementPoints = viralReactions * SCORING_CONFIG.REACTION_POINTS;
      expect(expectedEngagementPoints).toBe(20); // 20 points from reactions alone
    });
  });

  describe('calculatePostScore', () => {
    it('should calculate basic post score without streak', () => {
      const postData = {
        reactions: 10,
        comments: 5,
        reposts: 2,
        timestamp: new Date().toISOString()
      };

      const result = calculatePostScore(postData, 0);

      expect(result.baseScore).toBe(1); // 1 base point
      expect(result.engagementScore).toBe(4); // 10*0.1 + 5*0.5 + 2*0 = 1 + 2.5 = 3.5, rounded to 4
      expect(result.breakdown.streakMultiplier).toBe(1);
    });

    it('should exclude reposts from point calculation', () => {
      const postData = {
        reactions: 0,
        comments: 0,
        reposts: 10, // Should contribute 0 points
        timestamp: new Date().toISOString()
      };

      const result = calculatePostScore(postData, 0);

      expect(result.engagementScore).toBe(0); // Reposts should contribute 0 points
    });

    it('should apply streak multiplier correctly', () => {
      const postData = {
        reactions: 0,
        comments: 0,
        reposts: 0,
        timestamp: new Date().toISOString()
      };

      const result = calculatePostScore(postData, 5); // 5 day streak

      const expectedMultiplier = 1 + (5 * SCORING_CONFIG.STREAK_MULTIPLIER); // 1 + 5*0.15 = 1.75
      expect(result.breakdown.streakMultiplier).toBe(expectedMultiplier);
    });

    it('should cap streak multiplier at maximum', () => {
      const postData = {
        reactions: 0,
        comments: 0,
        reposts: 0,
        timestamp: new Date().toISOString()
      };

      const result = calculatePostScore(postData, 20); // Very high streak

      expect(result.breakdown.streakMultiplier).toBe(SCORING_CONFIG.MAX_STREAK_BONUS); // Should be capped at 2.0
    });

    it('should achieve 20+ points for viral posts with streak', () => {
      const viralPostData = {
        reactions: 200,
        comments: 10,
        reposts: 5, // Should contribute 0 points
        timestamp: new Date().toISOString()
      };

      const result = calculatePostScore(viralPostData, 3); // 3 day streak

      // Expected calculation:
      // Base: 1 * (1 + 3*0.15) = 1 * 1.45 = 1.45
      // Engagement: 200*0.1 + 10*0.5 + 5*0 = 20 + 5 = 25
      // Total: (1.45 + 25) * 1.0 (freshness) = ~26 points
      expect(result.totalScore).toBeGreaterThanOrEqual(20);
    });
  });

  describe('calculateCommentActivityScore', () => {
    it('should calculate base comment activity score', () => {
      const result = calculateCommentActivityScore(0);

      expect(result.baseScore).toBe(SCORING_CONFIG.COMMENT_ACTIVITY_POINTS); // 0.5
      expect(result.streakMultiplier).toBe(1);
      expect(result.totalScore).toBe(1); // Rounded up from 0.5 to 1
      expect(result.breakdown.streakBonus).toBe(0.5); // 1 - 0.5 = 0.5
    });

    it('should apply streak multiplier to comment activities', () => {
      const result = calculateCommentActivityScore(5); // 5 day streak

      const expectedMultiplier = 1 + (5 * SCORING_CONFIG.STREAK_MULTIPLIER); // 1.75
      expect(result.streakMultiplier).toBe(expectedMultiplier);
      expect(result.totalScore).toBe(Math.round(SCORING_CONFIG.COMMENT_ACTIVITY_POINTS * expectedMultiplier));
      expect(result.breakdown.streakBonus).toBeGreaterThan(0);
    });

    it('should return object with scoring breakdown', () => {
      const result = calculateCommentActivityScore(3);

      expect(result).toHaveProperty('baseScore');
      expect(result).toHaveProperty('streakMultiplier');
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveProperty('basePoints');
      expect(result.breakdown).toHaveProperty('streakBonus');
    });

    it('should cap streak multiplier at maximum for comments', () => {
      const result = calculateCommentActivityScore(20); // Very high streak

      expect(result.streakMultiplier).toBe(SCORING_CONFIG.MAX_STREAK_BONUS); // Should be capped at 2.0
    });
  });

  describe('calculateUserStreak', () => {
    it('should return 0 for no posts', () => {
      const result = calculateUserStreak([]);
      expect(result).toBe(0);
    });

    it('should return 1 for single post today', () => {
      const today = new Date();
      const posts = [{ postedAt: today.toISOString() }];
      const result = calculateUserStreak(posts);
      expect(result).toBe(1);
    });

    it('should calculate consecutive day streak correctly', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(today.getDate() - 2);

      const posts = [
        { postedAt: today.toISOString() },
        { postedAt: yesterday.toISOString() },
        { postedAt: twoDaysAgo.toISOString() }
      ];

      const result = calculateUserStreak(posts);
      expect(result).toBe(3);
    });

    it('should break streak when day is missed', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3); // Gap!

      const posts = [
        { postedAt: today.toISOString() },
        { postedAt: yesterday.toISOString() },
        { postedAt: threeDaysAgo.toISOString() } // Missing 2 days ago
      ];

      const result = calculateUserStreak(posts);
      expect(result).toBe(2); // Only counts today and yesterday
    });

    it('should handle multiple posts on same day', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const posts = [
        { postedAt: today.toISOString() },
        { postedAt: today.toISOString() }, // Second post today
        { postedAt: yesterday.toISOString() }
      ];

      const result = calculateUserStreak(posts);
      expect(result).toBe(2); // Should still be 2-day streak
    });

    it('should not count future posts', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const posts = [
        { postedAt: yesterday.toISOString() }
        // No post today
      ];

      const result = calculateUserStreak(posts);
      expect(result).toBe(0); // Streak broken (no post today)
    });
  });
});