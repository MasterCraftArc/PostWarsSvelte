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

		// Add job to queue for background processing
		console.log(`Queuing scraping job for user ${userId}: ${linkedinUrl}`);

		try {
			const job = await jobQueue.addJob('scrape-post', {
				linkedinUrl,
				userId
			}, userId);

			// Automatically start processing the job queue if not already running
			if (!jobQueue.processing) {
				jobQueue.startProcessing();
				console.log('🚀 Auto-started job processing for user submission');
			}

			return json({
				message: 'Post submitted for processing',
				jobId: job.id,
				status: 'queued',
				estimatedWaitTime: '30-60 seconds'
			}, { status: 202 });

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
