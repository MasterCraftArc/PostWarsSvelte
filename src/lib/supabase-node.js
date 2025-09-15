import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables for Node.js compatibility
config();

// Node.js polyfills for web APIs required by Supabase
if (typeof globalThis.fetch === 'undefined') {
	console.log('🔧 Installing fetch polyfill for Node.js...');
	
	globalThis.fetch = async (url, options = {}) => {
		// Dynamic imports for ES module compatibility
		const https = await import('https');
		const http = await import('http');
		
		return new Promise((resolve, reject) => {
			const parsedUrl = new URL(url);
			const client = parsedUrl.protocol === 'https:' ? https.default : http.default;
			
			// Handle Headers object properly
			let headers = {
				'Content-Type': 'application/json'
			};
			
			if (options.headers) {
				if (options.headers instanceof Headers) {
					// Convert Headers object to plain object
					for (const [key, value] of options.headers.entries()) {
						headers[key] = value;
					}
				} else if (options.headers && typeof options.headers === 'object') {
					// Check if it's our custom Headers polyfill
					if (options.headers._headers && options.headers._headers instanceof Map) {
						// Convert our Headers polyfill
						for (const [key, value] of options.headers._headers) {
							headers[key] = value;
						}
					} else {
						// Plain object, spread it - but filter out non-string values
						Object.entries(options.headers).forEach(([key, value]) => {
							if (typeof value === 'string') {
								headers[key] = value;
							}
						});
					}
				}
			}
			
			const requestOptions = {
				hostname: parsedUrl.hostname,
				port: parsedUrl.port,
				path: parsedUrl.pathname + parsedUrl.search,
				method: options.method || 'GET',
				headers
			};
			
			console.log('🌐 Making request to:', url);
			console.log('🔑 Headers:', requestOptions.headers);
			
			const req = client.request(requestOptions, (res) => {
				let data = '';
				res.on('data', chunk => data += chunk);
				res.on('end', () => {
					console.log('📡 Response status:', res.statusCode);
					resolve({
						ok: res.statusCode >= 200 && res.statusCode < 300,
						status: res.statusCode,
						statusText: res.statusMessage || '',
						headers: new Headers(res.headers),
						json: () => Promise.resolve(JSON.parse(data)),
						text: () => Promise.resolve(data)
					});
				});
			});
			
			req.on('error', (error) => {
				console.error('❌ Request error:', error);
				reject(error);
			});
			
			if (options.body) {
				req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
			}
			req.end();
		});
	};
	
	console.log('✅ Fetch polyfill installed');
}

if (typeof globalThis.Headers === 'undefined') {
	globalThis.Headers = class Headers {
		constructor(init) {
			this._headers = new Map();
			if (init) {
				if (Array.isArray(init)) {
					for (const [key, value] of init) {
						this.set(key, value);
					}
				} else if (typeof init === 'object') {
					for (const [key, value] of Object.entries(init)) {
						this.set(key, value);
					}
				}
			}
		}
		
		get(name) {
			return this._headers.get(name.toLowerCase()) || null;
		}
		
		set(name, value) {
			this._headers.set(name.toLowerCase(), String(value));
		}
		
		has(name) {
			return this._headers.has(name.toLowerCase());
		}
		
		delete(name) {
			this._headers.delete(name.toLowerCase());
		}
		
		append(name, value) {
			const existing = this.get(name);
			this.set(name, existing ? `${existing}, ${value}` : value);
		}
		
		forEach(callback) {
			for (const [key, value] of this._headers) {
				callback(value, key, this);
			}
		}
		
		entries() {
			return this._headers.entries();
		}
		
		keys() {
			return this._headers.keys();
		}
		
		values() {
			return this._headers.values();
		}
	};
}

// Node.js-compatible Supabase client using process.env
const PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Lazy-loaded admin client to avoid build-time issues
let _supabaseAdmin = null;
let _supabaseAdminInitialized = false;

function getSupabaseAdmin() {
	if (!_supabaseAdminInitialized) {
		console.log('🔍 Initializing Supabase admin client...');
		console.log('🔍 URL present:', !!PUBLIC_SUPABASE_URL);
		console.log('🔍 Service key present:', !!SUPABASE_SERVICE_KEY);
		console.log('🔍 Service key starts with:', SUPABASE_SERVICE_KEY?.substring(0, 20) + '...');
		
		if (PUBLIC_SUPABASE_URL && SUPABASE_SERVICE_KEY) {
			_supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
				auth: {
					autoRefreshToken: false,
					persistSession: false
				}
			});
			console.log('✅ Supabase admin client created successfully');
		} else {
			console.error('❌ Missing Supabase configuration');
		}
		_supabaseAdminInitialized = true;
	}
	return _supabaseAdmin;
}

// Export the admin client as a getter
export const supabaseAdmin = new Proxy({}, {
	get(_target, prop) {
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