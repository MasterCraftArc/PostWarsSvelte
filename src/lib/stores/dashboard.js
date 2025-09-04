import { writable } from 'svelte/store';

// Dashboard data store
export const dashboardData = writable(null);

// Loading and error states
export const dashboardLoading = writable(true);
export const dashboardError = writable('');

// Individual user stats for reactive updates
export const userStats = writable({
	totalScore: 0,
	currentStreak: 0,
	totalPosts: 0,
	totalEngagement: 0,
	rank: 0
});

// Recent posts for real-time updates
export const recentPosts = writable([]);