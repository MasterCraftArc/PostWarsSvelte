import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		const user = await getAuthenticatedUser(event);
		if (!user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { jobId } = event.params;
		
		if (!jobId) {
			return json({ error: 'Job ID required' }, { status: 400 });
		}

		// Get job from database
		const { data: job, error: jobError } = await supabaseAdmin
			.from('jobs')
			.select(`
				*,
				user:users(id, email, name)
			`)
			.eq('id', jobId)
			.single();

		if (jobError || !job) {
			return json({ error: 'Job not found' }, { status: 404 });
		}

		// Check if user owns this job or is admin
		if (job.userId !== user.id && user.role !== 'ADMIN') {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Parse data and result if they exist
		let parsedData = null;
		let parsedResult = null;

		try {
			if (job.data) {
				parsedData = JSON.parse(job.data);
			}
			if (job.result) {
				parsedResult = JSON.parse(job.result);
			}
		} catch (e) {
			console.error('Failed to parse job data/result:', e);
		}

		return json({
			id: job.id,
			type: job.type,
			status: job.status.toLowerCase(),
			data: parsedData,
			result: parsedResult,
			error: job.error,
			attempts: job.attempts,
			maxAttempts: job.maxAttempts,
			createdAt: job.createdAt,
			startedAt: job.startedAt,
			completedAt: job.completedAt,
			failedAt: job.failedAt,
			user: job.user
		});

	} catch (error) {
		console.error('Job status error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}