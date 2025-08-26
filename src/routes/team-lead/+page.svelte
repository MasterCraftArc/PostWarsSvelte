<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';
	import { goto } from '$app/navigation';

	let myTeam = null;
	let users = [];
	let loading = true;
	let error = '';
	let hasLoadedData = false;

	// Team member management
	let showMemberModal = false;
	let availableUsers = [];
	let selectedUserIds = [];

	// Reactive statement to handle team lead access when user becomes available
	$: {
		if ($user !== null) { // User auth has finished loading
			if (!$user || ($user.role !== 'TEAM_LEAD' && $user.role !== 'ADMIN')) {
				goto('/');
			} else if (!hasLoadedData) {
				// Only load data once when user is confirmed as team lead
				loadData();
			}
		}
	}

	onMount(() => {
		// onMount kept for any non-user dependent initialization
	});

	async function loadData() {
		loading = true;
		try {
			const [teamsData, usersData] = await Promise.all([
				authenticatedRequest('/api/admin/teams'),
				authenticatedRequest('/api/admin/users')
			]);
			
			console.log('🔍 Team Lead Debug:', {
				userId: $user.id,
				userRole: $user.role,
				totalTeams: teamsData.teams.length,
				teamsWithLeads: teamsData.teams.filter(t => t.teamLeadId).length
			});
			
			// Find the team this user leads
			myTeam = teamsData.teams.find(team => team.teamLeadId === $user.id);
			console.log('🎯 Found my team:', myTeam ? `${myTeam.name} (${myTeam.id})` : 'null');
			
			// Debug: Show all teams and their leads
			teamsData.teams.forEach(team => {
				console.log(`📋 Team: ${team.name}, Lead: ${team.teamLeadId}, Match: ${team.teamLeadId === $user.id}`);
			});
			
			users = usersData.users;
		} catch (err) {
			error = 'Network error';
		}
		loading = false;
		hasLoadedData = true;
	}

	function showAddMembers() {
		if (!myTeam) return;
		availableUsers = users.filter(user => !myTeam.members.some(member => member.id === user.id));
		selectedUserIds = [];
		showMemberModal = true;
	}

	async function addUsersToTeam() {
		if (!myTeam || selectedUserIds.length === 0) return;

		try {
			const response = await fetch(`/api/admin/teams/${myTeam.id}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userIds: selectedUserIds })
			});

			if (response.ok) {
				showMemberModal = false;
				await loadData();
			} else {
				const data = await response.json();
				alert('Error: ' + data.error);
			}
		} catch (err) {
			alert('Failed to add users to team');
		}
	}

	async function removeFromTeam(userId) {
		if (!confirm('Remove this user from your team?')) return;

		try {
			const response = await fetch(`/api/admin/teams/${myTeam.id}/members`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userIds: [userId] })
			});

			if (response.ok) {
				await loadData();
			} else {
				const data = await response.json();
				alert('Error: ' + data.error);
			}
		} catch (err) {
			alert('Failed to remove user from team');
		}
	}
</script>

<svelte:head>
	<title>Team Lead Dashboard</title>
</svelte:head>

{#if $user?.role !== 'TEAM_LEAD' && $user?.role !== 'ADMIN'}
	<div class="py-8 text-center">
		<div
			class="mx-auto max-w-xl rounded-xl px-4 py-3 shadow-lg backdrop-blur-md"
			style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff; color:#ff5456;"
		>
			<p>Access denied. Team Lead role required.</p>
		</div>
	</div>
{:else}
	<div class="container mx-auto px-4 py-8">
		<h1 class="mb-8 text-3xl font-bold" style="color:#fdfdfd;">Team Lead Dashboard</h1>

		{#if loading}
			<div class="py-8 text-center">
				<div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
				<p class="mt-3" style="color:#94a3b8;">Loading...</p>
			</div>
		{:else if error}
			<div class="py-8 text-center">
				<div
					class="mx-auto max-w-xl rounded-xl px-4 py-3 shadow-lg backdrop-blur-md"
					style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;"
				>
					{error}
				</div>
			</div>
		{:else if !myTeam}
			<div class="py-8 text-center">
				<p style="color:#cbd5e1;">You are not assigned as a team lead for any team.</p>
				<p class="text-sm" style="color:#94a3b8;">Contact your administrator to be assigned to a team.</p>
			</div>
		{:else}
			<!-- Team wrapper (GLASS) -->
			<div
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<div class="mb-6 flex items-start justify-between">
					<div>
						<h2 class="text-2xl font-semibold" style="color:#fdfdfd;">{myTeam.name}</h2>
						{#if myTeam.description}
							<p style="color:#cbd5e1;">{myTeam.description}</p>
						{/if}
						<div class="mt-2 text-sm" style="color:#94a3b8;">
							<span>Members: {myTeam.members.length}</span>
							<span class="ml-4">Active Goals: {myTeam.goals.length}</span>
						</div>
					</div>
					<button
						onclick={showAddMembers}
						class="rounded-md px-4 py-2 font-medium transition-colors hover:cursor-pointer"
						style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.6);"
					>
						Add Members
					</button>
				</div>

				<!-- Team Members -->
				<div class="mb-6">
					<h3 class="mb-4 text-lg font-medium" style="color:#fdfdfd;">Team Members</h3>
					{#if myTeam.members.length > 0}
						<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{#each myTeam.members as member}
								<div
									class="rounded-lg p-4 backdrop-blur-md"
									style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);"
								>
									<div class="flex items-start justify-between">
										<div>
											<h4 class="font-medium" style="color:#e5e7eb;">{member.name}</h4>
											<p class="text-sm" style="color:#cbd5e1;">{member.email}</p>
											<p class="text-xs" style="color:#94a3b8;">{member.role}</p>
										</div>
										<button
											onclick={() => removeFromTeam(member.id)}
											class="rounded px-2 text-sm transition-colors hover:cursor-pointer"
											title="Remove from team"
											style="color:#ff5456; border:1px solid rgba(255,84,86,0.5); background-color:rgba(255,84,86,0.12);"
										>
											×
										</button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p style="color:#cbd5e1;">No members assigned to this team yet.</p>
					{/if}
				</div>

				<!-- Team Goals -->
				<div>
					<h3 class="mb-4 text-lg font-medium" style="color:#fdfdfd;">Team Goals</h3>
					{#if myTeam.goals.length > 0}
						<div class="space-y-4">
							{#each myTeam.goals as goal}
								<div
									class="rounded-lg p-4 backdrop-blur-md"
									style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);"
								>
									<div class="flex items-start justify-between">
										<div>
											<h4 class="font-medium" style="color:#e5e7eb;">{goal.title}</h4>
											{#if goal.description}
												<p class="text-sm" style="color:#cbd5e1;">{goal.description}</p>
											{/if}
											<div class="mt-2 flex flex-wrap gap-4 text-sm" style="color:#94a3b8;">
												<span>Type: {goal.type.replace('_', ' ')}</span>
												<span>Target: {goal.targetValue}</span>
												<span>Current: {goal.currentValue}</span>
											</div>
										</div>

										<!-- Status badge (glass) -->
										{#if goal.status === 'ACTIVE'}
											<span
												class="rounded px-2 py-1 text-xs font-medium"
												style="background-color:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.6);"
											>
												{goal.status}
											</span>
										{:else if goal.status === 'COMPLETED'}
											<span
												class="rounded px-2 py-1 text-xs font-medium"
												style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.6);"
											>
												{goal.status}
											</span>
										{:else}
											<span
												class="rounded px-2 py-1 text-xs font-medium"
												style="background-color:rgba(255,84,86,0.12); color:#ff5456; border:1px solid rgba(255,84,86,0.6);"
											>
												{goal.status}
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p style="color:#cbd5e1;">No goals set for this team yet.</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- Add Members Modal -->
{#if showMemberModal && myTeam}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background-color:rgba(0,0,0,0.5);">
		<div
			class="max-w-md w-full rounded-xl p-6 shadow-xl backdrop-blur-md"
			style="background-color:rgba(16,35,73,0.6); border:1px solid #24b0ff;"
		>
			<h3 class="mb-4 text-lg font-medium" style="color:#fdfdfd;">Add Members to {myTeam.name}</h3>
			
			{#if availableUsers.length > 0}
				<div class="mb-4 max-h-60 overflow-y-auto rounded-lg"
					style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
					{#each availableUsers as user}
						<label class="flex items-center space-x-2 p-2 transition-colors"
							style="color:#cbd5e1;">
							<input
								type="checkbox"
								bind:group={selectedUserIds}
								value={user.id}
								class="rounded"
								style="accent-color:#24b0ff;"
							/>
							<span>{user.name} ({user.email}) - {user.role}</span>
						</label>
					{/each}
				</div>
				
				<div class="flex space-x-3">
					<button
						onclick={addUsersToTeam}
						disabled={selectedUserIds.length === 0}
						class="rounded-md px-4 py-2 font-medium transition-colors hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
						style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.6);"
					>
						Add Selected ({selectedUserIds.length})
					</button>
					<button
						onclick={() => showMemberModal = false}
						class="rounded-md px-4 py-2 font-medium transition-colors hover:cursor-pointer"
						style="background-color:rgba(148,163,184,0.15); color:#e5e7eb; border:1px solid rgba(148,163,184,0.5);"
					>
						Cancel
					</button>
				</div>
			{:else}
				<p class="mb-4" style="color:#cbd5e1;">No available users to add to this team.</p>
				<button
					onclick={() => showMemberModal = false}
					class="rounded-md px-4 py-2 font-medium transition-colors hover:cursor-pointer"
					style="background-color:rgba(148,163,184,0.15); color:#e5e7eb; border:1px solid rgba(148,163,184,0.5);"
				>
					Close
				</button>
			{/if}
		</div>
	</div>
{/if}
