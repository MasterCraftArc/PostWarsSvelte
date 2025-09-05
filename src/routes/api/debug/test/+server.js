import { json } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_KEY } from '$env/static/private';

export async function GET() {
	try {
		return json({
			message: 'API is working',
			environment: {
				hasSupabaseUrl: !!PUBLIC_SUPABASE_URL,
				hasAnonKey: !!PUBLIC_SUPABASE_ANON_KEY,
				hasServiceKey: !!SUPABASE_SERVICE_KEY,
				supabaseUrl: PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
				nodeEnv: process.env.NODE_ENV,
				netlifyContext: process.env.CONTEXT || 'not-available'
			},
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		return json({
			error: 'Test endpoint failed',
			details: error.message,
			stack: error.stack
		}, { status: 500 });
	}
}