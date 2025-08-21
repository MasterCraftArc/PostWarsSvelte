<script>
	import SignupForm from '$lib/components/SignupForm.svelte';
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
	<title>Sign Up</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
	<SignupForm />
</div>
