/**
 * LinkedIn URL Parser - Extract usernames from LinkedIn post URLs
 * Used for post ownership validation
 */

/**
 * Extract LinkedIn username from a post URL
 * @param {string} url - LinkedIn post URL
 * @returns {string|null} - LinkedIn username or null if not found
 */
export function extractLinkedInUsername(url) {
	if (!url || typeof url !== 'string') {
		return null;
	}

	const cleanUrl = url.trim();

	// LinkedIn post URL patterns:
	// https://www.linkedin.com/posts/username_activity-123456789
	// https://linkedin.com/posts/username_activity-123456789
	// https://www.linkedin.com/posts/posts/username_some-text-123456789

	const postPattern = /linkedin\.com\/posts\/([^_\/\?\#]+)/i;
	const match = cleanUrl.match(postPattern);

	if (match && match[1]) {
		return match[1].toLowerCase();
	}

	return null;
}

/**
 * Validate if LinkedIn username matches user's email domain or profile
 * @param {string} linkedinUsername - Username extracted from URL
 * @param {string} userEmail - User's email address
 * @returns {boolean} - True if valid match
 */
export function validateLinkedInOwnership(linkedinUsername, userEmail) {
	if (!linkedinUsername || !userEmail) {
		return false;
	}

	const username = linkedinUsername.toLowerCase();
	const email = userEmail.toLowerCase();
	const emailUsername = email.split('@')[0];

	// Exact match
	if (username === emailUsername) {
		return true;
	}

	// Normalize strings by removing separators
	const normalize = (str) => str.replace(/[-_.]/g, '');
	const normalizedUsername = normalize(username);
	const normalizedEmail = normalize(emailUsername);

	// Match after removing separators
	if (normalizedUsername === normalizedEmail) {
		return true;
	}

	// Partial matches (minimum 4 characters to prevent false positives)
	if (normalizedEmail.startsWith(normalizedUsername) && normalizedUsername.length >= 4) {
		return true;
	}

	if (normalizedUsername.startsWith(normalizedEmail) && normalizedEmail.length >= 4) {
		return true;
	}

	return false;
}

/**
 * Parse and validate LinkedIn post URL
 * @param {string} url - LinkedIn post URL
 * @returns {object} - Validation result with username and validity
 */
export function parseLinkedInPostUrl(url) {
	const username = extractLinkedInUsername(url);

	return {
		isValid: !!username,
		username,
		originalUrl: url
	};
}
