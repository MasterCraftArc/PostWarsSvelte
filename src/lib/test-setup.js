import { vi } from 'vitest';

// Mock environment variables
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/testdb');
vi.stubEnv('JWT_SECRET', 'test-jwt-secret');
vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');

// Mock Supabase client
vi.mock('$lib/supabase-node.js', () => ({
	supabaseAdmin: {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					single: vi.fn(() => Promise.resolve({ data: null, error: null }))
				}))
			})),
			insert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
			update: vi.fn(() => Promise.resolve({ data: {}, error: null })),
			delete: vi.fn(() => Promise.resolve({ data: {}, error: null }))
		}))
	}
}));

// Mock other dependencies
vi.mock('$lib/job-queue.js', () => ({
	jobQueue: {
		addJob: vi.fn(() => Promise.resolve({ id: 'mock-job-id' })),
		processJob: vi.fn(() => Promise.resolve())
	}
}));

vi.mock('$lib/rate-limiter.js', () => ({
	postSubmissionLimiter: {
		isAllowed: vi.fn(() => ({ allowed: true })),
		recordFailure: vi.fn()
	},
	ipBasedLimiter: {
		isAllowed: vi.fn(() => ({ allowed: true })),
		recordFailure: vi.fn()
	}
}));

vi.mock('$lib/error-handler.js', () => ({
	handleRateLimitError: vi.fn((error, retryAfter) => ({ error: error.message, retryAfter })),
	sanitizeError: vi.fn((error, defaultMessage) => ({ error: defaultMessage }))
}));

vi.mock('$lib/auth-helpers.js', () => ({
	getAuthenticatedUser: vi.fn(() => Promise.resolve({ id: 'test-user-id', email: 'test@example.com' }))
}));