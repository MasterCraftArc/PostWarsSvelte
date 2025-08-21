<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { goto } from '$app/navigation';
	import Background from '$lib/assets/Hero-Desktop.webp';

	let teams = [];
	let users = [];
	let goals = [];
	let loading = true;
	let error = '';

	// Team creation form
	let showCreateTeam = false;
	let newTeam = { name: '', description: '', teamLeadId: '' };

	// Goal creation form
	let showCreateGoal = false;
	let newGoal = { 
		title: '', 
		description: '', 
		type: 'POSTS_COUNT', 
		targetValue: '', 
		teamId: '', 
		endDate: '' 
	};

	// Team member management
	let showMemberModal = false;
	let selectedTeam = null;
	let availableUsers = [];
	let selectedUserIds = [];

	onMount(async () => {
		if (!$user || $user.role !== 'ADMIN') {
			goto('/');
			return;
		}
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [teamsRes, usersRes, goalsRes] = await Promise.all([
				fetch('/api/admin/teams'),
				fetch('/api/admin/users'),
				fetch('/api/admin/goals')
			]);

			if (teamsRes.ok) teams = (await teamsRes.json()).teams;
			if (usersRes.ok) users = (await usersRes.json()).users;
			if (goalsRes.ok) goals = (await goalsRes.json()).goals;
		} catch (err) {
			error = 'Failed to load admin data';
		}
		loading = false;
	}

	async function createTeam() {
		try {
			const response = await fetch('/api/admin/teams', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newTeam)
			});

			if (response.ok) {
				newTeam = { name: '', description: '', teamLeadId: '' };
				showCreateTeam = false;
				await loadData();
			} else {
				const data = await response.json();
				alert('Error: ' + data.error);
			}
		} catch (err) {
			alert('Failed to create team');
		}
	}

	async function createGoal() {
		try {
			const response = await fetch('/api/admin/goals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newGoal)
			});

			if (response.ok) {
				newGoal = { 
					title: '', 
					description: '', 
					type: 'POSTS_COUNT', 
					targetValue: '', 
					teamId: '', 
					endDate: '' 
				};
				showCreateGoal = false;
				await loadData();
			} else {
				const data = await response.json();
				alert('Error: ' + data.error);
			}
		} catch (err) {
			alert('Failed to create goal');
		}
	}

	async function updateUserRole(userId, newRole) {
		try {
			const response = await fetch('/api/admin/users', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, role: newRole })
			});

			if (response.ok) {
				await loadData();
			} else {
				const data = await response.json();
				alert('Error: ' + data.error);
			}
		} catch (err) {
			alert('Failed to update user role');
		}
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString();
	}

	function showTeamMembers(team) {
		selectedTeam = team;
		availableUsers = users.filter(u => !team.members.some(m => m.id === u.id));
		selectedUserIds = [];
		showMemberModal = true;
	}

	async function addUsersToTeam() {
		if (!selectedTeam || selectedUserIds.length === 0) return;

		try {
			const response = await fetch(`/api/admin/teams/${selectedTeam.id}/members`, {
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

	async function removeFromTeam(teamId, userId) {
		if (!confirm('Remove this user from the team?')) return;

		try {
			const response = await fetch(`/api/admin/teams/${teamId}/members`, {
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
	<title>Admin Dashboard</title>
</svelte:head>

{#if $user?.role !== 'ADMIN'}
	<div class="py-8 text-center">
		<p class="text-red-400">Access denied. Admin role required.</p>
	</div>
{:else}
	<!-- Background -->
	<div class="relative min-h-screen overflow-hidden">
		<div class="pointer-events-none absolute inset-0">
			<div class="absolute inset-0" style="background: radial-gradient(60% 60% at 50% 20%, rgba(36,176,255,0.18) 0%, rgba(12,26,62,0.0) 60%);"></div>
			<img src={Background} alt="" class="h-full w-full object-cover opacity-20 mix-blend-screen" />
		</div>

		<!-- Content -->
		<div class="relative container mx-auto px-4 py-10">
			<h1 class="mb-8 text-3xl font-bold tracking-tight" style="color:#fdfdfd;">
				Admin Dashboard
			</h1>

			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div class="h-12 w-12 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
				</div>
			{:else if error}
				<div class="mb-6 rounded-xl backdrop-blur-md px-4 py-3"
					style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;">
					{error}
				</div>
			{:else}
				<div class="space-y-8">
					<!-- Teams Section -->
					<div class="rounded-xl p-6 shadow-lg backdrop-blur-md"
						style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;">
						<div class="mb-4 flex items-center justify-between">
							<h2 class="text-2xl font-semibold" style="color:#fdfdfd;">Teams</h2>
							<button
								on:click={() => showCreateTeam = true}
								class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
								style="background:linear-gradient(90deg,#1392d6,#24b0ff); box-shadow:0 0 10px rgba(36,176,255,.6);">
								Create Team
							</button>
						</div>

						{#if showCreateTeam}
							<div class="mb-6 rounded-lg p-4 backdrop-blur-md"
								style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
								<h3 class="mb-4 text-lg font-medium" style="color:#fdfdfd;">Create New Team</h3>
								<div class="space-y-4">
									<input
										bind:value={newTeam.name}
										placeholder="Team Name"
										class="w-full rounded-md px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									/>
									<textarea
										bind:value={newTeam.description}
										placeholder="Description (optional)"
										class="w-full rounded-md px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2"
										rows="3"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									></textarea>
									<select
										bind:value={newTeam.teamLeadId}
										class="w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									>
										<option value="" class="text-slate-900">Select Team Lead (optional)</option>
										{#each users.filter(u => u.role !== 'ADMIN') as u}
											<option value={u.id} class="text-slate-900">{u.name} ({u.email})</option>
										{/each}
									</select>
									<div class="flex gap-2">
										<button
											on:click={createTeam}
											class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
											style="background:linear-gradient(90deg,#16a34a,#22c55e); box-shadow:0 0 10px rgba(34,197,94,.45);">
											Create
										</button>
										<button
											on:click={() => showCreateTeam = false}
											class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
											style="background:linear-gradient(90deg,#6b7280,#9ca3af);">
											Cancel
										</button>
									</div>
								</div>
							</div>
						{/if}

						<div class="space-y-4">
							{#each teams as team}
								<div class="rounded-lg p-4 backdrop-blur-md"
									style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
									<div class="flex items-start justify-between">
										<div>
											<h3 class="text-lg font-medium" style="color:#fdfdfd;">{team.name}</h3>
											{#if team.description}
												<p class="mt-1 text-sm" style="color:#cbd5e1;">{team.description}</p>
											{/if}
											<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" style="color:#94a3b8;">
												<span>Members: {team._count.members}</span>
												<span>Active Goals: {team._count.goals}</span>
												{#if team.teamLead}
													<span>Lead: {team.teamLead.name}</span>
												{/if}
											</div>
										</div>
										<button
											on:click={() => showTeamMembers(team)}
											class="rounded-md px-3 py-1.5 text-sm text-white transition hover:brightness-110"
											style="background:linear-gradient(90deg,#7e22ce,#a855f7); box-shadow:0 0 10px rgba(168,85,247,.45);">
											Manage Members
										</button>
									</div>

									{#if team.members && team.members.length > 0}
										<div class="mt-4 border-t border-slate-700/40 pt-4">
											<h4 class="mb-2 text-sm font-medium" style="color:#cbd5e1;">Current Members:</h4>
											<div class="flex flex-wrap gap-2">
												{#each team.members as member}
													<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
														style="background-color:rgba(36,176,255,0.12); color:#24b0ff; border:1px solid rgba(36,176,255,0.35);">
														{member.name} ({member.role})
														<button
															on:click={() => removeFromTeam(team.id, member.id)}
															class="ml-1 transition hover:scale-110"
															style="color:#24b0ff;">
															×
														</button>
													</span>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<!-- Goals Section -->
					<div class="rounded-xl p-6 shadow-lg backdrop-blur-md"
						style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;">
						<div class="mb-4 flex items-center justify-between">
							<h2 class="text-2xl font-semibold" style="color:#fdfdfd;">Goals</h2>
							<button
								on:click={() => showCreateGoal = true}
								class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
								style="background:linear-gradient(90deg,#16a34a,#22c55e); box-shadow:0 0 10px rgba(34,197,94,.45);">
								Create Goal
							</button>
						</div>

						{#if showCreateGoal}
							<div class="mb-6 rounded-lg p-4 backdrop-blur-md"
								style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
								<h3 class="mb-4 text-lg font-medium" style="color:#fdfdfd;">Create New Goal</h3>
								<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
									<input
										bind:value={newGoal.title}
										placeholder="Goal Title"
										class="rounded-md px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									/>
									<select
										bind:value={newGoal.type}
										class="rounded-md px-3 py-2 focus:outline-none focus:ring-2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									>
										<option value="POSTS_COUNT" class="text-slate-900">Posts Count</option>
										<option value="TOTAL_ENGAGEMENT" class="text-slate-900">Total Engagement</option>
										<option value="AVERAGE_ENGAGEMENT" class="text-slate-900">Average Engagement</option>
										<option value="TEAM_SCORE" class="text-slate-900">Team Score</option>
									</select>
									<input
										bind:value={newGoal.targetValue}
										type="number"
										placeholder="Target Value"
										class="rounded-md px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									/>
									<select
										bind:value={newGoal.teamId}
										class="rounded-md px-3 py-2 focus:outline-none focus:ring-2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									>
										<option value="" class="text-slate-900">Select Team</option>
										{#each teams as team}
											<option value={team.id} class="text-slate-900">{team.name}</option>
										{/each}
									</select>
									<input
										bind:value={newGoal.endDate}
										type="date"
										class="rounded-md px-3 py-2 focus:outline-none focus:ring-2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									/>
									<textarea
										bind:value={newGoal.description}
										placeholder="Description (optional)"
										class="rounded-md px-3 py-2 md:col-span-2 placeholder-slate-400 focus:outline-none focus:ring-2"
										rows="2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									></textarea>
								</div>
								<div class="mt-4 flex gap-2">
									<button
										on:click={createGoal}
										class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
										style="background:linear-gradient(90deg,#16a34a,#22c55e); box-shadow:0 0 10px rgba(34,197,94,.45);">
										Create
									</button>
									<button
										on:click={() => showCreateGoal = false}
										class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
										style="background:linear-gradient(90deg,#6b7280,#9ca3af);">
										Cancel
									</button>
								</div>
							</div>
						{/if}

						<div class="space-y-4">
							{#each goals as goal}
								<div class="rounded-lg p-4 backdrop-blur-md"
									style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
									<div class="flex items-start justify-between">
										<div>
											<h3 class="text-lg font-medium" style="color:#fdfdfd;">{goal.title}</h3>
											{#if goal.description}
												<p class="mt-1 text-sm" style="color:#cbd5e1;">{goal.description}</p>
											{/if}
											<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" style="color:#94a3b8;">
												<span>Type: {goal.type.replace('_', ' ')}</span>
												<span>Target: {goal.targetValue}</span>
												<span>Current: {goal.currentValue}</span>
												<span>Team: {goal.team.name}</span>
												<span>Due: {formatDate(goal.endDate)}</span>
											</div>
										</div>
										<!-- Status pill (uses style ternary to avoid invalid class JS) -->
										<span
											class="rounded px-2 py-1 text-xs font-medium"
											style={`${
												goal.status === 'ACTIVE'
													? 'background-color:rgba(34,197,94,0.12); color:#22c55e; border:1px solid rgba(34,197,94,0.4);'
													: goal.status === 'COMPLETED'
													? 'background-color:rgba(36,176,255,0.12); color:#24b0ff; border:1px solid rgba(36,176,255,0.4);'
													: 'background-color:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.4);'
											}`}>
											{goal.status}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Users Section -->
					<div class="rounded-xl p-6 shadow-lg backdrop-blur-md"
						style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;">
						<h2 class="mb-4 text-2xl font-semibold" style="color:#fdfdfd;">Users</h2>
						<div class="overflow-x-auto rounded-lg"
							style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
							<table class="min-w-full table-auto">
								<thead>
									<tr class="border-b" style="border-color:rgba(36,176,255,0.25);">
										<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">Name</th>
										<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">Email</th>
										<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">Role</th>
										<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">Team</th>
										<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">Score</th>
										<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each users as u}
										<tr class="transition hover:bg-white/5 border-b" style="border-color:rgba(36,176,255,0.15);">
											<td class="px-4 py-3" style="color:#fdfdfd;">{u.name}</td>
											<td class="px-4 py-3" style="color:#cbd5e1;">{u.email}</td>
											<td class="px-4 py-3">
												<select
													value={u.role}
													on:change={(e) => updateUserRole(u.id, e.target.value)}
													class="rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2"
													style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
												>
													<option value="REGULAR" class="text-slate-900">Regular</option>
													<option value="TEAM_LEAD" class="text-slate-900">Team Lead</option>
													<option value="ADMIN" class="text-slate-900">Admin</option>
												</select>
											</td>
											<td class="px-4 py-3" style="color:#cbd5e1;">{u.team?.name || 'No team'}</td>
											<td class="px-4 py-3" style="color:#fdfdfd;">{u.totalScore}</td>
											<td class="px-4 py-3">
												<button
													class="text-sm underline-offset-2 transition hover:underline"
													style="color:#24b0ff;">
													Manage
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Team Member Management Modal -->
{#if showMemberModal && selectedTeam}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
		<div class="w-full max-w-md rounded-xl p-6 shadow-2xl backdrop-blur-md"
			style="background-color:rgba(16,35,73,0.6); border:1px solid #24b0ff;">
			<h3 class="mb-4 text-lg font-medium" style="color:#fdfdfd;">Add Members to {selectedTeam.name}</h3>

			{#if availableUsers.length > 0}
				<div class="mb-4 max-h-60 overflow-y-auto rounded-md"
					style="border:1px solid rgba(36,176,255,0.25);">
					{#each availableUsers as au}
						<label class="flex items-center gap-2 p-2 transition hover:bg-white/5">
							<input
								type="checkbox"
								bind:group={selectedUserIds}
								value={au.id}
								class="rounded border-slate-500"
							/>
							<span style="color:#cbd5e1;">{au.name} ({au.email}) - {au.role}</span>
						</label>
					{/each}
				</div>

				<div class="flex gap-3">
					<button
						on:click={addUsersToTeam}
						disabled={selectedUserIds.length === 0}
						class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
						style="background:linear-gradient(90deg,#1392d6,#24b0ff); box-shadow:0 0 10px rgba(36,176,255,.6);">
						Add Selected ({selectedUserIds.length})
					</button>
					<button
						on:click={() => showMemberModal = false}
						class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
						style="background:linear-gradient(90deg,#6b7280,#9ca3af);">
						Cancel
					</button>
				</div>
			{:else}
				<p class="mb-4" style="color:#cbd5e1;">No available users to add to this team.</p>
				<button
					on:click={() => showMemberModal = false}
					class="rounded-lg px-4 py-2 text-white transition hover:brightness-110"
					style="background:linear-gradient(90deg,#6b7280,#9ca3af);">
					Close
				</button>
			{/if}
		</div>
	</div>
{/if}
