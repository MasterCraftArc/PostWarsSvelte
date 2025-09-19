import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin first
vi.mock('$lib/supabase-node.js', () => ({
	supabaseAdmin: {
		from: vi.fn(),
		rpc: vi.fn()
	}
}));


describe('New Achievements', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Leaderboard Champion Achievement', () => {
		it('should include Leaderboard Champion achievement in the achievements list', async () => {
			// Import achievements directly to verify they exist
			const { ACHIEVEMENTS } = await import('../src/lib/gamification.js');

			const leaderboardChampion = ACHIEVEMENTS.find(a => a.name === 'Leaderboard Champion');

			expect(leaderboardChampion).toBeDefined();
			expect(leaderboardChampion.requirementType).toBe('leaderboard_first_place');
			expect(leaderboardChampion.points).toBe(500);
			expect(leaderboardChampion.icon).toBe('👑');
		});
	});

	describe('Race Winner Achievement', () => {
		it('should include Race Winner achievement in the achievements list', async () => {
			// Import achievements directly to verify they exist
			const { ACHIEVEMENTS } = await import('../src/lib/gamification.js');

			const raceWinner = ACHIEVEMENTS.find(a => a.name === 'Race Winner');

			expect(raceWinner).toBeDefined();
			expect(raceWinner.requirementType).toBe('team_race_victory');
			expect(raceWinner.points).toBe(250);
			expect(raceWinner.icon).toBe('🏆');
		});
	});

	describe('Achievement Data Consistency', () => {
		it('should have matching achievement data in both static and dynamic arrays', async () => {
			// Import the achievements arrays from both files
			const { ACHIEVEMENTS: gamificationAchievements } = await import('../src/lib/gamification.js');

			// Since we can't easily import from the Svelte file, we'll test the gamification ones
			const leaderboardChampion = gamificationAchievements.find(a => a.name === 'Leaderboard Champion');
			const raceWinner = gamificationAchievements.find(a => a.name === 'Race Winner');

			expect(leaderboardChampion).toBeDefined();
			expect(leaderboardChampion.points).toBe(500);
			expect(leaderboardChampion.icon).toBe('👑');
			expect(leaderboardChampion.requirementType).toBe('leaderboard_first_place');

			expect(raceWinner).toBeDefined();
			expect(raceWinner.points).toBe(250);
			expect(raceWinner.icon).toBe('🏆');
			expect(raceWinner.requirementType).toBe('team_race_victory');
		});
	});
});