import { EventEmitter } from 'events';
import { supabaseAdmin } from './supabase-node.js';

class JobQueue extends EventEmitter {
	constructor() {
		super();
		this.queue = [];
		this.processing = false;
		this.concurrency = 3; // Process max 3 jobs concurrently
		this.activeJobs = 0;
		this.rateLimitWindow = 60000; // 1 minute
		this.maxJobsPerWindow = 10;
		this.jobHistory = [];
	}

	async addJob(type, data, userId = null) {
		// Check rate limit
		if (userId && !this.checkRateLimit(userId)) {
			throw new Error('Rate limit exceeded. Please wait before submitting another post.');
		}

		const job = {
			id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type,
			data,
			userId,
			status: 'queued',
			createdAt: new Date(),
			attempts: 0,
			maxAttempts: 3
		};

		// Store job in database for persistence
		await this.saveJobToDb(job);
		
		this.queue.push(job);
		this.emit('job-added', job);
		
		// Start processing if not already running
		if (!this.processing) {
			console.log('🚀 Starting job processing for new job:', job.id);
			this.startProcessing();
		} else {
			console.log('ℹ️ Job added to active queue:', job.id);
		}

		return job;
	}

	checkRateLimit(userId) {
		const now = Date.now();
		const windowStart = now - this.rateLimitWindow;
		
		// Clean old entries
		this.jobHistory = this.jobHistory.filter(job => job.timestamp > windowStart);
		
		// Count user's jobs in current window
		const userJobs = this.jobHistory.filter(job => job.userId === userId);
		
		if (userJobs.length >= this.maxJobsPerWindow) {
			return false;
		}

		// Add current job to history
		this.jobHistory.push({ userId, timestamp: now });
		return true;
	}

	async saveJobToDb(job) {
		try {
			const { error } = await supabaseAdmin
				.from('jobs')
				.insert({
					id: job.id,
					type: job.type,
					data: JSON.stringify(job.data),
					userId: job.userId,
					status: 'QUEUED',
					attempts: job.attempts,
					maxAttempts: job.maxAttempts,
					createdAt: job.createdAt.toISOString()
				});

			if (error) {
				console.error('Failed to save job to database:', error);
			}
		} catch (error) {
			console.error('Failed to save job to database:', error);
		}
	}

	async updateJobInDb(jobId, updates) {
		try {
			const updateData = {
				...updates,
				updatedAt: new Date().toISOString()
			};

			// Convert data to JSON string if it exists
			if (updates.data) {
				updateData.data = JSON.stringify(updates.data);
			}

			// Convert dates to ISO strings
			if (updates.startedAt) {
				updateData.startedAt = updates.startedAt.toISOString();
			}
			if (updates.completedAt) {
				updateData.completedAt = updates.completedAt.toISOString();
			}
			if (updates.failedAt) {
				updateData.failedAt = updates.failedAt.toISOString();
			}

			const { error } = await supabaseAdmin
				.from('jobs')
				.update(updateData)
				.eq('id', jobId);

			if (error) {
				console.error('Failed to update job in database:', error);
			}
		} catch (error) {
			console.error('Failed to update job in database:', error);
		}
	}

	startProcessing() {
		if (this.processing) return;
		this.processing = true;
		this.processQueue();
	}

	async processQueue() {
		while (this.queue.length > 0 && this.activeJobs < this.concurrency) {
			const job = this.queue.shift();
			if (job) {
				this.processJob(job);
			}
		}

		// If no more jobs and no active jobs, stop processing
		if (this.queue.length === 0 && this.activeJobs === 0) {
			this.processing = false;
		} else if (this.queue.length > 0) {
			// Check again in a moment
			setTimeout(() => this.processQueue(), 100);
		}
	}

