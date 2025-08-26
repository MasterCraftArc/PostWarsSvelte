import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_KEY } from '$env/static/private';

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

// Server-side client factory for request-specific sessions
export function createSupabaseServerClient(cookies) {
	return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false
		},
		global: {
			headers: {
				cookie: cookies
			}
		}
	});
}