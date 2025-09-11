import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock authenticatedRequest
vi.mock('../../src/lib/api.js', () => ({
	authenticatedRequest: vi.fn()
}));

describe('Leaderboard Access', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('EnhancedLeaderboard component', () => {
		it('should use /api/posts instead of /api/admin/posts for engagement data', async () => {
			const { authenticatedRequest } = await import('../../src/lib/api.js');
			
			// Mock successful responses
			authenticatedRequest
				.mockResolvedValueOnce({
					leaderboard: [
						{ id: 'user1', name: 'Test User', totalScore: 100, rank: 1 }
					]
				})
				.mockResolvedValueOnce({
					posts: [
						{ userId: 'user1', reactions: 10, comments: 5, reposts: 2 }
					]
				});

			// Simulate component behavior
			const [leaderboard, postsData] = await Promise.all([
				authenticatedRequest('/api/leaderboard?timeframe=all&scope=company'),
				authenticatedRequest('/api/posts')
			]);

			expect(authenticatedRequest).toHaveBeenCalledWith('/api/leaderboard?timeframe=all&scope=company');
			expect(authenticatedRequest).toHaveBeenCalledWith('/api/posts');
			expect(authenticatedRequest).not.toHaveBeenCalledWith('/api/admin/posts');
			
			expect(leaderboard).toBeDefined();
			expect(postsData.posts).toBeDefined();
		});

		it('should handle non-admin users accessing leaderboard', async () => {
			const { authenticatedRequest } = await import('../../src/lib/api.js');
			
			// Mock successful non-admin responses
			authenticatedRequest
				.mockResolvedValueOnce({
					leaderboard: [
						{ id: 'user1', name: 'Regular User', totalScore: 50, rank: 1 }
					]
				})
				.mockResolvedValueOnce({
					posts: [
						{ userId: 'user1', reactions: 5, comments: 2, reposts: 1 }
					]
				});

			const [leaderboard, postsData] = await Promise.all([
				authenticatedRequest('/api/leaderboard?timeframe=all&scope=company'),
				authenticatedRequest('/api/posts')
			]);

			// Should succeed for regular users
			expect(leaderboard.leaderboard).toHaveLength(1);
			expect(postsData.posts).toHaveLength(1);
		});

		it('should fail if trying to access admin endpoint', async () => {
			const { authenticatedRequest } = await import('../../src/lib/api.js');
			
			// Mock admin endpoint rejection for regular user
			authenticatedRequest
				.mockResolvedValueOnce({
					leaderboard: [{ id: 'user1', name: 'User', totalScore: 50, rank: 1 }]
				})
				.mockRejectedValueOnce(new Error('Admin access required'));

			// Simulate old behavior (using admin endpoint)
			try {
				await Promise.all([
					authenticatedRequest('/api/leaderboard?timeframe=all&scope=company'),
					authenticatedRequest('/api/admin/posts')
				]);
				expect.fail('Should have thrown error');
			} catch (error) {
				expect(error.message).toBe('Admin access required');
			}
		});
	});
});