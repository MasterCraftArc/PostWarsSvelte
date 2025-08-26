<script>
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';

	let linkedinUrl = '';
	let loading = false;
	let error = '';
	let success = '';

	async function handleSubmit() {
		if (!linkedinUrl.trim()) {
			error = 'Please enter a LinkedIn post URL';
			return;
		}

		if (!linkedinUrl.includes('linkedin.com')) {
			error = 'Please enter a valid LinkedIn URL';
			return;
		}

		loading = true;
		error = '';
		success = '';

		try {
			const data = await authenticatedRequest('/api/posts/submit', {
				method: 'POST',
				body: JSON.stringify({ linkedinUrl: linkedinUrl.trim() })
			});

			success = `Post submitted successfully! Job ID: ${data.jobId}`;
			if (data.estimatedWaitTime) {
				success += ` Estimated processing time: ${data.estimatedWaitTime}`;
			}
			linkedinUrl = '';

			// Refresh page data or dispatch event
			window.location.reload();
		} catch (err) {
			error = err.message || 'Failed to submit post';
		}

		loading = false;
	}
</script>

{#if $user}
	<form
		on:submit|preventDefault={handleSubmit}
		class="mx-auto max-w-2xl space-y-4 rounded-xl p-6 shadow-lg backdrop-blur-md"
		style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
	>
		<h2 class="mb-6 text-center text-2xl font-bold" style="color:#fdfdfd;">
			Submit LinkedIn Post
		</h2>

		{#if error}
			<div
				class="rounded px-4 py-3"
				style="border:1px solid #ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;"
			>
				{error}
			</div>
		{/if}

		{#if success}
			<div
				class="rounded px-4 py-3"
				style="border:1px solid #22c55e; background-color:rgba(34,197,94,0.12); color:#22c55e;"
			>
				{success}
			</div>
		{/if}

		<div>
			<label for="linkedinUrl" class="mb-1 block text-sm font-medium" style="color:#cbd5e1;">
				LinkedIn Post URL
			</label>
			<input
				id="linkedinUrl"
				type="url"
				bind:value={linkedinUrl}
				placeholder="https://www.linkedin.com/posts/your-post-url"
				required
				class="w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2"
				style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; focus:ring-color:#24b0ff;"
			/>
			<p class="mt-1 text-sm" style="color:#94a3b8;">
				Paste the URL of your LinkedIn post to start tracking engagement and earning points!
			</p>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-md hover:cursor-pointer px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
			style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.6);"
		>
			{loading ? 'Processing...' : 'Submit Post'}
		</button>
	</form>

	<div class="mx-auto mt-8 max-w-2xl">
		<h3 class="mb-4 text-lg font-semibold" style="color:#fdfdfd;">How Points Work:</h3>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div
				class="rounded-lg p-4 backdrop-blur-md"
				style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
			>
				<h4 class="font-medium" style="color:#e5e7eb;">Base Points</h4>
				<ul class="mt-2 space-y-1 text-sm" style="color:#cbd5e1;">
					<li>• New post: 10 points</li>
					<li>• Word bonus: +0.1/word over 50</li>
					<li>• Streak multiplier: +10% per day</li>
				</ul>
			</div>

			<div
				class="rounded-lg p-4 backdrop-blur-md"
				style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
			>
				<h4 class="font-medium" style="color:#e5e7eb;">Engagement Points</h4>
				<ul class="mt-2 space-y-1 text-sm" style="color:#cbd5e1;">
					<li>• Reaction: 1 point each</li>
					<li>• Comment: 3 points each</li>
					<li>• Repost: 5 points each</li>
				</ul>
			</div>
		</div>
	</div>
{:else}
	<div class="py-8 text-center">
		<p style="color:#cbd5e1;">Please log in to submit LinkedIn posts.</p>
	</div>
{/if}
