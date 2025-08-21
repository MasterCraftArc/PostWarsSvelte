<script>
	import { signup } from '$lib/stores/auth.js';

	let email = '';
	let password = '';
	let name = '';
	let confirmPassword = '';
	let error = '';
	let loading = false;

	async function handleSubmit() {
		if (!email || !password || !name) {
			error = 'Please fill in all fields';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}

		loading = true;
		error = '';

		const result = await signup(email, password, name);

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
	<h2 class="mb-6 text-center text-2xl font-bold">Sign Up</h2>

	{#if error}
		<div class="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
			{error}
		</div>
	{/if}

	<div>
		<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
		<input
			id="name"
			type="text"
			bind:value={name}
			required
			class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</div>

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

	<div>
		<label for="confirmPassword" class="mb-1 block text-sm font-medium text-gray-700"
			>Confirm Password</label
		>
		<input
			id="confirmPassword"
			type="password"
			bind:value={confirmPassword}
			required
			class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</div>

	<button
		type="submit"
		disabled={loading}
		class="w-full rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{loading ? 'Signing up...' : 'Sign Up'}
	</button>
</form>