	async processJob(job) {
		this.activeJobs++;
		job.status = 'processing';
		job.startedAt = new Date();
		
		console.log('🔄 Starting to process job:', job.id, 'Type:', job.type);
		
		await this.updateJobInDb(job.id, { 
			status: 'PROCESSING', 
			startedAt: job.startedAt 
		});

		this.emit('job-started', job);

		try {
			let result;
			
			switch (job.type) {
				case 'scrape-post':
					result = await this.processScrapeJob(job);
					break;
				default:
					throw new Error(`Unknown job type: ${job.type}`);
			}

			job.status = 'completed';
			job.completedAt = new Date();
			job.result = result;

			await this.updateJobInDb(job.id, { 
				status: 'COMPLETED', 
				completedAt: job.completedAt,
				result: JSON.stringify(result)
			});

			this.emit('job-completed', job);

		} catch (error) {
			job.attempts++;
			job.error = error.message;

			if (job.attempts >= job.maxAttempts) {
				job.status = 'failed';
				job.failedAt = new Date();
				
				await this.updateJobInDb(job.id, { 
					status: 'FAILED', 
					failedAt: job.failedAt,
					error: job.error,
					attempts: job.attempts
				});

				this.emit('job-failed', job);
			} else {
				job.status = 'queued';
				await this.updateJobInDb(job.id, { 
					status: 'QUEUED', 
					error: job.error,
					attempts: job.attempts
				});
				
				// Re-queue with exponential backoff
				const delay = Math.pow(2, job.attempts) * 1000; // 2s, 4s, 8s
				setTimeout(() => {
					this.queue.push(job);
					this.processQueue();
				}, delay);
				
				this.emit('job-retry', job);
			}
		}

		this.activeJobs--;
		
		// Continue processing
		if (this.queue.length > 0) {
			this.processQueue();
		}
	}

