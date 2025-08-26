class RateLimiter {
	constructor(options = {}) {
		this.limits = new Map();
		this.defaultConfig = {
			windowMs: options.windowMs || 60000, // 1 minute
			maxRequests: options.maxRequests || 5, // 5 requests per minute
			skipSuccessfulRequests: options.skipSuccessfulRequests || false,
			skipFailedRequests: options.skipFailedRequests || false
		};
	}

	// Check if request is allowed for a specific key (userId, IP, etc.)
	isAllowed(key, config = {}) {
		const finalConfig = { ...this.defaultConfig, ...config };
		const now = Date.now();
		const windowStart = now - finalConfig.windowMs;

		// Get or create rate limit data for this key
		if (!this.limits.has(key)) {
			this.limits.set(key, []);
		}

		const requests = this.limits.get(key);
		
		// Remove old requests outside the window
		const validRequests = requests.filter(timestamp => timestamp > windowStart);
		this.limits.set(key, validRequests);

		// Check if under limit
		if (validRequests.length < finalConfig.maxRequests) {
			// Add current request timestamp
			validRequests.push(now);
			this.limits.set(key, validRequests);
			return {
				allowed: true,
				remaining: finalConfig.maxRequests - validRequests.length,
				resetTime: windowStart + finalConfig.windowMs,
				totalRequests: validRequests.length
			};
		}

		// Over limit
		return {
			allowed: false,
			remaining: 0,
			resetTime: validRequests[0] + finalConfig.windowMs,
			totalRequests: validRequests.length,
			retryAfter: Math.ceil((validRequests[0] + finalConfig.windowMs - now) / 1000)
		};
	}

	// Record a failed request (if configured to skip failed requests)
	recordFailure(key, config = {}) {
		const finalConfig = { ...this.defaultConfig, ...config };
		
		if (finalConfig.skipFailedRequests) {
			const requests = this.limits.get(key) || [];
			if (requests.length > 0) {
				requests.pop(); // Remove the last request since it failed
				this.limits.set(key, requests);
			}
		}
	}

	// Get current status for a key without recording a request
	getStatus(key, config = {}) {
		const finalConfig = { ...this.defaultConfig, ...config };
		const now = Date.now();
		const windowStart = now - finalConfig.windowMs;

		if (!this.limits.has(key)) {
			return {
				remaining: finalConfig.maxRequests,
				resetTime: now + finalConfig.windowMs,
				totalRequests: 0
			};
		}

		const requests = this.limits.get(key);
		const validRequests = requests.filter(timestamp => timestamp > windowStart);

		return {
			remaining: Math.max(0, finalConfig.maxRequests - validRequests.length),
			resetTime: validRequests.length > 0 ? validRequests[0] + finalConfig.windowMs : now + finalConfig.windowMs,
			totalRequests: validRequests.length
		};
	}

	// Clear all rate limit data
	clear() {
		this.limits.clear();
	}

	// Clear rate limit data for specific key
	clearKey(key) {
		this.limits.delete(key);
	}

	// Get all current limits (for debugging)
	getAllLimits() {
		const result = {};
		for (const [key, requests] of this.limits.entries()) {
			result[key] = {
				requests: requests.length,
				oldestRequest: requests.length > 0 ? new Date(Math.min(...requests)) : null,
				newestRequest: requests.length > 0 ? new Date(Math.max(...requests)) : null
			};
		}
		return result;
	}

	// Cleanup old entries periodically
	cleanup() {
		const now = Date.now();
		const cutoff = now - this.defaultConfig.windowMs;

		for (const [key, requests] of this.limits.entries()) {
			const validRequests = requests.filter(timestamp => timestamp > cutoff);
			
			if (validRequests.length === 0) {
				this.limits.delete(key);
			} else {
				this.limits.set(key, validRequests);
			}
		}
	}
}

// Create rate limiters for different use cases
export const postSubmissionLimiter = new RateLimiter({
	windowMs: 60000, // 1 minute
	maxRequests: 3, // 3 post submissions per minute per user
	skipFailedRequests: true
});

export const globalScrapingLimiter = new RateLimiter({
	windowMs: 60000, // 1 minute  
	maxRequests: 10, // 10 scraping jobs per minute globally
	skipFailedRequests: false
});

export const ipBasedLimiter = new RateLimiter({
	windowMs: 300000, // 5 minutes
	maxRequests: 20, // 20 requests per IP per 5 minutes
	skipFailedRequests: false
});

// Cleanup periodically
setInterval(() => {
	postSubmissionLimiter.cleanup();
	globalScrapingLimiter.cleanup();
	ipBasedLimiter.cleanup();
}, 60000); // Cleanup every minute

export { RateLimiter };