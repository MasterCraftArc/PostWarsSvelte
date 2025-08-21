import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma/index.js';
import { JWT_SECRET } from '$env/static/private';

export async function hashPassword(password) {
	return await bcryptjs.hash(password, 12);
}

export async function verifyPassword(password, hashedPassword) {
	return await bcryptjs.compare(password, hashedPassword);
}

export function createJWT(userId) {
	return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJWT(token) {
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch {
		return null;
	}
}

export async function createUser(email, password, name, role = 'REGULAR') {
	const hashedPassword = await hashPassword(password);
	return await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			name,
			role
		}
	});
}

export async function authenticateUser(email, password) {
	const user = await prisma.user.findUnique({
		where: { email }
	});

	if (!user) return null;

	const isValid = await verifyPassword(password, user.password);
	if (!isValid) return null;

	return user;
}

export async function createSession(userId, token) {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7);

	return await prisma.session.create({
		data: {
			userId,
			token,
			expiresAt
		}
	});
}

export async function getSessionUser(token) {
	const session = await prisma.session.findUnique({
		where: { token },
		include: { user: true }
	});

	if (!session || session.expiresAt < new Date()) {
		if (session) {
			await prisma.session.delete({ where: { id: session.id } });
		}
		return null;
	}

	return session.user;
}

export async function deleteSession(token) {
	try {
		await prisma.session.delete({ where: { token } });
	} catch {
		// Session might not exist
	}
}
