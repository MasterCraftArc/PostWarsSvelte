import { supabaseAdmin } from './supabase-node.js';

/**
 * Extract and validate Supabase session from Authorization header
 * @param {string} authorization - Authorization header value
 * @returns {Promise<Object|null>} User data or null
 */
export async function validateSupabaseAuth(authorization) {
	if (!authorization || !authorization.startsWith('Bearer ')) {
		return null;
	}

	const token = authorization.substring(7); // Remove 'Bearer ' prefix

	try {
		// Verify the JWT token with Supabase
		const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

		if (error || !user) {
			console.error('Invalid token:', error?.message);
			return null;
		}

		// Get user data from Supabase database
		let { data: localUser, error: dbError } = await supabaseAdmin
			.from('users')
			.select('id, email, name, role, totalScore, currentStreak, bestStreak, teamId, createdAt')
			.eq('id', user.id)
			.single();

		// If user doesn't exist, create them
		if (dbError && dbError.code === 'PGRST116') {
			console.log('Creating new user record for:', user.id);
			const { data: newUser, error: createError } = await supabaseAdmin
				.from('users')
				.insert({
					id: user.id,
					email: user.email,
					name: user.user_metadata?.name || user.user_metadata?.full_name || null,
					role: 'REGULAR'
				})
				.select('id, email, name, role, totalScore, currentStreak, bestStreak, teamId, createdAt')
				.single();

			if (createError) {
				console.error('Failed to create user:', createError);
				return null;
			}

			localUser = newUser;
		} else if (dbError) {
			console.error('Database error:', dbError);
			return null;
		}

		return localUser;
	} catch (error) {
		console.error('Auth validation error:', error);
		return null;
	}
}

/**
 * Middleware to check authentication from header or locals
 * @param {Object} request - Request object with locals and headers
 * @returns {Promise<Object|null>} User data or null
 */
export async function getAuthenticatedUser(request) {
	// First try locals.user (if set by hooks)
	if (request.locals?.user) {
		return request.locals.user;
	}

	// Then try Authorization header
	const authorization = request.request?.headers.get('authorization') || request.headers?.get('authorization');
	if (authorization) {
		return await validateSupabaseAuth(authorization);
	}

	return null;
}