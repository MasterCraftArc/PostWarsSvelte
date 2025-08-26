<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';

	let leaderboardData = null;
	let teamsData = null;
	let loading = true;
	let error = '';
	let timeframe = 'all';
	let scope = 'company';
	let selectedTeamId = null;
	let userHasTeam = false;

	const timeframeOptions = [
		{ value: 'all', label: 'All Time' },
		{ value: 'month', label: 'This Month' },
		{ value: 'week', label: 'This Week' }
	];

	$: scopeOptions = userHasTeam 
		? [
			{ value: 'team', label: 'My Team' },
			{ value: 'other-team', label: 'Other Teams' },
			{ value: 'company', label: 'Company' }
		]
		: [
			{ value: 'team', label: 'Teams' },
			{ value: 'company', label: 'Company' }
		];

	async function loadTeams() {
		try {
			const data = await authenticatedRequest('/api/teams');
			teamsData = data.teams;
			// Set first team as default if user has no team
			if (!userHasTeam && teamsData.length > 0) {
				selectedTeamId = teamsData[0].id;
			}
		} catch (err) {
			console.error('Failed to load teams:', err);
		}
	}

	async function loadLeaderboard() {
		loading = true;
		try {
			let data;
			
			if (scope === 'team' && userHasTeam) {
				// User's own team
				data = await authenticatedRequest(`/api/leaderboard?timeframe=${timeframe}&scope=team`);
			} else if ((scope === 'team' && !userHasTeam) || scope === 'other-team') {
				// Specific team leaderboard
				if (selectedTeamId) {
					data = await authenticatedRequest(`/api/teams/${selectedTeamId}/leaderboard?timeframe=${timeframe}`);
				} else {
					error = 'Please select a team';
					loading = false;
					return;
				}
			} else {
				// Company leaderboard
				data = await authenticatedRequest(`/api/leaderboard?timeframe=${timeframe}&scope=company`);
			}

			leaderboardData = data;
			error = '';
		} catch (err) {
			error = err.message || 'Failed to load leaderboard';
		}
		loading = false;
	}

	function handleTimeframeChange(event) {
		timeframe = event.target.value;
		loadLeaderboard();
	}

	function handleScopeChange(event) {
		scope = event.target.value;
		loadLeaderboard();
	}

	function handleTeamChange(event) {
		selectedTeamId = event.target.value;
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

	async function checkUserTeam() {
		try {
			await authenticatedRequest('/api/team-progress');
			userHasTeam = true;
		} catch (err) {
			userHasTeam = false;
			scope = 'company'; // Default to company view for users without teams
		}
	}

	// Reactive statement to load leaderboard when user becomes available
	$: {
		if ($user && !leaderboardData) {
			initializeLeaderboard();
		}
	}

	async function initializeLeaderboard() {
		await checkUserTeam();
		await loadTeams();
		loadLeaderboard();
	}

	onMount(() => {
		// onMount kept for any non-user dependent initialization
	});
</script>

{#if $user}
	<div class="space-y-6">
		<!-- Header with filters -->
		<div
			class="rounded-xl p-6 shadow-lg backdrop-blur-md"
			style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-bold" style="color:#fdfdfd;">
					{#if scope === 'company'}
						Company Leaderboard
					{:else if scope === 'team' && userHasTeam}
						My Team Leaderboard
					{:else if scope === 'other-team'}
						Team Leaderboard
					{:else}
						Team Leaderboard
					{/if}
				</h2>

				<div class="flex space-x-4">
					<select
						bind:value={scope}
						on:change={handleScopeChange}
						class="rounded-md px-3 py-2 focus:outline-none focus:ring-2"
						style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; focus:ring-color:#24b0ff;"
					>
						{#each scopeOptions as option}
							<option value={option.value} style="color:#0c1a3e;">{option.label}</option>
						{/each}
					</select>

					<!-- Team selector for non-members or when viewing other teams -->
					{#if ((scope === 'team' && !userHasTeam) || scope === 'other-team') && teamsData}
						<select
							bind:value={selectedTeamId}
							on:change={handleTeamChange}
							class="rounded-md px-3 py-2 focus:outline-none focus:ring-2"
							style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; focus:ring-color:#24b0ff;"
						>
							{#each teamsData as team}
								<option value={team.id} style="color:#0c1a3e;">{team.name} ({team.memberCount} members)</option>
							{/each}
						</select>
					{/if}
					
					<select
						bind:value={timeframe}
						on:change={handleTimeframeChange}
						class="rounded-md px-3 py-2 focus:outline-none focus:ring-2"
						style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; focus:ring-color:#24b0ff;"
					>
						{#each timeframeOptions as option}
							<option value={option.value} style="color:#0c1a3e;">{option.label}</option>
						{/each}
					</select>
				</div>
			</div>

			{#if leaderboardData?.teamInfo && (scope === 'team' || scope === 'other-team')}
				<div
					class="rounded-lg p-4 text-center backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff;"
				>
					<div class="text-lg font-semibold" style="color:#24b0ff;">
						Team: {leaderboardData.teamInfo.name}
					</div>
					<div class="text-sm" style="color:#cbd5e1;">
						{leaderboardData.teamInfo.memberCount} members
						{#if leaderboardData.userRank}
							• Your Rank: #{leaderboardData.userRank}
						{/if}
					</div>
					{#if leaderboardData.teamInfo.description}
						<div class="text-xs mt-1" style="color:#94a3b8;">
							{leaderboardData.teamInfo.description}
						</div>
					{/if}
				</div>
			{:else if leaderboardData?.userRank && scope === 'company'}
				<div
					class="rounded-lg p-4 text-center backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff;"
				>
					<div class="text-lg font-semibold" style="color:#24b0ff;">
						Your Company Rank: #{leaderboardData.userRank}
					</div>
					<div class="text-sm" style="color:#cbd5e1;">
						{timeframeOptions.find((opt) => opt.value === timeframe)?.label || 'All Time'}
					</div>
				</div>
			{/if}
		</div>

		<!-- Leaderboard -->
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
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<div class="space-y-3">
					{#each leaderboardData.leaderboard as player}
						<div
							class="flex items-center justify-between rounded-lg p-4"
							style="background-color:{player.isCurrentUser ? 'rgba(36,176,255,0.15)' : 'rgba(16,35,73,0.28)'}; border:1px solid {player.isCurrentUser ? '#24b0ff' : 'rgba(36,176,255,0.35)'};"
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
									{#if scope === 'company' && player.teamName !== 'No Team'}
										{player.teamName} •
									{/if}
									{player.postsInTimeframe} posts in {timeframe === 'all' ? 'total' : timeframe}
								</div>
							</div>

							<!-- Stats -->
							<div class="text-right mr-6">
								<div class="text-xl font-bold" style="color:#fdfdfd;">
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

				{#if leaderboardData.leaderboard.length === 0}
					<div class="py-8 text-center" style="color:#94a3b8;">
						No users found for this timeframe.
					</div>
				{/if}
			</div>

			<!-- Top 3 Highlights -->
			{#if leaderboardData.leaderboard.length >= 3}
				<div
					class="rounded-xl p-6 shadow-lg backdrop-blur-md"
					style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
				>
					<h3 class="mb-4 text-lg font-semibold" style="color:#fdfdfd;">
						Top 3 {scope === 'team' ? 'Team Members' : 'Performers'}
					</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
						{#each leaderboardData.leaderboard.slice(0, 3) as topPlayer, index}
							<div
								class="rounded-lg p-4 text-center backdrop-blur-md"
								style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
							>
								<div class="mb-2 text-3xl" style="color:#24b0ff;">
									{getRankIcon(index + 1)}
								</div>
								<div class="font-semibold" style="color:#fdfdfd;">{topPlayer.name}</div>
								<div class="mb-2 text-sm" style="color:#cbd5e1;">
									{topPlayer.totalScore.toLocaleString()} points
								</div>
								<div class="text-xs" style="color:#94a3b8;">
									{topPlayer.achievements.length} achievements
								</div>
								{#if scope === 'company' && topPlayer.teamName !== 'No Team'}
									<div class="text-xs mt-1" style="color:#94a3b8;">
										{topPlayer.teamName}
									</div>
								{/if}
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