import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../src/routes/api/posts/submit/+server.js';

describe('Post Submission Confirmation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return confirmation message with job ID after successful post submission', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { jobQueue } = await import('../src/lib/job-queue.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		// Setup mocks
		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);
		
		const mockJob = { id: 'job-123' };
		jobQueue.addJob.mockResolvedValue(mockJob);
		jobQueue.processJob.mockResolvedValue();

		// Mock supabase to return no existing post
		supabaseAdmin.from.mockReturnValue({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					eq: vi.fn(() => ({
						single: vi.fn(() => Promise.resolve({ data: null, error: null }))
					}))
				}))
			}))
		});

		const mockRequest = {
			json: () => Promise.resolve({
				linkedinUrl: 'https://www.linkedin.com/posts/test-user_test-post-123'
			})
		};

		const mockEvent = {
			request: mockRequest,
			getClientAddress: () => '127.0.0.1'
		};

		const response = await POST(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(202);
		expect(responseData).toMatchObject({
			message: expect.stringContaining('submitted'),
			jobId: mockJob.id,
			status: expect.any(String),
			estimatedWaitTime: expect.any(String)
		});

		expect(jobQueue.addJob).toHaveBeenCalledWith(
			'scrape-post',
			{
				linkedinUrl: 'https://www.linkedin.com/posts/test-user_test-post-123',
				userId: mockUser.id
			},
			mockUser.id
		);
	});

	it('should include estimated processing time in confirmation', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { jobQueue } = await import('../src/lib/job-queue.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		// Setup mocks
		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);
		
		const mockJob = { id: 'job-456' };
		jobQueue.addJob.mockResolvedValue(mockJob);
		jobQueue.processJob.mockResolvedValue();

		// Mock supabase to return no existing post
		supabaseAdmin.from.mockReturnValue({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					eq: vi.fn(() => ({
						single: vi.fn(() => Promise.resolve({ data: null, error: null }))
					}))
				}))
			}))
		});

		const mockRequest = {
			json: () => Promise.resolve({
				linkedinUrl: 'https://www.linkedin.com/posts/test-user_another-post-456'
			})
		};

		const mockEvent = {
			request: mockRequest,
			getClientAddress: () => '127.0.0.1'
		};

		const response = await POST(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(202);
		expect(responseData.estimatedWaitTime).toMatch(/\d+-\d+ seconds/);
		expect(responseData.message).toContain('submitted');
	});

	it('should handle duplicate post submission gracefully with clear message', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');
		const { supabaseAdmin } = await import('../src/lib/supabase-node.js');

		// Setup mocks
		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);

		// Mock supabase to return existing post
		supabaseAdmin.from.mockReturnValue({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					eq: vi.fn(() => ({
						single: vi.fn(() => Promise.resolve({ 
							data: { id: 'existing-post-id' }, 
							error: null 
						}))
					}))
				}))
			}))
		});

		const mockRequest = {
			json: () => Promise.resolve({
				linkedinUrl: 'https://www.linkedin.com/posts/test-user_duplicate-post-789'
			})
		};

		const mockEvent = {
			request: mockRequest,
			getClientAddress: () => '127.0.0.1'
		};

		const response = await POST(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(409);
		expect(responseData.error).toBe('Post already tracked by you');
	});

	it('should provide clear error message when LinkedIn URL is invalid', async () => {
		const { getAuthenticatedUser } = await import('../src/lib/auth-helpers.js');

		// Setup mocks
		const mockUser = { id: 'test-user-id', email: 'test@example.com' };
		getAuthenticatedUser.mockResolvedValue(mockUser);

		const mockRequest = {
			json: () => Promise.resolve({
				linkedinUrl: 'https://twitter.com/invalid-url'
			})
		};

		const mockEvent = {
			request: mockRequest,
			getClientAddress: () => '127.0.0.1'
		};

		const response = await POST(mockEvent);
		const responseData = await response.json();

		expect(response.status).toBe(400);
		expect(responseData.error).toBe('Valid LinkedIn URL required');
	});
});