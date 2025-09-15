<script>
	import { SCORING_CONFIG, ACHIEVEMENTS } from '$lib/gamification.js';
</script>

<svelte:head>
	<title>Points & Achievements - PostWars</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="mb-4 text-3xl font-bold" style="color:#fdfdfd;">Points & Achievements</h1>
			<p class="text-lg" style="color:#cbd5e1;">
				Understand how to earn points and unlock achievements in PostWars
			</p>
		</div>

		<!-- Points System -->
		<section class="mb-12">
			<h2 class="mb-6 text-2xl font-semibold" style="color:#fdfdfd;">📊 How Points Work</h2>
			
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<!-- Base Points -->
				<div
					class="rounded-lg p-6 backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
				>
					<h3 class="mb-3 text-lg font-medium" style="color:#e5e7eb;">🎯 Base Points</h3>
					<ul class="space-y-2 text-sm" style="color:#cbd5e1;">
						<li>• New post: <strong style="color:#24b0ff;">{SCORING_CONFIG.BASE_POST_POINTS} point</strong></li>
						<li>• Comment activity: <strong style="color:#24b0ff;">{SCORING_CONFIG.COMMENT_ACTIVITY_POINTS} point</strong></li>
						<li>• Daily limit for comments: <strong style="color:#24b0ff;">{SCORING_CONFIG.MAX_DAILY_COMMENTS}</strong></li>
					</ul>
				</div>

				<!-- Engagement Points -->
				<div
					class="rounded-lg p-6 backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
				>
					<h3 class="mb-3 text-lg font-medium" style="color:#e5e7eb;">💬 Engagement Points</h3>
					<ul class="space-y-2 text-sm" style="color:#cbd5e1;">
						<li>• Reaction: <strong style="color:#24b0ff;">{SCORING_CONFIG.REACTION_POINTS} points</strong> each</li>
						<li>• Comment: <strong style="color:#24b0ff;">{SCORING_CONFIG.COMMENT_POINTS} point</strong> each</li>
						<li>• Repost: <strong style="color:#24b0ff;">{SCORING_CONFIG.REPOST_POINTS} points</strong> each</li>
					</ul>
				</div>

				<!-- Streak Bonuses -->
				<div
					class="rounded-lg p-6 backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
				>
					<h3 class="mb-3 text-lg font-medium" style="color:#e5e7eb;">🔥 Streak Bonuses</h3>
					<ul class="space-y-2 text-sm" style="color:#cbd5e1;">
						<li>• Streak multiplier: <strong style="color:#24b0ff;">+{SCORING_CONFIG.STREAK_MULTIPLIER * 100}%</strong> per day</li>
						<li>• Maximum bonus: <strong style="color:#24b0ff;">{SCORING_CONFIG.MAX_STREAK_BONUS * 100}%</strong></li>
						<li>• Applies to base points only</li>
					</ul>
				</div>
			</div>

			<!-- Freshness Factor -->
			<div
				class="mt-6 rounded-lg p-6 backdrop-blur-md"
				style="background-color:rgba(255,165,0,0.08); border:1px solid rgba(255,165,0,0.3);"
			>
				<h3 class="mb-3 text-lg font-medium" style="color:#ffa500;">⏰ Freshness Factor</h3>
				<p class="text-sm" style="color:#cbd5e1;">
					Posts remain at full points for <strong style="color:#ffa500;">{SCORING_CONFIG.FRESH_HOURS} hours</strong>, 
					then decay by <strong style="color:#ffa500;">{SCORING_CONFIG.DECAY_RATE * 100}% per day</strong> 
					to encourage recent activity and maintain leaderboard relevance.
				</p>
			</div>

			<!-- Example Calculation -->
			<div
				class="mt-6 rounded-lg p-6 backdrop-blur-md"
				style="background-color:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3);"
			>
				<h3 class="mb-3 text-lg font-medium" style="color:#22c55e;">🧮 Example Calculation</h3>
				<div class="text-sm" style="color:#cbd5e1;">
					<p class="mb-2">
						<strong>Post with 50 reactions, 10 comments, 3 reposts, 3-day streak:</strong>
					</p>
					<ul class="ml-4 space-y-1">
						<li>• Base: 1 point × 1.3 (30% streak bonus) = 1.3 points</li>
						<li>• Engagement: (50 × 0.1) + (10 × 1) + (3 × 2) = 21 points</li>
						<li>• <strong style="color:#22c55e;">Total: 22.3 points</strong></li>
					</ul>
				</div>
			</div>
		</section>

		<!-- Achievements -->
		<section>
			<h2 class="mb-6 text-2xl font-semibold" style="color:#fdfdfd;">🏆 Available Achievements</h2>
			<p class="mb-6 text-sm" style="color:#cbd5e1;">
				Unlock achievements by reaching specific milestones. Each achievement awards bonus points!
			</p>
			
			<div class="grid gap-4 md:grid-cols-2">
				{#each ACHIEVEMENTS as achievement}
					<div
						class="rounded-lg p-6 backdrop-blur-md transition-transform hover:scale-105"
						style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
					>
						<div class="flex items-start gap-4">
							<div class="text-3xl">{achievement.icon}</div>
							<div class="flex-1">
								<h3 class="mb-1 text-lg font-medium" style="color:#e5e7eb;">
									{achievement.name}
								</h3>
								<p class="mb-2 text-sm" style="color:#cbd5e1;">
									{achievement.description}
								</p>
								<div class="flex items-center gap-2">
									<span
										class="rounded px-2 py-1 text-xs font-medium"
										style="background-color:rgba(36,176,255,0.15); color:#24b0ff;"
									>
										+{achievement.points} points
									</span>
									<span class="text-xs" style="color:#94a3b8;">
										{#if achievement.requirementType === 'posts_count'}
											Post {achievement.requirementValue} time{achievement.requirementValue > 1 ? 's' : ''}
										{:else if achievement.requirementType === 'engagement_total'}
											Get {achievement.requirementValue} total reactions
										{:else if achievement.requirementType === 'streak_days'}
											{achievement.requirementValue} day streak
										{:else if achievement.requirementType === 'single_post_reactions'}
											{achievement.requirementValue} reactions on one post
										{/if}
									</span>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Tips Section -->
		<section class="mt-12">
			<h2 class="mb-6 text-2xl font-semibold" style="color:#fdfdfd;">💡 Tips for Success</h2>
			
			<div class="grid gap-4 md:grid-cols-2">
				<div
					class="rounded-lg p-6 backdrop-blur-md"
					style="background-color:rgba(139,69,196,0.08); border:1px solid rgba(139,69,196,0.3);"
				>
					<h3 class="mb-3 text-lg font-medium" style="color:#8b45c4;">🚀 Maximize Points</h3>
					<ul class="space-y-2 text-sm" style="color:#cbd5e1;">
						<li>• Post consistently to build streak bonuses</li>
						<li>• Engage with others' content to get comment activity points</li>
						<li>• Create engaging content that gets reactions and comments</li>
						<li>• Submit posts quickly after publishing for maximum freshness</li>
					</ul>
				</div>

				<div
					class="rounded-lg p-6 backdrop-blur-md"
					style="background-color:rgba(236,72,153,0.08); border:1px solid rgba(236,72,153,0.3);"
				>
					<h3 class="mb-3 text-lg font-medium" style="color:#ec4899;">🎯 Achievement Strategy</h3>
					<ul class="space-y-2 text-sm" style="color:#cbd5e1;">
						<li>• Start with "First Post" for quick points</li>
						<li>• Focus on consistency for streak achievements</li>
						<li>• Create shareable content for viral moments</li>
						<li>• Check dashboard regularly to track progress</li>
					</ul>
				</div>
			</div>
		</section>

		<!-- Update Schedule -->
		<div
			class="mt-8 rounded-lg p-6 backdrop-blur-md"
			style="background-color:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3);"
		>
			<h3 class="mb-3 text-lg font-medium" style="color:#22c55e;">🔄 Update Schedule</h3>
			<p class="text-sm" style="color:#cbd5e1;">
				Points are updated <strong style="color:#22c55e;">twice daily at 6 AM and 6 PM UTC</strong> 
				when we scrape LinkedIn for the latest engagement data. Your dashboard shows real-time progress!
			</p>
		</div>
	</div>
</div>