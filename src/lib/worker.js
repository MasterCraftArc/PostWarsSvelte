#!/usr/bin/env node

import { jobQueue } from './job-queue.js';
import { supabaseAdmin } from './supabase-server.js';

class BackgroundWorker {
	constructor() {
		this.isRunning = false;
		this.restartJobsOnStartup = true;
	}

	async start() {
		if (this.isRunning) {
			console.log('Worker already running');
			return;
		}

		console.log('🚀 Starting background worker...');
		this.isRunning = true;

		// Restart incomplete jobs from database
		if (this.restartJobsOnStartup) {
			await this.restartIncompleteJobs();
		}

		// Set up job queue event listeners
		this.setupEventListeners();

		// Start monitoring
		this.startMonitoring();

		console.log('✅ Background worker started successfully');
	}

	async restartIncompleteJobs() {
		console.log('🔄 Restarting incomplete jobs...');

		try {
			// Find jobs that were processing but didn't complete
			const { data: incompleteJobs, error } = await supabaseAdmin
				.from('jobs')
				.select('*')
				.in('status', ['PROCESSING', 'QUEUED'])
				.order('createdAt', { ascending: true });

			if (error) {
				console.error('Error fetching incomplete jobs:', error);
				return;
			}

			console.log(`Found ${incompleteJobs.length} incomplete jobs`);

			for (const dbJob of incompleteJobs) {
				// Reset processing jobs back to queued
				if (dbJob.status === 'PROCESSING') {
					await supabaseAdmin
						.from('jobs')
						.update({ 
							status: 'QUEUED',
							startedAt: null
						})
						.eq('id', dbJob.id);
				}

				// Convert database job to queue format and add to queue
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

				jobQueue.queue.push(queueJob);
			}

			if (incompleteJobs.length > 0) {
				// Start processing the restarted jobs
				jobQueue.startProcessing();
			}

		} catch (error) {
			console.error('Failed to restart incomplete jobs:', error);
		}
	}

	setupEventListeners() {
		jobQueue.on('job-added', (job) => {
			console.log(`📝 Job added: ${job.id} (${job.type})`);
		});

		jobQueue.on('job-started', (job) => {
			console.log(`▶️  Job started: ${job.id} (${job.type}) - User: ${job.userId}`);
		});

		jobQueue.on('job-completed', (job) => {
			console.log(`✅ Job completed: ${job.id} (${job.type}) - Duration: ${job.completedAt - job.startedAt}ms`);
		});

		jobQueue.on('job-failed', (job) => {
			console.log(`❌ Job failed: ${job.id} (${job.type}) - Error: ${job.error}`);
		});

		jobQueue.on('job-retry', (job) => {
			console.log(`🔄 Job retry: ${job.id} (${job.type}) - Attempt: ${job.attempts}`);
		});
	}

	startMonitoring() {
		// Log stats every 30 seconds
		setInterval(() => {
			this.logStats();
		}, 30000);

		// Clean up old jobs every hour
		setInterval(() => {
			this.cleanupOldJobs();
		}, 3600000);

		// Health check every 5 minutes
		setInterval(() => {
			this.healthCheck();
		}, 300000);
	}

	async logStats() {
		const queueStats = jobQueue.getQueueStats();
		
		try {
			const { browserPool } = await import('./linkedin-scraper-pool.js');
			const browserStats = browserPool.getStats();
			console.log(`📊 Stats - Queue: ${queueStats.queueLength} pending, ${queueStats.activeJobs} active | Browsers: ${browserStats.activeBrowsers}/${browserStats.totalBrowsers}, Pages: ${browserStats.totalPages}`);
		} catch (error) {
			console.log(`📊 Stats - Queue: ${queueStats.queueLength} pending, ${queueStats.activeJobs} active | Browser pool unavailable`);
		}
	}

	async cleanupOldJobs() {
		try {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 7); // Keep jobs for 7 days

			const { data: deleted, error } = await supabaseAdmin
				.from('jobs')
				.delete()
				.in('status', ['COMPLETED', 'FAILED'])
				.lt('createdAt', cutoff.toISOString())
				.select('id');

			if (error) {
				console.error('Error cleaning up jobs:', error);
				return;
			}

			if (deleted && deleted.length > 0) {
				console.log(`🧹 Cleaned up ${deleted.length} old jobs`);
			}
		} catch (error) {
			console.error('Failed to cleanup old jobs:', error);
		}
	}

	async healthCheck() {
		try {
			// Check database connection
			const { error: connectionError } = await supabaseAdmin
				.from('jobs')
				.select('id')
				.limit(1);

			if (connectionError) {
				console.error('Database connection check failed:', connectionError);
			}

			// Check browser pool health
			try {
				const { browserPool } = await import('./linkedin-scraper-pool.js');
				const browserStats = browserPool.getStats();
				if (browserStats.totalBrowsers === 0 && jobQueue.getQueueStats().queueLength > 0) {
					console.warn('⚠️  No browsers available but jobs are queued');
				}
			} catch (error) {
				console.log('Browser pool health check unavailable');
			}

			// Check for stuck jobs (processing for more than 10 minutes)
			const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
			const { data: stuckJobs, error: stuckJobsError } = await supabaseAdmin
				.from('jobs')
				.select('*')
				.eq('status', 'PROCESSING')
				.lt('startedAt', tenMinutesAgo.toISOString());

			if (stuckJobsError) {
				console.error('Error checking for stuck jobs:', stuckJobsError);
				return;
			}

			if (stuckJobs && stuckJobs.length > 0) {
				console.warn(`⚠️  Found ${stuckJobs.length} stuck jobs, resetting to queued`);
				
				for (const job of stuckJobs) {
					await supabaseAdmin
						.from('jobs')
						.update({ 
							status: 'QUEUED',
							startedAt: null,
							error: 'Job was stuck in processing state'
						})
						.eq('id', job.id);

					// Add back to queue
					const queueJob = {
						id: job.id,
						type: job.type,
						data: JSON.parse(job.data),
						userId: job.userId,
						status: 'queued',
						createdAt: job.createdAt,
						attempts: job.attempts,
						maxAttempts: job.maxAttempts
					};

					jobQueue.queue.push(queueJob);
				}

				jobQueue.startProcessing();
			}

		} catch (error) {
			console.error('Health check failed:', error);
		}
	}

	async stop() {
		console.log('🛑 Stopping background worker...');
		this.isRunning = false;

		// Cleanup browser pool
		try {
			const { browserPool } = await import('./linkedin-scraper-pool.js');
			await browserPool.cleanup();
		} catch (error) {
			console.log('Browser pool cleanup unavailable');
		}

		// Supabase connections are automatically managed
		// No explicit disconnect needed

		console.log('✅ Background worker stopped');
	}
}

// Create and export worker instance
const worker = new BackgroundWorker();

// Handle process signals
process.on('SIGINT', async () => {
	console.log('\n🛑 Received SIGINT, shutting down gracefully...');
	await worker.stop();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
	await worker.stop();
	process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
	console.error('💥 Uncaught Exception:', error);
	worker.stop().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
	worker.stop().then(() => process.exit(1));
});

// Start worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	worker.start().catch((error) => {
		console.error('Failed to start worker:', error);
		process.exit(1);
	});
}

export { worker };