import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PostSubmitForm from './PostSubmitForm.svelte';
import { user } from '$lib/stores/auth.js';

// Mock the auth store
vi.mock('$lib/stores/auth.js', () => ({
	user: {
		subscribe: vi.fn((callback) => {
			callback({ id: 'test-user', email: 'test@example.com' });
			return vi.fn(); // unsubscribe function
		})
	}
}));

// Mock the API function
vi.mock('$lib/api.js', () => ({
	authenticatedRequest: vi.fn()
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
	value: { ...window.location, reload: mockReload },
	writable: true
});

describe('PostSubmitForm Confirmation Display', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should display confirmation message after successful post submission', async () => {
		const { authenticatedRequest } = await import('$lib/api.js');
		
		// Mock successful API response
		authenticatedRequest.mockResolvedValue({
			jobId: 'job-123',
			estimatedWaitTime: '30-90 seconds',
			message: 'Post submitted successfully'
		});

		render(PostSubmitForm);

		// Fill in the form
		const urlInput = screen.getByPlaceholderText(/linkedin.com\/posts/i);
		const submitButton = screen.getByRole('button', { name: /submit post/i });

		await fireEvent.input(urlInput, { target: { value: 'https://www.linkedin.com/posts/test-user_test-post' } });
		await fireEvent.click(submitButton);

		// Wait for and check confirmation message
		await waitFor(() => {
			expect(screen.getByText(/✅ Post submitted successfully!/)).toBeInTheDocument();
		});

		// Should show estimated time
		expect(screen.getByText(/Estimated processing time: 30-90 seconds/)).toBeInTheDocument();
		
		// Should guide user to Dashboard
		expect(screen.getByText(/Check your Recent Posts on the Dashboard to track progress/)).toBeInTheDocument();

		// Should clear the input field
		expect(urlInput.value).toBe('');
	});

	it('should NOT reload the page after successful submission', async () => {
		const { authenticatedRequest } = await import('$lib/api.js');
		
		// Mock successful API response
		authenticatedRequest.mockResolvedValue({
			jobId: 'job-456',
			estimatedWaitTime: '10-30 seconds',
			message: 'Post submitted successfully'
		});

		render(PostSubmitForm);

		const urlInput = screen.getByPlaceholderText(/linkedin.com\/posts/i);
		const submitButton = screen.getByRole('button', { name: /submit post/i });

		await fireEvent.input(urlInput, { target: { value: 'https://www.linkedin.com/posts/test-user_another-test' } });
		await fireEvent.click(submitButton);

		await waitFor(() => {
			expect(screen.getByText(/✅ Post submitted successfully!/)).toBeInTheDocument();
		});

		// Should NOT have called window.location.reload
		expect(mockReload).not.toHaveBeenCalled();
	});

	it('should automatically hide confirmation message after 8 seconds', async () => {
		const { authenticatedRequest } = await import('$lib/api.js');
		
		// Mock successful API response
		authenticatedRequest.mockResolvedValue({
			jobId: 'job-789',
			estimatedWaitTime: '60-120 seconds',
			message: 'Post submitted successfully'
		});

		// Mock timers
		vi.useFakeTimers();

		render(PostSubmitForm);

		const urlInput = screen.getByPlaceholderText(/linkedin.com\/posts/i);
		const submitButton = screen.getByRole('button', { name: /submit post/i });

		await fireEvent.input(urlInput, { target: { value: 'https://www.linkedin.com/posts/test-user_timing-test' } });
		await fireEvent.click(submitButton);

		// Confirmation should be visible
		await waitFor(() => {
			expect(screen.getByText(/✅ Post submitted successfully!/)).toBeInTheDocument();
		});

		// Fast-forward time by 8 seconds
		vi.advanceTimersByTime(8000);

		// Confirmation should be hidden
		await waitFor(() => {
			expect(screen.queryByText(/✅ Post submitted successfully!/)).not.toBeInTheDocument();
		});

		vi.useRealTimers();
	});

	it('should display error message for invalid LinkedIn URL', async () => {
		render(PostSubmitForm);

		const urlInput = screen.getByPlaceholderText(/linkedin.com\/posts/i);
		const submitButton = screen.getByRole('button', { name: /submit post/i });

		// Try to submit invalid URL
		await fireEvent.input(urlInput, { target: { value: 'https://twitter.com/invalid' } });
		await fireEvent.click(submitButton);

		// Should show error message immediately (no API call needed)
		await waitFor(() => {
			expect(screen.getByText('Please enter a valid LinkedIn URL')).toBeInTheDocument();
		});
	});

	it('should show loading state during submission', async () => {
		const { authenticatedRequest } = await import('$lib/api.js');
		
		// Create a promise that we control
		let resolveApiCall;
		const apiPromise = new Promise((resolve) => {
			resolveApiCall = resolve;
		});
		authenticatedRequest.mockReturnValue(apiPromise);

		render(PostSubmitForm);

		const urlInput = screen.getByPlaceholderText(/linkedin.com\/posts/i);
		const submitButton = screen.getByRole('button', { name: /submit post/i });

		await fireEvent.input(urlInput, { target: { value: 'https://www.linkedin.com/posts/test-user_loading-test' } });
		await fireEvent.click(submitButton);

		// Should show loading state
		expect(screen.getByText('Processing...')).toBeInTheDocument();
		expect(submitButton).toBeDisabled();

		// Resolve the API call
		resolveApiCall({
			jobId: 'job-loading-test',
			estimatedWaitTime: '45 seconds',
			message: 'Post submitted successfully'
		});

		// Should return to normal state with confirmation
		await waitFor(() => {
			expect(screen.getByText(/✅ Post submitted successfully!/)).toBeInTheDocument();
			expect(submitButton).not.toBeDisabled();
			expect(screen.getByText('Submit Post')).toBeInTheDocument();
		});
	});
});