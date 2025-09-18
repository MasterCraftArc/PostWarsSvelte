<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { authenticatedRequest } from '$lib/api.js';
	import { getPostEngagement } from '$lib/engagement.js';
	import { user } from '$lib/stores/auth.js';

	let userData = $state(null);
	let userPosts = $state([]);
	let userAchievements = $state([]);
	let loading = $state(true);
	let error = $state('');

	const userId = $page.params.userId;

	async function loadUserProfile() {
		loading = true;
		error = '';

		try {
			// Load user data
			console.log('Loading user profile for userId:', userId);
			const userResponse = await authenticatedRequest(`/api/users/${userId}`);
			console.log('User response:', userResponse);
			userData = userResponse.user;

			// Load user's posts
			const postsResponse = await authenticatedRequest(`/api/posts?userId=${userId}`);
			console.log('Posts response:', postsResponse);
			userPosts = postsResponse.posts || [];

			// Load user's achievements
			try {
				const achievementsResponse = await authenticatedRequest('/api/achievements/recent', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userIds: [userId], limit: 10 })
				});
				console.log('Achievements response:', achievementsResponse);
				userAchievements = achievementsResponse.achievements?.[userId] || [];
			} catch (achievementError) {
				console.log('Failed to load achievements:', achievementError);
				userAchievements = [];
			}
		} catch (err) {
			console.error('Error loading user profile:', err);
			error = err.message || 'Failed to load user profile';
		}

		loading = false;
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	onMount(() => {
		loadUserProfile();
	});
</script>

<svelte:head>
	<title>{userData?.name || 'User Profile'} - LinkedIn Gamification</title>
</svelte:head>

<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div
				class="w-12 h-12 border-b-2 rounded-full animate-spin"
				style="border-color: #24b0ff;"
			></div>
		</div>
	{:else if error}
		<div
			class="px-4 py-3 rounded mb-6"
			style="border: 1px solid #ff5456; background-color: rgba(255, 84, 86, 0.12); color: #ff5456;"
		>
			{error}
		</div>
	{:else if userData}
		<div class="space-y-6">
			<!-- User Header -->
			<div
				class="rounded-xl p-6 backdrop-blur-md"
				style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid #24b0ff;"
			>
				<div class="flex items-start justify-between">
					<div>
						<h1 class="text-3xl font-bold text-white mb-2">
							{userData.name || userData.email}
							{#if userData.id === $user?.id}
								<span class="text-lg font-normal text-[#24b0ff]">(You)</span>
							{/if}
						</h1>
						{#if userData.teamName && userData.teamName !== 'No Team'}
							<div class="flex items-center space-x-2 mb-4">
								<span class="text-[#94a3b8]">Team:</span>
								<span
									class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium backdrop-blur-sm"
									style="background-color: rgba(36, 176, 255, 0.15); color: #24b0ff; border: 1px solid rgba(36, 176, 255, 0.4);"
								>
									🏆 {userData.teamName}
								</span>
							</div>
						{/if}
					</div>
					<div class="text-right">
						<div class="text-2xl font-bold text-white">
							{userData.totalScore?.toLocaleString() || 0}
						</div>
						<div class="text-sm text-[#94a3b8]">total points</div>
					</div>
				</div>

				<!-- Stats Row -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
					<div class="text-center">
						<div class="text-xl font-bold text-white">{userPosts.length}</div>
						<div class="text-xs text-[#94a3b8]">Posts</div>
					</div>
					<div class="text-center">
						<div class="text-xl font-bold text-white">{userData.currentStreak || 0}</div>
						<div class="text-xs text-[#94a3b8]">Current Streak</div>
					</div>
					<div class="text-center">
						<div class="text-xl font-bold text-white">{userData.bestStreak || 0}</div>
						<div class="text-xs text-[#94a3b8]">Best Streak</div>
					</div>
					<div class="text-center">
						<div class="text-xl font-bold text-white">
							{userPosts.reduce((total, post) => total + getPostEngagement(post), 0)}
						</div>
						<div class="text-xs text-[#94a3b8]">Total Engagement</div>
					</div>
				</div>
			</div>

			<!-- Recent Achievements -->
			{#if userAchievements.length > 0}
				<div
					class="rounded-xl p-6 backdrop-blur-md"
					style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid #24b0ff;"
				>
					<h2 class="text-xl font-bold text-white mb-4">Recent Achievements</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{#each userAchievements.slice(0, 6) as achievement}
							<div
								class="rounded-lg p-4 flex items-center space-x-3"
								style="background-color: rgba(36, 176, 255, 0.08); border: 1px solid rgba(36, 176, 255, 0.25);"
							>
								<span class="text-2xl" style="color: #24b0ff;">{achievement.icon}</span>
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium text-white">{achievement.name}</div>
									<div class="text-xs text-[#94a3b8]">{achievement.description}</div>
									<div class="text-xs text-[#94a3b8]">
										{new Date(achievement.earnedAt).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric'
										})} • {achievement.points} pts
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Recent Posts -->
			<div
				class="rounded-xl p-6 backdrop-blur-md"
				style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid #24b0ff;"
			>
				<h2 class="text-xl font-bold text-white mb-4">Recent Posts</h2>

				{#if userPosts.length > 0}
					<div class="space-y-4">
						{#each userPosts.slice(0, 10) as post}
							<div
								class="rounded-lg p-4 transition-all duration-200"
								style="background-color: rgba(36, 176, 255, 0.08); border: 1px solid rgba(36, 176, 255, 0.25);"
							>
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										{#if post.content}
											<p class="mb-2 text-sm text-[#e2e8f0]">{post.content}</p>
										{/if}
										<a
											href={post.url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-[#24b0ff] hover:text-white transition-colors text-xs"
										>
											View on LinkedIn →
										</a>
										<div class="text-xs text-[#94a3b8] mt-1">
											{formatDate(post.createdAt)}
										</div>
									</div>
									<div class="text-right ml-4">
										<div class="text-sm font-bold text-white">
											{post.totalScore || 0} pts
										</div>
										<div class="text-xs text-[#94a3b8]">
											{getPostEngagement(post)} engagement
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-8 text-center text-[#94a3b8]">
						No posts found.
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>