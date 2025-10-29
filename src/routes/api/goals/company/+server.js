import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-node.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		// Fetch active company goals (company-team-id) AND active race goals (teamId is null, is_race is true)
		const { data: goals, error: goalsError } = await supabaseAdmin
			.from('goals')
			.select(`
				id,
				title,
				description,
				type,
				currentValue,
				targetValue,
				status,
				startDate,
				endDate,
				createdAt,
				updatedAt,
				is_race,
				teamId
			`)
			.or('teamId.eq.company-team-id,and(teamId.is.null,is_race.eq.true)')
			.eq('status', 'ACTIVE')
			.order('createdAt', { ascending: false });

		if (goalsError) {
			console.error('Error fetching company goals:', goalsError);
			return json({ error: 'Failed to fetch company goals' }, { status: 500 });
		}

		// Calculate progress percentage for each goal
		const goalsWithProgress = goals?.map(goal => ({
			...goal,
			progressPercent: Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)),
			isCompleted: goal.currentValue >= goal.targetValue,
			daysLeft: Math.max(0, Math.ceil((new Date(goal.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
		})) || [];

		return json({ 
			goals: goalsWithProgress,
			totalGoals: goalsWithProgress.length,
			completedGoals: goalsWithProgress.filter(g => g.isCompleted).length
		});

	} catch (error) {
		console.error('Company goals API error:', error);
		return json({ error: 'Failed to fetch company goals' }, { status: 500 });
	}
}