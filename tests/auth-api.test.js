import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as signupPOST } from '../src/routes/api/auth/signup/+server.js';
import { POST as loginPOST } from '../src/routes/api/auth/login/+server.js';
import { POST as logoutPOST } from '../src/routes/api/auth/logout/+server.js';

// Mock the auth library
vi.mock('../src/lib/auth.js', () => ({
	createUser: vi.fn(),
	authenticateUser: vi.fn(),
	createJWT: vi.fn(),
	createSession: vi.fn(),
	deleteSession: vi.fn()
}));

describe('Auth API', () => {
	describe('/api/auth/signup', () => {
		it('should create a new user successfully', async () => {
			const { createUser, createJWT, createSession } = await import('../src/lib/auth.js');

			const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
			const mockToken = 'mock-jwt-token';

			createUser.mockResolvedValueOnce(mockUser);
			createJWT.mockReturnValueOnce(mockToken);
			createSession.mockResolvedValueOnce({});

			const request = {
				json: () =>
					Promise.resolve({
						email: 'test@example.com',
						password: 'password123',
						name: 'Test User'
					})
			};

			const response = await signupPOST({ request });
			const data = await response.json();

			expect(response.status).toBe(201);
			expect(data.user).toEqual({
				id: mockUser.id,
				email: mockUser.email,
				name: mockUser.name
			});
			expect(createUser).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
			expect(createJWT).toHaveBeenCalledWith(mockUser.id);
			expect(createSession).toHaveBeenCalledWith(mockUser.id, mockToken);
		});

		it('should return 400 for missing fields', async () => {
			const request = {
				json: () =>
					Promise.resolve({
						email: 'test@example.com'
						// missing password
					})
			};

			const response = await signupPOST({ request });
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Email and password are required');
		});

		it('should return 409 for existing user', async () => {
			const { createUser } = await import('../src/lib/auth.js');

			const error = new Error('Unique constraint violation');
			error.code = 'P2002';
			createUser.mockRejectedValueOnce(error);

			const request = {
				json: () =>
					Promise.resolve({
						email: 'existing@example.com',
						password: 'password123',
						name: 'Existing User'
					})
			};

			const response = await signupPOST({ request });
			const data = await response.json();

			expect(response.status).toBe(409);
			expect(data.error).toBe('User already exists');
		});
	});

	describe('/api/auth/login', () => {
		it('should authenticate user successfully', async () => {
			const { authenticateUser, createJWT, createSession } = await import('../src/lib/auth.js');

			const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };
			const mockToken = 'mock-jwt-token';

			authenticateUser.mockResolvedValueOnce(mockUser);
			createJWT.mockReturnValueOnce(mockToken);
			createSession.mockResolvedValueOnce({});

			const request = {
				json: () =>
					Promise.resolve({
						email: 'test@example.com',
						password: 'password123'
					})
			};

			const response = await loginPOST({ request });
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.user).toEqual({
				id: mockUser.id,
				email: mockUser.email,
				name: mockUser.name
			});
			expect(authenticateUser).toHaveBeenCalledWith('test@example.com', 'password123');
		});

		it('should return 401 for invalid credentials', async () => {
			const { authenticateUser } = await import('../src/lib/auth.js');

			authenticateUser.mockResolvedValueOnce(null);

			const request = {
				json: () =>
					Promise.resolve({
						email: 'test@example.com',
						password: 'wrongpassword'
					})
			};

			const response = await loginPOST({ request });
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe('Invalid credentials');
		});
	});

	describe('/api/auth/logout', () => {
		it('should logout successfully', async () => {
			const { deleteSession } = await import('../src/lib/auth.js');

			deleteSession.mockResolvedValueOnce();

			const cookies = {
				get: vi.fn().mockReturnValue('mock-token')
			};

			const response = await logoutPOST({ cookies });
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe('Logged out successfully');
			expect(deleteSession).toHaveBeenCalledWith('mock-token');
		});

		it('should handle logout without token', async () => {
			const { deleteSession } = await import('../src/lib/auth.js');

			const cookies = {
				get: vi.fn().mockReturnValue(null)
			};

			const response = await logoutPOST({ cookies });
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe('Logged out successfully');
			// deleteSession may still be called with null, which is fine
		});
	});
});
