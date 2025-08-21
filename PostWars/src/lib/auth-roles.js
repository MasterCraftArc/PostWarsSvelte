import { json } from '@sveltejs/kit';

export const UserRole = {
	REGULAR: 'REGULAR',
	TEAM_LEAD: 'TEAM_LEAD',
	ADMIN: 'ADMIN'
};

export function requireAuth(locals) {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}
	return null;
}

export function requireRole(locals, requiredRole) {
	const authError = requireAuth(locals);
	if (authError) return authError;

	const roleHierarchy = {
		[UserRole.REGULAR]: 1,
		[UserRole.TEAM_LEAD]: 2,
		[UserRole.ADMIN]: 3
	};

	const userLevel = roleHierarchy[locals.user.role] || 0;
	const requiredLevel = roleHierarchy[requiredRole] || 0;

	if (userLevel < requiredLevel) {
		return json({ 
			error: `Access denied. ${requiredRole} role required.`,
			userRole: locals.user.role,
			requiredRole 
		}, { status: 403 });
	}

	return null;
}

export function requireAdmin(locals) {
	return requireRole(locals, UserRole.ADMIN);
}

export function requireTeamLead(locals) {
	return requireRole(locals, UserRole.TEAM_LEAD);
}

export function isAdmin(user) {
	return user?.role === UserRole.ADMIN;
}

export function isTeamLead(user) {
	return user?.role === UserRole.TEAM_LEAD || user?.role === UserRole.ADMIN;
}

export function canManageTeam(user, teamId) {
	if (isAdmin(user)) return true;
	if (isTeamLead(user) && user.ledTeams?.some(team => team.id === teamId)) return true;
	return false;
}