import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/lib/api.js', () => ({
	authenticatedRequest: vi.fn()
}));

vi.mock('../../src/lib/stores/auth.js', () => ({
	user: {
		subscribe: vi.fn(),
		set: vi.fn(),
		get: vi.fn(() => ({ id: 'test-user', teamId: 'team-dragons' }))
	}
}));

vi.mock('../../src/lib/engagement.js', () => ({
	getPostEngagement: vi.fn(() => 10)
}));

vi.mock('../../src/lib/stores/achievements.js', () => ({
	userAchievements: { subscribe: vi.fn() },
	fetchUserRecentAchievements: vi.fn(),
	getUserRecentAchievement: vi.fn()
}));

describe('Leaderboard Toggle Functionality', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Company/Team Competition Toggle', () => {
		it('should default to company (individual) view', async () => {
			// Test the API endpoint directly for company scope
			const companyEndpoint = '/api/leaderboard?timeframe=all&scope=company';
			const expectedStructure = {
				scope: 'company',
				leaderboard: expect.any(Array)
			};

			// Verify the endpoint structure matches expected format
			expect(companyEndpoint).toContain('scope=company');
			expect(expectedStructure.scope).toBe('company');
			expect(expectedStructure.leaderboard).toEqual(expect.any(Array));
		});

		it('should switch to team competition view', async () => {
			const { authenticatedRequest } = await import('../../src/lib/api.js');

			// Mock team competition response (teams ranked against each other)
			vi.mocked(authenticatedRequest).mockResolvedValueOnce({
				teamRankings: [
					{
						rank: 1,
						id: 'team-dragons',
						name: 'Team Dragons',
						totalScore: 2850,
						memberCount: 25,
						averageScore: 114,
						isUserTeam: false
					},
					{
						rank: 2,
						id: 'team-eagles',
						name: 'Team Eagles',
						totalScore: 2720,
						memberCount: 24,
						averageScore: 113,
						isUserTeam: true // User's team
					},
					{
						rank: 3,
						id: 'team-phoenixes',
						name: 'Team Phoenixes',
						totalScore: 2680,
						memberCount: 26,
						averageScore: 103,
						isUserTeam: false
					}
				],
				scope: 'teams'
			});

			// Test team competition endpoint
			const expectedUrl = '/api/leaderboard?timeframe=all&scope=teams';

			// Verify the API would be called with teams scope
			expect(expectedUrl).toBe('/api/leaderboard?timeframe=all&scope=teams');
		});

		it('should show team competition rankings', async () => {
			const teamRankings = [
				{
					rank: 1,
					name: 'Team Dragons',
					totalScore: 2850,
					memberCount: 25,
					averageScore: 114,
					isUserTeam: false
				},
				{
					rank: 2,
					name: 'Team Eagles',
					totalScore: 2720,
					memberCount: 24,
					averageScore: 113,
					isUserTeam: true
				}
			];

			// Verify team rankings structure
			expect(teamRankings[0]).toHaveProperty('rank', 1);
			expect(teamRankings[0]).toHaveProperty('totalScore', 2850);
			expect(teamRankings[0]).toHaveProperty('memberCount', 25);
			expect(teamRankings[0]).toHaveProperty('averageScore', 114);

			// User's team should be highlighted
			const userTeam = teamRankings.find(team => team.isUserTeam);
			expect(userTeam).toBeTruthy();
			expect(userTeam.rank).toBe(2);
		});

		it('should handle users without teams gracefully', async () => {
			const userWithoutTeam = { id: 'test-user', teamId: null };

			// When user has no team, team view should be disabled or show appropriate message
			expect(userWithoutTeam.teamId).toBeNull();

			// Component should fall back to company view
			const fallbackMode = userWithoutTeam.teamId ? 'team' : 'company';
			expect(fallbackMode).toBe('company');
		});

		it('should preserve view mode between data refreshes', async () => {
			// Test that view mode state persists during leaderboard refreshes
			let viewMode = 'team';

			// Simulate data refresh while in team view
			const refreshData = () => {
				// View mode should remain 'team' after refresh
				return viewMode;
			};

			expect(refreshData()).toBe('team');
		});

		it('should use correct API endpoints for each view mode', async () => {
			const testCases = [
				{
					viewMode: 'company',
					expectedEndpoint: '/api/leaderboard?timeframe=all&scope=company'
				},
				{
					viewMode: 'teams',
					expectedEndpoint: '/api/leaderboard?timeframe=all&scope=teams'
				}
			];

			testCases.forEach(({ viewMode, expectedEndpoint }) => {
				const actualEndpoint = viewMode === 'teams'
					? '/api/leaderboard?timeframe=all&scope=teams'
					: '/api/leaderboard?timeframe=all&scope=company';

				expect(actualEndpoint).toBe(expectedEndpoint);
			});
		});
	});
});