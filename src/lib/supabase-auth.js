import { supabaseAdmin } from './supabase-server.js';

/**
 * Get user from Supabase session and sync with local database
 * @param {Object} session - Supabase session object
 * @returns {Promise<Object|null>} User object or null
 */
export async function getOrCreateUser(session) {
	if (!session?.user) return null;

	const { user: supabaseUser } = session;
	
	// Check if user exists in our database
	let { data: user } = await supabaseAdmin
		.from('users')
		.select('*')
		.eq('id', supabaseUser.id)
		.single();

	// If user doesn't exist, create them
	if (!user) {
		const { data: newUser } = await supabaseAdmin
			.from('users')
			.insert({
				id: supabaseUser.id,
				email: supabaseUser.email,
				name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || null,
				role: 'REGULAR' // All new users start as regular
			})
			.select()
			.single();
		user = newUser;
	}

	// Update user info if it has changed
	if (user.email !== supabaseUser.email || 
		user.name !== (supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name)) {
		const { data: updatedUser } = await supabaseAdmin
			.from('users')
			.update({
				email: supabaseUser.email,
				name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || user.name
			})
			.eq('id', supabaseUser.id)
			.select()
			.single();
		user = updatedUser;
	}

	return user;
}

/**
 * Create admin user in Supabase (for seeding)
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 * @returns {Promise<Object>} Created user
 */
export async function createSupabaseAdmin(email, password, name) {
	const { data, error } = await supabaseAdmin.auth.admin.createUser({
		email,
		password,
		user_metadata: {
			name,
			full_name: name
		},
		email_confirm: true // Skip email confirmation for admin
	});

	if (error) throw error;

	// Create/update user in our database with admin role
	let { data: user } = await supabaseAdmin
		.from('users')
		.select('*')
		.eq('id', data.user.id)
		.single();

	if (!user) {
		// Create new user
		const { data: newUser } = await supabaseAdmin
			.from('users')
			.insert({
				id: data.user.id,
				email: data.user.email,
				name,
				role: 'ADMIN'
			})
			.select()
			.single();
		user = newUser;
	} else {
		// Update existing user
		const { data: updatedUser } = await supabaseAdmin
			.from('users')
			.update({
				email: data.user.email,
				name,
				role: 'ADMIN'
			})
			.eq('id', data.user.id)
			.select()
			.single();
		user = updatedUser;
	}

	return { supabaseUser: data.user, localUser: user };
}

/**
 * Update user role (admin function)
 * @param {string} userId 
 * @param {string} role 
 * @returns {Promise<Object>} Updated user
 */
export async function updateUserRole(userId, role) {
	const validRoles = ['REGULAR', 'TEAM_LEAD', 'ADMIN'];
	if (!validRoles.includes(role)) {
		throw new Error('Invalid role');
	}

	const { data: user, error } = await supabaseAdmin
		.from('users')
		.update({ role })
		.eq('id', userId)
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to update user role: ${error.message}`);
	}

	return user;
}

/**
 * Get user by ID (combines Supabase and local data)
 * @param {string} userId 
 * @returns {Promise<Object|null>} User object or null
 */
export async function getUserById(userId) {
	// Get local user data with relationships
	const { data: localUser, error } = await supabaseAdmin
		.from('users')
		.select(`
			*,
			team:teams(*),
			linkedinPosts:linkedin_posts(*)
		`)
		.eq('id', userId)
		.single();

	if (error || !localUser) return null;

	// Get user achievements separately
	const { data: userAchievements } = await supabaseAdmin
		.from('user_achievements')
		.select(`
			*,
			achievement:achievements(*)
		`)
		.eq('userId', userId);

	// Get Supabase user data
	const { data: supabaseUser } = await supabaseAdmin.auth.admin.getUserById(userId);

	// Sort posts by creation date (newest first) and limit to 5
	const sortedPosts = (localUser.linkedinPosts || [])
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
		.slice(0, 5);

	return {
		...localUser,
		linkedinPosts: sortedPosts,
		achievements: userAchievements || [],
		supabaseData: supabaseUser?.user || null
	};
}