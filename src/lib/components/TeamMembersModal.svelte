<script>
	import { authenticatedRequest } from '$lib/api.js';

	let isOpen = $state(false);
	let teamData = $state(null);
	let loading = $state(false);
	let error = $state('');

	export function openModal(teamId) {
		isOpen = true;
		loadTeamMembers(teamId);
	}

	export function closeModal() {
		isOpen = false;
		teamData = null;
		error = '';
	}

	async function loadTeamMembers(teamId) {
		loading = true;
		error = '';

		try {
			const data = await authenticatedRequest(`/api/teams/${teamId}/members`);
			teamData = data;
		} catch (err) {
			error = err.message || 'Failed to load team members';
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

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function navigateToUser(userId) {
		window.location.href = `/user/${userId}`;
	}
</script>

{#if isOpen}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
	>
		<!-- Modal Content -->
		<div
			class="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl backdrop-blur-md"
			style="background-color: rgba(16, 35, 73, 0.95); border: 2px solid #24b0ff; box-shadow: 0 0 30px rgba(36, 176, 255, 0.3);"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-[#24b0ff]/30">
				<div>
					{#if teamData?.team}
						<h2 class="text-xl font-bold text-white">🏆 {teamData.team.name}</h2>
						<p class="text-sm text-[#94a3b8]">{teamData.members?.length || 0} team members</p>
					{:else}
						<h2 class="text-xl font-bold text-white">Team Members</h2>
					{/if}
				</div>
				<button
					onclick={closeModal}
					class="p-2 rounded-lg hover:bg-white/10 transition-colors"
					aria-label="Close modal"
				>
					<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-6 overflow-y-auto max-h-[60vh]">
				{#if loading}
					<div class="flex items-center justify-center py-12">
						<div
							class="w-12 h-12 border-b-2 rounded-full animate-spin"
							style="border-color: #24b0ff;"
						></div>
					</div>
				{:else if error}
					<div
						class="px-4 py-3 rounded"
						style="border: 1px solid #ff5456; background-color: rgba(255, 84, 86, 0.12); color: #ff5456;"
					>
						{error}
					</div>
				{:else if teamData?.members}
					<div class="space-y-3">
						{#each teamData.members as member, index}
							<button
								onclick={() => navigateToUser(member.id)}
								class="w-full flex items-center justify-between rounded-lg p-4 transition-all duration-200 hover:scale-[1.02] hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#24b0ff]/50"
								style="background-color: rgba(36, 176, 255, 0.08); border: 1px solid rgba(36, 176, 255, 0.25);"
							>
								<!-- Rank -->
								<div class="w-12 text-center">
									<div class="text-lg font-bold" style="color: #24b0ff;">
										{getRankIcon(index + 1)}
									</div>
								</div>

								<!-- Member Info -->
								<div class="flex-1 min-w-0 ml-4">
									<div class="font-semibold truncate text-white">
										{member.name || member.email}
									</div>
									<div class="text-xs truncate text-[#94a3b8]">
										Current streak: {member.currentStreak || 0} • Best: {member.bestStreak || 0}
									</div>
								</div>

								<!-- Score -->
								<div class="text-right">
									<div class="text-lg font-bold text-white">
										{member.totalScore?.toLocaleString() || 0}
									</div>
									<div class="text-xs text-[#94a3b8]">points</div>
								</div>
							</button>
						{/each}
					</div>

					{#if teamData.members.length === 0}
						<div class="py-8 text-center text-[#94a3b8]">
							No team members found.
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}