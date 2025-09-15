<script>
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';

	let targetPostUrl = '';
	let loading = false;
	let error = '';
	let success = '';

	function validateLinkedInUrl(url) {
		const linkedinUrlPattern = /^https:\/\/(www\.)?linkedin\.com\/posts\/.*$/;
		return linkedinUrlPattern.test(url);
	}

	async function handleSubmit() {
		if (!targetPostUrl.trim()) {
			error = 'Please enter a LinkedIn post URL';
			return;
		}

		if (!validateLinkedInUrl(targetPostUrl.trim())) {
			error = 'Please enter a valid LinkedIn post URL';
			return;
		}

		loading = true;
		error = '';
		success = '';

		try {
			const data = await authenticatedRequest('/api/comment-activities/submit', {
				method: 'POST',
				body: JSON.stringify({ targetPostUrl: targetPostUrl.trim() })
			});

			success = `✅ Comment activity logged successfully! You earned ${data.points_awarded} points for commenting on this LinkedIn post. Check your Recent Posts on the Dashboard to see your comment activity.`;
			targetPostUrl = '';

			// Don't reload - let user see the confirmation message
			setTimeout(() => {
				success = '';
			}, 8000);
		} catch (err) {
			error = err.message || 'Failed to log comment activity';
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
		<h2 class="mb-6 text-center text-2xl font-bold" style="color:#fdfdfd;">Submit Comment</h2>

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
			<label for="targetPostUrl" class="mb-1 block text-sm font-medium" style="color:#cbd5e1;">
				LinkedIn Post URL
			</label>
			<input
				id="targetPostUrl"
				type="url"
				bind:value={targetPostUrl}
				placeholder="https://www.linkedin.com/posts/username-activity-..."
				required
				class="w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2"
				style="background-color:rgba(16,35,73,0.35); border:1px solid #24b0ff; color:#fdfdfd; focus:ring-color:#24b0ff;"
			/>
			<p class="mt-1 text-sm" style="color:#94a3b8;">
				Paste the URL of the LinkedIn post you commented on. 
				Each comment activity earns <strong>1 point</strong> instantly.
			</p>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-md px-4 py-2 font-medium transition-colors hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
			style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.6);"
		>
			{loading ? 'Processing...' : 'Submit Comment'}
		</button>
	</form>

	<div class="mx-auto mt-8 max-w-2xl">
		<h3 class="mb-4 text-lg font-semibold" style="color:#fdfdfd;">How Comment Points Work:</h3>
		<div class="grid grid-cols-1 gap-4">
			<div
				class="rounded-lg p-4 backdrop-blur-md"
				style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
			>
				<h4 class="font-medium" style="color:#e5e7eb;">Comment Activity</h4>
				<ul class="mt-2 space-y-1 text-sm" style="color:#cbd5e1;">
					<li>• Each LinkedIn comment: 1 point</li>
					<li>• Points awarded instantly upon submission</li>
					<li>• Each post can only be submitted once</li>
					<li>• No scraping required - immediate points</li>
				</ul>
			</div>
		</div>

		<div
			class="mt-6 rounded-lg p-4 backdrop-blur-md"
			style="background-color:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3);"
		>
			<h4 class="mb-2 font-medium" style="color:#22c55e;">Important Note</h4>
			<p class="text-sm" style="color:#cbd5e1;">
				Only submit posts where you have <strong style="color:#22c55e;">actually left a comment</strong>. 
				This system operates on trust and helps track your LinkedIn engagement activity.
			</p>
		</div>
	</div>
{:else}
	<div class="py-8 text-center">
		<p style="color:#cbd5e1;">Please log in to submit comment activities.</p>
	</div>
{/if}