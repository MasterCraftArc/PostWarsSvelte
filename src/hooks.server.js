import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export async function handle({ event, resolve }) {
	// Remove heavy authentication logic for static pages
	// Auth will be handled client-side for better performance
	
	const response = await resolve(event);

	// Add security headers
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	
	// Dynamic Content Security Policy based on environment
	const supabaseUrl = PUBLIC_SUPABASE_URL?.replace('https://', '') || 'your-supabase-project.supabase.co';
	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'", // unsafe-inline needed for SvelteKit hydration
		"style-src 'self' 'unsafe-inline'", // unsafe-inline needed for component styles
		"img-src 'self' data: https:",
		"font-src 'self'",
		`connect-src 'self' https://${supabaseUrl}`, // Dynamic Supabase URL
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
