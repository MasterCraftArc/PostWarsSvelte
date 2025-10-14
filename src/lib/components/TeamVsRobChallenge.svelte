<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';

	let loading = true;
	let error = '';
	let teams = [];
	let robScore = 0;
	let companyGoalTotal = 0;

	async function loadChallengeData() {
		if (!$user) {
			console.log('[TeamVsRob] No user, skipping load');
			return;
		}

		console.log('[TeamVsRob] Loading challenge data for user:', $user.name);
		loading = true;
		error = '';

		try {
			// Fetch both team-vs-rob data and company goals
			const [teamData, goalsData] = await Promise.all([
				authenticatedRequest('/api/team-vs-rob'),
				authenticatedRequest('/api/goals/company')
			]);

			console.log('[TeamVsRob] Team data:', teamData);
			console.log('[TeamVsRob] Goals data:', goalsData);

			if (!teamData.success) {
				console.log('[TeamVsRob] API returned success: false');
				loading = false;
				return;
			}

			teams = teamData.teams || [];
			robScore = teamData.robScore || 0;

			// Get company goal total (use TEAM_SCORE goal if exists)
			const teamScoreGoal = goalsData.goals?.find(g => g.type === 'TEAM_SCORE');
			companyGoalTotal = teamScoreGoal?.currentValue || 0;

			console.log('[TeamVsRob] Data loaded:', { teams, robScore, companyGoalTotal });

		} catch (err) {
			console.error('[TeamVsRob] Failed to load challenge data:', err);
			error = err.message || 'Failed to load challenge';
		}

		loading = false;
	}

	// Load data when user becomes available
	$: {
		if ($user !== null) {
			loadChallengeData();
		}
	}

	onMount(() => {
		if ($user) {
			loadChallengeData();
		}
	});
</script>

{#if !loading && !error && teams.length > 0 && companyGoalTotal > 0}
	<div
		class="rounded-xl p-6 shadow-lg backdrop-blur-md mb-6"
		style="background-color:rgba(255,255,255,0.05); border:1px solid #ffa500;"
	>
		<div class="flex items-center justify-between mb-6">
			<h2 class="text-xl font-bold" style="color:#fdfdfd;">
				🏆 Teams vs Rob Challenge
			</h2>
			<p class="text-sm" style="color:#94a3b8;">Company Goal Contributions</p>
		</div>

		<!-- All Teams -->
		{#each teams as team}
			{@const teamPercent = companyGoalTotal > 0 ? Math.round((team.score / companyGoalTotal) * 100) : 0}

			<div class="mb-4">
				<div class="flex justify-between items-center mb-2">
					<span class="text-sm font-medium" style="color:#24b0ff;">{team.name}</span>
					<span class="text-sm font-bold" style="color:#24b0ff;">{team.score} pts ({teamPercent}%)</span>
				</div>
				<div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-500"
						style="width: {teamPercent}%; background: linear-gradient(90deg, #24b0ff 0%, #1a8acc 100%);"
					></div>
				</div>
			</div>
		{/each}

		<!-- Rob -->
		<div class="mb-4">
			<div class="flex justify-between items-center mb-2">
				<span class="text-sm font-medium" style="color:#ffa500;">Rob Slaughter</span>
				<span class="text-sm font-bold" style="color:#ffa500;">{robScore} pts ({companyGoalTotal > 0 ? Math.round((robScore / companyGoalTotal) * 100) : 0}%)</span>
			</div>
			<div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
				<div
					class="h-full rounded-full transition-all duration-500"
					style="width: {companyGoalTotal > 0 ? Math.round((robScore / companyGoalTotal) * 100) : 0}%; background: linear-gradient(90deg, #ffa500 0%, #cc8400 100%);"
				></div>
			</div>
		</div>

		<!-- Total Summary -->
		<div class="text-center pt-4 border-t" style="border-color:rgba(255,255,255,0.1);">
			<p class="text-sm" style="color:#94a3b8;">
				Total Company Points: <span class="font-bold" style="color:#fdfdfd;">{companyGoalTotal}</span>
			</p>
		</div>
	</div>
{/if}
