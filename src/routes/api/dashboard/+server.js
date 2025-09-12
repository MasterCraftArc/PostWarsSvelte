import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	const startTime = Date.now();
	console.log('🚀 Dashboard API called at:', new Date().toISOString());
	
	try {
		console.log('⏱️ Getting authenticated user...');
		const user = await getAuthenticatedUser(event);
		console.log('✅ Auth check took:', Date.now() - startTime, 'ms');
		
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		console.log('⏱️ Calling RPC function for user:', user.id);
		const rpcStart = Date.now();
		
		// Try optimized function first, fallback to original queries if it fails
		let data;
		const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_user_dashboard', {
			p_user_id: user.id
		});
		
		console.log('✅ RPC call took:', Date.now() - rpcStart, 'ms');

		if (rpcError || !rpcData) {
			console.log('❌ RPC function failed, falling back to original queries:', rpcError);
			const fallbackStart = Date.now();
			// Fallback to original implementation
			data = await getFallbackDashboardData(user.id);
			console.log('✅ Fallback queries took:', Date.now() - fallbackStart, 'ms');
		} else {
			console.log('✅ RPC function succeeded');
			data = rpcData;
		}

		console.log('🎉 Total dashboard API time:', Date.now() - startTime, 'ms');

		// Cache response for 5 minutes
		const response = json(data);
		response.headers.set('Cache-Control', 'public, max-age=300');
		
		return response;
	} catch (error) {
		console.error('❌ Dashboard error after', Date.now() - startTime, 'ms:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

// Fallback function with original logic
async function getFallbackDashboardData(userId) {
	const userData = await supabaseAdmin
		.from('users')
		.select('*')
		.eq('id', userId)
		.single();

	// Get posts with analytics
	const { data: linkedinPosts } = await supabaseAdmin
		.from('linkedin_posts')
		.select(`
			*,
			analytics:post_analytics(*)
		`)
		.eq('userId', userId)
		.order('postedAt', { ascending: false })
		.limit(10);

	// Get pending jobs for this user
	const { data: pendingJobs } = await supabaseAdmin
		.from('jobs')
		.select('*')
		.eq('userId', userId)
		.in('status', ['QUEUED', 'PROCESSING'])
		.order('createdAt', { ascending: false });

	// Get comment activities for this user
	const { data: commentActivities } = await supabaseAdmin
		.from('comment_activities')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(10);

	// Get achievements
	const { data: userAchievements } = await supabaseAdmin
		.from('user_achievements')
		.select(`
			*,
			achievement:achievements(*)
		`)
		.eq('userId', userId)
		.order('earnedAt', { ascending: false });

	// Calculate stats
	const { count: totalPosts } = await supabaseAdmin
		.from('linkedin_posts')
		.select('*', { count: 'exact', head: true })
		.eq('userId', userId);

	const { data: totalEngagementData } = await supabaseAdmin
		.from('linkedin_posts')
		.select('totalEngagement')
		.eq('userId', userId);

	const totalEngagement = totalEngagementData?.reduce((sum, post) => sum + (post.totalEngagement || 0), 0) || 0;

	// Get user rank
	const { count: higherScoreUsers } = await supabaseAdmin
		.from('users')
		.select('*', { count: 'exact', head: true })
		.gt('totalScore', userData.data.totalScore);

	const userRank = (higherScoreUsers || 0) + 1;

	// Transform posts
	const processedPosts = (linkedinPosts || []).map((post) => ({
		id: post.id,
		url: post.url,
		content: post.content.substring(0, 150) + (post.content.length > 150 ? '...' : ''),
		authorName: post.authorName,
		reactions: post.reactions,
		comments: post.comments,
		reposts: post.reposts,
		totalEngagement: post.totalEngagement,
		totalScore: post.totalScore,
		postedAt: post.postedAt,
		lastScrapedAt: post.lastScrapedAt,
		growth: { reactions: 0, comments: 0, reposts: 0 }
	}));

	// Transform pending jobs into post-like objects
	const pendingPosts = (pendingJobs || []).map((job) => {
		const jobData = JSON.parse(job.data || '{}');
		const statusText = job.status === 'QUEUED' ? 'pending' : 'processing';
		const processingText = statusText === 'pending' 
			? 'Post is being processed...' 
			: 'Post is currently being scraped...';

		return {
			id: job.id,
			url: jobData.linkedinUrl || '',
			content: processingText,
			authorName: 'You',
			reactions: '?',
			comments: '?', 
			reposts: '?',
			totalEngagement: 0,
			totalScore: 1, // Estimated base score
			postedAt: job.createdAt,
			lastScrapedAt: job.createdAt,
			status: statusText,
			growth: { reactions: 0, comments: 0, reposts: 0 }
		};
	});

	// Transform comment activities into post-like objects
	const commentActivityPosts = (commentActivities || []).map((activity) => ({
		id: activity.id,
		url: activity.target_post_url,
		content: '💬 Commented on LinkedIn post',
		authorName: 'You',
		reactions: 'N/A',
		comments: 'N/A',
		reposts: 'N/A',
		totalEngagement: 0,
		totalScore: activity.points_awarded,
		postedAt: activity.created_at,
		lastScrapedAt: activity.created_at,
		type: 'comment_activity',
		growth: { reactions: 0, comments: 0, reposts: 0 }
	}));

	// Combine and sort all posts by date (newest first)
	const allPosts = [...processedPosts, ...pendingPosts, ...commentActivityPosts];
	const recentPosts = allPosts
		.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
		.slice(0, 15); // Show up to 15 total posts

	// Transform achievements
	const recentAchievements = (userAchievements || []).slice(0, 5).map((ua) => ({
		name: ua.achievement?.name,
		description: ua.achievement?.description,
		icon: ua.achievement?.icon,
		points: ua.achievement?.points,
		earnedAt: ua.earnedAt
	}));

	return {
		user: {
			id: userData.data.id,
			name: userData.data.name,
			email: userData.data.email,
			totalScore: userData.data.totalScore,
			postsThisMonth: userData.data.postsThisMonth,
			currentStreak: userData.data.currentStreak,
			bestStreak: userData.data.bestStreak,
			rank: userRank
		},
		stats: {
			totalPosts: totalPosts || 0,
			totalEngagement,
			monthlyPosts: 0,
			monthlyEngagement: 0,
			averageEngagement: totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0
		},
		recentPosts,
		recentAchievements
	};
}
