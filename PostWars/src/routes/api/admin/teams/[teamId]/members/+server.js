import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { requireAdmin } from '$lib/auth-roles.js';

// POST /api/admin/teams/[teamId]/members - Add user to team
export async function POST({ params, request, locals }) {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const { teamId } = params;
	
	// Check if user is admin or team lead of this team
	if (locals.user.role !== 'ADMIN') {
		const team = await prisma.team.findUnique({
			where: { id: teamId }
		});
		
		if (!team || team.teamLeadId !== locals.user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		const { teamId } = params;
		const { userIds } = await request.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'userIds array is required' }, { status: 400 });
		}

		// Verify team exists
		const team = await prisma.team.findUnique({
			where: { id: teamId }
		});

		if (!team) {
			return json({ error: 'Team not found' }, { status: 404 });
		}

		// Add users to team
		await prisma.user.updateMany({
			where: { id: { in: userIds } },
			data: { teamId: teamId }
		});

		// Get updated team with members
		const updatedTeam = await prisma.team.findUnique({
			where: { id: teamId },
			include: {
				members: {
					select: { id: true, name: true, email: true, role: true }
				}
			}
		});

		return json({ team: updatedTeam });
	} catch (error) {
		console.error('Add team members error:', error);
		return json({ error: 'Failed to add team members' }, { status: 500 });
	}
}

// DELETE /api/admin/teams/[teamId]/members - Remove user from team
export async function DELETE({ params, request, locals }) {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const { teamId } = params;
	
	// Check if user is admin or team lead of this team
	if (locals.user.role !== 'ADMIN') {
		const team = await prisma.team.findUnique({
			where: { id: teamId }
		});
		
		if (!team || team.teamLeadId !== locals.user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}
	}

	try {
		const { teamId } = params;
		const { userIds } = await request.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'userIds array is required' }, { status: 400 });
		}

		// Remove users from team
		await prisma.user.updateMany({
			where: { 
				id: { in: userIds },
				teamId: teamId
			},
			data: { teamId: null }
		});

		// Get updated team with members
		const updatedTeam = await prisma.team.findUnique({
			where: { id: teamId },
			include: {
				members: {
					select: { id: true, name: true, email: true, role: true }
				}
			}
		});

		return json({ team: updatedTeam });
	} catch (error) {
		console.error('Remove team members error:', error);
		return json({ error: 'Failed to remove team members' }, { status: 500 });
	}
}