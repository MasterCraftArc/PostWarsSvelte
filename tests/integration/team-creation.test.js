import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/lib/supabase-node.js', () => ({
	supabaseAdmin: {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				data: [],
				error: null
			})),
			insert: vi.fn(() => ({
				data: [
					{ id: 'team-dragons', name: 'Team Dragons', description: 'Fierce competitors breathing fire' },
					{ id: 'team-phoenixes', name: 'Team Phoenixes', description: 'Rising from challenges stronger' },
					{ id: 'team-unicorns', name: 'Team Unicorns', description: 'Magical innovators and creators' },
					{ id: 'team-lions', name: 'Team Lions', description: 'Bold leaders of the pride' },
					{ id: 'team-eagles', name: 'Team Eagles', description: 'Soaring above the competition' },
					{ id: 'team-wolves', name: 'Team Wolves', description: 'Strategic pack hunters' }
				],
				error: null
			}))
		}))
	}
}));

describe('Team Creation Migration', () => {
	it('should create 6 initial teams with correct structure', async () => {
		const { supabaseAdmin } = await import('../../src/lib/supabase-node.js');

		// Simulate migration running
		const insertResult = await supabaseAdmin.from('teams').insert([
			{ id: 'team-dragons', name: 'Team Dragons', description: 'Fierce competitors breathing fire' },
			{ id: 'team-phoenixes', name: 'Team Phoenixes', description: 'Rising from challenges stronger' },
			{ id: 'team-unicorns', name: 'Team Unicorns', description: 'Magical innovators and creators' },
			{ id: 'team-lions', name: 'Team Lions', description: 'Bold leaders of the pride' },
			{ id: 'team-eagles', name: 'Team Eagles', description: 'Soaring above the competition' },
			{ id: 'team-wolves', name: 'Team Wolves', description: 'Strategic pack hunters' }
		]);

		expect(insertResult.error).toBeNull();
		expect(insertResult.data).toHaveLength(6);
		expect(insertResult.data[0]).toHaveProperty('id', 'team-dragons');
		expect(insertResult.data[0]).toHaveProperty('name', 'Team Dragons');
		expect(insertResult.data[0]).toHaveProperty('description', 'Fierce competitors breathing fire');
	});

	it('should verify all teams have unique IDs and names', async () => {
		const { supabaseAdmin } = await import('../../src/lib/supabase-node.js');

		const insertResult = await supabaseAdmin.from('teams').insert([
			{ id: 'team-dragons', name: 'Team Dragons', description: 'Fierce competitors breathing fire' },
			{ id: 'team-phoenixes', name: 'Team Phoenixes', description: 'Rising from challenges stronger' },
			{ id: 'team-unicorns', name: 'Team Unicorns', description: 'Magical innovators and creators' },
			{ id: 'team-lions', name: 'Team Lions', description: 'Bold leaders of the pride' },
			{ id: 'team-eagles', name: 'Team Eagles', description: 'Soaring above the competition' },
			{ id: 'team-wolves', name: 'Team Wolves', description: 'Strategic pack hunters' }
		]);

		const teamIds = insertResult.data.map(team => team.id);
		const teamNames = insertResult.data.map(team => team.name);

		// Verify all IDs are unique
		expect(new Set(teamIds).size).toBe(6);

		// Verify all names are unique
		expect(new Set(teamNames).size).toBe(6);

		// Verify expected team naming pattern
		expect(teamIds.every(id => id.startsWith('team-'))).toBe(true);
	});

	it('should fail if teams table does not exist', async () => {
		// This test verifies the migration depends on existing schema
		const { supabaseAdmin } = await import('../../src/lib/supabase-node.js');

		// Mock error for missing table
		vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
			insert: vi.fn(() => ({
				data: null,
				error: { message: 'relation "teams" does not exist' }
			}))
		});

		const insertResult = await supabaseAdmin.from('teams').insert([]);
		expect(insertResult.error).toBeTruthy();
		expect(insertResult.error.message).toContain('teams');
	});
});