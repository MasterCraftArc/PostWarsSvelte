import { getSessionUser } from '$lib/auth.js';

export async function handle({ event, resolve }) {
	const token = event.cookies.get('auth-token');

	if (token) {
		const user = await getSessionUser(token);
		if (user) {
			event.locals.user = user;
		}
	}

	return resolve(event);
}
