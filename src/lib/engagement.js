/**
 * Engagement calculation utilities
 * Single source of truth for engagement metrics
 */

/**
 * Calculate total engagement from individual metrics
 * @param {number} reactions - Number of reactions/likes
 * @param {number} comments - Number of comments  
 * @param {number} reposts - Number of reposts/shares
 * @returns {number} Total engagement count
 */
export function calculateTotalEngagement(reactions = 0, comments = 0, reposts = 0) {
	return (reactions || 0) + (comments || 0) + (reposts || 0);
}

/**
 * Calculate total engagement for a post object
 * @param {Object} post - Post object with engagement fields
 * @returns {number} Total engagement count
 */
export function getPostEngagement(post) {
	if (!post) return 0;
	return calculateTotalEngagement(post.reactions, post.comments, post.reposts);
}

/**
 * Calculate total engagement for an array of posts by user
 * @param {Array} posts - Array of post objects
 * @returns {Object} User engagement mapping {userId: totalEngagement}
 */
export function calculateUserEngagement(posts) {
	const userEngagement = {};
	
	posts.forEach(post => {
		const userId = post.userId;
		if (!userEngagement[userId]) {
			userEngagement[userId] = 0;
		}
		userEngagement[userId] += getPostEngagement(post);
	});
	
	return userEngagement;
}