import { describe, it, expect } from 'vitest';
import {
	extractLinkedInUsername,
	validateLinkedInOwnership,
	parseLinkedInPostUrl
} from './linkedin-url-parser.js';

describe('LinkedIn URL Parser', () => {
	describe('extractLinkedInUsername', () => {
		it('should extract username from standard LinkedIn post URL', () => {
			const url = 'https://www.linkedin.com/posts/john-doe_activity-1234567890';
			const result = extractLinkedInUsername(url);
			expect(result).toBe('john-doe');
		});

		it('should extract username from LinkedIn post URL without www', () => {
			const url = 'https://linkedin.com/posts/jane-smith_some-text-1234567890';
			const result = extractLinkedInUsername(url);
			expect(result).toBe('jane-smith');
		});

		it('should handle URLs with query parameters', () => {
			const url =
				'https://www.linkedin.com/posts/michaelsmith_activity-1234567890?utm_source=share';
			const result = extractLinkedInUsername(url);
			expect(result).toBe('michaelsmith');
		});

		it('should return null for invalid URLs', () => {
			expect(extractLinkedInUsername('https://twitter.com/user')).toBeNull();
			expect(extractLinkedInUsername('not a url')).toBeNull();
			expect(extractLinkedInUsername(null)).toBeNull();
			expect(extractLinkedInUsername('')).toBeNull();
		});
	});

	describe('validateLinkedInOwnership', () => {
		it('should validate exact matches', () => {
			expect(validateLinkedInOwnership('john-doe', 'john-doe@company.com')).toBe(true);
			expect(validateLinkedInOwnership('janesmith', 'janesmith@company.com')).toBe(true);
		});

		it('should validate matches with different separators', () => {
			expect(validateLinkedInOwnership('john-doe', 'johndoe@company.com')).toBe(true);
			expect(validateLinkedInOwnership('jane_smith', 'jane.smith@company.com')).toBe(true);
			expect(validateLinkedInOwnership('michaelsmith', 'michael-smith@company.com')).toBe(true);
		});

		it('should validate matches with numeric suffixes', () => {
			expect(
				validateLinkedInOwnership(
					'michael-slaughter-579222245',
					'mikeslaughter@defenseunicorns.com'
				)
			).toBe(true);
			expect(validateLinkedInOwnership('john-doe-123456', 'johndoe@company.com')).toBe(true);
			expect(validateLinkedInOwnership('jane-smith-999', 'jane.smith@company.com')).toBe(true);
		});

		it('should validate common name abbreviations', () => {
			expect(validateLinkedInOwnership('robert-johnson', 'rob.johnson@company.com')).toBe(true);
			expect(validateLinkedInOwnership('james-wilson', 'jim.wilson@company.com')).toBe(true);
			expect(validateLinkedInOwnership('william-davis', 'bill.davis@company.com')).toBe(true);
			expect(validateLinkedInOwnership('david-brown', 'dave.brown@company.com')).toBe(true);
		});

		it('should validate partial matches (minimum 4 chars)', () => {
			expect(validateLinkedInOwnership('johnsmith', 'john@company.com')).toBe(true);
			expect(validateLinkedInOwnership('john', 'johnsmith123@company.com')).toBe(true);
		});

		it('should reject partial matches under 4 characters', () => {
			expect(validateLinkedInOwnership('joe', 'joseph@company.com')).toBe(false);
			expect(validateLinkedInOwnership('jo', 'john@company.com')).toBe(false);
		});

		it('should reject non-matching names', () => {
			expect(validateLinkedInOwnership('john-doe', 'jane-smith@company.com')).toBe(false);
			expect(validateLinkedInOwnership('alice', 'bob@company.com')).toBe(false);
		});

		it('should handle null/empty inputs', () => {
			expect(validateLinkedInOwnership(null, 'john@company.com')).toBe(false);
			expect(validateLinkedInOwnership('john', null)).toBe(false);
			expect(validateLinkedInOwnership('', 'john@company.com')).toBe(false);
		});
	});

	describe('parseLinkedInPostUrl', () => {
		it('should parse valid LinkedIn URLs', () => {
			const url = 'https://www.linkedin.com/posts/john-doe_activity-1234567890';
			const result = parseLinkedInPostUrl(url);

			expect(result.isValid).toBe(true);
			expect(result.username).toBe('john-doe');
			expect(result.originalUrl).toBe(url);
		});

		it('should handle invalid URLs', () => {
			const url = 'https://twitter.com/user';
			const result = parseLinkedInPostUrl(url);

			expect(result.isValid).toBe(false);
			expect(result.username).toBeNull();
			expect(result.originalUrl).toBe(url);
		});
	});
});
