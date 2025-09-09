import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as CompanyGoalsAPI } from '../src/routes/api/goals/company/+server.js';

describe('CompanyGoals Component Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return company goals data from API', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);

		// Mock company goals in database
		const mockGoals = [
			{
				id: 'goal-1',
				title: 'Reach 100 Posts This Month',
				description: 'Company-wide goal to post 100 LinkedIn posts',
				type: 'POSTS_COUNT',
				currentValue: 75,
				targetValue: 100,
				status: 'ACTIVE',
				startDate: '2025-01-01T00:00:00Z',
				endDate: '2025-01-31T23:59:59Z',
				createdAt: '2025-01-01T00:00:00Z',
				updatedAt: '2025-01-15T00:00:00Z'
			}
		];

		supabaseAdmin.from = vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						order: vi.fn().mockReturnValue({
							data: mockGoals,
							error: null
						})
					})
				})
			})
		});

		const mockEvent = { request: {}, headers: {} };

		const response = await CompanyGoalsAPI(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(200);
		expect(responseData.goals).toBeDefined();
		expect(responseData.goals).toHaveLength(1);
		expect(responseData.goals[0].title).toBe('Reach 100 Posts This Month');
		expect(responseData.goals[0].progressPercent).toBe(75);
		expect(responseData.goals[0].isCompleted).toBe(false);
		expect(responseData.totalGoals).toBe(1);
		expect(responseData.completedGoals).toBe(0);
	});

	it('should handle no company goals gracefully', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);

		// Mock empty goals response
		supabaseAdmin.from = vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						order: vi.fn().mockReturnValue({
							data: [],
							error: null
						})
					})
				})
			})
		});

		const mockEvent = { request: {}, headers: {} };

		const response = await CompanyGoalsAPI(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(200);
		expect(responseData.goals).toEqual([]);
		expect(responseData.totalGoals).toBe(0);
		expect(responseData.completedGoals).toBe(0);
	});

	it('should require authentication', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');

		// Mock unauthenticated user
		getAuthenticatedUser.mockResolvedValue(null);

		const mockEvent = { request: {}, headers: {} };

		const response = await CompanyGoalsAPI(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(401);
		expect(responseData.error).toBe('Authentication required');
	});
});