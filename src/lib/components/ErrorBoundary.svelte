<script>
	export let error = null;
	export let retry = () => {};
</script>

{#if error}
	<div class="bg-red-50 border border-red-200 rounded-lg p-4 mx-auto max-w-md">
		<div class="flex items-center mb-2">
			<svg class="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
			</svg>
			<h3 class="text-red-800 font-semibold">Something went wrong</h3>
		</div>
		<p class="text-red-600 text-sm mb-3">{error.message || 'An unexpected error occurred'}</p>
		<button 
			on:click={retry}
			class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
		>
			Try Again
		</button>
	</div>
{:else}
	<slot />
{/if}