import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { jobQueue } from '$lib/job-queue.js';
import { postSubmissionLimiter, ipBasedLimiter } from '$lib/rate-limiter.js';
import { handleRateLimitError, sanitizeError } from '$lib/error-handler.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function POST(event) {
	try {
		const user = await getAuthenticatedUser(event);
		
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { linkedinUrl } = await event.request.json();

		if (!linkedinUrl || !linkedinUrl.includes('linkedin.com')) {
			return json({ error: 'Valid LinkedIn URL required' }, { status: 400 });
		}

		// Check rate limits
		const userId = user.id;
		const clientIP = event.getClientAddress();

		// Check per-user rate limit
		const userLimit = postSubmissionLimiter.isAllowed(userId);
		if (!userLimit.allowed) {
			const rateLimitError = new Error('User rate limit exceeded');
			const sanitized = handleRateLimitError(rateLimitError, userLimit.retryAfter);
			return json(sanitized, { status: 429 });
		}

		// Check IP-based rate limit
		const ipLimit = ipBasedLimiter.isAllowed(clientIP);
		if (!ipLimit.allowed) {
			const rateLimitError = new Error('IP rate limit exceeded');
			const sanitized = handleRateLimitError(rateLimitError, ipLimit.retryAfter);
			return json(sanitized, { status: 429 });
		}

		// Check if post already exists for this user
		const { data: existingPost } = await supabaseAdmin
			.from('linkedin_posts')
			.select('id')
			.eq('url', linkedinUrl)
			.eq('userId', userId)
			.single();

		if (existingPost) {
			return json({ error: 'Post already tracked by you' }, { status: 409 });
		}

		// Add job to database for tracking
		console.log(`Creating scraping job for user ${userId}: ${linkedinUrl}`);

		try {
			const job = await jobQueue.addJob('scrape-post', {
				linkedinUrl,
				userId
			}, userId);

			const githubToken = process.env.GITHUB_TOKEN;
			const githubRepo = process.env.GITHUB_REPOSITORY || 'your-username/PostWarsV2';
			
			// Try GitHub Action first, fall back to local processing if not configured
			if (githubToken && githubRepo !== 'your-username/PostWarsV2') {
				try {
					console.log('🚀 Triggering GitHub Action for scraping job:', job.id);
					
					const response = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/scrape-linkedin-post.yml/dispatches`, {
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${githubToken}`,
							'Accept': 'application/vnd.github.v3+json',
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							ref: 'main',
							inputs: {
								job_id: job.id,
								linkedin_url: linkedinUrl,
								user_id: userId
							}
						})
					});

					if (!response.ok) {
						const errorText = await response.text();
						throw new Error(`GitHub Action trigger failed: ${response.status} ${errorText}`);
					}

					console.log('✅ GitHub Action triggered successfully');

					return json({
						message: 'Post submitted for processing',
						jobId: job.id,
						status: 'queued',
						estimatedWaitTime: '30-90 seconds',
						note: 'Processing via GitHub Action'
					}, { status: 202 });

				} catch (githubError) {
					console.warn('GitHub Action failed, falling back to local processing:', githubError.message);
					// Fall through to local processing
				}
			} else {
				console.log('GitHub credentials not configured, using local processing');
			}

			// Local processing fallback
			try {
				console.log('🔄 Processing job locally:', job.id);
				await jobQueue.processJob(job.id);
				
				return json({
					message: 'Post submitted and processed successfully',
					jobId: job.id,
					status: 'processing',
					estimatedWaitTime: '10-30 seconds',
					note: 'Processing locally'
				}, { status: 202 });
				
			} catch (localError) {
				console.error('Local processing failed:', localError.message);
				throw new Error('Both GitHub Action and local processing failed');
			}

		} catch (queueError) {
			// Record rate limit failure
			if (queueError.message.includes('Rate limit')) {
				postSubmissionLimiter.recordFailure(userId);
				ipBasedLimiter.recordFailure(clientIP);
			}
			
			const sanitized = sanitizeError(queueError, 'Failed to process request');
			return json(sanitized, { status: 400 });
		}
	} catch (error) {
		const sanitized = sanitizeError(error, 'Internal server error');
		return json(sanitized, { status: 500 });
	}
}
