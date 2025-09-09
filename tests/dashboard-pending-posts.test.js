import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../src/routes/api/dashboard/+server.js';

describe('Dashboard Pending Posts Display', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should include pending job submissions in recent posts', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);

		// Mock RPC to fail so it uses fallback
		const mockRpc = vi.fn().mockResolvedValue({ data: null, error: 'RPC failed' });
		
		// Mock various database queries
		const mockFrom = vi.fn();
		const mockSelect = vi.fn();
		const mockEq = vi.fn();
		const mockSingle = vi.fn();
		const mockOrder = vi.fn();
		const mockLimit = vi.fn();
		const mockGt = vi.fn();

		// Setup query chain for user data
		mockSingle.mockResolvedValue({ 
			data: { 
				id: mockUser.id, 
				name: 'Test User', 
				email: mockUser.email, 
				totalScore: 150,
				postsThisMonth: 5,
				currentStreak: 3,
				bestStreak: 10
			} 
		});

		// Setup query chain for posts
		mockLimit.mockReturnValue({ 
			data: [
				{
					id: 'post-1',
					url: 'https://linkedin.com/posts/test-1',
					content: 'This is an existing processed post with full data',
					reactions: 10,
					comments: 2,
					reposts: 1,
					totalScore: 15,
					postedAt: '2025-01-15T10:00:00Z',
					lastScrapedAt: '2025-01-15T11:00:00Z'
				}
			] 
		});

		// Setup query chain for pending jobs
		const mockOrderJobs = vi.fn();
		mockOrderJobs.mockReturnValue({
			data: [
				{
					id: 'job-pending-123',
					type: 'scrape-post',
					data: JSON.stringify({
						linkedinUrl: 'https://linkedin.com/posts/test-pending-post',
						userId: mockUser.id
					}),
					status: 'QUEUED',
					createdAt: '2025-01-15T12:00:00Z'
				},
				{
					id: 'job-processing-456',
					type: 'scrape-post',
					data: JSON.stringify({
						linkedinUrl: 'https://linkedin.com/posts/test-processing-post',
						userId: mockUser.id
					}),
					status: 'PROCESSING',
					createdAt: '2025-01-15T11:45:00Z'
				}
			]
		});

		mockEq.mockImplementation((field, value) => {
			if (field === 'userId' && mockSelect().includes('analytics')) {
				// Return posts query
				return {
					order: mockOrder.mockReturnValue({
						limit: mockLimit
					})
				};
			} else if (field === 'userId' && mockSelect().includes('achievement')) {
				// Return achievements query  
				return {
					order: vi.fn().mockReturnValue({ data: [] })
				};
			} else if (field === 'userId' && mockFrom().includes('jobs')) {
				// Return jobs query
				return {
					in: vi.fn().mockReturnValue({
						order: mockOrderJobs
					})
				};
			} else {
				// Default user query
				return { single: mockSingle };
			}
		});

		mockSelect.mockReturnValue({ eq: mockEq, count: 'exact', head: true });
		mockFrom.mockReturnValue({ select: mockSelect, rpc: mockRpc });

		supabaseAdmin.rpc = mockRpc;
		supabaseAdmin.from = mockFrom;

		const mockEvent = { request: {}, headers: {} };

		const response = await GET(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(200);
		
		// Should include pending posts alongside processed posts
		expect(responseData.recentPosts).toBeDefined();
		expect(responseData.recentPosts.length).toBeGreaterThan(1);
		
		// Check for pending post
		const pendingPost = responseData.recentPosts.find(post => 
			post.url === 'https://linkedin.com/posts/test-pending-post'
		);
		expect(pendingPost).toBeDefined();
		expect(pendingPost.status).toBe('pending');
		expect(pendingPost.content).toContain('Post is being processed...');
		
		// Check for processing post
		const processingPost = responseData.recentPosts.find(post => 
			post.url === 'https://linkedin.com/posts/test-processing-post'
		);
		expect(processingPost).toBeDefined();
		expect(processingPost.status).toBe('processing');
	});

	it('should show estimated points for pending posts', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);

		// Mock fallback logic with pending job
		supabaseAdmin.rpc = vi.fn().mockResolvedValue({ data: null, error: 'RPC failed' });
		
		const mockJobsQuery = {
			data: [{
				id: 'job-estimation-test',
				type: 'scrape-post',
				data: JSON.stringify({
					linkedinUrl: 'https://linkedin.com/posts/test-estimation',
					userId: mockUser.id
				}),
				status: 'QUEUED',
				createdAt: '2025-01-15T12:30:00Z'
			}]
		};

		supabaseAdmin.from = vi.fn().mockImplementation((table) => {
			if (table === 'jobs') {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							in: vi.fn().mockReturnValue({
								order: vi.fn().mockReturnValue(mockJobsQuery)
							})
						})
					})
				};
			}
			// Mock other tables to return empty/default data
			return {
				select: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						single: vi.fn().mockResolvedValue({ data: { totalScore: 0 } }),
						order: vi.fn().mockReturnValue({
							limit: vi.fn().mockReturnValue({ data: [] })
						})
					}),
					count: 'exact',
					head: true
				})
			};
		});

		const mockEvent = { request: {}, headers: {} };
		const response = await GET(mockEvent);
		const responseData = await response.json();

		const pendingPost = responseData.recentPosts.find(post => 
			post.url === 'https://linkedin.com/posts/test-estimation'
		);
		
		expect(pendingPost).toBeDefined();
		expect(pendingPost.totalScore).toBe(1); // Estimated base score
		expect(pendingPost.reactions).toBe('?');
		expect(pendingPost.comments).toBe('?');
		expect(pendingPost.reposts).toBe('?');
	});

	it('should sort pending posts by creation time with most recent first', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);

		// Mock jobs in reverse chronological order
		const mockJobsData = [
			{
				id: 'job-newest',
				data: JSON.stringify({ linkedinUrl: 'https://linkedin.com/posts/newest' }),
				status: 'QUEUED',
				createdAt: '2025-01-15T12:30:00Z'
			},
			{
				id: 'job-older',
				data: JSON.stringify({ linkedinUrl: 'https://linkedin.com/posts/older' }),
				status: 'PROCESSING', 
				createdAt: '2025-01-15T12:00:00Z'
			}
		];

		supabaseAdmin.rpc = vi.fn().mockResolvedValue({ data: null, error: 'RPC failed' });
		supabaseAdmin.from = vi.fn().mockImplementation((table) => {
			if (table === 'jobs') {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							in: vi.fn().mockReturnValue({
								order: vi.fn().mockReturnValue({ data: mockJobsData })
							})
						})
					})
				};
			}
			return {
				select: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						single: vi.fn().mockResolvedValue({ data: { totalScore: 0 } }),
						order: vi.fn().mockReturnValue({
							limit: vi.fn().mockReturnValue({ data: [] })
						})
					})
				})
			};
		});

		const mockEvent = { request: {}, headers: {} };
		const response = await GET(mockEvent);
		const responseData = await response.json();

		const pendingPosts = responseData.recentPosts.filter(post => post.status);
		expect(pendingPosts[0].url).toBe('https://linkedin.com/posts/newest');
		expect(pendingPosts[1].url).toBe('https://linkedin.com/posts/older');
	});
});