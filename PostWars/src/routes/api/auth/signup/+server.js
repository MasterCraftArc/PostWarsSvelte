import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabase-server.js';
import { getOrCreateUser } from '$lib/supabase-auth.js';
import { handleAuthError } from '$lib/error-handler.js';

export async function POST({ request }) {
	try {
		const { email, password, name } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
		}

		// Create user in Supabase Auth
		const { data, error } = await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			user_metadata: {
				name: name || null,
				full_name: name || null
			},
			email_confirm: false // Require email confirmation
		});

		if (error) {
			return json({ error: error.message }, { status: 400 });
		}

		// Create user in Supabase database
		const { data: localUser, error: dbError } = await supabaseAdmin
			.from('users')
			.upsert({
				id: data.user.id,
				email: data.user.email,
				name: name || null,
				role: 'REGULAR'
			}, {
				onConflict: 'id'
			})
			.select()
			.single();

		if (dbError) {
			console.error('Database error:', dbError);
			return json({ error: 'Failed to create user record' }, { status: 500 });
		}

		return json({
			message: 'User created successfully. Please check your email to confirm your account.',
			user: {
				id: localUser.id,
				email: localUser.email,
				name: localUser.name,
				role: localUser.role
			}
		}, { status: 201 });

	} catch (error) {
		console.error('Signup error:', error);
		const sanitized = handleAuthError(error);
		return json(sanitized, { status: 500 });
	}
}
