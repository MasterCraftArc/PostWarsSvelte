import { writable } from 'svelte/store';
import { authenticatedRequest } from '$lib/api.js';

// Svelte store for user recent achievements data
export const userAchievements = writable({});

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
			// Update the store with fetched data
			userAchievements.update(current => ({
				...current,
				...response.achievements
			}));

			return response.achievements;
		}

		return {};
	} catch (error) {
		return {};
	}
}

/**
 * Get recent achievement for a specific user from store
 * @param {string} userId - User ID  
 * @param {Object} $userAchievements - Store value
 * @returns {Object|null} Recent achievement or null
 */
export function getUserRecentAchievement(userId, $userAchievements) {
	return $userAchievements[userId] || null;
}
