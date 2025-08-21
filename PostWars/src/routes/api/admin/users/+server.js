import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { requireAdmin } from '$lib/auth-roles.js';

// GET /api/admin/users - List all users
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Allow admin and team leads to see users
	if (locals.user.role !== 'ADMIN' && locals.user.role !== 'TEAM_LEAD') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const users = await prisma.user.findMany({
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				teamId: true,
				totalScore: true,
				postsThisMonth: true,
				createdAt: true,
				team: {
					select: { id: true, name: true }
				}
			},
			orderBy: { createdAt: 'desc' }
		});

		return json({ users });
	} catch (error) {
		console.error('Get users error:', error);
		return json({ error: 'Failed to fetch users' }, { status: 500 });
	}
}

// PATCH /api/admin/users - Update user role
export async function PATCH({ request, locals }) {
	const authError = requireAdmin(locals);
	if (authError) return authError;

	try {
		const { userId, role } = await request.json();

		if (!userId || !role) {
			return json({ error: 'userId and role are required' }, { status: 400 });
		}

		if (!['REGULAR', 'TEAM_LEAD', 'ADMIN'].includes(role)) {
			return json({ error: 'Invalid role' }, { status: 400 });
		}

		const user = await prisma.user.update({
			where: { id: userId },
			data: { role },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				teamId: true
			}
		});

		return json({ user });
	} catch (error) {
		console.error('Update user role error:', error);
		return json({ error: 'Failed to update user role' }, { status: 500 });
	}
}