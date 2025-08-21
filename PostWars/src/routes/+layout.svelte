<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AuthButtons from '$lib/components/AuthButtons.svelte';
	import { user } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	onMount(() => {
		if (data.user) {
			user.set(data.user);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-[#102349]">
	<header class="bg-[#102349] text-white border-b border-[#144a8f] shadow-sm rounded-b-lg">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between py-4">
				<div class="flex items-center space-x-8">
					
					
	
					<nav class="hidden space-x-6 md:flex items-center">
						<a
							href="/"
							class="text-[##fdfdfd] hover:text-white transition-colors mb-4"
						>
							<img src="src/lib/assets/defense-unicorns-horizontal-logo-white.svg" alt="">
						</a>
						<a
							href="/dashboard"
							class="text-[#fdfdfd] hover:text-[#24b0ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded"
						>Dashboard</a>
						<a
							href="/submit"
							class="text-[#fdfdfd] hover:text-[#24b0ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded"
						>Submit Post</a>
						<a
							href="/leaderboard"
							class="text-[#fdfdfd] hover:text-[#24b0ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded"
						>Leaderboard</a>
	
						{#if $user?.role === 'TEAM_LEAD'}
							<a
								href="/team-lead"
								class="text-[#fdfdfd] hover:text-[#24b0ff] font-mediumtransition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded"
							>My Team</a>
						{/if}
	
						{#if $user?.role === 'ADMIN'}
							<a
								href="/admin"
								class="text-[#24b0ff] font-medium hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded"
							>Admin</a>
						{/if}
					</nav>
				</div>
	
				<!-- Right side -->
				<div class="flex items-center">
					<AuthButtons />
				</div>
			</div>
		</div>
	</header>

	<main>
		{@render children?.()}
	</main>
</div>
