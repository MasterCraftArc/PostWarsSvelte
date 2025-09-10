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

	// Normalize strings by removing separators and numbers
	const normalize = (str) => str.replace(/[-_.]/g, '');
	const removeNumbers = (str) => str.replace(/\d+/g, '');

	const normalizedUsername = normalize(username);
	const normalizedEmail = normalize(emailUsername);

	// Remove numbers from LinkedIn username (common pattern: michael-slaughter-579222245)
	const usernameWithoutNumbers = removeNumbers(normalizedUsername);
	const emailWithoutNumbers = removeNumbers(normalizedEmail);

	// Debug logging (remove in production)
	// console.log('Debug validation:', { username, emailUsername, normalizedUsername, normalizedEmail, usernameWithoutNumbers, emailWithoutNumbers });

	// Match after removing separators
	if (normalizedUsername === normalizedEmail) {
		return true;
	}

	// Match after removing separators and numbers
	if (usernameWithoutNumbers === emailWithoutNumbers && usernameWithoutNumbers.length >= 4) {
		return true;
	}

	// Partial matches (minimum 4 characters to prevent false positives)
	if (normalizedEmail.startsWith(normalizedUsername) && normalizedUsername.length >= 4) {
		return true;
	}

	if (normalizedUsername.startsWith(normalizedEmail) && normalizedEmail.length >= 4) {
		return true;
	}

	// Check if email (without numbers) is contained in username (without numbers)
	if (usernameWithoutNumbers.includes(emailWithoutNumbers) && emailWithoutNumbers.length >= 3) {
		// For 3-character names, check if they are common abbreviations
		if (emailWithoutNumbers.length === 3) {
			const commonThreeLetterNames = [
				'rob',
				'jim',
				'tom',
				'joe',
				'bob',
				'dan',
				'sam',
				'ben',
				'tim'
			];
			if (commonThreeLetterNames.includes(emailWithoutNumbers)) {
				return true;
			}
		} else {
			return true;
		}
	}

	// Check if username (without numbers) is contained in email (without numbers)
	if (emailWithoutNumbers.includes(usernameWithoutNumbers) && usernameWithoutNumbers.length >= 4) {
		return true;
	}

	// Handle common name abbreviations and variations
	if (
		(emailWithoutNumbers.length >= 3 && usernameWithoutNumbers.length >= 4) ||
		(emailWithoutNumbers.length >= 4 && usernameWithoutNumbers.length >= 3)
	) {
		// Check common name patterns: mike/michael, rob/robert, etc.
		const commonAbbreviations = new Map([
			['mike', 'michael'],
			['michael', 'mike'],
			['mike', 'mikael'],
			['mikael', 'mike'],
			['rob', 'robert'],
			['robert', 'rob'],
			['jim', 'james'],
			['james', 'jim'],
			['bill', 'william'],
			['william', 'bill'],
			['dave', 'david'],
			['david', 'dave'],
			['tom', 'thomas'],
			['thomas', 'tom'],
			['joe', 'joseph'],
			['joseph', 'joe'],
			['bob', 'robert'],
			['dan', 'daniel'],
			['daniel', 'dan'],
			['sam', 'samuel'],
			['samuel', 'sam']
		]);

		// Check if the names are known abbreviations of each other
		if (
			commonAbbreviations.get(emailWithoutNumbers) === usernameWithoutNumbers ||
			commonAbbreviations.get(usernameWithoutNumbers) === emailWithoutNumbers
		) {
			return true;
		}

		// Handle compound names like "michael-slaughter" vs "mike-slaughter"
		// and middle initials like "bryan-d-finster" vs "bryan-finster"
		for (const [abbrev, full] of commonAbbreviations.entries()) {
			// Check if username starts with full name and email starts with abbreviation
			if (usernameWithoutNumbers.startsWith(full) && emailWithoutNumbers.startsWith(abbrev)) {
				const usernameSuffix = usernameWithoutNumbers.substring(full.length);
				const emailSuffix = emailWithoutNumbers.substring(abbrev.length);
				if (usernameSuffix === emailSuffix) {
					return true;
				}
			}

			// Check reverse case: email starts with full name and username starts with abbreviation
			if (emailWithoutNumbers.startsWith(full) && usernameWithoutNumbers.startsWith(abbrev)) {
				const emailSuffix = emailWithoutNumbers.substring(full.length);
				const usernameSuffix = usernameWithoutNumbers.substring(abbrev.length);
				if (emailSuffix === usernameSuffix) {
					return true;
				}
			}
		}

		// Handle middle initials: "bryandfinster" should match "bryanfinster"
		// by removing single letters that appear between longer segments
		if (Math.abs(usernameWithoutNumbers.length - emailWithoutNumbers.length) === 1) {
			const longer =
				usernameWithoutNumbers.length > emailWithoutNumbers.length
					? usernameWithoutNumbers
					: emailWithoutNumbers;
			const shorter =
				usernameWithoutNumbers.length > emailWithoutNumbers.length
					? emailWithoutNumbers
					: usernameWithoutNumbers;

			// Try removing each single character and see if it matches
			for (let i = 0; i < longer.length; i++) {
				const withoutChar = longer.slice(0, i) + longer.slice(i + 1);
				if (withoutChar === shorter && shorter.length >= 4) {
					return true;
				}
			}
		}
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
