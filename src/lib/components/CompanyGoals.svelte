<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';

	let companyGoals = null;
	let raceData = null;
	let loading = true;
	let error = '';

	async function loadCompanyGoals() {
		loading = true;
		try {
			const data = await authenticatedRequest('/api/goals/company');
			companyGoals = data;

			// If there are race goals, load team rankings
			const hasRace = data.goals?.some(g => g.is_race);
			if (hasRace) {
				try {
					const raceResponse = await authenticatedRequest('/api/goals/race-active');
					raceData = raceResponse;
				} catch (raceErr) {
					console.error('Failed to load race data:', raceErr);
				}
			}

			error = '';
		} catch (err) {
			console.error('Failed to load company goals:', err);
			error = err.message || 'Failed to load company goals';
			companyGoals = null;
		}
		loading = false;
	}

	function getGoalTypeLabel(type) {
		switch (type) {
			case 'POSTS_COUNT':
				return 'Posts';
			case 'TOTAL_ENGAGEMENT':
				return 'Total Engagement';
			case 'AVERAGE_ENGAGEMENT':
				return 'Avg Engagement';
			case 'TEAM_SCORE':
				return 'Team Score';
			default:
				return type;
		}
	}

	// Reactive statement to load company goals when user becomes available
	$: {
		if ($user !== null) {
			loadCompanyGoals();
		}
	}

	onMount(() => {
		if ($user) {
			loadCompanyGoals();
		}
	});
</script>

{#if $user}
	{#if loading}
		<div class="flex items-center justify-center py-8">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
		</div>
	{:else if error}
		<div
			class="rounded-xl p-6 shadow-lg backdrop-blur-md text-center"
			style="background-color:rgba(255,255,255,0.05); border:1px solid #ff5456;"
		>
			<h3 class="text-xl font-semibold mb-2" style="color:#ff5456;">Error Loading Company Goals</h3>
			<p style="color:#94a3b8;">{error}</p>
		</div>
	{:else if companyGoals?.goals && companyGoals.goals.length > 0}
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
					{#if goal.is_race}
						<!-- Team Race Goal -->
						<div
							class="rounded-lg p-4 backdrop-blur-md"
							style="background-color:rgba(255,165,0,0.1); border:1px solid #ffa500;"
						>
							<div class="flex items-center justify-between mb-3">
								<div>
									<h4 class="font-semibold flex items-center gap-2" style="color:#fdfdfd;">
										<span>🏁</span>
										{goal.title}
									</h4>
									<p class="text-sm" style="color:#94a3b8;">
										Team Race • {getGoalTypeLabel(goal.type)}
										{#if goal.daysLeft > 0}
											• {goal.daysLeft} days left
										{:else}
											• Deadline reached
										{/if}
									</p>
								</div>
								<div class="text-right">
									<div class="text-sm" style="color:#ffa500;">
										{raceData?.totalTeams || 0} teams competing
									</div>
								</div>
							</div>

							{#if goal.description}
								<p class="text-xs mb-3" style="color:#94a3b8;">
									{goal.description}
								</p>
							{/if}

							<!-- Team Rankings -->
							{#if raceData?.teamProgress && raceData.teamProgress.length > 0}
								<div class="space-y-2">
									{#each raceData.teamProgress.slice(0, 3) as team, index}
										<div class="flex items-center justify-between p-2 rounded"
											style="background-color:rgba(255,165,0,{team.isWinning ? '0.2' : '0.1'});">
											<div class="flex items-center gap-2">
												<span class="text-lg font-bold" style="color:{team.isWinning ? '#ffa500' : '#fdfdfd'};">
													#{team.rank}
												</span>
												<div>
													<div class="font-semibold text-sm" style="color:#fdfdfd;">
														{team.teamName}
													</div>
													<div class="text-xs" style="color:#94a3b8;">
														{team.memberCount} members
													</div>
												</div>
											</div>
											<div class="text-right">
												<div class="font-bold" style="color:{team.isWinning ? '#ffa500' : '#fdfdfd'};">
													{team.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
												</div>
												<div class="text-xs" style="color:#94a3b8;">
													{team.progress.toFixed(1)}%
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-center py-2" style="color:#94a3b8;">
									No team progress available yet
								</p>
							{/if}
						</div>
					{:else}
						<!-- Regular Company Goal -->
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
					{/if}
				{/each}
			</div>
		</div>
	{:else}
		<div
			class="rounded-xl p-6 shadow-lg backdrop-blur-md text-center"
			style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
		>
			<h3 class="text-xl font-semibold mb-2" style="color:#fdfdfd;">No Active Company Goals</h3>
			<p style="color:#94a3b8;">There are no active company goals at the moment.</p>
		</div>
	{/if}
{:else}
	<div
		class="rounded-xl p-6 shadow-lg backdrop-blur-md text-center"
		style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
	>
		<h3 class="text-xl font-semibold mb-2" style="color:#fdfdfd;">Please Log In</h3>
		<p style="color:#94a3b8;">Please log in to view company goals.</p>
	</div>
{/if}