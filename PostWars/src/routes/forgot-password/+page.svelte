<script>
	import { goto } from '$app/navigation';

	let email = '';
	let loading = false;
	let message = '';
	let error = '';
	let resetLink = '';

	async function handleSubmit() {
		if (!email) {
			error = 'Please enter your email address';
			return;
		}

		loading = true;
		error = '';
		message = '';
		resetLink = '';

		try {
			const response = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});

			const data = await response.json();

			if (response.ok) {
				message = data.message;
				// In development, show the reset link
				if (data.resetLink) {
					resetLink = data.resetLink;
				}
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
	<title>Forgot Password</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-md space-y-4 rounded-lg bg-white p-6 shadow-md">
		<h2 class="mb-6 text-center text-2xl font-bold">Reset Password</h2>

		{#if message}
			<div class="rounded border border-green-400 bg-green-100 px-4 py-3 text-green-700">
				{message}
			</div>
			{#if resetLink}
				<div class="rounded border border-blue-400 bg-blue-100 px-4 py-3 text-blue-700">
					<p class="text-sm"><strong>Development Mode:</strong></p>
					<a href={resetLink} class="text-blue-600 underline">{resetLink}</a>
				</div>
			{/if}
		{:else}
			{#if error}
				<div class="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
					{error}
				</div>
			{/if}

			<form on:submit|preventDefault={handleSubmit}>
				<div class="space-y-4">
					<div>
						<label for="email" class="mb-1 block text-sm font-medium text-gray-700">
							Email Address
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter your email address"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{loading ? 'Sending...' : 'Send Reset Link'}
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