import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { requireAdmin } from '$lib/auth-roles.js';

// GET /api/admin/teams - List all teams
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Allow admin to see all teams, team leads to see their own team
	if (locals.user.role !== 'ADMIN' && locals.user.role !== 'TEAM_LEAD') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		// Filter teams based on user role
		const whereClause = locals.user.role === 'ADMIN' 
			? {} 
			: { teamLeadId: locals.user.id };

		const teams = await prisma.team.findMany({
			where: whereClause,
			include: {
				teamLead: {
					select: { id: true, name: true, email: true }
				},
				members: {
					select: { id: true, name: true, email: true, role: true }
				},
				goals: {
					where: { status: 'ACTIVE' }
				},
				_count: {
					select: { members: true, goals: true }
				}
			},
			orderBy: { createdAt: 'desc' }
		});

		return json({ teams });
	} catch (error) {
		console.error('Get teams error:', error);
		return json({ error: 'Failed to fetch teams' }, { status: 500 });
	}
}

// POST /api/admin/teams - Create new team
export async function POST({ request, locals }) {
	const authError = requireAdmin(locals);
	if (authError) return authError;

	try {
		const { name, description, teamLeadId } = await request.json();

		if (!name) {
			return json({ error: 'Team name is required' }, { status: 400 });
		}

		// Verify team lead exists and is eligible
		if (teamLeadId) {
			const teamLead = await prisma.user.findUnique({
				where: { id: teamLeadId }
			});

			if (!teamLead) {
				return json({ error: 'Team lead not found' }, { status: 400 });
			}

			if (teamLead.role === 'REGULAR') {
				// Promote user to TEAM_LEAD
				await prisma.user.update({
					where: { id: teamLeadId },
					data: { role: 'TEAM_LEAD' }
				});
			}
		}

		const team = await prisma.team.create({
			data: {
				name,
				description,
				...(teamLeadId && { teamLeadId })
			},
			include: {
				teamLead: {
					select: { id: true, name: true, email: true }
				},
				members: {
					select: { id: true, name: true, email: true }
				}
			}
		});

		return json({ team });
	} catch (error) {
		if (error.code === 'P2002') {
			return json({ error: 'Team name already exists' }, { status: 409 });
		}
		console.error('Create team error:', error);
		return json({ error: 'Failed to create team' }, { status: 500 });
	}
}