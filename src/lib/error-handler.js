import { dev } from '$app/environment';

/**
 * Sanitizes error messages for production to prevent information leakage
 * @param {Error} error - The error object
 * @param {string} userMessage - User-friendly message to display
 * @returns {Object} Sanitized error response
 */
export function sanitizeError(error, userMessage = 'Internal server error') {
	// Log the full error for debugging (only visible in server logs)
	console.error('Error:', error);

	// In development, return detailed error information
	if (dev) {
		return {
			error: userMessage,
			details: error.message,
			stack: error.stack,
			code: error.code
		};
	}

	// In production, return only safe error information
	const sanitizedResponse = {
		error: userMessage
	};

	// Include error code if it's safe to expose (database constraint errors, etc.)
	if (error.code && isSafeErrorCode(error.code)) {
		sanitizedResponse.code = error.code;
	}

	return sanitizedResponse;
}

/**
 * Determines if an error code is safe to expose to users
 * @param {string} code - Error code
 * @returns {boolean} Whether the code is safe to expose
 */
function isSafeErrorCode(code) {
	const safeErrorCodes = [
		'P2002', // Unique constraint violation
		'P2025', // Record not found
		'P2003', // Foreign key constraint violation
		'P2014', // Required field missing
	];

	return safeErrorCodes.includes(code);
}

/**
 * Creates a standardized API error response
 * @param {Error} error - The error object
 * @param {string} userMessage - User-friendly message
 * @param {number} statusCode - HTTP status code
 * @returns {Response} JSON error response
 */
export function createErrorResponse(error, userMessage, statusCode = 500) {
	const sanitized = sanitizeError(error, userMessage);
	return new Response(JSON.stringify(sanitized), {
		status: statusCode,
		headers: {
			'Content-Type': 'application/json'
		}
	});
}

/**
 * Database error handler with user-friendly messages
 * @param {Error} error - Database error
 * @returns {Object} Sanitized error response
 */
export function handleDatabaseError(error) {
	let userMessage = 'Database operation failed';

	// Provide user-friendly messages for common database errors
	switch (error.code) {
		case 'P2002':
			userMessage = 'This record already exists';
			break;
		case 'P2025':
			userMessage = 'Record not found';
			break;
		case 'P2003':
			userMessage = 'Invalid reference to related record';
			break;
		case 'P2014':
			userMessage = 'Required field is missing';
			break;
		case 'P2021':
			userMessage = 'Database table does not exist';
			break;
		default:
			userMessage = 'Database operation failed';
	}

	return sanitizeError(error, userMessage);
}

/**
 * Authentication error handler
 * @param {Error} error - Auth error
 * @returns {Object} Sanitized error response
 */
export function handleAuthError(error) {
	// Never expose authentication details
	return sanitizeError(error, 'Authentication failed');
}

/**
 * Rate limiting error handler
 * @param {Error} error - Rate limit error
 * @param {number} retryAfter - Seconds until retry allowed
 * @returns {Object} Sanitized error response
 */
export function handleRateLimitError(error, retryAfter) {
	const response = sanitizeError(error, 'Too many requests. Please try again later.');
	
	if (retryAfter) {
		response.retryAfter = retryAfter;
	}

	return response;
}