import { authenticatedRequest } from '$lib/api.js';

// Svelte 5 state for user recent achievements data
export let userAchievements = $state({});

/**
 * Fetch recent achievements for users
 * @param {Array} userIds - Array of user IDs to fetch achievements for
 * @returns {Promise<Object>} Object mapping userId to recent achievement
 */
export async function fetchUserRecentAchievements(userIds) {
	if (!userIds || userIds.length === 0) {
		return {};
	}

	try {
		const response = await authenticatedRequest('/api/achievements/recent', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userIds })
		});

		if (response.success) {
			// Update the state with fetched data
			Object.assign(userAchievements, response.achievements);

			return response.achievements;
		}

		return {};
	} catch (error) {
		console.error('Failed to fetch user achievements:', error);
		return {};
	}
}

/**
 * Get recent achievement for a specific user from state
 * @param {string} userId - User ID
 * @returns {Object|null} Recent achievement or null
 */
export function getUserRecentAchievement(userId) {
	return userAchievements[userId] || null;
}
