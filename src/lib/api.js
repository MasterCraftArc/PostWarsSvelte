import { supabase } from './supabase.js';

/**
 * Make an authenticated API request to our backend
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
	console.log('⏱️ Getting Supabase session...');
	const sessionStart = Date.now();
	
	// Get the current session
	const { data: { session } } = await supabase.auth.getSession();
	console.log('✅ getSession took:', Date.now() - sessionStart, 'ms');
	console.log('🔍 Session details:', {
		hasSession: !!session,
		hasAccessToken: !!session?.access_token,
		userId: session?.user?.id,
		userEmail: session?.user?.email,
		userName: session?.user?.user_metadata?.name,
		tokenLength: session?.access_token?.length
	});
	
	if (!session?.access_token) {
		console.error('❌ No access token found in session');
		throw new Error('No authentication session found');
	}

	console.log('⏱️ Making fetch request...');
	const fetchStart = Date.now();

	// Add the Authorization header
	const headers = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${session.access_token}`,
		...options.headers
	};

	const response = await fetch(url, {
		...options,
		headers
	});
	
	console.log('✅ fetch took:', Date.now() - fetchStart, 'ms');
	return response;
}

/**
 * Make an authenticated API request and parse JSON response
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function authenticatedRequest(url, options = {}) {
	console.log('🚀 Starting authenticatedRequest for:', url);
	const startTime = Date.now();
	
	try {
		const response = await authenticatedFetch(url, options);
		console.log('✅ authenticatedFetch took:', Date.now() - startTime, 'ms');
		
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
			throw new Error(errorData.error || `Request failed with status ${response.status}`);
		}
		
		const data = await response.json();
		console.log('✅ Total authenticatedRequest took:', Date.now() - startTime, 'ms');
		return data;
	} catch (error) {
		console.error('❌ authenticatedRequest failed after', Date.now() - startTime, 'ms:', error);
		throw error;
	}
}