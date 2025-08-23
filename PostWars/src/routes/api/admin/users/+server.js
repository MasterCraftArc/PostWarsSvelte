import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getAuthenticatedUser } from '$lib/auth-helpers.js';

// GET /api/admin/users - List all users
export async function GET(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Allow admin and team leads to see users
	if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const { data: users, error } = await supabaseAdmin
			.from('users')
			.select(`
				id,
				name,
				email,
				role,
				teamId,
				totalScore,
				postsThisMonth,
				createdAt,
				team:teams!users_teamId_fkey(id, name)
			`)
			.order('createdAt', { ascending: false });

		if (error) {
			console.error('Supabase error:', error);
			return json({ error: 'Failed to fetch users' }, { status: 500 });
		}

		return json({ users: users || [] });
	} catch (error) {
		console.error('Get users error:', error);
		return json({ error: 'Failed to fetch users' }, { status: 500 });
	}
}

// PATCH /api/admin/users - Update user role
export async function PATCH(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	
	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { userId, role } = await event.request.json();

		if (!userId || !role) {
			return json({ error: 'userId and role are required' }, { status: 400 });
		}

		if (!['REGULAR', 'TEAM_LEAD', 'ADMIN'].includes(role)) {
			return json({ error: 'Invalid role' }, { status: 400 });
		}

		const { data: updatedUser, error } = await supabaseAdmin
			.from('users')
			.update({ role })
			.eq('id', userId)
			.select('id, name, email, role, teamId')
			.single();

		if (error) {
			console.error('Update user error:', error);
			return json({ error: 'Failed to update user role' }, { status: 500 });
		}

		return json({ user: updatedUser });
	} catch (error) {
		console.error('Update user role error:', error);
		return json({ error: 'Failed to update user role' }, { status: 500 });
	}
}

// DELETE /api/admin/users - Delete user
export async function DELETE(event) {
	const user = await getAuthenticatedUser(event);
	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	
	if (user.role !== 'ADMIN') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { id } = await event.request.json();

		if (!id) {
			return json({ error: 'User ID is required' }, { status: 400 });
		}

		// Can't delete yourself
		if (id === user.id) {
			return json({ error: 'Cannot delete yourself' }, { status: 400 });
		}

		// Delete user's posts first
		await supabaseAdmin
			.from('linkedin_posts')
			.delete()
			.eq('userId', id);

		// Delete user's achievements
		await supabaseAdmin
			.from('user_achievements')
			.delete()
			.eq('userId', id);

		// Update teams where this user is team lead
		await supabaseAdmin
			.from('teams')
			.update({ teamLeadId: null })
			.eq('teamLeadId', id);

		// Delete the user
		const { error: deleteError } = await supabaseAdmin
			.from('users')
			.delete()
			.eq('id', id);

		if (deleteError) {
			console.error('Delete user error:', deleteError);
			return json({ error: 'Failed to delete user' }, { status: 500 });
		}

		console.log('✅ User deleted successfully:', id);

		return json({ success: true });
	} catch (error) {
		console.error('Delete user error:', error);
		return json({ error: 'Failed to delete user' }, { status: 500 });
	}
}