import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_KEY } from '$env/static/private';

// Lazy-loaded admin client to avoid build-time issues
let _supabaseAdmin = null;
let _supabaseAdminInitialized = false;

function getSupabaseAdmin() {
	if (!_supabaseAdminInitialized) {
		if (PUBLIC_SUPABASE_URL && SUPABASE_SERVICE_KEY) {
			_supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
				auth: {
					autoRefreshToken: false,
					persistSession: false
				}
			});
		}
		_supabaseAdminInitialized = true;
	}
	return _supabaseAdmin;
}

// Export the admin client as a getter
export const supabaseAdmin = new Proxy({}, {
	get(target, prop) {
		const admin = getSupabaseAdmin();
		if (!admin) {
			throw new Error('Supabase admin client not initialized. Check environment variables.');
		}
		return admin[prop];
	}
});

// Server-side client factory for request-specific sessions
export function createSupabaseServerClient(cookies) {
	if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
		throw new Error('Supabase configuration not available. Check environment variables.');
	}
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