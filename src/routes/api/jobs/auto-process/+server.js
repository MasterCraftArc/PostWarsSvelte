import { json } from '@sveltejs/kit';
import { jobQueue } from '$lib/job-queue.js';
import { supabaseAdmin } from '$lib/supabase-node.js';

// GET /api/jobs/auto-process - Automatically load and process queued jobs
export async function GET(event) {
	try {
		console.log('🔄 Auto-processing queued jobs...');
		
		// Load any queued jobs from the database
		const { data: queuedJobs, error: jobsError } = await supabaseAdmin
			.from('jobs')
			.select('*')
			.eq('status', 'QUEUED')
			.order('createdAt', { ascending: true });

		if (jobsError) {
			console.error('Error fetching queued jobs:', jobsError);
			return json({ error: 'Failed to fetch jobs' }, { status: 500 });
		}

		console.log(`Found ${queuedJobs.length} queued jobs to auto-process`);

		// Add jobs to the queue
		let jobsAdded = 0;
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
				jobsAdded++;
			}
		}
		
		// Note: Job processing should be handled by separate worker process
		if (jobsAdded > 0) {
			console.log(`📋 Added ${jobsAdded} jobs to queue. Start separate worker process to handle processing.`);
		}

		// Get current queue stats
		const stats = jobQueue.getQueueStats();
		
		return json({ 
			message: 'Auto-processing completed',
			jobsLoaded: jobsAdded,
			totalQueued: queuedJobs.length,
			stats: stats
		});

	} catch (error) {
		console.error('Auto-process jobs error:', error);
		return json({ error: 'Failed to auto-process jobs' }, { status: 500 });
	}
}