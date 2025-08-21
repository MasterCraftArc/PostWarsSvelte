import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, createJWT, verifyJWT } from './auth.js';

// Mock Prisma
vi.mock('./prisma/index.js', () => ({
	prisma: {
		user: {
			create: vi.fn(),
			findUnique: vi.fn()
		},
		session: {
			create: vi.fn(),
			findUnique: vi.fn(),
			delete: vi.fn()
		}
	}
}));

describe('Auth utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Password handling', () => {
		it('should hash password correctly', async () => {
			const password = 'testpassword123';
			const hashedPassword = await hashPassword(password);

			expect(hashedPassword).toBeTruthy();
			expect(hashedPassword).not.toBe(password);
			expect(hashedPassword.length).toBeGreaterThan(50);
		});

		it('should verify password correctly', async () => {
			const password = 'testpassword123';
			const hashedPassword = await hashPassword(password);

			const isValid = await verifyPassword(password, hashedPassword);
			expect(isValid).toBe(true);

			const isInvalid = await verifyPassword('wrongpassword', hashedPassword);
			expect(isInvalid).toBe(false);
		});
	});

	describe('JWT handling', () => {
		it('should create and verify JWT correctly', () => {
			const userId = 'test-user-id';
			const token = createJWT(userId);

			expect(token).toBeTruthy();
			expect(typeof token).toBe('string');

			const payload = verifyJWT(token);
			expect(payload).toBeTruthy();
			expect(payload.userId).toBe(userId);
		});

		it('should return null for invalid JWT', () => {
			const invalidToken = 'invalid-token';
			const payload = verifyJWT(invalidToken);

			expect(payload).toBeNull();
		});
	});
});
