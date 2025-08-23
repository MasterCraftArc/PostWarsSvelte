<script>
	import { login } from '$lib/stores/auth.js';

	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	async function handleSubmit() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		loading = true;
		error = '';

		const result = await login(email, password);

		if (!result.success) {
			error = result.error;
		}

		loading = false;
	}
</script>

<form
	on:submit|preventDefault={handleSubmit}
	class="mx-auto max-w-md space-y-6 rounded-xl p-8 shadow-lg backdrop-blur-md"
	style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
>
	<h2 class="mb-8 text-center text-3xl font-bold tracking-tight" style="color:#fdfdfd;">Login</h2>

	{#if error}
		<div 
			class="rounded-lg px-4 py-3"
			style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;"
		>
			{error}
		</div>
	{/if}

	<div>
		<label for="email" class="mb-2 block text-sm font-medium" style="color:#cbd5e1;">Email</label>
		<input
			id="email"
			type="email"
			bind:value={email}
			required
			placeholder="Enter your email"
			class="w-full rounded-md px-3 py-3 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all"
			style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
		/>
	</div>

	<div>
		<label for="password" class="mb-2 block text-sm font-medium" style="color:#cbd5e1;">Password</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			required
			placeholder="Enter your password"
			class="w-full rounded-md px-3 py-3 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all"
			style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; --tw-ring-color:#24b0ff;"
		/>
	</div>

	<button
		type="submit"
		disabled={loading}
		class="w-full rounded-lg px-4 py-3 text-white font-medium transition hover:brightness-110 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
		style="background:linear-gradient(90deg,#1392d6,#24b0ff); box-shadow:0 0 15px rgba(36,176,255,.6);"
	>
		{loading ? 'Logging in...' : 'Login'}
	</button>
</form>
