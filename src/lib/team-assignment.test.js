import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('./supabase-node.js', () => ({
	supabaseAdmin: {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				order: vi.fn(() => ({
					data: [
						{
							id: 'team-dragons',
							name: 'Team Dragons',
							description: 'Fierce competitors breathing fire',
							members: new Array(22).fill({}).map((_, i) => ({ id: `user-${i}` }))
						},
						{
							id: 'team-phoenixes',
							name: 'Team Phoenixes',
							description: 'Rising from challenges stronger',
							members: new Array(25).fill({}).map((_, i) => ({ id: `user-${i}` }))
						},
						{
							id: 'team-unicorns',
							name: 'Team Unicorns',
							description: 'Magical innovators and creators',
							members: new Array(28).fill({}).map((_, i) => ({ id: `user-${i}` }))
						}
					],
					error: null
				}))
			})),
			update: vi.fn(() => ({
				eq: vi.fn(() => ({
					data: [{ id: 'test-user-id', teamId: 'team-dragons' }],
					error: null
				}))
			}))
		}))
	}
}));

describe('Team Assignment Utility', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('assignUserToTeam', () => {
		it('should assign user to team with smallest member count', async () => {
			// This test will fail until we implement the function
			const { assignUserToTeam } = await import('./team-assignment.js');

			const result = await assignUserToTeam('test-user-id');

			expect(result).toBeDefined();
			expect(result.id).toBe('team-dragons'); // Smallest team (22 members)
			expect(result.name).toBe('Team Dragons');
		});

		it('should handle user assignment with database update', async () => {
			const { assignUserToTeam } = await import('./team-assignment.js');
			const { supabaseAdmin } = await import('./supabase-node.js');

			const result = await assignUserToTeam('test-user-id');

			// Verify the result
			expect(result.id).toBe('team-dragons');
			expect(result.memberCount).toBe(23); // 22 + 1 new user

			// Verify database calls were made
			expect(supabaseAdmin.from).toHaveBeenCalled();
		});

		it('should throw error when no teams are available', async () => {
			const { supabaseAdmin } = await import('./supabase-node.js');

			// Mock empty teams response
			vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
				select: vi.fn(() => ({
					order: vi.fn(() => ({
						data: [],
						error: null
					}))
				}))
			});

			const { assignUserToTeam } = await import('./team-assignment.js');

			await expect(assignUserToTeam('test-user-id')).rejects.toThrow('No teams available for assignment');
		});

		it('should handle database errors gracefully', async () => {
			const { supabaseAdmin } = await import('./supabase-node.js');

			// Mock database error
			vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
				select: vi.fn(() => ({
					order: vi.fn(() => ({
						data: null,
						error: { message: 'Database connection failed' }
					}))
				}))
			});

			const { assignUserToTeam } = await import('./team-assignment.js');

			await expect(assignUserToTeam('test-user-id')).rejects.toThrow('Database connection failed');
		});
	});

	describe('getTeamsOrderedBySize', () => {
		it('should return teams ordered by member count ascending', async () => {
			const { getTeamsOrderedBySize } = await import('./team-assignment.js');

			const teams = await getTeamsOrderedBySize();

			expect(teams).toHaveLength(3);
			expect(teams[0].memberCount).toBe(22); // Smallest first
			expect(teams[1].memberCount).toBe(25);
			expect(teams[2].memberCount).toBe(28); // Largest last
		});

		it('should only include teams with team- prefix', async () => {
			const { supabaseAdmin } = await import('./supabase-node.js');

			// Mock teams including company team
			vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
				select: vi.fn(() => ({
					order: vi.fn(() => ({
						data: [
							{ id: 'team-dragons', name: 'Team Dragons', memberCount: 22 },
							{ id: 'company-team-id', name: 'Company', memberCount: 150 },
							{ id: 'team-phoenixes', name: 'Team Phoenixes', memberCount: 25 }
						],
						error: null
					}))
				}))
			});

			const { getTeamsOrderedBySize } = await import('./team-assignment.js');

			const teams = await getTeamsOrderedBySize();

			// Should only include team- prefixed teams
			expect(teams).toHaveLength(2);
			expect(teams.every(team => team.id.startsWith('team-'))).toBe(true);
		});
	});

	describe('assignAllUnassignedUsers', () => {
		it('should assign all users without teamId to balanced teams', async () => {
			const { supabaseAdmin } = await import('./supabase-node.js');

			// Mock unassigned users query
			vi.mocked(supabaseAdmin.from).mockImplementation((table) => {
				if (table === 'users') {
					return {
						select: vi.fn(() => ({
							is: vi.fn(() => ({
								data: [
									{ id: 'user1', name: 'User 1', teamId: null },
									{ id: 'user2', name: 'User 2', teamId: null },
									{ id: 'user3', name: 'User 3', teamId: null }
								],
								error: null
							}))
						})),
						update: vi.fn(() => ({
							eq: vi.fn(() => ({
								data: [{}],
								error: null
							}))
						}))
					};
				}
				// Default teams query
				return {
					select: vi.fn(() => ({
						order: vi.fn(() => ({
							data: [
								{ id: 'team-dragons', name: 'Team Dragons', memberCount: 22 },
								{ id: 'team-phoenixes', name: 'Team Phoenixes', memberCount: 25 }
							],
							error: null
						}))
					}))
				};
			});

			const { assignAllUnassignedUsers } = await import('./team-assignment.js');

			const result = await assignAllUnassignedUsers();

			expect(result.assigned).toBe(3);
			expect(result.skipped).toBe(0);
		});
	});
});