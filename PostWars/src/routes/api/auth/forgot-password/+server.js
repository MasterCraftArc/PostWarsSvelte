import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma/index.js';
import crypto from 'crypto';

export async function POST({ request }) {
	try {
		const { email } = await request.json();

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Find user by email
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() }
		});

		if (!user) {
			// Return success even if user doesn't exist (security best practice)
			return json({ 
				message: 'If an account with that email exists, a password reset link has been sent.' 
			});
		}

		// Generate reset token
		const resetToken = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

		// Save reset token to database
		await prisma.passwordReset.create({
			data: {
				userId: user.id,
				token: resetToken,
				expiresAt
			}
		});

		// In a real app, you'd send an email here
		// For now, we'll just log the reset link
		console.log(`Password reset link for ${email}: http://localhost:5175/reset-password?token=${resetToken}`);

		return json({ 
			message: 'If an account with that email exists, a password reset link has been sent.',
			// In development, include the token for testing
			...(process.env.NODE_ENV === 'development' && { 
				resetToken,
				resetLink: `http://localhost:5175/reset-password?token=${resetToken}`
			})
		});

	} catch (error) {
		console.error('Forgot password error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}