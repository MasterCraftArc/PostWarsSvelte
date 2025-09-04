import { writable } from 'svelte/store';

// Team progress data
export const teamProgress = writable(null);

// Loading and error states
export const teamLoading = writable(true);
export const teamError = writable('');

// Active goals for real-time updates
export const activeGoals = writable([]);

// Team members for live updates
export const teamMembers = writable([]);

// Team stats
export const teamStats = writable({
	totalScore: 0,
	totalPosts: 0,
	averageEngagement: 0,
	goalsCompleted: 0,
	activeMembers: 0
});