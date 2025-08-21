import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { requireAdmin } from '$lib/auth-roles.js';

// GET /api/admin/goals - List all goals
export async function GET({ locals }) {
	const authError = requireAdmin(locals);
	if (authError) return authError;

	try {
		const goals = await prisma.goal.findMany({
			include: {
				team: {
					select: { id: true, name: true }
				}
			},
			orderBy: { createdAt: 'desc' }
		});

		return json({ goals });
	} catch (error) {
		console.error('Get goals error:', error);
		return json({ error: 'Failed to fetch goals' }, { status: 500 });
	}
}

// POST /api/admin/goals - Create new goal
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Allow admin and team leads to create goals
	if (locals.user.role !== 'ADMIN' && locals.user.role !== 'TEAM_LEAD') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const { 
			title, 
			description, 
			type, 
			targetValue, 
			teamId, 
			endDate 
		} = await request.json();

		if (!title || !type || !targetValue || !teamId || !endDate) {
			return json({ 
				error: 'Title, type, targetValue, teamId, and endDate are required' 
			}, { status: 400 });
		}

		// Verify team exists and user has permission
		const team = await prisma.team.findUnique({
			where: { id: teamId }
		});

		if (!team) {
			return json({ error: 'Team not found' }, { status: 404 });
		}

		// Team leads can only create goals for their own team
		if (locals.user.role === 'TEAM_LEAD' && team.teamLeadId !== locals.user.id) {
			return json({ error: 'You can only create goals for your own team' }, { status: 403 });
		}

		const goal = await prisma.goal.create({
			data: {
				title,
				description,
				type,
				targetValue: parseInt(targetValue),
				teamId,
				endDate: new Date(endDate)
			},
			include: {
				team: {
					select: { id: true, name: true }
				}
			}
		});

		return json({ goal });
	} catch (error) {
		console.error('Create goal error:', error);
		return json({ error: 'Failed to create goal' }, { status: 500 });
	}
}