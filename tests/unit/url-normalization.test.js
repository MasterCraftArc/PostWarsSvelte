import { describe, it, expect } from 'vitest';

/**
 * Test URL normalization logic (extracted from post submission API)
 * This ensures consistent duplicate detection for LinkedIn URLs
 */
function normalizeLinkedInUrl(url) {
	try {
		const trimmed = url.trim().toLowerCase();

		// Handle domain variations
		let normalized = trimmed.replace(/^https?:\/\/linkedin\.com/, 'https://www.linkedin.com');
		if (normalized.startsWith('www.linkedin.com')) {
			normalized = 'https://' + normalized;
		}

		const urlObj = new URL(normalized);

		// Remove query parameters and fragments
		urlObj.search = '';
		urlObj.hash = '';

		// Remove trailing slash
		if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
			urlObj.pathname = urlObj.pathname.slice(0, -1);
		}

		return urlObj.toString();
	} catch (error) {
		// Fallback for malformed URLs
		return url.trim().toLowerCase()
			.replace(/\/$/, '') // Remove trailing slash
			.replace(/[?#].*$/, ''); // Remove query params and fragments
	}
}

describe('URL Normalization for Duplicate Detection', () => {
	it('should normalize URLs with different query parameters to the same URL', () => {
		const baseUrl = 'https://www.linkedin.com/posts/user_activity-123456789';
		const urlWithUtm = 'https://www.linkedin.com/posts/user_activity-123456789?utm_source=share';
		const urlWithMultipleParams = 'https://www.linkedin.com/posts/user_activity-123456789?utm_source=share&utm_campaign=mobile';

		const normalized1 = normalizeLinkedInUrl(baseUrl);
		const normalized2 = normalizeLinkedInUrl(urlWithUtm);
		const normalized3 = normalizeLinkedInUrl(urlWithMultipleParams);

		expect(normalized1).toBe(normalized2);
		expect(normalized2).toBe(normalized3);
		expect(normalized1).toBe('https://www.linkedin.com/posts/user_activity-123456789');
	});

	it('should normalize URLs with and without www', () => {
		const withWww = 'https://www.linkedin.com/posts/user_activity-123456789';
		const withoutWww = 'https://linkedin.com/posts/user_activity-123456789';

		const normalized1 = normalizeLinkedInUrl(withWww);
		const normalized2 = normalizeLinkedInUrl(withoutWww);

		expect(normalized1).toBe(normalized2);
		expect(normalized1).toBe('https://www.linkedin.com/posts/user_activity-123456789');
	});

	it('should normalize URLs with trailing slashes', () => {
		const withSlash = 'https://www.linkedin.com/posts/user_activity-123456789/';
		const withoutSlash = 'https://www.linkedin.com/posts/user_activity-123456789';

		const normalized1 = normalizeLinkedInUrl(withSlash);
		const normalized2 = normalizeLinkedInUrl(withoutSlash);

		expect(normalized1).toBe(normalized2);
		expect(normalized1).toBe('https://www.linkedin.com/posts/user_activity-123456789');
	});

	it('should normalize URLs with fragments', () => {
		const withFragment = 'https://www.linkedin.com/posts/user_activity-123456789#comments';
		const withoutFragment = 'https://www.linkedin.com/posts/user_activity-123456789';

		const normalized1 = normalizeLinkedInUrl(withFragment);
		const normalized2 = normalizeLinkedInUrl(withoutFragment);

		expect(normalized1).toBe(normalized2);
		expect(normalized1).toBe('https://www.linkedin.com/posts/user_activity-123456789');
	});

	it('should handle complex URLs with multiple variations', () => {
		const urls = [
			'https://www.linkedin.com/posts/user_activity-123456789',
			'https://linkedin.com/posts/user_activity-123456789/',
			'https://www.linkedin.com/posts/user_activity-123456789?utm_source=share',
			'https://LinkedIn.com/posts/user_activity-123456789?utm_source=share&utm_campaign=mobile#section',
			'  HTTPS://WWW.LINKEDIN.COM/POSTS/USER_ACTIVITY-123456789/  ' // whitespace and caps
		];

		const normalizedUrls = urls.map(normalizeLinkedInUrl);
		const expectedUrl = 'https://www.linkedin.com/posts/user_activity-123456789';

		normalizedUrls.forEach(normalized => {
			expect(normalized).toBe(expectedUrl);
		});
	});

	it('should handle feed update URLs', () => {
		const feedUrl1 = 'https://www.linkedin.com/feed/update/urn:li:activity:123456789';
		const feedUrl2 = 'https://linkedin.com/feed/update/urn:li:activity:123456789?utm_source=share';

		const normalized1 = normalizeLinkedInUrl(feedUrl1);
		const normalized2 = normalizeLinkedInUrl(feedUrl2);

		expect(normalized1).toBe(normalized2);
		expect(normalized1).toBe('https://www.linkedin.com/feed/update/urn:li:activity:123456789');
	});

	it('should prevent common duplicate scenarios', () => {
		// These are the exact scenarios that were causing duplicate posts
		const duplicateScenarios = [
			[
				'https://www.linkedin.com/posts/michaelslaughter_activity-123456789',
				'https://www.linkedin.com/posts/michaelslaughter_activity-123456789?utm_source=share'
			],
			[
				'https://linkedin.com/posts/user_activity-123456789',
				'https://www.linkedin.com/posts/user_activity-123456789/'
			],
			[
				'https://www.linkedin.com/posts/user_activity-123456789',
				'https://www.linkedin.com/posts/user_activity-123456789?trackingId=abc123'
			]
		];

		duplicateScenarios.forEach(([url1, url2]) => {
			const normalized1 = normalizeLinkedInUrl(url1);
			const normalized2 = normalizeLinkedInUrl(url2);
			expect(normalized1).toBe(normalized2);
		});
	});
});