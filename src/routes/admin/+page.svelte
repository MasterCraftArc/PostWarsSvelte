<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';
	import { goto } from '$app/navigation';

	let teams = [];
	let users = [];
	let goals = [];
	let posts = [];
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
		endDate: '',
		isRace: false
	};

	// Post metrics editing
	let showEditMetrics = false;
	let selectedPost = null;
	let editedMetrics = { reactions: 0, comments: 0, reposts: 0, reason: '' };

	// Team member management
	let showMemberModal = false;
	let selectedTeam = null;
	let availableUsers = [];
	let selectedUserIds = [];

	// Reactive statement to handle admin access when user becomes available
	$: {
		if ($user !== null) { // User auth has finished loading
			if (!$user || $user.role !== 'ADMIN') {
				goto('/');
			} else if (!users.length && !teams.length && !goals.length) {
				// Only load data once when user is confirmed as admin
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
			const [teamsData, usersData, goalsData, postsData] = await Promise.all([
				authenticatedRequest('/api/admin/teams'),
				authenticatedRequest('/api/admin/users'),
				authenticatedRequest('/api/admin/goals'),
				authenticatedRequest('/api/admin/posts')
			]);

			teams = teamsData.teams || [];
			users = usersData.users || [];
			goals = goalsData.goals || [];
			posts = postsData.posts || [];
		} catch (err) {
			error = err.message || 'Failed to load admin data';
		}
		loading = false;
	}

	async function createTeam() {
		try {
			await authenticatedRequest('/api/admin/teams', {
				method: 'POST',
				body: JSON.stringify(newTeam)
			});

			newTeam = { name: '', description: '', teamLeadId: '' };
			showCreateTeam = false;
			await loadData();
		} catch (err) {
			alert('Error: ' + err.message);
		}
	}

	async function createGoal() {
		try {
			await authenticatedRequest('/api/admin/goals', {
				method: 'POST',
				body: JSON.stringify(newGoal)
			});

			newGoal = {
				title: '',
				description: '',
				type: 'POSTS_COUNT',
				targetValue: '',
				teamId: '',
				endDate: '',
				isRace: false
			};
			showCreateGoal = false;
			await loadData();
		} catch (err) {
			alert('Error: ' + err.message);
		}
	}

	async function updateUserRole(userId, newRole) {
		try {
			await authenticatedRequest('/api/admin/users', {
				method: 'PATCH',
				body: JSON.stringify({ userId, role: newRole })
			});

			await loadData();
		} catch (err) {
			alert('Error: ' + err.message);
		}
	}

	async function updateUserTeam(userId, newTeamId) {
		try {
			await authenticatedRequest('/api/admin/users', {
				method: 'PATCH',
				body: JSON.stringify({ userId, teamId: newTeamId })
			});

			await loadData();
		} catch (err) {
			alert('Error: ' + err.message);
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
			await authenticatedRequest(`/api/admin/teams/${selectedTeam.id}/members`, {
				method: 'POST',
				body: JSON.stringify({ userIds: selectedUserIds })
			});

			// Success - authenticatedRequest throws on error
			showMemberModal = false;
			await loadData();
		} catch (err) {
			alert('Failed to add users to team');
		}
	}

	async function removeFromTeam(teamId, userId) {
		if (!confirm('Remove this user from the team?')) return;

		try {
			await authenticatedRequest(`/api/admin/teams/${teamId}/members`, {
				method: 'DELETE',
				body: JSON.stringify({ userIds: [userId] })
			});

			// Success - authenticatedRequest throws on error
			await loadData();
		} catch (err) {
			alert('Failed to remove user from team');
		}
	}

	async function deleteTeam(teamId, teamName) {
		if (!confirm(`Are you sure you want to delete team "${teamName}"? This will remove all members and delete all associated goals. This action cannot be undone.`)) return;
		try {
			await authenticatedRequest('/api/admin/teams', {
				method: 'DELETE',
				body: JSON.stringify({ id: teamId })
			});
			
			await loadData();
		} catch (err) {
			alert('Failed to delete team: ' + err.message);
		}
	}

	async function deleteUser(userId, userName) {
		if (!confirm(`Are you sure you want to delete user "${userName}"? This will delete all their posts and achievements. This action cannot be undone.`)) return;
		try {
			await authenticatedRequest('/api/admin/users', {
				method: 'DELETE',
				body: JSON.stringify({ id: userId })
			});
			
			await loadData();
		} catch (err) {
			alert('Failed to delete user: ' + err.message);
		}
	}

	async function deleteGoal(goalId, goalTitle) {
		if (!confirm(`Are you sure you want to delete goal "${goalTitle}"? This action cannot be undone.`)) return;
		try {
			await authenticatedRequest('/api/admin/goals', {
				method: 'DELETE',
				body: JSON.stringify({ id: goalId })
			});
			
			await loadData();
		} catch (err) {
			alert('Failed to delete goal: ' + err.message);
		}
	}

	function openEditMetrics(post) {
		selectedPost = post;
		editedMetrics = {
			reactions: post.reactions,
			comments: post.comments,
			reposts: post.reposts,
			reason: ''
		};
		showEditMetrics = true;
	}

	async function updatePostMetrics() {
		try {
			await authenticatedRequest('/api/admin/posts/update-metrics', {
				method: 'POST',
				body: JSON.stringify({
					postId: selectedPost.id,
					reactions: editedMetrics.reactions,
					comments: editedMetrics.comments,
					reposts: editedMetrics.reposts,
					reason: editedMetrics.reason
				})
			});

			showEditMetrics = false;
			selectedPost = null;
			await loadData();
			alert('Post metrics updated successfully');
		} catch (err) {
			alert('Error updating metrics: ' + err.message);
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
	<!-- Content -->
	<div class="container mx-auto px-4 py-10">
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
								onclick={() => showCreateTeam = true}
								class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
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
									<div class="flex flex-col sm:flex-row gap-2">
										<button
											onclick={createTeam}
											class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
											style="background:linear-gradient(90deg,#16a34a,#22c55e); box-shadow:0 0 10px rgba(34,197,94,.45);">
											Create
										</button>
										<button
											onclick={() => showCreateTeam = false}
											class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
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

											<!-- Team Statistics -->
											{#if team.members && team.members.length > 0}
												{@const totalScore = team.members.reduce((sum, m) => sum + (m.totalScore || 0), 0)}
												{@const avgScore = Math.round(totalScore / team.members.length)}
												{@const topPerformer = team.members.reduce((top, m) => (m.totalScore || 0) > (top.totalScore || 0) ? m : top, team.members[0])}
												<div class="mt-3 rounded-md p-3" style="background-color:rgba(36,176,255,0.08); border:1px solid rgba(36,176,255,0.25);">
													<h4 class="mb-2 text-sm font-medium" style="color:#24b0ff;">Team Performance</h4>
													<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
														<div class="text-center">
															<div class="font-semibold" style="color:#fdfdfd;">{totalScore.toLocaleString()}</div>
															<div style="color:#94a3b8;">Total Score</div>
														</div>
														<div class="text-center">
															<div class="font-semibold" style="color:#fdfdfd;">{avgScore.toLocaleString()}</div>
															<div style="color:#94a3b8;">Avg Score</div>
														</div>
														<div class="text-center">
															<div class="font-semibold" style="color:#fdfdfd;">{topPerformer.name}</div>
															<div style="color:#94a3b8;">Top Performer</div>
														</div>
													</div>
												</div>
											{/if}
										</div>
										<div class="flex flex-col sm:flex-row gap-2">
											<button
												onclick={() => deleteTeam(team.id, team.name)}
												class="rounded-md px-3 py-1.5 text-sm text-white transition hover:brightness-110 hover:cursor-pointer"
												style="background:linear-gradient(90deg,#dc2626,#ef4444); box-shadow:0 0 10px rgba(239,68,68,.45);">
												Delete
											</button>
										</div>
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
															onclick={() => removeFromTeam(team.id, member.id)}
															class="ml-1 transition hover:scale-110 hover:cursor-pointer"
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
								onclick={() => showCreateGoal = true}
								class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
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
										<option value="company" class="text-slate-900">🏢 Company-wide Goal</option>
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
									<div class="flex items-center space-x-3 p-3 rounded-md"
										style="background-color:rgba(255,165,0,0.1); border:1px solid rgba(255,165,0,0.3);">
										<input
											bind:checked={newGoal.isRace}
											type="checkbox"
											id="isRace"
											class="w-4 h-4 accent-orange-500"
										/>
										<label for="isRace" class="text-sm font-medium" style="color:#ffa500;">
											🏁 Team Race Goal (All teams compete toward same target)
										</label>
									</div>
									<textarea
										bind:value={newGoal.description}
										placeholder="Description (optional)"
										class="rounded-md px-3 py-2 md:col-span-2 placeholder-slate-400 focus:outline-none focus:ring-2"
										rows="2"
										style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
									></textarea>
								</div>
								<div class="mt-4 flex flex-col sm:flex-row gap-2">
									<button
										onclick={createGoal}
										class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
										style="background:linear-gradient(90deg,#16a34a,#22c55e); box-shadow:0 0 10px rgba(34,197,94,.45);">
										Create
									</button>
									<button
										onclick={() => showCreateGoal = false}
										class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
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
												<span>Team: {goal.teamId === 'company-team-id' ? '🏢 Company-wide' : goal.team?.name || 'Unknown'}</span>
												<span>Due: {formatDate(goal.endDate)}</span>
											</div>
										</div>
										<div class="flex items-center gap-2">
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
											<button
												onclick={() => deleteGoal(goal.id, goal.title)}
												class="rounded px-2 py-1 text-xs text-white transition hover:brightness-110 hover:cursor-pointer"
												style="background:linear-gradient(90deg,#dc2626,#ef4444);">
												Delete
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Posts Management Section -->
					<div class="rounded-xl p-6 shadow-lg backdrop-blur-md"
						style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;">
						<h2 class="mb-4 text-2xl font-semibold" style="color:#fdfdfd;">Posts Management</h2>
						
						{#if posts.length > 0}
							<div class="overflow-x-auto rounded-lg max-h-96 overflow-y-auto"
								style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.35);">
								<table class="min-w-full table-auto">
									<thead class="sticky top-0" style="background-color:rgba(16,35,73,0.95);">
										<tr class="border-b" style="border-color:rgba(36,176,255,0.25);">
											<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">User</th>
											<th class="px-4 py-3 text-left text-sm font-semibold" style="color:#cbd5e1;">Posted</th>
											<th class="px-4 py-3 text-center text-sm font-semibold" style="color:#cbd5e1;">Reactions</th>
											<th class="px-4 py-3 text-center text-sm font-semibold" style="color:#cbd5e1;">Comments</th>
											<th class="px-4 py-3 text-center text-sm font-semibold" style="color:#cbd5e1;">Reposts</th>
											<th class="px-4 py-3 text-center text-sm font-semibold" style="color:#cbd5e1;">Total</th>
											<th class="px-4 py-3 text-center text-sm font-semibold" style="color:#cbd5e1;">Score</th>
											<th class="px-4 py-3 text-center text-sm font-semibold" style="color:#cbd5e1;">Actions</th>
										</tr>
									</thead>
									<tbody>
										{#each posts as post}
											<tr class="transition hover:bg-white/5 border-b" style="border-color:rgba(36,176,255,0.15);">
												<td class="px-4 py-3">
													<div>
														<div style="color:#fdfdfd;" class="font-medium">{post.userName}</div>
														<div style="color:#94a3b8;" class="text-xs">{post.userEmail}</div>
													</div>
												</td>
												<td class="px-4 py-3">
													<div style="color:#cbd5e1;" class="text-sm">
														{new Date(post.postedAt).toLocaleDateString()}
													</div>
													<div style="color:#94a3b8;" class="text-xs">
														{new Date(post.postedAt).toLocaleTimeString()}
													</div>
												</td>
												<td class="px-4 py-3 text-center" style="color:#fdfdfd;">
													{(post.reactions || 0).toLocaleString()}
												</td>
												<td class="px-4 py-3 text-center" style="color:#fdfdfd;">
													{(post.comments || 0).toLocaleString()}
												</td>
												<td class="px-4 py-3 text-center" style="color:#fdfdfd;">
													{(post.reposts || 0).toLocaleString()}
												</td>
												<td class="px-4 py-3 text-center font-semibold" style="color:#22c55e;">
													{(post.totalEngagement || 0).toLocaleString()}
												</td>
												<td class="px-4 py-3 text-center font-semibold" style="color:#fbbf24;">
													{(post.totalScore || 0).toLocaleString()}
												</td>
												<td class="px-4 py-3 text-center">
													<button
														onclick={() => openEditMetrics(post)}
														class="rounded-lg px-3 py-1 text-xs text-white transition hover:brightness-110 hover:cursor-pointer"
														style="background:linear-gradient(90deg,#1392d6,#24b0ff);">
														Edit Metrics
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<div class="py-8 text-center" style="color:#94a3b8;">
								No posts found.
							</div>
						{/if}

						<!-- Edit Metrics Modal -->
						{#if showEditMetrics && selectedPost}
							<div class="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm"
								style="background-color:rgba(0,0,0,0.5);">
								<div class="w-full max-w-md rounded-xl p-6 shadow-2xl backdrop-blur-md"
									style="background-color:rgba(255,255,255,0.95); border:2px solid #24b0ff;">
									<h3 class="mb-4 text-xl font-bold" style="color:#102349;">Edit Post Metrics</h3>
									
									<div class="mb-4 p-3 rounded-lg" style="background-color:rgba(36,176,255,0.1);">
										<div class="text-sm" style="color:#102349;">
											<strong>User:</strong> {selectedPost.userName}
										</div>
										<div class="text-sm mt-1" style="color:#102349;">
											<strong>Posted:</strong> {new Date(selectedPost.postedAt).toLocaleString()}
										</div>
									</div>

									<div class="space-y-4">
										<div>
											<label class="block text-sm font-medium mb-1" style="color:#102349;">
												Reactions ({(selectedPost.reactions || 0).toLocaleString()} → {(editedMetrics.reactions || 0).toLocaleString()})
											</label>
											<input
												type="number"
												bind:value={editedMetrics.reactions}
												min="0"
												max="100000"
												class="w-full rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2"
												style="border:1px solid #24b0ff; --tw-ring-color:#24b0ff;"
											/>
										</div>
										
										<div>
											<label class="block text-sm font-medium mb-1" style="color:#102349;">
												Comments ({(selectedPost.comments || 0).toLocaleString()} → {(editedMetrics.comments || 0).toLocaleString()})
											</label>
											<input
												type="number"
												bind:value={editedMetrics.comments}
												min="0"
												max="10000"
												class="w-full rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2"
												style="border:1px solid #24b0ff; --tw-ring-color:#24b0ff;"
											/>
										</div>
										
										<div>
											<label class="block text-sm font-medium mb-1" style="color:#102349;">
												Reposts ({(selectedPost.reposts || 0).toLocaleString()} → {(editedMetrics.reposts || 0).toLocaleString()})
											</label>
											<input
												type="number"
												bind:value={editedMetrics.reposts}
												min="0"
												max="5000"
												class="w-full rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2"
												style="border:1px solid #24b0ff; --tw-ring-color:#24b0ff;"
											/>
										</div>
										
										<div>
											<label class="block text-sm font-medium mb-1" style="color:#102349;">
												Reason for Change
											</label>
											<textarea
												bind:value={editedMetrics.reason}
												placeholder="e.g., Correcting scraping error"
												rows="2"
												class="w-full rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2"
												style="border:1px solid #24b0ff; --tw-ring-color:#24b0ff;"
											></textarea>
										</div>
										
										<div class="flex flex-col sm:flex-row gap-2 mt-6">
											<button
												onclick={updatePostMetrics}
												class="flex-1 rounded-lg px-4 py-2 text-white font-semibold transition hover:brightness-110 hover:cursor-pointer"
												style="background:linear-gradient(90deg,#16a34a,#22c55e); box-shadow:0 0 10px rgba(34,197,94,.45);">
												Update Metrics
											</button>
											<button
												onclick={() => showEditMetrics = false}
												class="flex-1 rounded-lg px-4 py-2 text-white font-semibold transition hover:brightness-110 hover:cursor-pointer"
												style="background:linear-gradient(90deg,#6b7280,#9ca3af);">
												Cancel
											</button>
										</div>
									</div>
								</div>
							</div>
						{/if}
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
													onchange={(e) => updateUserRole(u.id, e.target.value)}
													class="rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 hover:cursor-pointer"
													style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
												>
													<option value="REGULAR" class="text-slate-900">Regular</option>
													<option value="TEAM_LEAD" class="text-slate-900">Team Lead</option>
													<option value="ADMIN" class="text-slate-900">Admin</option>
												</select>
											</td>
											<td class="px-4 py-3">
												<select
													value={u.teamId || ''}
													onchange={(e) => updateUserTeam(u.id, e.target.value || null)}
													class="rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 hover:cursor-pointer"
													style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
												>
													<option value="" class="text-slate-900">No Team</option>
													{#each teams.filter(t => t.id !== 'company-team-id' && t.name !== 'Company') as team}
														<option value={team.id} class="text-slate-900">{team.name}</option>
													{/each}
												</select>
											</td>
											<td class="px-4 py-3" style="color:#fdfdfd;">{u.totalScore}</td>
											<td class="px-4 py-3">
												<div class="flex flex-col sm:flex-row gap-2">
													<button
														onclick={() => deleteUser(u.id, u.name)}
														class="rounded px-2 py-1 text-xs text-white transition hover:brightness-110 hover:cursor-pointer"
														style="background:linear-gradient(90deg,#dc2626,#ef4444);">
														Delete
													</button>
												</div>
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
						onclick={addUsersToTeam}
						disabled={selectedUserIds.length === 0}
						class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
						style="background:linear-gradient(90deg,#1392d6,#24b0ff); box-shadow:0 0 10px rgba(36,176,255,.6);">
						Add Selected ({selectedUserIds.length})
					</button>
					<button
						onclick={() => showMemberModal = false}
						class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
						style="background:linear-gradient(90deg,#6b7280,#9ca3af);">
						Cancel
					</button>
				</div>
			{:else}
				<p class="mb-4" style="color:#cbd5e1;">No available users to add to this team.</p>
				<button
					onclick={() => showMemberModal = false}
					class="rounded-lg px-4 py-2 text-white transition hover:brightness-110 hover:cursor-pointer"
					style="background:linear-gradient(90deg,#6b7280,#9ca3af);">
					Close
				</button>
			{/if}
		</div>
	</div>
{/if}
