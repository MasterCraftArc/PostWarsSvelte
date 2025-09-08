import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function POST(event) {
	try {
		const authenticatedUser = await getAuthenticatedUser(event);
		if (!authenticatedUser || authenticatedUser.role !== 'ADMIN') {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		const timeframe = 'all';
		const scope = 'company';

		// Call leaderboard function directly without cache
		const { data, error } = await supabaseAdmin.rpc('get_leaderboard', {
			p_timeframe: timeframe,
			p_scope: scope,
			p_team_id: authenticatedUser.teamId,
			p_requesting_user_id: authenticatedUser.id
		});

		if (error) {
			console.error('Leaderboard refresh error:', error);
			return json({ error: `Database error: ${error.message}` }, { status: 500 });
		}

		// Return fresh data with no cache headers
		const response = json({
			success: true,
			message: 'Leaderboard refreshed',
			data: data,
			timestamp: new Date().toISOString()
		});
		
		response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
		
		return response;
	} catch (error) {
		console.error('Leaderboard refresh error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}