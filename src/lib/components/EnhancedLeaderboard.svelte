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

	async function loadLeaderboard() {
		loading = true;
		try {
			// Load leaderboard and posts data
			const [leaderboard, postsData] = await Promise.all([
				authenticatedRequest(`/api/leaderboard?timeframe=all&scope=company`),
				authenticatedRequest('/api/admin/posts')
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

			// Fetch achievements for all users in leaderboard
			if (leaderboard?.leaderboard) {
				const userIds = leaderboard.leaderboard.map((player) => player.id);
				await fetchUserRecentAchievements(userIds);
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
			<div
				class="overflow-y-auto shadow-lg custom-scrollbar max-h-96 rounded-xl backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<div class="p-6">
					<h3
						class="top-0 z-10 p-2 mb-4 text-xl font-bold rounded-lg "
						style="color:#fdfdfd; background-color:rgba(255,255,255,0.05);"
					>
						Company Leaderboard
					</h3>
					<div class="space-y-3">
						{#each leaderboardData.leaderboard as player}
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
								<div class="w-16 text-center">
									<div
										class="text-xl font-bold"
										style="color:{player.isCurrentUser ? '#24b0ff' : '#24b0ff'};"
									>
										{getRankIcon(player.rank)}
									</div>
								</div>

								<!-- User Info -->
								<div class="flex-1">
									<div
										class="font-semibold"
										style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};"
									>
										{player.name}
										{#if player.isCurrentUser}
											<span class="text-sm font-normal animate-pulse" style="color:#24b0ff;"
												>YOU</span
											>
										{/if}
									</div>
									<div class="text-sm" style="color:#94a3b8;">
										{#if player.teamName !== 'No Team'}
											{player.teamName} •
										{/if}
										{player.postsInTimeframe || 0} posts
									</div>
								</div>

								<!-- Recent Achievement -->
								<div class="mr-4 text-center">
									{#if getUserRecentAchievement(player.id, $userAchievements)}
										{@const recentAchievement = getUserRecentAchievement(player.id, $userAchievements)}
										<div
											class="text-lg"
											title="{recentAchievement.name} - {recentAchievement.points} points"
										>
											{recentAchievement.icon}
										</div>
										<div class="text-xs" style="color:#94a3b8;">
											{recentAchievement.name}
										</div>
									{:else}
										<div class="text-lg opacity-30">🏆</div>
										<div class="text-xs" style="color:#94a3b8;">No achievement</div>
									{/if}
								</div>

								<!-- Stats -->
								<div class="mr-6 text-right">
									<div
										class="text-xl font-bold"
										style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};"
									>
										{player.totalScore.toLocaleString()}
									</div>
									<div class="text-sm" style="color:#94a3b8;">points</div>
								</div>

								<!-- Engagement -->
								<div class="mr-6 text-right">
									<div
										class="text-lg font-semibold"
										style="color:#22c55e;"
										title="Total engagement from all posts"
									>
										{(player.engagementInTimeframe || 0).toLocaleString()}
									</div>
									<div class="text-sm" style="color:#94a3b8;">engagement</div>
								</div>

								<!-- Streak -->
								<div class="text-right">
									<div class="text-lg font-semibold" style="color:#fbbf24;">
										{player.currentStreak}
									</div>
									<div class="text-sm" style="color:#94a3b8;">streak</div>
								</div>
							</div>
						{/each}
					</div>

					{#if leaderboardData.leaderboard.length === 0}
						<div class="py-8 text-center" style="color:#94a3b8;">No users found.</div>
					{/if}
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
</style>
