<script>
	import { user, logout } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	// Removed server-side user override - let client-side auth store handle user state
</script>

<div class="flex items-center space-x-4">
	{#if $user}
		<div class="flex items-center space-x-2">
			<span class="text-[#fdfdfd]">Hello, {$user.name || $user.email}!</span>
			{#if $user.team}
				<span
					class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm"
					style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.4);"
					title="Your team: {$user.team.name}"
				>
					🏆 {$user.team.name}
				</span>
			{/if}
		</div>
		<button
	onclick={logout}
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
			class="rounded-lg px-4 py-2 text-white font-medium transition hover:brightness-110 hover:cursor-pointer"
			style="background:linear-gradient(90deg,#1392d6,#24b0ff); box-shadow:0 0 10px rgba(36,176,255,.6);"
		>
			Login
		</a>
		<a
			href="/signup"
			class="rounded-lg px-4 py-2 text-white font-medium transition hover:brightness-110 hover:cursor-pointer"
			style="background:linear-gradient(90deg,#1392d6,#24b0ff); box-shadow:0 0 10px rgba(36,176,255,.6);"
		>
			Sign Up
		</a>
	{/if}
</div>
