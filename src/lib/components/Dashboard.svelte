<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth.js';
	import { authenticatedRequest } from '$lib/api.js';
	import CompanyGoals from './CompanyGoals.svelte';
	let dashboardData = null;
	let loading = true;
	let error = '';

	async function loadDashboard() {
		try {
			const data = await authenticatedRequest('/api/dashboard');
			dashboardData = data;
			error = '';
		} catch (err) {
			error = err.message || 'Failed to load dashboard';
		}
		loading = false;
	}

	async function updatePostAnalytics(postId) {
		try {
			await authenticatedRequest('/api/posts/update-analytics', {
				method: 'POST',
				body: JSON.stringify({ postId })
			});

			// Refresh dashboard data
			loading = true;
			await loadDashboard();
		} catch (err) {
			error = err.message || 'Failed to update analytics';
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

			// Refresh dashboard data
			loading = true;
			await loadDashboard();
			alert('Post deleted successfully');
		} catch (err) {
			error = err.message || 'Failed to delete post';
		}
	}

	// Reactive statement to load dashboard when user becomes available
	$: {
		if ($user && !dashboardData && !error) {
			loadDashboard();
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
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-12 w-12 animate-spin rounded-full border-b-2" style="border-color:#24b0ff;"></div>
		</div>
	{:else if error}
		<div class="mb-6 rounded border px-4 py-3" style="border-color:#ff5456; background-color:rgba(255,84,86,0.12); color:#ff5456;">
			{error}
		</div>
	{:else if dashboardData}
		<div class="space-y-6">

			<!-- User Stats Overview (GLASS) -->
			<div
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<h2 class="mb-6 text-2xl font-bold" style="color:#fdfdfd;">
					Welcome back, {dashboardData.user.name || 'User'}!
				</h2>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
					<!-- Stat card -->
					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.35);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">{dashboardData.user.totalScore}</div>
						<div class="text-sm" style="color:#cbd5e1;">Total Points</div>
						<div class="text-xs" style="color:#94a3b8;">Rank #{dashboardData.user.rank}</div>
					</div>

					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">{dashboardData.stats.totalPosts}</div>
						<div class="text-sm" style="color:#cbd5e1;">Total Posts</div>
						<div class="text-xs" style="color:#94a3b8;">{dashboardData.stats.monthlyPosts} this month</div>
					</div>

					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">{dashboardData.user.currentStreak}</div>
						<div class="text-sm" style="color:#cbd5e1;">Current Streak</div>
						<div class="text-xs" style="color:#94a3b8;">Best: {dashboardData.user.bestStreak} days</div>
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

					<div
						class="rounded-lg p-4 text-center"
						style="background-color:rgba(16,35,73,0.35); border:1px solid rgba(36,176,255,0.28);"
					>
						<div class="text-xl sm:text-2xl font-bold" style="color:#24b0ff;">{dashboardData.stats.totalCommentActivities || 0}</div>
						<div class="text-sm" style="color:#cbd5e1;">Comments</div>
						<div class="text-xs" style="color:#94a3b8;">{dashboardData.stats.monthlyCommentActivities || 0} this month</div>
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

			<!-- Company Goals -->
			<CompanyGoals />

			<!-- Recent Posts (GLASS) -->
			<div
				class="rounded-xl p-6 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-xl font-semibold" style="color:#fdfdfd;">Recent Posts</h3>
					<span class="text-sm" style="color:#94a3b8;">{dashboardData.recentPosts.length} posts shown</span>
				</div>

				{#if dashboardData.recentPosts.length === 0}
					<p class="py-8 text-center" style="color:#94a3b8;">
						No posts yet. Submit your first LinkedIn post to get started!
					</p>
				{:else}
					<div class="space-y-4">
						{#each dashboardData.recentPosts as post}
							<!-- Individual Post Card (GLASS) -->
							<div
								class="rounded-lg p-4 transition-shadow hover:shadow-xl"
								style="background-color:rgba(16,35,73,0.28); border:1px solid {post.type === 'comment_activity' ? '#22c55e' : post.status ? (post.status === 'pending' ? '#fbbf24' : '#f97316') : '#24b0ff'}; backdrop-filter:blur(6px);"
							>
								<div class="mb-2 flex items-start justify-between">
									<div class="flex-1">
										<p class="mb-2 text-sm" style="color:#e2e8f0;">{post.content}</p>
										<div class="flex items-center space-x-4 text-sm">
											<span style="color:#cbd5e1;">{formatDate(post.postedAt)}</span>
											{#if post.type === 'comment_activity'}
												<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
													style="background-color:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3);">
													💬 Comment Activity
												</span>
												<span style="color:#cbd5e1;">Points: +{post.totalScore}</span>
											{:else if post.status}
												<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
													style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.3);">
													{post.status === 'pending' ? '⏳ Processing' : '🔄 Scraping'}
												</span>
												<span style="color:#cbd5e1;">Est. Score: {post.totalScore}</span>
											{:else}
												<span style="color:#cbd5e1;">Score: {post.totalScore}</span>
											{/if}
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

								{#if post.type !== 'comment_activity'}
									<div class="mt-3 flex items-center justify-between border-t pt-3" style="border-color:rgba(148,163,184,0.2);">
										<div class="grid flex-1 grid-cols-3 gap-4">
											<div class="text-center">
												<div class="font-medium" style="color:#f1f5f9;">{post.reactions}</div>
												<div class="text-xs" style="color:#94a3b8;">Reactions</div>
												{#if post.status}
													<div class="text-xs" style="color:#24b0ff;">+? pts</div>
												{:else if post.growth.reactions !== 0}
													<div class="text-xs" style="color:{post.growth.reactions > 0 ? '#22c55e' : '#ef4444'};">
														{post.growth.reactions > 0 ? '+' : ''}{post.growth.reactions}
													</div>
												{:else}
													<div class="text-xs" style="color:#94a3b8;">
														+{(post.reactions * 0.1).toFixed(1)} pts
													</div>
												{/if}
											</div>

											<div class="text-center">
												<div class="font-medium" style="color:#f1f5f9;">{post.comments}</div>
												<div class="text-xs" style="color:#94a3b8;">Comments</div>
												{#if post.status}
													<div class="text-xs" style="color:#24b0ff;">+? pts</div>
												{:else if post.growth.comments !== 0}
													<div class="text-xs" style="color:{post.growth.comments > 0 ? '#22c55e' : '#ef4444'};">
														{post.growth.comments > 0 ? '+' : ''}{post.growth.comments}
													</div>
												{:else}
													<div class="text-xs" style="color:#94a3b8;">
														+{post.comments * 1} pts
													</div>
												{/if}
											</div>

											<div class="text-center">
												<div class="font-medium" style="color:#f1f5f9;">{post.reposts}</div>
												<div class="text-xs" style="color:#94a3b8;">Reposts</div>
												{#if post.status}
													<div class="text-xs" style="color:#24b0ff;">+? pts</div>
												{:else if post.growth.reposts !== 0}
													<div class="text-xs" style="color:{post.growth.reposts > 0 ? '#22c55e' : '#ef4444'};">
														{post.growth.reposts > 0 ? '+' : ''}{post.growth.reposts}
													</div>
												{:else}
													<div class="text-xs" style="color:#94a3b8;">
														+{post.reposts * 2} pts
													</div>
												{/if}
											</div>
										</div>

										<div class="ml-4 text-right">
											<div class="text-sm" style="color:#cbd5e1;">
												{post.status ? 'Submitted' : 'Last updated'}
											</div>
											<div class="text-xs" style="color:#94a3b8;">{formatDate(post.lastScrapedAt)}</div>
										</div>
									</div>
								{:else}
									<div class="mt-3 border-t pt-3 text-center" style="border-color:rgba(148,163,184,0.2);">
										<div class="text-sm" style="color:#22c55e;">
											Comment activity logged • {formatDate(post.postedAt)}
										</div>
									</div>
								{/if}
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
