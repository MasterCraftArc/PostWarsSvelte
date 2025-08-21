import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import { signup, login, logout, user } from '$lib/stores/auth.js';
import { get } from 'svelte/store';

// Mock fetch globally
global.fetch = vi.fn();

describe('Auth Store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		user.set(null);
	});

	afterEach(() => {
		cleanup();
	});

	describe('signup', () => {
		it('should successfully sign up a user', async () => {
			const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };

			fetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ user: mockUser })
			});

			const result = await signup('test@example.com', 'password123', 'Test User');

			expect(result.success).toBe(true);
			expect(get(user)).toEqual(mockUser);
			expect(fetch).toHaveBeenCalledWith('/api/auth/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'test@example.com',
					password: 'password123',
					name: 'Test User'
				})
			});
		});

		it('should handle signup errors', async () => {
			fetch.mockResolvedValueOnce({
				ok: false,
				json: () => Promise.resolve({ error: 'User already exists' })
			});

			const result = await signup('test@example.com', 'password123', 'Test User');

			expect(result.success).toBe(false);
			expect(result.error).toBe('User already exists');
			expect(get(user)).toBeNull();
		});
	});

	describe('login', () => {
		it('should successfully log in a user', async () => {
			const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' };

			fetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ user: mockUser })
			});

			const result = await login('test@example.com', 'password123');

			expect(result.success).toBe(true);
			expect(get(user)).toEqual(mockUser);
			expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
			});
		});

		it('should handle login errors', async () => {
			fetch.mockResolvedValueOnce({
				ok: false,
				json: () => Promise.resolve({ error: 'Invalid credentials' })
			});

			const result = await login('test@example.com', 'wrongpassword');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid credentials');
			expect(get(user)).toBeNull();
		});
	});

	describe('logout', () => {
		it('should successfully log out a user', async () => {
			user.set({ id: '1', email: 'test@example.com', name: 'Test User' });

			fetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ message: 'Logged out successfully' })
			});

			await logout();

			expect(get(user)).toBeNull();
			expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
				method: 'POST'
			});
		});
	});
});
