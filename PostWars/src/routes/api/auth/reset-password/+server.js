import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import { hashPassword } from '$lib/auth.js';

export async function POST({ request }) {
	try {
		const { token, password } = await request.json();

		if (!token || !password) {
			return json({ error: 'Token and password are required' }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
		}

		// Find the reset token
		const resetRecord = await prisma.passwordReset.findUnique({
			where: { token },
			include: { user: true }
		});

		if (!resetRecord) {
			return json({ error: 'Invalid or expired reset token' }, { status: 400 });
		}

		// Check if token is expired
		if (resetRecord.expiresAt < new Date()) {
			return json({ error: 'Reset token has expired' }, { status: 400 });
		}

		// Check if token has already been used
		if (resetRecord.used) {
			return json({ error: 'Reset token has already been used' }, { status: 400 });
		}

		// Hash the new password
		const hashedPassword = await hashPassword(password);

		// Update user password and mark token as used
		await prisma.$transaction([
			prisma.user.update({
				where: { id: resetRecord.userId },
				data: { password: hashedPassword }
			}),
			prisma.passwordReset.update({
				where: { id: resetRecord.id },
				data: { used: true }
			})
		]);

		return json({ message: 'Password has been reset successfully' });

	} catch (error) {
		console.error('Reset password error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}