export async function load({ locals, url }) {
	// For static pages, don't pass server-side user data
	// Client-side auth will handle this
	const staticPages = ['/', '/login', '/signup'];
	
	if (staticPages.includes(url.pathname)) {
		return {
			user: null // Static pages get user from client-side store
		};
	}
	
	return {
		user: locals.user || null
	};
}
