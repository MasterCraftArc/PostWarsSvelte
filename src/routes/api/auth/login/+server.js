import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	// Login is now handled client-side through Supabase Auth
	// This endpoint exists for backward compatibility but directs to client-side auth
	return json({ 
		error: 'Please use client-side authentication' 
	}, { status: 400 });
}
