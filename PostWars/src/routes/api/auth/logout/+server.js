import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	// Logout is now handled client-side through Supabase Auth
	// This endpoint exists for backward compatibility
	return json({ message: 'Logged out successfully' });
}