	async processScrapeJob(job) {
		const { linkedinUrl, userId } = job.data;
		
		// Use try-catch to handle environment where scraper is not available
		let scrapeSinglePostQueued;
		try {
			// Import from unified scraper
			const scraperModule = await import('./linkedin-scraper.js');
			scrapeSinglePostQueued = scraperModule.scrapeSinglePostQueued;
		} catch (error) {
			throw new Error('Scraping functionality is not available in this environment. Please use a dedicated worker process.');
		}
		
		const { 
			calculatePostScore, 
			updateUserStats, 
			checkAndAwardAchievements 
		} = await import('./gamification.js');
		
		const { validateLinkedInOwnership, parseLinkedInPostUrl } = await import('./linkedin-url-parser.js');

		// Scrape the post using browser pool
		const scrapedData = await scrapeSinglePostQueued(linkedinUrl, userId);

		if (!scrapedData) {
			throw new Error('No data could be extracted from the post');
		}

		// Get user data for ownership check and streak calculation
		const { data: user } = await supabaseAdmin
			.from('users')
			.select('email')
			.eq('id', userId)
			.single();

		const { data: userPosts } = await supabaseAdmin
			.from('linkedin_posts')
			.select('totalScore, postedAt')
			.eq('userId', userId)
			.order('postedAt', { ascending: false });

		const currentStreak = userPosts && userPosts.length > 0 ? 
			Math.max(...userPosts.map((p) => p.totalScore)) : 0;

		// Check if this is original content for scoring
		const urlParseResult = parseLinkedInPostUrl(linkedinUrl);
		let isOriginalContent = false;
		
		if (urlParseResult.isFeedUpdate) {
			// Feed updates are always treated as shared content (no username to validate)
			isOriginalContent = false;
		} else if (urlParseResult.username && user?.email) {
			// Profile posts can be validated against user ownership
			isOriginalContent = validateLinkedInOwnership(urlParseResult.username, user.email);
		} else {
			// If no username found and not a feed update, assume shared content
			isOriginalContent = false;
		}

		// Calculate scoring with ownership consideration
		const scoring = calculatePostScore({
			word_count: scrapedData.word_count,
			reactions: scrapedData.reactions,
			comments: scrapedData.comments,
			reposts: scrapedData.reposts,
			timestamp: scrapedData.timestamp
		}, currentStreak, isOriginalContent);

		// Save to database using upsert pattern
		const linkedinId = scrapedData.id || scrapedData.linkedinId;
		
		// First try to find existing post
		const { data: existingPost } = await supabaseAdmin
			.from('linkedin_posts')
			.select('id')
			.eq('linkedinId', linkedinId)
			.single();

		let savedPost;
		if (existingPost) {
			// Update existing post
			const { data: updatedPost, error: updateError } = await supabaseAdmin
				.from('linkedin_posts')
				.update({
					reactions: scrapedData.reactions,
					comments: scrapedData.comments,
					reposts: scrapedData.reposts,
					totalEngagement: scrapedData.total_engagement,
					baseScore: scoring.baseScore,
					engagementScore: scoring.engagementScore,
					totalScore: scoring.totalScore,
					lastScrapedAt: new Date().toISOString()
				})
				.eq('linkedinId', linkedinId)
				.select()
				.single();

			if (updateError) {
				throw new Error(`Failed to update post: ${updateError.message}`);
			}
			savedPost = updatedPost;
		} else {
			// Generate UUID for new post
			const { randomUUID } = await import('crypto');
			const postId = randomUUID();

			// Create new post
			const { data: newPost, error: createError } = await supabaseAdmin
				.from('linkedin_posts')
				.insert({
					id: postId,
					userId,
					linkedinId: linkedinId,
					url: linkedinUrl,
					content: scrapedData.text || scrapedData.content,
					authorName: scrapedData.author || scrapedData.authorName,
					reactions: scrapedData.reactions,
					comments: scrapedData.comments,
					reposts: scrapedData.reposts,
					totalEngagement: scrapedData.total_engagement,
					baseScore: scoring.baseScore,
					engagementScore: scoring.engagementScore,
					totalScore: scoring.totalScore,
					wordCount: scrapedData.word_count,
					charCount: scrapedData.char_count,
					postedAt: new Date(scrapedData.timestamp || scrapedData.postedAt).toISOString(),
					lastScrapedAt: new Date().toISOString()
				})
				.select()
				.single();

			if (createError) {
				throw new Error(`Failed to create post: ${createError.message}`);
			}
			savedPost = newPost;
		}

		// Create analytics record
		try {
			const { randomUUID } = await import('crypto');
			const analyticsId = randomUUID();

			const { error: analyticsError } = await supabaseAdmin
				.from('post_analytics')
				.insert({
					id: analyticsId,
					postId: savedPost.id,
					reactions: scrapedData.reactions,
					comments: scrapedData.comments,
					reposts: scrapedData.reposts,
					totalEngagement: scrapedData.total_engagement,
					reactionGrowth: 0,
					commentGrowth: 0,
					repostGrowth: 0
				});

			if (analyticsError) {
				console.log('Analytics creation failed:', analyticsError.message);
			}
		} catch (analyticsError) {
			console.log('Analytics creation failed:', analyticsError.message);
		}

		// Update user stats
		await updateUserStats(userId);

		// Check for new achievements
		const newAchievements = await checkAndAwardAchievements(userId);

		return {
			post: savedPost,
			scoring: scoring,
			newAchievements: newAchievements
		};
	}

	async getJobStatus(jobId) {
		// Check active queue first
		const queuedJob = this.queue.find(job => job.id === jobId);
		if (queuedJob) return queuedJob;

		// If not in queue, check database
		const { data: job, error } = await supabaseAdmin
			.from('jobs')
			.select('*')
			.eq('id', jobId)
			.single();

		if (error) {
			console.error('Error fetching job status:', error);
			return null;
		}

		return job;
	}

	getQueueStats() {
		return {
			queueLength: this.queue.length,
			activeJobs: this.activeJobs,
			processing: this.processing,
			totalProcessed: this.jobHistory.length
		};
	}
}

// Singleton instance
const jobQueue = new JobQueue();

export { jobQueue };