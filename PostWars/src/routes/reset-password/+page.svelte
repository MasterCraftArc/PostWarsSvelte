<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let password = '';
	let confirmPassword = '';
	let loading = false;
	let error = '';
	let success = false;
	let token = '';

	onMount(() => {
		token = $page.url.searchParams.get('token') || '';
		if (!token) {
			error = 'Invalid reset link. Please request a new password reset.';
		}
	});

	async function handleSubmit() {
		if (!password || !confirmPassword) {
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

		try {
			const response = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password })
			});

			const data = await response.json();

			if (response.ok) {
				success = true;
				setTimeout(() => {
					goto('/login');
				}, 3000);
			} else {
				error = data.error;
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		}

		loading = false;
	}
</script>

<svelte:head>
	<title>Reset Password</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-md space-y-4 rounded-lg bg-white p-6 shadow-md">
		<h2 class="mb-6 text-center text-2xl font-bold">Set New Password</h2>

		{#if success}
			<div class="rounded border border-green-400 bg-green-100 px-4 py-3 text-green-700">
				<p>Password has been reset successfully!</p>
				<p class="text-sm mt-2">Redirecting to login page...</p>
			</div>
		{:else if !token}
			<div class="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
				Invalid reset link. Please request a new password reset.
			</div>
			<div class="text-center">
				<a href="/forgot-password" class="text-blue-600 hover:underline">
					Request New Reset Link
				</a>
			</div>
		{:else}
			{#if error}
				<div class="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
					{error}
				</div>
			{/if}

			<form on:submit|preventDefault={handleSubmit}>
				<div class="space-y-4">
					<div>
						<label for="password" class="mb-1 block text-sm font-medium text-gray-700">
							New Password
						</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							required
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter new password"
						/>
					</div>

					<div>
						<label for="confirmPassword" class="mb-1 block text-sm font-medium text-gray-700">
							Confirm New Password
						</label>
						<input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
							required
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Confirm new password"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{loading ? 'Resetting...' : 'Reset Password'}
					</button>
				</div>
			</form>

			<div class="mt-4 text-center">
				<a href="/login" class="text-sm text-blue-600 hover:underline">
					Back to Login
				</a>
			</div>
		{/if}
	</div>
</div>