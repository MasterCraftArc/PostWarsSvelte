<script>
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';
	import { onMount } from 'svelte';

	let targetPostUrl = '';
	let isSubmitting = false;
	let error = '';
	let successMessage = '';
	let submissionResult = null;

	onMount(() => {
		if (!$user) {
			goto('/login');
		}
	});

	function validateLinkedInUrl(url) {
		const linkedinUrlPattern = /^https:\/\/(www\.)?linkedin\.com\/posts\/.*$/;
		return linkedinUrlPattern.test(url);
	}

	async function submitActivity() {
		if (!targetPostUrl.trim()) {
			error = 'LinkedIn post URL is required';
			return;
		}
		
		if (!validateLinkedInUrl(targetPostUrl.trim())) {
			error = 'Invalid LinkedIn post URL format';
			return;
		}
		
		isSubmitting = true;
		error = '';
		successMessage = '';
		
		try {
			const result = await authenticatedRequest('/api/comment-activities/submit', {
				method: 'POST',
				body: JSON.stringify({
					targetPostUrl: targetPostUrl.trim()
				})
			});
			
			successMessage = result.message || `Comment activity logged! You earned ${result.points_awarded} points.`;
			submissionResult = result;
			targetPostUrl = '';
		} catch (e) {
			error = e.message || 'Failed to submit comment activity';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Submit Comment Activity - LinkedIn Gamification</title>
</svelte:head>

{#if $user}
	<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-2xl">
		<div class="bg-white rounded-lg shadow-lg p-8">
			<h1 class="text-3xl font-bold mb-2" style="color:#102349;">Submit Comment Activity</h1>
			<p class="text-gray-600 mb-8">
				Earn 2 points for each LinkedIn post you comment on. Submit the URL of the post you commented on below.
			</p>

			<!-- Scoring Rules Section -->
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
				<h2 class="text-lg font-semibold mb-4" style="color:#102349;">💬 Comment Activity Rules</h2>
				<div class="space-y-2 text-sm text-gray-700">
					<div class="flex justify-between">
						<span>Comment Activity:</span>
						<span class="font-medium">+2 points</span>
					</div>
					<div class="text-xs text-gray-500 mt-3">
						• Only submit posts you have actually commented on<br>
						• Each post can only be submitted once<br>
						• Points are awarded immediately upon submission
					</div>
				</div>
			</div>

			<form on:submit|preventDefault={submitActivity} class="space-y-6">
				<div>
					<label for="post-url" class="block text-sm font-medium text-gray-700 mb-2">
						LinkedIn Post URL *
					</label>
					<input 
						id="post-url"
						type="url" 
						bind:value={targetPostUrl}
						placeholder="https://www.linkedin.com/posts/username-activity-..."
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						disabled={isSubmitting}
						required
					/>
					<p class="text-xs text-gray-500 mt-1">
						Paste the full URL of the LinkedIn post you commented on
					</p>
				</div>
				
				{#if error}
					<div class="bg-red-50 border border-red-200 rounded-lg p-4">
						<div class="text-red-800 text-sm">{error}</div>
					</div>
				{/if}
				
				{#if successMessage}
					<div class="bg-green-50 border border-green-200 rounded-lg p-4">
						<div class="text-green-800 text-sm font-medium">{successMessage}</div>
						{#if submissionResult}
							<div class="mt-3 text-sm text-green-700">
								<p><strong>Points Earned:</strong> {submissionResult.points_awarded}</p>
								<p class="mt-2">
									<a href="/dashboard" class="text-blue-600 hover:text-blue-800 underline">
										View in Dashboard →
									</a>
								</p>
							</div>
						{/if}
					</div>
				{/if}
				
				<div class="flex gap-4">
					<button 
						type="submit"
						disabled={isSubmitting || !targetPostUrl.trim()}
						class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{isSubmitting ? 'Submitting...' : 'Submit Comment Activity (+2 points)'}
					</button>
					
					<a 
						href="/dashboard"
						class="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-center"
					>
						Cancel
					</a>
				</div>
			</form>
		</div>
	</div>
{:else}
	<div class="container mx-auto px-4 py-8 text-center">
		<p class="text-gray-600">Please log in to submit comment activities.</p>
		<a href="/login" class="text-blue-600 hover:underline">Go to Login</a>
	</div>
{/if}