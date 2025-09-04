<script>
	import { onMount, onDestroy } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { 
		dashboardData, 
		dashboardLoading, 
		dashboardError, 
		userStats, 
		recentPosts 
	} from '$lib/stores/dashboard.js';
	import { initializeRealtime, cleanupRealtime } from '$lib/realtime.js';
	import { authenticatedRequest } from '$lib/api.js';
	import TeamProgress from './TeamProgress.svelte';

	let hasInitialized = false;
	
	// Initialize real-time when user is fully authenticated
	$: {
		if ($user?.id && !hasInitialized && !$dashboardLoading) {
			hasInitialized = true;
			initializeRealtime($user.id).catch(error => {
				console.error('Failed to initialize real-time:', error);
				hasInitialized = false; // Allow retry
			});
		}
	}

	// Clean up on component destroy
	onDestroy(() => {
		cleanupRealtime();
	});

	async function updatePostAnalytics(postId) {
		try {
			await authenticatedRequest('/api/posts/update-analytics', {
				method: 'POST',
				body: JSON.stringify({ postId })
			});
			// Real-time subscriptions will automatically update the UI
		} catch (err) {
			dashboardError.set(err.message || 'Failed to update analytics');
		}
	}

	async function deletePost(postId) {
		if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
			return;
		}

		try {
			await authenticatedRequest(`/api/posts/${postId}`, {
				method: 'DELETE'
			});
			// Real-time subscriptions will automatically update the UI
			alert('Post deleted successfully');
		} catch (err) {
			dashboardError.set(err.message || 'Failed to delete post');
		}
	}


	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getGrowthColor(growth) {
		if (growth > 0) return 'text-green-600';
		if (growth < 0) return 'text-red-600';
		return 'text-gray-500';
	}
</script>

