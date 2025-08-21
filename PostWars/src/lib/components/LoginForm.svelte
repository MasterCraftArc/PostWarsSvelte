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
	class="mx-auto max-w-md space-y-4 rounded-lg bg-white p-6 shadow-md"
>
	<h2 class="mb-6 text-center text-2xl font-bold">Login</h2>

	{#if error}
		<div class="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
			{error}
		</div>
	{/if}

	<div>
		<label for="email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
		<input
			id="email"
			type="email"
			bind:value={email}
			required
			class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</div>

	<div>
		<label for="password" class="mb-1 block text-sm font-medium text-gray-700">Password</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			required
			class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</div>

	<button
		type="submit"
		disabled={loading}
		class="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{loading ? 'Logging in...' : 'Login'}
	</button>
</form>

<div class="mt-4 text-center">
	<a href="/forgot-password" class="text-sm text-blue-600 hover:underline">
		Forgot your password?
	</a>
</div>
