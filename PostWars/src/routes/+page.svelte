<script>
	import { user } from '$lib/stores/auth.js';
</script>

<div class="mx-auto max-w-4xl px-4 py-8">
	<div class="mb-12 text-center">
		<h1
			class="mb-4 bg-gradient-to-r from-[#24b0ff] to-[#a78bfa] bg-clip-text text-5xl font-bold text-transparent"
		>
			LinkedIn Gamification Platform
		</h1>
		<p class="mb-8 text-xl" style="color:#cbd5e1;">
			Turn your LinkedIn posting into a competitive game! Track engagement, earn points, and climb
			the leaderboard.
		</p>
	</div>

	{#if $user}
		<div class="space-y-6 text-center">
			<div
				class="rounded-xl p-8 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<h2 class="mb-4 text-2xl font-semibold" style="color:#fdfdfd;">
					Welcome back, {$user.name || $user.email}! 🎉
				</h2>
				<p class="mb-6" style="color:#cbd5e1;">Ready to boost your LinkedIn presence?</p>

				<div class="mx-auto grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
					<a
						href="/dashboard"
						class="block rounded-lg px-6 py-4 transition-colors"
						style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.6);"
					>
						<div class="mb-2 text-2xl">📊</div>
						<div class="font-semibold">Dashboard</div>
						<div class="text-sm opacity-80">View your stats</div>
					</a>

					<a
						href="/submit"
						class="block rounded-lg px-6 py-4 transition-colors"
						style="background-color:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.6);"
					>
						<div class="mb-2 text-2xl">📝</div>
						<div class="font-semibold">Submit Post</div>
						<div class="text-sm opacity-80">Add new LinkedIn post</div>
					</a>

					<a
						href="/leaderboard"
						class="block rounded-lg px-6 py-4 transition-colors"
						style="background-color:rgba(167,139,250,0.15); color:#a78bfa; border:1px solid rgba(167,139,250,0.6);"
					>
						<div class="mb-2 text-2xl">🏆</div>
						<div class="font-semibold">Leaderboard</div>
						<div class="text-sm opacity-80">See top performers</div>
					</a>
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center">
			<div
				class="mb-8 rounded-xl p-8 shadow-lg backdrop-blur-md"
				style="background-color:rgba(255,255,255,0.05); border:1px solid #24b0ff;"
			>
				<h2 class="mb-4 text-2xl font-semibold" style="color:#fdfdfd;">Get Started Today!</h2>
				<p class="mb-6" style="color:#cbd5e1;">
					Join your team in making LinkedIn engagement fun and competitive.
				</p>

				<div class="space-x-4">
					<a
						href="/login"
						class="inline-block rounded-lg px-8 py-3 transition-colors"
						style="background-color:rgba(36,176,255,0.15); color:#24b0ff; border:1px solid rgba(36,176,255,0.6);"
					>
						Login
					</a>
					<a
						href="/signup"
						class="inline-block rounded-lg px-8 py-3 transition-colors"
						style="background-color:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.6);"
					>
						Sign Up
					</a>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-6 text-left md:grid-cols-3">
				<div
					class="rounded-lg p-6 shadow-md backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
				>
					<div class="mb-4 text-3xl">🎯</div>
					<h3 class="mb-2 font-semibold" style="color:#fdfdfd;">Track Performance</h3>
					<p style="color:#cbd5e1;">
						Monitor likes, comments, and shares on your LinkedIn posts with real-time analytics.
					</p>
				</div>

				<div
					class="rounded-lg p-6 shadow-md backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
				>
					<div class="mb-4 text-3xl">🏅</div>
					<h3 class="mb-2 font-semibold" style="color:#fdfdfd;">Earn Points</h3>
					<p style="color:#cbd5e1;">
						Get points for posting, engagement, and maintaining streaks. Unlock achievements as you
						grow!
					</p>
				</div>

				<div
					class="rounded-lg p-6 shadow-md backdrop-blur-md"
					style="background-color:rgba(16,35,73,0.28); border:1px solid #24b0ff;"
				>
					<div class="mb-4 text-3xl">🚀</div>
					<h3 class="mb-2 font-semibold" style="color:#fdfdfd;">Compete & Win</h3>
					<p style="color:#cbd5e1;">
						Climb the leaderboard and compete with your colleagues for the top spot.
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
