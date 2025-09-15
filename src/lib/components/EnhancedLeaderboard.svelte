<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';
	import { getPostEngagement } from '$lib/engagement.js';
	import {
		userAchievements,
		fetchUserRecentAchievements,
		getUserRecentAchievement
	} from '$lib/stores/achievements.js';
	import CompanyGoals from './CompanyGoals.svelte';

	let leaderboardData = $state(null);
	let loading = $state(true);
	let error = $state('');
	let achievementsAwarded = $state(false);

	async function loadLeaderboard() {
		loading = true;
		try {
			// Load leaderboard and posts data
			const [leaderboard, postsData] = await Promise.all([
				authenticatedRequest(`/api/leaderboard?timeframe=all&scope=company`),
				authenticatedRequest('/api/posts')
			]);

			// Calculate correct engagement from posts data
			const userEngagement = {};
			if (postsData?.posts) {
				postsData.posts.forEach((post) => {
					const userId = post.userId;
					if (!userEngagement[userId]) {
						userEngagement[userId] = 0;
					}
					userEngagement[userId] += getPostEngagement(post);
				});
			}

			// Update leaderboard with correct engagement
			if (leaderboard?.leaderboard) {
				leaderboard.leaderboard.forEach((player) => {
					player.engagementInTimeframe = userEngagement[player.id] || 0;
				});
			}

			leaderboardData = leaderboard;

			// Fetch and auto-award achievements for all users in leaderboard
			if (leaderboard?.leaderboard) {
				const userIds = leaderboard.leaderboard.map((player) => player.id);
				
				// First, try to fetch existing achievements
				const achievements = await fetchUserRecentAchievements(userIds);
				
				// If no achievements found and we haven't tried awarding yet, auto-award them
				const hasAnyAchievements = Object.keys(achievements || {}).length > 0;
				
				if (!hasAnyAchievements && !achievementsAwarded) {
					achievementsAwarded = true; // Prevent repeated attempts
					
					try {
						// Auto-award achievements for all users (they must have posts if they're on leaderboard)
						const autoAwardResult = await authenticatedRequest('/api/auto-award-achievements', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ userIds })
						});
						
						// Only fetch again if achievements were actually awarded
						if (autoAwardResult.totalAchievementsAwarded > 0) {
							await fetchUserRecentAchievements(userIds);
						}
					} catch (error) {
						// Auto-award failed, continue without achievements
					}
				}
			}

			error = '';
		} catch (err) {
			error = err.message || 'Failed to load leaderboard';
		}
		loading = false;
	}

	function getRankIcon(rank) {
		switch (rank) {
			case 1:
				return '🥇';
			case 2:
				return '🥈';
			case 3:
				return '🥉';
			default:
				return `#${rank}`;
		}
	}

	// Svelte 5: Effect to load leaderboard when user becomes available
	$effect(() => {
		if ($user && !leaderboardData) {
			loadLeaderboard();
		}
	});

	onMount(() => {
		// onMount kept for any non-user dependent initialization
	});
</script>

