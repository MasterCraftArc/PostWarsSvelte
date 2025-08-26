import { createSupabaseServerClient } from '$lib/supabase-server.js';

export async function handle({ event, resolve }) {
	// Get Supabase session from cookies
	const supabase = createSupabaseServerClient(event.request.headers.get('cookie') || '');
	
	const { data: { session } } = await supabase.auth.getSession();

	if (session) {
		try {
			// Get or create user record in Supabase database
			const { data: existingUser } = await supabase
				.from('users')
				.select('*')
				.eq('id', session.user.id)
				.single();

			let user = existingUser;

			// If user doesn't exist in our users table, create them
			if (!existingUser) {
				const { data: newUser, error } = await supabase
					.from('users')
					.insert({
						id: session.user.id,
						email: session.user.email,
						name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || null,
						role: 'REGULAR'
					})
					.select()
					.single();

				if (!error) {
					user = newUser;
				}
			}

			if (user) {
				event.locals.user = user;
				event.locals.session = session;
			}
		} catch (error) {
			console.error('Error loading user session:', error);
			// Fallback: use basic session data
			event.locals.user = {
				id: session.user.id,
				email: session.user.email,
				name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || null,
				role: 'REGULAR'
			};
			event.locals.session = session;
		}
	}

	const response = await resolve(event);

	// Add security headers
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	
	// Content Security Policy
	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'", // unsafe-inline needed for SvelteKit hydration
		"style-src 'self' 'unsafe-inline'", // unsafe-inline needed for component styles
		"img-src 'self' data: https:",
		"font-src 'self'",
		"connect-src 'self' https://ptblrcociqedamarytuj.supabase.co", // Allow Supabase API calls
		"media-src 'self'",
		"frame-ancestors 'none'"
	].join('; ');
	
	response.headers.set('Content-Security-Policy', csp);

	// HTTPS redirect in production
	if (event.url.protocol === 'http:' && process.env.NODE_ENV === 'production') {
		const httpsUrl = event.url.toString().replace('http:', 'https:');
		return Response.redirect(httpsUrl, 301);
	}

	return response;
}
