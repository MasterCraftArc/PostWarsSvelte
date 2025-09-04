<script>
	import { onMount, onDestroy } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { 
		teamProgress, 
		teamLoading, 
		teamError, 
		activeGoals, 
		teamMembers, 
		teamStats 
	} from '$lib/stores/team.js';
	import { initializeRealtime, cleanupRealtime } from '$lib/realtime.js';
	import { authenticatedRequest } from '$lib/api.js';
	import ProgressBar from './ProgressBar.svelte';
	
	let hasInitialized = false;
	
	// Initialize real-time when user is fully authenticated
	$: {
		if ($user?.id && !hasInitialized && !$teamLoading) {
			hasInitialized = true;
			initializeRealtime($user.id).catch(error => {
				console.error('Failed to initialize real-time:', error);
				hasInitialized = false; // Allow retry
			});
		}
	}

	// Clean up on component destroy
	onDestroy(() => {
		cleanupRealtime();
	});
	
	async function loadTeamProgress() {
		teamLoading.set(true);
		try {
			const data = await authenticatedRequest('/api/team-progress');
			teamProgress.set(data);
			activeGoals.set(data.goals || []);
			teamMembers.set(data.members || []);
			teamStats.set(data.teamStats || {});
			teamError.set('');
		} catch (err) {
			teamError.set(err.message || 'Failed to load team progress');
		}
		teamLoading.set(false);
	}
	
	onMount(() => {
		// Load initial data when component mounts
		if ($user) {
			loadTeamProgress();
		}
	});
	
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
	
	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
	
	function getDaysRemaining(endDate) {
		const end = new Date(endDate);
		const now = new Date();
		const diffTime = end - now;
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return Math.max(0, diffDays);
	}
</script>

{#if $teamLoading}
	<div class="flex items-center justify-center py-8">
		<div class="h-8 w-8 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
	</div>
{:else if $teamError}
	<div 
		class="rounded-lg p-4"
		style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;"
	>
		{$teamError}
	</div>
{:else if $teamProgress}
	<div class="space-y-6">
		<!-- Team Header -->
		<div 
			class="rounded-xl p-6 shadow-lg backdrop-blur-md"
			style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
		>
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-2xl font-bold" style="color:#fdfdfd;">{$teamProgress?.team?.name || 'No Team Assigned'}</h2>
					{#if $teamProgress?.team?.description}
						<p class="text-sm mt-1" style="color:#94a3b8;">{$teamProgress.team.description}</p>
					{/if}
				</div>
				{#if $teamProgress?.team?.teamLead}
					<div class="text-right">
						<div class="text-sm" style="color:#94a3b8;">Team Lead</div>
						<div class="font-medium" style="color:#24b0ff;">{$teamProgress.team.teamLead.name}</div>
					</div>
				{/if}
			</div>
			
			<!-- Team Stats -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div 
					class="rounded-lg p-3 text-center"
					style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
				>
					<div class="text-xl font-bold" style="color:#24b0ff;">{$teamStats.totalMembers || 0}</div>
					<div class="text-xs" style="color:#94a3b8;">Members</div>
				</div>
				
				<div 
					class="rounded-lg p-3 text-center"
					style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
				>
					<div class="text-xl font-bold" style="color:#24b0ff;">{($teamStats.totalScore || 0).toLocaleString()}</div>
					<div class="text-xs" style="color:#94a3b8;">Total Score</div>
				</div>
				
				<div 
					class="rounded-lg p-3 text-center"
					style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
				>
					<div class="text-xl font-bold" style="color:#24b0ff;">{$teamStats.totalPostsThisMonth || 0}</div>
					<div class="text-xs" style="color:#94a3b8;">Posts This Month</div>
				</div>
				
				<div 
					class="rounded-lg p-3 text-center"
					style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
				>
					<div class="text-xl font-bold" style="color:#24b0ff;">{$teamStats.averageStreak || 0}</div>
					<div class="text-xs" style="color:#94a3b8;">Avg Streak</div>
				</div>
			</div>
		</div>
		
		<!-- Active Goals -->
		{#if $activeGoals && $activeGoals.length > 0}
			<div 
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<h3 class="text-xl font-semibold mb-4" style="color:#fdfdfd;">Team Goals</h3>
				
				<div class="space-y-4">
					{#each $activeGoals as goal}
						<div 
							class="rounded-lg p-4"
							style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);"
						>
							<div class="flex items-center justify-between mb-3">
								<div>
									<h4 class="font-semibold" style="color:#fdfdfd;">{goal.title}</h4>
									{#if goal.description}
										<p class="text-sm mt-1" style="color:#94a3b8;">{goal.description}</p>
									{/if}
								</div>
								<div class="text-right">
									<div class="text-sm" style="color:#94a3b8;">
										{getDaysRemaining(goal.endDate)} days left
									</div>
									<div class="text-xs" style="color:#94a3b8;">
										Ends {formatDate(goal.endDate)}
									</div>
								</div>
							</div>
							
							<ProgressBar 
								current={goal.currentValue}
								target={goal.targetValue}
								label={getGoalTypeLabel(goal.type)}
								color={goal.isCompleted ? '#22c55e' : '#24b0ff'}
							/>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div 
				class="rounded-xl p-6 shadow-lg backdrop-blur-md text-center"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<h3 class="text-xl font-semibold mb-2" style="color:#fdfdfd;">No Active Goals</h3>
				<p style="color:#94a3b8;">Your team doesn't have any active goals at the moment.</p>
			</div>
		{/if}
	</div>
{:else}
	<div 
		class="rounded-xl p-6 shadow-lg backdrop-blur-md text-center"
		style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
	>
		<h3 class="text-xl font-semibold mb-2" style="color:#fdfdfd;">No Team Assigned</h3>
		<p style="color:#94a3b8;">You haven't been assigned to a team yet. Contact your administrator.</p>
	</div>
{/if}