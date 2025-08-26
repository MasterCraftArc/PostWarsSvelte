import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { supabase } from '$lib/supabase.js';

// Auth stores
export const user = writable(null);
export const session = writable(null);
export const loading = writable(true);

// Store reference to avoid conflicts
const sessionStore = session;

// Initialize auth state
if (browser) {
	console.log('🚀 Auth store initializing...');
	
	// Get initial session
	console.log('⏱️ Auth store: Getting initial session...');
	supabase.auth.getSession().then(({ data }) => {
		console.log('✅ Auth store: Got initial session:', !!data.session);
		const { session: initialSession } = data;
		sessionStore.set(initialSession);
		if (initialSession) {
			console.log('⏱️ Auth store: Syncing user data...');
			syncUserData(initialSession);
		} else {
			console.log('❌ Auth store: No initial session found');
		}
		loading.set(false);
		console.log('✅ Auth store: Initial setup complete');
	}).catch(error => {
		console.error('❌ Auth store: Failed to get initial session:', error);
		loading.set(false);
	});

	// Listen for auth changes
	supabase.auth.onAuthStateChange((event, authSession) => {
		console.log('🔄 Auth store: Auth state changed:', event, !!authSession);
		sessionStore.set(authSession);
		if (authSession) {
			syncUserData(authSession);
		} else {
			user.set(null);
		}
		loading.set(false);
	});
}

// Sync user data from server (includes role, gamification data)
async function syncUserData(sessionData) {
	try {
		console.log('🔍 Syncing user data for:', sessionData.user.email);
		
		// Fetch user data from our API to get role and other info
		const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${sessionData.access_token}`
			}
		});

		if (response.ok) {
			const userData = await response.json();
			console.log('✅ User data synced:', userData.user.email);
			user.set(userData.user);
		} else {
			console.log('⚠️ API sync failed, using fallback data for:', sessionData.user.email);
			// Fallback to basic Supabase user data
			user.set({
				id: sessionData.user.id,
				email: sessionData.user.email,
				name: sessionData.user.user_metadata?.name || sessionData.user.user_metadata?.full_name || null,
				role: 'REGULAR' // Default role
			});
		}
	} catch (error) {
		console.error('Error syncing user data:', error);
		// Fallback to basic Supabase user data
		user.set({
			id: sessionData.user.id,
			email: sessionData.user.email,
			name: sessionData.user.user_metadata?.name || sessionData.user.user_metadata?.full_name || null,
			role: 'REGULAR' // Default role
		});
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
		console.error('Logout error:', error);
	}

	if (browser) {
		// Force clear any remaining storage as backup
		try {
			localStorage.clear();
			sessionStorage.clear();
		} catch (e) {
			console.warn('Could not clear storage:', e);
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
