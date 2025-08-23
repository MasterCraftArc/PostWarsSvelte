<script>
	import LoginForm from '$lib/components/LoginForm.svelte';
	import { user } from '$lib/stores/auth.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		if ($user) {
			goto('/');
		}
	});
</script>

<svelte:head>
	<title>Login - PostWars</title>
</svelte:head>

<!-- Content -->
<div class="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md">
		<LoginForm />
		<div class="mt-6 text-center">
			<span class="text-sm" style="color:#94a3b8;">
				Don't have an account? 
				<a href="/signup" class="hover:underline transition-colors" style="color:#24b0ff;">
					Sign up here
				</a>
			</span>
		</div>
	</div>
</div>
