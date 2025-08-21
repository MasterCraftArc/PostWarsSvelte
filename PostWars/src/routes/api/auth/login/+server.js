import { json } from '@sveltejs/kit';
import { authenticateUser, createJWT, createSession } from '$lib/auth.js';

export async function POST({ request }) {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		const user = await authenticateUser(email, password);
		if (!user) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const token = createJWT(user.id);
		await createSession(user.id, token);

		return json(
			{ user: { id: user.id, email: user.email, name: user.name, role: user.role } },
			{
				headers: {
					'Set-Cookie': `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
				}
			}
		);
	} catch (error) {
		console.error('Login error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