{#if $user}
	{#if $dashboardLoading}
		<div class="flex items-center justify-center py-12">
			<div class="h-12 w-12 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
		</div>
	{:else if $dashboardError}
		<div class="mb-6 rounded border px-4 py-3" style="border-color:#ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;">
			{$dashboardError}
		</div>
	{:else if $dashboardData}
		<div class="space-y-6">

			<!-- User Stats Overview (GLASS) -->
			<div
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<h2 class="mb-6 text-2xl font-bold" style="color:#fdfdfd;">
					Welcome back, {$dashboardData?.user?.name || 'User'}!
				</h2>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<!-- Stat card -->
					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.35);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">{$userStats.totalScore}</div>
						<div class="text-sm" style="color:#cbd5e1;">Total Points</div>
						<div class="text-xs" style="color:#94a3b8;">Rank #{$userStats.rank}</div>
					</div>

					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">{$userStats.totalPosts}</div>
						<div class="text-sm" style="color:#cbd5e1;">Total Posts</div>
						<div class="text-xs" style="color:#94a3b8;">{$dashboardData?.stats?.monthlyPosts || 0} this month</div>
					</div>

					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">{$userStats.currentStreak}</div>
						<div class="text-sm" style="color:#cbd5e1;">Current Streak</div>
						<div class="text-xs" style="color:#94a3b8;">Best: {$dashboardData?.user?.bestStreak || 0} days</div>
					</div>

					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.35);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">
							{dashboardData.stats.averageEngagement}
						</div>
						<div class="text-sm" style="color:#cbd5e1;">Avg Engagement</div>
						<div class="text-xs" style="color:#94a3b8;">{dashboardData.stats.totalEngagement} total</div>
					</div>
				</div>
			</div>

			<!-- Recent Achievements (GLASS) -->
			{#if dashboardData.recentAchievements?.length > 0}
				<div
					class="rounded-xl p-6 shadow-lg backdrop-blur-md"
					style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
				>
					<h3 class="mb-4 text-xl font-semibold" style="color:#fdfdfd;">Recent Achievements</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each dashboardData.recentAchievements as achievement}
							<div
								class="flex items-center space-x-3 rounded-lg p-3"
								style="background-color:rgba(16,35,73,0.28); border:1px solid rgba(36,176,255,0.28);"
							>
								<span class="text-2xl" style="color:#24b0ff;">{achievement.icon}</span>
								<div>
									<div class="font-medium" style="color:#e5e7eb;">{achievement.name}</div>
									<div class="text-sm" style="color:#cbd5e1;">{achievement.description}</div>
									<div class="text-xs" style="color:#94a3b8;">
										{achievement.points} points • {formatDate(achievement.earnedAt)}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Team Progress -->
			<TeamProgress />

			<!-- Recent Posts (GLASS) -->
			<div
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-xl font-semibold" style="color:#fdfdfd;">Recent Posts</h3>
					<span class="text-sm" style="color:#94a3b8;">{$recentPosts.length} posts shown</span>
				</div>

				{#if $recentPosts.length === 0}
					<p class="py-8 text-center" style="color:#94a3b8;">
						No posts yet. Submit your first LinkedIn post to get started!
					</p>
				{:else}
					<div class="space-y-4">
						{#each $recentPosts as post}
							<!-- Individual Post Card (GLASS) -->
							<div
								class="rounded-lg p-4 transition-shadow hover:shadow-xl"
								style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff; backdrop-filter:blur(6px);"
							>
								<div class="mb-2 flex items-start justify-between">
									<div class="flex-1">
										<p class="mb-2 text-sm" style="color:#e2e8f0;">{post.content}</p>
										<div class="flex items-center space-x-4 text-sm">
											<span style="color:#cbd5e1;">{formatDate(post.postedAt)}</span>
											<span style="color:#cbd5e1;">Score: {post.totalScore}</span>
											<a
												href={post.url}
												target="_blank"
												rel="noopener"
												class="hover:underline"
												style="color:#24b0ff;"
											>
												View Post →
											</a>
										</div>
									</div>

									<div class="ml-4">
										<button
											onclick={() => deletePost(post.id)}
											class="rounded px-3 py-1 text-xs transition-colors hover:cursor-pointer"
											style="background-color:rgba(235,38,40,0.12); color:#ff5456; border:1px solid rgba(255,84,86,0.6);"
										>
											Delete
										</button>
									</div>
								</div>

								<div class="mt-3 flex items-center justify-between border-t pt-3" style="border-color:rgba(148,163,184,0.2);">
									<div class="grid flex-1 grid-cols-3 gap-4">
										<div class="text-center">
											<div class="font-medium" style="color:#f1f5f9;">{post.reactions}</div>
											<div class="text-xs" style="color:#94a3b8;">Reactions</div>
											{#if post.growth.reactions !== 0}
												<div class="text-xs {getGrowthColor(post.growth.reactions)}" style="color:{post.growth.reactions > 0 ? '#22c55e' : '#ef4444'};">
													{post.growth.reactions > 0 ? '+' : ''}{post.growth.reactions}
												</div>
											{/if}
										</div>

										<div class="text-center">
											<div class="font-medium" style="color:#f1f5f9;">{post.comments}</div>
											<div class="text-xs" style="color:#94a3b8;">Comments</div>
											{#if post.growth.comments !== 0}
												<div class="text-xs" style="color:{post.growth.comments > 0 ? '#22c55e' : '#ef4444'};">
													{post.growth.comments > 0 ? '+' : ''}{post.growth.comments}
												</div>
											{/if}
										</div>

										<div class="text-center">
											<div class="font-medium" style="color:#f1f5f9;">{post.reposts}</div>
											<div class="text-xs" style="color:#94a3b8;">Reposts</div>
											{#if post.growth.reposts !== 0}
												<div class="text-xs" style="color:{post.growth.reposts > 0 ? '#22c55e' : '#ef4444'};">
													{post.growth.reposts > 0 ? '+' : ''}{post.growth.reposts}
												</div>
											{/if}
										</div>
									</div>

									<div class="ml-4 text-right">
										<div class="text-sm" style="color:#cbd5e1;">Last updated</div>
										<div class="text-xs" style="color:#94a3b8;">{formatDate(post.lastScrapedAt)}</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
{:else}
	<div class="py-8 text-center">
		<p style="color:#cbd5e1;">Please log in to view your dashboard.</p>
	</div>
{/if}
