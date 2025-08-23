<script>
	export let progress = 0;
	export let target = 100;
	export let current = 0;
	export let label = '';
	export let showNumbers = true;
	export let size = 'medium';
	export let color = '#24b0ff';
	
	$: progressPercentage = Math.min((current / target) * 100, 100);
	$: isComplete = current >= target;
	
	function getSizeClasses(size) {
		switch (size) {
			case 'small':
				return 'h-2';
			case 'large':
				return 'h-6';
			default:
				return 'h-4';
		}
	}
</script>

<div class="progress-container">
	{#if label}
		<div class="mb-2 flex items-center justify-between">
			<span class="text-sm font-medium" style="color:#fdfdfd;">{label}</span>
			{#if showNumbers}
				<span class="text-sm" style="color:#94a3b8;">
					{current.toLocaleString()} / {target.toLocaleString()}
				</span>
			{/if}
		</div>
	{/if}
	
	<div 
		class="w-full rounded-full overflow-hidden {getSizeClasses(size)}"
		style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
	>
		<div 
			class="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
			style="width: {progressPercentage}%; background-color: {isComplete ? '#22c55e' : color};"
		>
			{#if progressPercentage > 0}
				<div 
					class="absolute inset-0 opacity-30"
					style="background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%); animation: shimmer 2s infinite;"
				></div>
			{/if}
		</div>
	</div>
	
	{#if showNumbers && size !== 'small'}
		<div class="mt-1 text-center">
			<span 
				class="text-xs font-medium"
				style="color: {isComplete ? '#22c55e' : color};"
			>
				{progressPercentage.toFixed(1)}%
			</span>
			{#if isComplete}
				<span class="ml-2 text-xs" style="color:#22c55e;">✓ Complete!</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	@keyframes shimmer {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}
	
	.progress-container {
		width: 100%;
	}
</style>