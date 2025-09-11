import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as postsGET } from '../../src/routes/api/posts/+server.js';
import { GET as adminPostsGET } from '../../src/routes/api/admin/posts/+server.js';

// Mock dependencies
vi.mock('../../src/lib/supabase-node.js', () => ({
	supabaseAdmin: {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				order: vi.fn(() => ({
					limit: vi.fn(() => ({
						data: [
							{
								id: '1',
								userId: 'user1',
								reactions: 10,
								comments: 5,
								reposts: 2,
								createdAt: '2025-01-01',
								user: { id: 'user1', name: 'Test User' }
							}
						],
						error: null
					}))
				}))
			}))
		}))
	}
}));

vi.mock('../../src/lib/auth-helpers.js', () => ({
	getAuthenticatedUser: vi.fn()
}));

describe('Posts API Endpoints', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('/api/posts (non-admin)', () => {
		it('should allow authenticated users to access posts', async () => {
			const { getAuthenticatedUser } = await import('../../src/lib/auth-helpers.js');
			
			getAuthenticatedUser.mockResolvedValueOnce({
				id: 'user1',
				role: 'USER'
			});

			const response = await postsGET({ url: new URL('http://localhost/api/posts') });
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toBeDefined();
			expect(data.posts[0]).toHaveProperty('reactions');
			expect(data.posts[0]).toHaveProperty('comments');
			expect(data.posts[0]).toHaveProperty('reposts');
		});

		it('should require authentication', async () => {
			const { getAuthenticatedUser } = await import('../../src/lib/auth-helpers.js');
			
			getAuthenticatedUser.mockResolvedValueOnce(null);

			const response = await postsGET({ url: new URL('http://localhost/api/posts') });
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Authentication required');
		});

		it('should return only necessary fields for engagement calculation', async () => {
			const { getAuthenticatedUser } = await import('../../src/lib/auth-helpers.js');
			
			getAuthenticatedUser.mockResolvedValueOnce({
				id: 'user1',
				role: 'USER'
			});

			const response = await postsGET({ url: new URL('http://localhost/api/posts') });
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts[0]).toEqual({
				id: '1',
				userId: 'user1',
				reactions: 10,
				comments: 5,
				reposts: 2,
				createdAt: '2025-01-01',
				userName: 'Test User'
			});
		});
	});

	describe('/api/admin/posts (admin-only)', () => {
		it('should require admin role', async () => {
			const { getAuthenticatedUser } = await import('../../src/lib/auth-helpers.js');
			
			getAuthenticatedUser.mockResolvedValueOnce({
				id: 'user1',
				role: 'USER'
			});

			const response = await adminPostsGET({ url: new URL('http://localhost/api/admin/posts') });
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe('Admin access required');
		});

		it('should allow admin users to access posts', async () => {
			const { getAuthenticatedUser } = await import('../../src/lib/auth-helpers.js');
			
			getAuthenticatedUser.mockResolvedValueOnce({
				id: 'admin1',
				role: 'ADMIN'
			});

			const response = await adminPostsGET({ url: new URL('http://localhost/api/admin/posts') });
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.posts).toBeDefined();
		});
	});
});