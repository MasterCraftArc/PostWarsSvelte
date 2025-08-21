<script>
	import { user, logout } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	onMount(() => {
		if ($page.data.user) {
			user.set($page.data.user);
		}
	});
</script>

<div class="flex items-center space-x-4">
	{#if $user}
		<span class="text-[#fdfdfd]">Hello, {$user.name || $user.email}!</span>
		<button
	on:click={logout}
	class="rounded-full px-4 py-2 text-white font-medium 
           bg-[#eb2628]/40 border border-[#ff5456]/60 
           backdrop-blur-sm shadow-lg 
           hover:bg-[#eb2628]/90 hover:border-[#ff5456] 
           transition-colors hover:cursor-pointer"
>
	Logout
</button>
	{:else}
		<a
			href="/login"
			class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
		>
			Login
		</a>
		<a
			href="/signup"
			class="rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
		>
			Sign Up
		</a>
	{/if}
</div>
