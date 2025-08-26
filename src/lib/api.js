import { supabase } from './supabase.js';

/**
 * Make an authenticated API request to our backend
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
	// Get the current session
	const { data: { session } } = await supabase.auth.getSession();
	
	if (!session?.access_token) {
		throw new Error('No authentication session found');
	}

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
	
	return response;
}

/**
 * Make an authenticated API request and parse JSON response
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function authenticatedRequest(url, options = {}) {
	try {
		const response = await authenticatedFetch(url, options);
		
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
			throw new Error(errorData.error || `Request failed with status ${response.status}`);
		}
		
		const data = await response.json();
		return data;
	} catch (error) {
		throw error;
	}
}

/**
 * Make multiple authenticated API requests in parallel
 * @param {Array} requests - Array of {url, options} objects
 * @returns {Promise<Array>} Array of parsed JSON responses
 */
export async function batchRequest(requests) {
	const { data: { session } } = await supabase.auth.getSession();
	
	if (!session?.access_token) {
		throw new Error('No authentication session found');
	}
	
	// Execute multiple API calls in parallel
	const promises = requests.map(({ url, options = {} }) => 
		fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${session.access_token}`,
				...options.headers
			}
		})
	);
	
	const responses = await Promise.all(promises);
	
	// Check for errors and parse JSON
	const results = await Promise.all(
		responses.map(async (response, index) => {
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
				throw new Error(`Request ${index + 1} failed: ${errorData.error || response.status}`);
			}
			return response.json();
		})
	);
	
	return results;
}