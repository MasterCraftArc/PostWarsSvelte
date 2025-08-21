import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('should display login and signup buttons when not authenticated', async ({ page }) => {
		await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible();
	});

	test('should navigate to login page', async ({ page }) => {
		await page.getByRole('link', { name: 'Login' }).click();
		await expect(page).toHaveURL('/login');
		await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
	});

	test('should navigate to signup page', async ({ page }) => {
		await page.getByRole('link', { name: 'Sign Up' }).click();
		await expect(page).toHaveURL('/signup');
		await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
	});

	test('should show validation errors for empty login form', async ({ page }) => {
		await page.goto('/login');
		await page.getByRole('button', { name: 'Login' }).click();
		await expect(page.getByText('Please fill in all fields')).toBeVisible();
	});

	test('should show validation errors for empty signup form', async ({ page }) => {
		await page.goto('/signup');
		await page.getByRole('button', { name: 'Sign Up' }).click();
		await expect(page.getByText('Please fill in all fields')).toBeVisible();
	});

	test('should show password mismatch error in signup', async ({ page }) => {
		await page.goto('/signup');

		await page.getByLabel('Name').fill('Test User');
		await page.getByLabel('Email').fill('test@example.com');
		await page.getByLabel('Password', { exact: true }).fill('password123');
		await page.getByLabel('Confirm Password').fill('password456');

		await page.getByRole('button', { name: 'Sign Up' }).click();
		await expect(page.getByText('Passwords do not match')).toBeVisible();
	});

	test('should show password length error in signup', async ({ page }) => {
		await page.goto('/signup');

		await page.getByLabel('Name').fill('Test User');
		await page.getByLabel('Email').fill('test@example.com');
		await page.getByLabel('Password', { exact: true }).fill('123');
		await page.getByLabel('Confirm Password').fill('123');

		await page.getByRole('button', { name: 'Sign Up' }).click();
		await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
	});

	test('should handle signup and login flow', async ({ page }) => {
		const testEmail = `test-${Date.now()}@example.com`;
		const testPassword = 'password123';
		const testName = 'Test User';

		// Sign up
		await page.goto('/signup');
		await page.getByLabel('Name').fill(testName);
		await page.getByLabel('Email').fill(testEmail);
		await page.getByLabel('Password', { exact: true }).fill(testPassword);
		await page.getByLabel('Confirm Password').fill(testPassword);

		await page.getByRole('button', { name: 'Sign Up' }).click();

		// Should redirect to home page after successful signup
		await expect(page).toHaveURL('/');
		await expect(page.getByText(`Hello, ${testName}!`)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

		// Logout
		await page.getByRole('button', { name: 'Logout' }).click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();

		// Login with the same credentials
		await page.getByRole('link', { name: 'Login' }).click();
		await page.getByLabel('Email').fill(testEmail);
		await page.getByLabel('Password').fill(testPassword);

		await page.getByRole('button', { name: 'Login' }).click();

		// Should redirect to home page after successful login
		await expect(page).toHaveURL('/');
		await expect(page.getByText(`Hello, ${testName}!`)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
	});

	test('should handle invalid login credentials', async ({ page }) => {
		await page.goto('/login');

		await page.getByLabel('Email').fill('nonexistent@example.com');
		await page.getByLabel('Password').fill('wrongpassword');

		await page.getByRole('button', { name: 'Login' }).click();

		await expect(page.getByText('Invalid credentials')).toBeVisible();
		await expect(page).toHaveURL('/login');
	});

	test('should redirect authenticated users away from auth pages', async ({ page }) => {
		const testEmail = `test-redirect-${Date.now()}@example.com`;
		const testPassword = 'password123';
		const testName = 'Test User';

		// Sign up first
		await page.goto('/signup');
		await page.getByLabel('Name').fill(testName);
		await page.getByLabel('Email').fill(testEmail);
		await page.getByLabel('Password', { exact: true }).fill(testPassword);
		await page.getByLabel('Confirm Password').fill(testPassword);
		await page.getByRole('button', { name: 'Sign Up' }).click();

		// Try to visit login page while authenticated
		await page.goto('/login');
		await expect(page).toHaveURL('/');

		// Try to visit signup page while authenticated
		await page.goto('/signup');
		await expect(page).toHaveURL('/');
	});
});
