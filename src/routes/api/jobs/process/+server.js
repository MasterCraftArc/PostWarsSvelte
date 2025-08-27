import { json } from '@sveltejs/kit';
import { jobQueue } from '$lib/job-queue.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

// POST /api/jobs/process - Manually process queued jobs (admin endpoint)
export async function POST(event) {
	// Check if this is a development bypass request
	const { bypass } = await event.request.json().catch(() => ({}));
	
	if (bypass === 'development') {
		console.log('🔄 Development job processing bypass activated');
	} else {
		const user = await getAuthenticatedUser(event);
		
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Only allow admins to manually process jobs for security
		if (user.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}
		
		console.log('🔄 Manual job processing requested by admin:', user.email);
	}

	try {
		
		// First, load any queued jobs from the database
		const { supabaseAdmin } = await import('$lib/supabase-server.js');
		const { data: queuedJobs, error: jobsError } = await supabaseAdmin
			.from('jobs')
			.select('*')
			.eq('status', 'QUEUED')
			.order('createdAt', { ascending: true });

		if (jobsError) {
			console.error('Error fetching queued jobs:', jobsError);
			return json({ error: 'Failed to fetch jobs' }, { status: 500 });
		}

		console.log(`Found ${queuedJobs.length} queued jobs to process`);

		// Add jobs to the queue
		for (const dbJob of queuedJobs) {
			const queueJob = {
				id: dbJob.id,
				type: dbJob.type,
				data: JSON.parse(dbJob.data),
				userId: dbJob.userId,
				status: 'queued',
				createdAt: dbJob.createdAt,
				attempts: dbJob.attempts,
				maxAttempts: dbJob.maxAttempts
			};

			// Check if job is already in queue
			const exists = jobQueue.queue.find(job => job.id === queueJob.id);
			if (!exists) {
				jobQueue.queue.push(queueJob);
				console.log(`Added job ${queueJob.id} to queue`);
			}
		}
		
		// Note: Job processing should be handled by separate worker process
		// This serverless function only manages the queue, not processing
		console.log('📋 Jobs added to queue. Start separate worker process to handle processing.');

		// Get current queue stats
		const stats = jobQueue.getQueueStats();
		
		return json({ 
			message: 'Job processing initiated',
			jobsLoaded: queuedJobs.length,
			stats: stats
		});

	} catch (error) {
		console.error('Process jobs error:', error);
		return json({ error: 'Failed to process jobs' }, { status: 500 });
	}
}

// GET /api/jobs/process - Get job queue status
export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Only allow admins to check job status for security
	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const stats = jobQueue.getQueueStats();
		
		return json({
			queueStats: stats,
			processing: jobQueue.processing
		});

	} catch (error) {
		console.error('Get job stats error:', error);
		return json({ error: 'Failed to get job stats' }, { status: 500 });
	}
}