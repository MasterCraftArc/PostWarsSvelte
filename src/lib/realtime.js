import { supabase } from './supabase.js';
import { authenticatedRequest } from './api.js';
import { 
	dashboardData, 
	dashboardLoading, 
	dashboardError, 
	userStats, 
	recentPosts 
} from './stores/dashboard.js';
import { 
	leaderboardData, 
	leaderboardLoading, 
	leaderboardError,
	teamLeaderboards,
	currentUserRank 
} from './stores/leaderboard.js';
import { 
	teamProgress, 
	teamLoading, 
	teamError, 
	activeGoals, 
	teamMembers, 
	teamStats 
} from './stores/team.js';

let channels = [];

export async function initializeRealtime(userId) {
	if (!userId) {
		console.warn('Cannot initialize real-time: no userId provided');
		return;
	}

	// Clean up existing channels
	cleanupRealtime();

	try {
		// Initialize dashboard data
		await loadDashboardData(userId);
		
		// Initialize leaderboard data
		await loadLeaderboardData();
		
		// Initialize team data
		await loadTeamData(userId);

		// Set up real-time subscriptions
		setupUserSubscription(userId);
		setupLeaderboardSubscription();
		setupTeamSubscription(userId);
		setupPostsSubscription(userId);
		setupGoalsSubscription(userId);

	} catch (error) {
		console.error('Error initializing real-time:', error);
		dashboardError.set('Failed to initialize real-time updates');
	}
}

async function loadDashboardData(userId) {
	dashboardLoading.set(true);
	dashboardError.set('');

	try {
		const data = await authenticatedRequest('/api/dashboard');

		if (data) {
			dashboardData.set(data);
			userStats.set({
				totalScore: data.user.totalScore || 0,
				currentStreak: data.user.currentStreak || 0,
				totalPosts: data.user.totalPosts || 0,
				totalEngagement: data.user.totalEngagement || 0,
				rank: data.user.rank || 0
			});
			recentPosts.set(data.recentPosts || []);
		}
	} catch (error) {
		dashboardError.set(error.message || 'Failed to load dashboard');
	} finally {
		dashboardLoading.set(false);
	}
}

async function loadLeaderboardData() {
	leaderboardLoading.set(true);
	leaderboardError.set('');

	try {
		const data = await authenticatedRequest('/api/leaderboard');

		if (data) {
			leaderboardData.set(data.users || []);
			teamLeaderboards.set(data.teams || {});
		}
	} catch (error) {
		leaderboardError.set(error.message || 'Failed to load leaderboard');
	} finally {
		leaderboardLoading.set(false);
	}
}

async function loadTeamData(userId) {
	teamLoading.set(true);
	teamError.set('');

	try {
		const data = await authenticatedRequest('/api/team-progress');

		if (data) {
			teamProgress.set(data);
			activeGoals.set(data.goals || []);
			teamMembers.set(data.members || []);
			teamStats.set(data.teamStats || {});
		}
	} catch (error) {
		teamError.set(error.message || 'Failed to load team data');
	} finally {
		teamLoading.set(false);
	}
}

function setupUserSubscription(userId) {
	const userChannel = supabase
		.channel(`user-${userId}`)
		.on('postgres_changes', {
			event: 'UPDATE',
			schema: 'public',
			table: 'users',
			filter: `id=eq.${userId}`
		}, (payload) => {
			console.log('User updated:', payload);
			
			// Update user stats reactively
			userStats.update(stats => ({
				...stats,
				totalScore: payload.new.totalScore || stats.totalScore,
				currentStreak: payload.new.currentStreak || stats.currentStreak,
				totalPosts: payload.new.totalPosts || stats.totalPosts,
				totalEngagement: payload.new.totalEngagement || stats.totalEngagement
			}));
		})
		.subscribe();

	channels.push(userChannel);
}

function setupLeaderboardSubscription() {
	const leaderboardChannel = supabase
		.channel('leaderboard-updates')
		.on('postgres_changes', {
			event: 'UPDATE',
			schema: 'public',
			table: 'users'
		}, (payload) => {
			console.log('Leaderboard user updated:', payload);
			
			// Update leaderboard data
			leaderboardData.update(users => {
				const updatedUsers = users.map(user => 
					user.id === payload.new.id 
						? { ...user, ...payload.new }
						: user
				);
				
				// Re-sort by total score
				return updatedUsers.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
			});
		})
		.subscribe();

	channels.push(leaderboardChannel);
}

function setupTeamSubscription(userId) {
	// Get user's team first, then subscribe to team changes
	authenticatedRequest('/api/dashboard')
		.then(data => {
			const teamId = data.user?.teamId;
			if (!teamId) return;

			const teamChannel = supabase
				.channel(`team-${teamId}`)
				.on('postgres_changes', {
					event: 'UPDATE',
					schema: 'public',
					table: 'users',
					filter: `teamId=eq.${teamId}`
				}, (payload) => {
					console.log('Team member updated:', payload);
					
					// Update team members
					teamMembers.update(members => 
						members.map(member => 
							member.id === payload.new.id 
								? { ...member, ...payload.new }
								: member
						)
					);
				})
				.subscribe();

			channels.push(teamChannel);
		})
		.catch(error => {
			console.error('Error setting up team subscription:', error);
		});
}

function setupPostsSubscription(userId) {
	const postsChannel = supabase
		.channel(`posts-${userId}`)
		.on('postgres_changes', {
			event: 'INSERT',
			schema: 'public',
			table: 'linkedin_posts',
			filter: `userId=eq.${userId}`
		}, (payload) => {
			console.log('New post added:', payload);
			
			// Add new post to recent posts
			recentPosts.update(posts => [payload.new, ...posts].slice(0, 10));
		})
		.on('postgres_changes', {
			event: 'UPDATE',
			schema: 'public',
			table: 'linkedin_posts',
			filter: `userId=eq.${userId}`
		}, (payload) => {
			console.log('Post updated:', payload);
			
			// Update existing post in recent posts
			recentPosts.update(posts => 
				posts.map(post => 
					post.id === payload.new.id 
						? { ...post, ...payload.new }
						: post
				)
			);
		})
		.subscribe();

	channels.push(postsChannel);
}

function setupGoalsSubscription(userId) {
	// Subscribe to goals updates
	const goalsChannel = supabase
		.channel('goals-updates')
		.on('postgres_changes', {
			event: 'UPDATE',
			schema: 'public',
			table: 'goals'
		}, (payload) => {
			console.log('Goal updated:', payload);
			
			// Update active goals
			activeGoals.update(goals => 
				goals.map(goal => 
					goal.id === payload.new.id 
						? { ...goal, ...payload.new }
						: goal
				)
			);
		})
		.on('postgres_changes', {
			event: 'INSERT',
			schema: 'public',
			table: 'goals'
		}, (payload) => {
			console.log('New goal added:', payload);
			
			// Add new goal if it's active
			if (payload.new.status === 'ACTIVE') {
				activeGoals.update(goals => [...goals, payload.new]);
			}
		})
		.subscribe();

	channels.push(goalsChannel);
}

export function cleanupRealtime() {
	channels.forEach(channel => {
		supabase.removeChannel(channel);
	});
	channels = [];
}

// Auto cleanup on page unload
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', cleanupRealtime);
}