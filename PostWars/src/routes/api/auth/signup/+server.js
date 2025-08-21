import { json } from '@sveltejs/kit';
import { createUser, createJWT, createSession } from '$lib/auth.js';

export async function POST({ request }) {
	try {
		const { email, password, name } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		// Check if this is the first user and make them admin
		const userCount = await prisma.user.count();
		const role = userCount === 0 ? 'ADMIN' : 'REGULAR';

		const user = await createUser(email, password, name, role);
		const token = createJWT(user.id);
		await createSession(user.id, token);

		return json(
			{ user: { id: user.id, email: user.email, name: user.name, role: user.role } },
			{
				status: 201,
				headers: {
					'Set-Cookie': `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
				}
			}
		);
	} catch (error) {
		if (error.code === 'P2002') {
			return json({ error: 'User already exists' }, { status: 409 });
		}
		console.error('Signup error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
