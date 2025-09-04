<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { 
		leaderboardData, 
		leaderboardLoading, 
		leaderboardError,
		leaderboardTimeframe,
		teamLeaderboards,
		currentUserRank 
	} from '$lib/stores/leaderboard.js';
	import { initializeRealtime } from '$lib/realtime.js';

	const timeframeOptions = [
		{ value: 'all', label: 'All Time' },
		{ value: 'month', label: 'This Month' },
		{ value: 'week', label: 'This Week' }
	];

	async function loadLeaderboard() {
		leaderboardLoading.set(true);
		try {
			const response = await fetch(`/api/leaderboard?timeframe=${$leaderboardTimeframe}`);
			const data = await response.json();

			if (response.ok) {
				leaderboardData.set(data.users || []);
				currentUserRank.set(data.userRank || null);
				teamLeaderboards.set(data.teams || {});
				leaderboardError.set('');
			} else {
				leaderboardError.set(data.error || 'Failed to load leaderboard');
			}
		} catch (err) {
			leaderboardError.set('Network error loading leaderboard');
		}
		leaderboardLoading.set(false);
	}

	function handleTimeframeChange(event) {
		leaderboardTimeframe.set(event.target.value);
		loadLeaderboard();
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

	function getRankClass(rank, isCurrentUser) {
		let baseClass = 'flex items-center space-x-4 p-4 rounded-lg transition-colors ';

		if (isCurrentUser) {
			baseClass += 'bg-blue-50 border border-blue-200 ';
		} else if (rank <= 3) {
			baseClass += 'bg-yellow-50 border border-yellow-200 ';
		} else {
			baseClass += 'bg-white border border-gray-200 ';
		}

		return baseClass;
	}

	let hasInitialized = false;
	
	// Initialize real-time system and load data
	$: {
		if ($user?.id && !hasInitialized && !$leaderboardLoading) {
			hasInitialized = true;
			// Always initialize real-time system (singleton pattern prevents duplicates)
			initializeRealtime($user.id);
		}
	}
</script>

{#if $user}
	<div class="space-y-6">
		<!-- Header with timeframe selector (GLASS) -->
		<div
			class="rounded-xl p-6 shadow-lg backdrop-blur-md"
			style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold" style="color:#fdfdfd;">Leaderboard</h2>

				<select
					bind:value={$leaderboardTimeframe}
					on:change={handleTimeframeChange}
					class="rounded-md px-3 py-2 focus:outline-none focus:ring-2"
					style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; focus:ring-color:#24b0ff;"
				>
					{#each timeframeOptions as option}
						<option value={option.value} style="color:#0c1a3e;">{option.label}</option>
					{/each}
				</select>
			</div>

			{#if $currentUserRank}
				<div
					class="rounded-lg p-4 text-center backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff;"
				>
					<div class="text-lg font-semibold" style="color:#24b0ff;">
						Your Current Rank: #{$currentUserRank}
					</div>
					<div class="text-sm" style="color:#cbd5e1;">
						{timeframeOptions.find((opt) => opt.value === timeframe)?.label || 'All Time'}
					</div>
				</div>
			{/if}
		</div>

		<!-- Leaderboard -->
		{#if $leaderboardLoading}
			<div class="flex items-center justify-center py-12">
				<div class="h-12 w-12 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
			</div>
		{:else if $leaderboardError}
			<div
				class="rounded px-4 py-3"
				style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;"
			>
				{$leaderboardError}
			</div>
		{:else if $leaderboardData}
			<div
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style=" border:1px solid #24b0ff;"
			>
				<div class="space-y-3">
					{#each $leaderboardData as player}
						<div
							class="flex items-center justify-between rounded-lg p-3"
							
						>
							<!-- Rank -->
							<div class="w-16 text-center">
								<div class="text-xl font-bold" style="color:#24b0ff;">
									{getRankIcon(player.rank)}
								</div>
							</div>

							<!-- User Info -->
							<div class="flex-1">
								<div class="font-semibold" style="color:#fdfdfd;">
									{player.name}
									{#if player.isCurrentUser}
										<span class="text-sm font-normal" style="color:#24b0ff;">(You)</span>
									{/if}
								</div>
								<div class="text-sm" style="color:#94a3b8;">
									{player.postsInTimeframe} posts in {timeframe === 'all' ? 'total' : timeframe}
								</div>
							</div>

							<!-- Stats -->
							<div class="text-right">
								<div class="text-xl font-bold" style="color:#fdfdfd;">
									{player.totalScore.toLocaleString()}
								</div>
								<div class="text-sm" style="color:#94a3b8;">points</div>
							</div>

							<!-- Engagement -->
							<div class="text-right">
								<div class="text-lg font-semibold" style="color:#22c55e;">
									{player.engagementInTimeframe}
								</div>
								<div class="text-sm" style="color:#94a3b8;">engagement</div>
							</div>

							<!-- Streak -->
							{#if timeframe === 'all'}
								<div class="text-right">
									<div class="text-lg font-semibold" style="color:#fbbf24;">
										{player.currentStreak}
									</div>
									<div class="text-sm" style="color:#94a3b8;">streak</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				{#if $leaderboardData.length === 0}
					<div class="py-8 text-center" style="color:#94a3b8;">
						No users found for this timeframe.
					</div>
				{/if}
			</div>

			<!-- Achievement highlights for top performers -->
			{#if $leaderboardData.length > 0}
				<div
					class="rounded-xl p-6 shadow-lg backdrop-blur-md"
					style=" "
				>
					<h3 class="mb-4 text-lg font-semibold" style="color:#fdfdfd;">Top Performers</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
						{#each $leaderboardData.slice(0, 3) as topPlayer, index}
							<div
								class="rounded-lg p-4 text-center "
								style=""
							>
								<div class="mb-2 text-3xl" style="color:#24b0ff;">
									{getRankIcon(index + 1)}
								</div>
								<div class="font-semibold" style="color:#fdfdfd;">{topPlayer.name}</div>
								<div class="mb-2 text-sm" style="color:#cbd5e1;">
									{topPlayer.totalScore.toLocaleString()} points
								</div>
								<div class="text-xs" style="color:#94a3b8;">
									{topPlayer.achievements.length} achievements earned
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
{:else}
	<div class="py-8 text-center">
		<p style="color:#cbd5e1;">Please log in to view the leaderboard.</p>
	</div>
{/if}


