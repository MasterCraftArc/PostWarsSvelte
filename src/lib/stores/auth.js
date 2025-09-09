import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { supabase } from '$lib/supabase.js';

// Auth stores
export const user = writable(null);
export const session = writable(null);
export const loading = writable(true);
export const sessionChecked = writable(false); // Track if initial session check is complete

// Store reference to avoid conflicts
const sessionStore = session;

// Initialize auth state
if (browser) {
	// Get initial session
	supabase.auth.getSession().then(({ data }) => {
		const { session: initialSession } = data;
		sessionStore.set(initialSession);
		if (initialSession) {
			syncUserData(initialSession);
		} else {
			// No session found, but check is complete
			sessionChecked.set(true);
		}
		loading.set(false);
	}).catch(error => {
		loading.set(false);
		sessionChecked.set(true);
	});

	// Listen for auth changes
	supabase.auth.onAuthStateChange((event, authSession) => {
		sessionStore.set(authSession);
		if (authSession) {
			syncUserData(authSession);
		} else {
			user.set(null);
		}
		loading.set(false);
		sessionChecked.set(true);
	});
}

// Sync user data from server (includes role, gamification data)
async function syncUserData(sessionData) {
	try {
		// Fetch user data from our API to get role and other info
		const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${sessionData.access_token}`
			}
		});

		if (response.ok) {
			const userData = await response.json();
			user.set(userData.user);
		} else {
			// Fallback to basic Supabase user data
			user.set({
				id: sessionData.user.id,
				email: sessionData.user.email,
				name: sessionData.user.user_metadata?.name || sessionData.user.user_metadata?.full_name || null,
				role: 'REGULAR' // Default role
			});
		}
	} catch (error) {
		// Fallback to basic Supabase user data
		user.set({
			id: sessionData.user.id,
			email: sessionData.user.email,
			name: sessionData.user.user_metadata?.name || sessionData.user.user_metadata?.full_name || null,
			role: 'REGULAR' // Default role
		});
	} finally {
		// Mark session check as complete
		sessionChecked.set(true);
	}
}

export async function signup(email, password, name) {
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				name: name || null,
				full_name: name || null
			}
		}
	});

	if (error) {
		return { success: false, error: error.message };
	}

	// For email confirmation required
	if (data.user && !data.session) {
		return { 
			success: true, 
			message: 'Please check your email to confirm your account.',
			requiresConfirmation: true 
		};
	}

	// If logged in immediately (email confirmation disabled)
	if (data.session) {
		if (browser) {
			await goto('/dashboard');
		}
	}

	return { success: true };
}

export async function login(email, password) {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password
	});

	if (error) {
		return { success: false, error: error.message };
	}

	if (browser) {
		await goto('/dashboard');
	}

	return { success: true };
}

export async function logout() {
	// Clear user and session stores immediately
	user.set(null);
	session.set(null);
	
	// Sign out from Supabase (this should clear all storage)
	const { error } = await supabase.auth.signOut({ scope: 'global' });
	
	if (error) {
		// Handle logout error if needed
	}

	if (browser) {
		// Force clear any remaining storage as backup
		try {
			localStorage.clear();
			sessionStorage.clear();
		} catch (e) {
			// Storage clear failed, but user is still logged out
		}
		
		window.location.href = '/';
	}
}

// Password reset function
export async function resetPassword(email) {
	const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${window.location.origin}/auth/reset-password`
	});

	if (error) {
		return { success: false, error: error.message };
	}

	return { 
		success: true, 
		message: 'Password reset link has been sent to your email.' 
	};
}
