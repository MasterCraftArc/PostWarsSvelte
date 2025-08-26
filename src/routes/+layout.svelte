<script>
	import '../app.css';
	import favicon from '$lib/assets/doug.svg';
	import AuthButtons from '$lib/components/AuthButtons.svelte';
	import { user } from '$lib/stores/auth.js';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Background from '$lib/assets/Hero-Desktop.webp';
	import DefenseUnicornsLogo from '$lib/assets/defense-unicorns-horizontal-logo-white.svg';

	let { children, data } = $props();
	let mobileMenuOpen = $state(false);
	
	// Hide nav completely only on home page
	let shouldHideNav = $derived($page.route?.id === '/');
	// Show simplified nav (logo only) on login/signup pages
	let isAuthPage = $derived($page.route?.id === '/login' || $page.route?.id === '/signup');

	// Removed server-side user override - let client-side auth store handle user state

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Background Container with Image and Gradient -->
<div class="relative min-h-screen overflow-hidden bg-[#102349]">
	<!-- Background Image with Gradient Overlay -->
	<div class="pointer-events-none absolute inset-0">
		<div class="absolute inset-0" style="background: radial-gradient(60% 60% at 50% 20%, rgba(36,176,255,0.18) 0%, rgba(12,26,62,0.0) 60%);"></div>
		<img src={Background} alt="" class="h-full w-full object-cover opacity-20 mix-blend-screen" />
	</div>

	<!-- Content Container -->
	<div class="relative z-10">
		<header class="bg-transparent text-white border-b border-[#144a8f]/40 shadow-sm rounded-b-lg backdrop-blur-sm" class:invisible={shouldHideNav}>
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between py-4">
					<!-- Logo -->
					<div class="flex items-center">
						<a href="/" class="flex-shrink-0">
							<img src={DefenseUnicornsLogo} alt="Defense Unicorns" class="h-8 w-auto">
						</a>
					</div>

					{#if !isAuthPage}
						<!-- Desktop Navigation -->
						<nav class="hidden md:flex items-center space-x-6">
							<a
								href="/dashboard"
								class="text-[#fdfdfd] hover:text-[#24b0ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded px-3 py-2"
							>Dashboard</a>
							<a
								href="/submit"
								class="text-[#fdfdfd] hover:text-[#24b0ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded px-3 py-2"
							>Submit Post</a>
							<a
								href="/leaderboard"
								class="text-[#fdfdfd] hover:text-[#24b0ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded px-3 py-2"
							>Leaderboard</a>

							{#if $user?.role === 'TEAM_LEAD'}
								<a
									href="/team-lead"
									class="text-[#fdfdfd] hover:text-[#24b0ff] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded px-3 py-2"
								>My Team</a>
							{/if}

							{#if $user?.role === 'ADMIN'}
								<a
									href="/admin"
									class="text-[#24b0ff] font-medium hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24b0ff] rounded px-3 py-2"
								>Admin</a>
							{/if}
						</nav>
					{/if}

					<!-- Desktop Auth Buttons (always visible) -->
					<div class="hidden md:flex items-center">
						<AuthButtons />
					</div>

					{#if !isAuthPage}
						<!-- Mobile menu button -->
						<div class="md:hidden">
							<button
								onclick={toggleMobileMenu}
								class="inline-flex items-center justify-center p-2 rounded-md text-[#fdfdfd] hover:text-[#24b0ff] hover:bg-[#1e3a8a]/20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#24b0ff] transition-colors hover:cursor-pointer"
								aria-expanded="false"
							>
								<span class="sr-only">Open main menu</span>
								{#if !mobileMenuOpen}
									<!-- Hamburger icon -->
									<svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
									</svg>
								{:else}
									<!-- X icon -->
									<svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								{/if}
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Mobile menu -->
			{#if mobileMenuOpen}
				<div class="md:hidden">
					<div class="px-2 pt-2 pb-3 space-y-1 bg-[#0f1f3d]/80 border-t border-[#144a8f] backdrop-blur-sm">
						<a
							href="/dashboard"
							onclick={closeMobileMenu}
							class="block px-3 py-2 rounded-md text-base font-medium text-[#fdfdfd] hover:text-[#24b0ff] hover:bg-[#1e3a8a]/20 transition-colors"
						>Dashboard</a>
						<a
							href="/submit"
							onclick={closeMobileMenu}
							class="block px-3 py-2 rounded-md text-base font-medium text-[#fdfdfd] hover:text-[#24b0ff] hover:bg-[#1e3a8a]/20 transition-colors"
						>Submit Post</a>
						<a
							href="/leaderboard"
							onclick={closeMobileMenu}
							class="block px-3 py-2 rounded-md text-base font-medium text-[#fdfdfd] hover:text-[#24b0ff] hover:bg-[#1e3a8a]/20 transition-colors"
						>Leaderboard</a>

						{#if $user?.role === 'TEAM_LEAD'}
							<a
								href="/team-lead"
								onclick={closeMobileMenu}
								class="block px-3 py-2 rounded-md text-base font-medium text-[#fdfdfd] hover:text-[#24b0ff] hover:bg-[#1e3a8a]/20 transition-colors"
							>My Team</a>
						{/if}

						{#if $user?.role === 'ADMIN'}
							<a
								href="/admin"
								onclick={closeMobileMenu}
								class="block px-3 py-2 rounded-md text-base font-medium text-[#24b0ff] hover:text-white hover:bg-[#1e3a8a]/20 transition-colors"
							>Admin</a>
						{/if}

						<!-- Mobile Auth Buttons -->
						<div class="pt-4 pb-3 border-t border-[#144a8f]">
							<div class="px-3">
								<AuthButtons />
							</div>
						</div>
					</div>
				</div>
			{/if}
		</header>

		<main class="flex-1">
			{@render children?.()}
		</main>
	</div>
</div>