{#if $user}
	<div class="space-y-6">
		<!-- Company Goals Progress -->
		<CompanyGoals />

		<!-- Scrollable Leaderboard -->
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div
					class="w-12 h-12 border-b-2 rounded-full animate-spin"
					style="border-color:#24b0ff;"
				></div>
			</div>
		{:else if error}
			<div
				class="px-4 py-3 rounded"
				style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;"
			>
				{error}
			</div>
		{:else if leaderboardData}
			<!-- Split Leaderboards: Top 10 and Bottom 10 -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<!-- Top 10 Users -->
				<div
					class="overflow-y-auto shadow-lg custom-scrollbar max-h-[600px] lg:max-h-[1200px] rounded-xl backdrop-blur-md"
					style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
				>
					<div class="p-6">
						<h3
							class="top-0 z-10 p-2 mb-4 text-xl font-bold rounded-lg"
							style="color:#fdfdfd; background-color:rgba(255,255,255,0.05);"
						>
							🦄 Sparkling
						</h3>
						<div class="space-y-3">
							{#each leaderboardData.leaderboard.slice(0, 10) as player}
								<div
									class="flex items-center justify-between rounded-lg p-4 transition-all duration-200 hover:scale-[1.02]"
									style="background-color:{player.isCurrentUser
										? 'rgba(36,176,255,0.25)'
										: 'rgba(16,35,73,0.28)'}; border:2px solid {player.isCurrentUser
										? '#24b0ff'
										: 'rgba(36,176,255,0.35)'}; {player.isCurrentUser
										? 'box-shadow: 0 0 20px rgba(36,176,255,0.3);'
										: ''}"
								>
									<!-- Rank -->
									<div class="w-12 text-center">
										<div
											class="text-lg font-bold"
											style="color:{player.isCurrentUser ? '#24b0ff' : '#24b0ff'};"
										>
											{getRankIcon(player.rank)}
										</div>
									</div>

									<!-- User Info -->
									<div class="flex-1 min-w-0">
										<div
											class="font-semibold truncate"
											style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};"
										>
											{player.name}
											{#if player.isCurrentUser}
												<span class="text-xs font-normal animate-pulse" style="color:#24b0ff;"
													>YOU</span
												>
											{/if}
										</div>
										<div class="text-xs truncate" style="color:#94a3b8;">
											{#if player.teamName !== 'No Team'}
												{player.teamName} •
											{/if}
											{player.postsInTimeframe || 0} posts
										</div>
									</div>

									<!-- Recent Achievement -->
									<div class="mr-2 text-center">
										{#if getUserRecentAchievement(player.id, $userAchievements)}
											{@const recentAchievement = getUserRecentAchievement(player.id, $userAchievements)}
											<div
												class="text-sm"
												title="{recentAchievement.name} - {recentAchievement.points} points"
											>
												{recentAchievement.icon}
											</div>
										{:else}
											<div class="text-sm opacity-30">🏆</div>
										{/if}
									</div>

									<!-- Stats -->
									<div class="text-right">
										<div
											class="text-sm font-bold"
											style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};"
										>
											{player.totalScore.toLocaleString()}
										</div>
										<div class="text-xs" style="color:#94a3b8;">points</div>
									</div>
								</div>
							{/each}
						</div>

						{#if leaderboardData.leaderboard.length === 0}
							<div class="py-8 text-center" style="color:#94a3b8;">No users found.</div>
						{/if}
					</div>
				</div>

				<!-- Bottom 10 Users -->
				<div
					class="overflow-y-auto shadow-lg custom-scrollbar-reverse max-h-[600px] lg:max-h-[1200px] rounded-xl backdrop-blur-md"
					style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
				>
					<div class="p-6">
						<h3
							class="top-0 z-10 p-2 mb-4 text-xl font-bold rounded-lg"
							style="color:#fdfdfd; background-color:rgba(255,255,255,0.05);"
						>
							😭 Growing Their Horns
						</h3>
						<div class="flex flex-col-reverse space-y-3">
							{#each leaderboardData.leaderboard.slice(-10) as player}
								<div
									class="flex items-center justify-between rounded-lg p-4 transition-all duration-200 hover:scale-[1.02]"
									style="background-color:{player.isCurrentUser
										? 'rgba(36,176,255,0.25)'
										: 'rgba(16,35,73,0.28)'}; border:2px solid {player.isCurrentUser
										? '#24b0ff'
										: 'rgba(148,163,184,0.35)'}; {player.isCurrentUser
										? 'box-shadow: 0 0 20px rgba(36,176,255,0.3);'
										: ''}"
								>
									<!-- Rank -->
									<div class="w-12 text-center">
										<div
											class="text-lg font-bold"
											style="color:{player.isCurrentUser ? '#24b0ff' : '#94a3b8'};"
										>
											{getRankIcon(player.rank)}
										</div>
									</div>

									<!-- User Info -->
									<div class="flex-1 min-w-0">
										<div
											class="font-semibold truncate"
											style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};"
										>
											{player.name}
											{#if player.isCurrentUser}
												<span class="text-xs font-normal animate-pulse" style="color:#24b0ff;"
													>YOU</span
												>
											{/if}
										</div>
										<div class="text-xs truncate" style="color:#94a3b8;">
											{#if player.teamName !== 'No Team'}
												{player.teamName} •
											{/if}
											{player.postsInTimeframe || 0} posts
										</div>
									</div>

									<!-- Recent Achievement -->
									<div class="mr-2 text-center">
										{#if getUserRecentAchievement(player.id, $userAchievements)}
											{@const recentAchievement = getUserRecentAchievement(player.id, $userAchievements)}
											<div
												class="text-sm"
												title="{recentAchievement.name} - {recentAchievement.points} points"
											>
												{recentAchievement.icon}
											</div>
										{:else}
											<div class="text-sm opacity-30">🏆</div>
										{/if}
									</div>

									<!-- Stats -->
									<div class="text-right">
										<div
											class="text-sm font-bold"
											style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};"
										>
											{player.totalScore.toLocaleString()}
										</div>
										<div class="text-xs" style="color:#94a3b8;">points</div>
									</div>
								</div>
							{/each}
						</div>

						{#if leaderboardData.leaderboard.length <= 10}
							<div class="py-8 text-center" style="color:#94a3b8;">
								Need more than 10 users to show bottom performers.
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="py-8 text-center">
		<p style="color:#cbd5e1;">Please log in to view the leaderboard.</p>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}

	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgba(16, 35, 73, 0.35);
		border-radius: 4px;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #24b0ff;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #1e9adb;
	}

	/* Firefox scrollbar styling */
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #24b0ff rgba(16, 35, 73, 0.35);
	}

	/* Reverse scrollbar for bottom 10 - same style as regular */
	.custom-scrollbar-reverse::-webkit-scrollbar {
		width: 8px;
	}

	.custom-scrollbar-reverse::-webkit-scrollbar-track {
		background: rgba(16, 35, 73, 0.35);
		border-radius: 4px;
	}

	.custom-scrollbar-reverse::-webkit-scrollbar-thumb {
		background: #24b0ff;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.custom-scrollbar-reverse::-webkit-scrollbar-thumb:hover {
		background: #1e9adb;
	}

	/* Firefox scrollbar styling for reverse */
	.custom-scrollbar-reverse {
		scrollbar-width: thin;
		scrollbar-color: #24b0ff rgba(16, 35, 73, 0.35);
	}
</style>
