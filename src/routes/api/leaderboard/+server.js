import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const timeframe = event.url.searchParams.get('timeframe') || 'all';
		const scope = event.url.searchParams.get('scope') || 'company';

		if (!['all', 'month', 'week'].includes(timeframe)) {
			return json({ error: 'Invalid timeframe. Use: all, month, or week' }, { status: 400 });
		}

		if (!['team', 'company'].includes(scope)) {
			return json({ error: 'Invalid scope. Use: team or company' }, { status: 400 });
		}

		// Check team scope requirements
		if (scope === 'team' && !authenticatedUser.teamId) {
			return json({ error: 'User not assigned to a team' }, { status: 404 });
		}

		// OPTIMIZED: Single database function call instead of multiple queries
		const { data, error } = await supabaseAdmin.rpc('get_leaderboard', {
			p_timeframe: timeframe,
			p_scope: scope,
			p_team_id: authenticatedUser.teamId,
			p_requesting_user_id: authenticatedUser.id
		});

		if (error) {
			console.error('Leaderboard RPC error:', error);
			return json({ error: `Database error: ${error.message}` }, { status: 500 });
		}

		// Cache response for 5 minutes (leaderboard changes frequently but not every second)
		const response = json(data);
		response.headers.set('Cache-Control', 'public, max-age=300');
		
		return response;
	} catch (error) {
		console.error('Leaderboard error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
