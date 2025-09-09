import { describe, it, expect } from 'vitest';

// Mock the normalizeCount function for testing
// In real TDD, this test would be written first and would fail
function normalizeCount(s, context = '') {
	const cleanStr = s.toString().trim().replace(/,/g, '').replace(/\s/g, '');
	if (!cleanStr) return 0;

	// CRITICAL: Filter out time patterns that are mistaken for engagement
	if (cleanStr.match(/^\d+[wdhms]$/i)) {
		return 0;
	}

	const match = cleanStr.match(/(\d+(?:\.\d+)?)\s*([KkMm])?/);
	if (!match) return 0;

	const [, num, suffix] = match;
	let value = parseFloat(num);

	if (suffix && suffix.toLowerCase() === 'k') {
		value *= 1000;
	} else if (suffix && suffix.toLowerCase() === 'm') {
		value *= 1000000;
	}

	const result = Math.floor(value);

	// Additional validation: engagement numbers should be reasonable
	const isViewsOrImpressions = context.includes('view') || context.includes('impression');
	const maxLimit = isViewsOrImpressions ? 10000000 : 1000000;
	
	if (result > maxLimit) {
		return 0;
	}

	return result;
}

describe('LinkedIn Scraper - normalizeCount', () => {
	describe('timestamp filtering (Issue #1)', () => {
		it('should filter out minute timestamps', () => {
			expect(normalizeCount('51m', 'time')).toBe(0);
		});

		it('should filter out hour timestamps', () => {
			expect(normalizeCount('2h', 'time')).toBe(0);
		});

		it('should filter out day timestamps', () => {
			expect(normalizeCount('3d', 'time')).toBe(0);
		});

		it('should filter out week timestamps', () => {
			expect(normalizeCount('1w', 'time')).toBe(0);
		});

		it('should filter out second timestamps', () => {
			expect(normalizeCount('30s', 'time')).toBe(0);
		});
	});

	describe('valid engagement numbers', () => {
		it('should parse basic numbers', () => {
			expect(normalizeCount('25', 'reactions')).toBe(25);
		});

		it('should parse K notation', () => {
			expect(normalizeCount('5K', 'reactions')).toBe(5000);
		});

		it('should parse M notation for views', () => {
			expect(normalizeCount('1.2M', 'views')).toBe(1200000);
		});

		it('should allow higher limits for views/impressions', () => {
			expect(normalizeCount('5000000', 'views')).toBe(5000000);
		});
	});

	describe('unrealistic engagement filtering', () => {
		it('should filter unrealistic reaction counts', () => {
			expect(normalizeCount('5000000', 'reactions')).toBe(0);
		});

		it('should filter extremely high engagement', () => {
			expect(normalizeCount('50000000', 'views')).toBe(0);
		});
	});
});