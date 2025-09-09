<script>
	import LoginForm from '$lib/components/LoginForm.svelte';
	import { user, loading, sessionChecked } from '$lib/stores/auth.js';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase.js';

	let hasExistingSession = $state(false);
	let storedUserEmail = $state('');
	let showQuickLogin = $state(false);
	let checkingSession = $state(true);

	// Svelte 5 effect to handle authenticated users
	$effect(() => {
		// If user is fully authenticated, redirect to dashboard
		if ($user && !$loading) {
			goto('/dashboard');
		}
	});

	// Check for existing session on mount
	$effect(() => {
		if ($sessionChecked && !$user) {
			checkExistingSession();
		}
	});

	async function checkExistingSession() {
		try {
			const { data: { session } } = await supabase.auth.getSession();
			
			if (session?.user && !$user) {
				// User has a valid session but store hasn't loaded yet
				hasExistingSession = true;
				storedUserEmail = session.user.email || '';
				showQuickLogin = true;
			}
		} catch (error) {
			console.error('Session check failed:', error);
		} finally {
			checkingSession = false;
		}
	}

	async function continueAsStoredUser() {
		try {
			// Trigger auth state refresh
			const { data: { session } } = await supabase.auth.getSession();
			if (session) {
				// Let the auth store handle the session
				await goto('/dashboard');
			}
		} catch (error) {
			console.error('Quick login failed:', error);
			showQuickLogin = false;
		}
	}

	function showManualLogin() {
		showQuickLogin = false;
	}
</script>

<svelte:head>
	<title>Login - PostWars</title>
</svelte:head>

<!-- Content -->
<div class="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md">
		{#if $loading || checkingSession}
			<!-- Loading state while checking for existing session -->
			<div class="flex items-center justify-center py-12">
				<div
					class="h-8 w-8 animate-spin rounded-full border-b-2"
					style="border-color:#24b0ff;"
				></div>
				<span class="ml-3 text-sm" style="color:#94a3b8;">Checking session...</span>
			</div>
		{:else if showQuickLogin && hasExistingSession}
			<!-- Quick login option for returning users -->
			<div
				class="mx-auto max-w-md space-y-6 rounded-xl p-8 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<h2 class="mb-6 text-center text-3xl font-bold tracking-tight" style="color:#fdfdfd;">
					Welcome Back!
				</h2>
				
				<div class="text-center">
					<div class="mb-4">
						<div class="text-lg font-medium" style="color:#fdfdfd;">
							We found your session
						</div>
						<div class="text-sm" style="color:#94a3b8;">
							{storedUserEmail}
						</div>
					</div>
					
					<button
						onclick={continueAsStoredUser}
						class="mb-4 w-full rounded-lg px-4 py-3 text-white font-medium transition hover:brightness-110"
						style="background:linear-gradient(90deg,#1392d6,#24b0ff); box-shadow:0 0 15px rgba(36,176,255,.6);"
					>
						Continue to Dashboard
					</button>
					
					<button
						onclick={showManualLogin}
						class="text-sm hover:underline transition-colors"
						style="color:#94a3b8;"
					>
						Use different account
					</button>
				</div>
			</div>
		{:else}
			<!-- Standard login form -->
			<LoginForm />
			<div class="mt-6 text-center">
				<span class="text-sm" style="color:#94a3b8;">
					Don't have an account? 
					<a href="/signup" class="hover:underline transition-colors" style="color:#24b0ff;">
						Sign up here
					</a>
				</span>
			</div>
		{/if}
	</div>
</div>
