import { writable } from 'svelte/store';

// Leaderboard data store
export const leaderboardData = writable([]);

// Loading and error states
export const leaderboardLoading = writable(false);
export const leaderboardError = writable('');

// Current timeframe filter
export const leaderboardTimeframe = writable('all');

// Team leaderboards
export const teamLeaderboards = writable({});

// Current user's rank for highlighting
export const currentUserRank = writable(null);