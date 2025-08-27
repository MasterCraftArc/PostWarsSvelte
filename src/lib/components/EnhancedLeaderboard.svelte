<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';

	let leaderboardData = null;
	let companyGoals = null;
	let loading = true;
	let error = '';

	async function loadCompanyGoals() {
		try {
			const data = await authenticatedRequest('/api/goals/company');
			companyGoals = data;
		} catch (err) {
			console.error('Failed to load company goals:', err);
			companyGoals = null;
		}
	}

	async function loadLeaderboard() {
		loading = true;
		try {
			// Always load company leaderboard with all time data
			const data = await authenticatedRequest(`/api/leaderboard?timeframe=all&scope=company`);
			leaderboardData = data;
			error = '';
			
			// Load company goals
			await loadCompanyGoals();
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

	function getGoalTypeLabel(type) {
		switch (type) {
			case 'POSTS_COUNT':
				return 'Posts';
			case 'TOTAL_ENGAGEMENT':
				return 'Total Engagement';
			case 'AVERAGE_ENGAGEMENT':
				return 'Average Engagement';
			case 'TEAM_SCORE':
				return 'Total Score';
			default:
				return type;
		}
	}

	function getGoalIcon(type) {
		switch (type) {
			case 'POSTS_COUNT':
				return '📝';
			case 'TOTAL_ENGAGEMENT':
				return '💬';
			case 'AVERAGE_ENGAGEMENT':
				return '⭐';
			case 'TEAM_SCORE':
				return '🎯';
			default:
				return '🎯';
		}
	}

	// Reactive statement to load leaderboard when user becomes available
	$: {
		if ($user && !leaderboardData) {
			loadLeaderboard();
		}
	}

	onMount(() => {
		// onMount kept for any non-user dependent initialization
	});
</script>

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

{#if $user}
	<div class="space-y-6">

		<!-- Company Goals Progress -->
		{#if companyGoals?.goals && companyGoals.goals.length > 0}
			<div
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-xl font-bold" style="color:#fdfdfd;">
						Company Goals Progress
					</h3>
					<div class="text-sm" style="color:#cbd5e1;">
						{companyGoals.completedGoals} of {companyGoals.totalGoals} completed
					</div>
				</div>

				<div class="space-y-4">
					{#each companyGoals.goals as goal}
						<div
							class="rounded-lg p-4 backdrop-blur-md"
							style="background-color:rgba(16,35,73,0.28); border:1px solid {goal.isCompleted ? '#22c55e' : '#24b0ff'};"
						>
							<div class="flex items-center justify-between mb-3">
								<div>
									<h4 class="font-semibold" style="color:#fdfdfd;">
										{goal.title}
									</h4>
									<p class="text-sm" style="color:#94a3b8;">
										{getGoalTypeLabel(goal.type)}
										{#if goal.daysLeft > 0}
											• {goal.daysLeft} days left
										{:else}
											• Deadline reached
										{/if}
									</p>
								</div>
								<div class="text-right">
									<div class="text-lg font-bold" style="color:{goal.isCompleted ? '#22c55e' : '#fdfdfd'};">
										{goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
									</div>
									<div class="text-sm" style="color:{goal.isCompleted ? '#22c55e' : '#24b0ff'};">
										{goal.progressPercent}%
									</div>
								</div>
							</div>

							<!-- Progress Bar -->
							<div class="w-full rounded-full h-2" style="background-color:rgba(16,35,73,0.5);">
								<div
									class="h-2 rounded-full transition-all duration-300"
									style="width: {goal.progressPercent}%; background-color: {goal.isCompleted ? '#22c55e' : '#24b0ff'};"
								></div>
							</div>

							{#if goal.description}
								<p class="text-xs mt-2" style="color:#94a3b8;">
									{goal.description}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Scrollable Leaderboard -->
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="h-12 w-12 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
			</div>
		{:else if error}
			<div
				class="rounded px-4 py-3"
				style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;"
			>
				{error}
			</div>
		{:else if leaderboardData}
			<div
				class="rounded-xl shadow-lg backdrop-blur-md max-h-96 overflow-y-auto custom-scrollbar"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<div class="p-6">
					<h3 class="text-xl font-bold mb-4 sticky top-0 z-10 p-2 rounded-lg" 
					    style="color:#fdfdfd; background-color:rgba(255,255,255,0.05);">
						Company Leaderboard
					</h3>
					<div class="space-y-3">
						{#each leaderboardData.leaderboard as player}
							<div
								class="flex items-center justify-between rounded-lg p-4 transition-all duration-200 hover:scale-[1.02]"
								style="background-color:{player.isCurrentUser ? 'rgba(36,176,255,0.25)' : 'rgba(16,35,73,0.28)'}; border:2px solid {player.isCurrentUser ? '#24b0ff' : 'rgba(36,176,255,0.35)'}; {player.isCurrentUser ? 'box-shadow: 0 0 20px rgba(36,176,255,0.3);' : ''}"
							>
								<!-- Rank -->
								<div class="w-16 text-center">
									<div class="text-xl font-bold" style="color:{player.isCurrentUser ? '#24b0ff' : '#24b0ff'};">
										{getRankIcon(player.rank)}
									</div>
								</div>

								<!-- User Info -->
								<div class="flex-1">
									<div class="font-semibold" style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};">
										{player.name}
										{#if player.isCurrentUser}
											<span class="text-sm font-normal animate-pulse" style="color:#24b0ff;">YOU</span>
										{/if}
									</div>
									<div class="text-sm" style="color:#94a3b8;">
										{#if player.teamName !== 'No Team'}
											{player.teamName} •
										{/if}
										{player.postsInTimeframe} total posts
									</div>
								</div>

								<!-- Stats -->
								<div class="text-right mr-6">
									<div class="text-xl font-bold" style="color:{player.isCurrentUser ? '#ffffff' : '#fdfdfd'};">
										{player.totalScore.toLocaleString()}
									</div>
									<div class="text-sm" style="color:#94a3b8;">points</div>
								</div>

								<!-- Engagement -->
								<div class="text-right mr-6">
									<div class="text-lg font-semibold" style="color:#22c55e;">
										{player.engagementInTimeframe}
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
						<div class="py-8 text-center" style="color:#94a3b8;">
							No users found.
						</div>
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