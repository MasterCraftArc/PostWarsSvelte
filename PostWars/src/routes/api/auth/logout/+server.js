import { json } from '@sveltejs/kit';
import { deleteSession } from '$lib/auth.js';

export async function POST({ cookies }) {
	const token = cookies.get('auth-token');

	if (token) {
		await deleteSession(token);
	}

	return json(
		{ message: 'Logged out successfully' },
		{
			headers: {
				'Set-Cookie': 'auth-token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
			}
		}
	);
}
