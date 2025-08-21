import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

export const user = writable(null);

export async function signup(email, password, name) {
	const response = await fetch('/api/auth/signup', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password, name })
	});

	const data = await response.json();

	if (response.ok) {
		user.set(data.user);
		if (browser) {
			await goto('/dashboard');
		}
		return { success: true };
	} else {
		return { success: false, error: data.error };
	}
}

export async function login(email, password) {
	const response = await fetch('/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});

	const data = await response.json();

	if (response.ok) {
		user.set(data.user);
		if (browser) {
			await goto('/dashboard');
		}
		return { success: true };
	} else {
		return { success: false, error: data.error };
	}
}

export async function logout() {
	const response = await fetch('/api/auth/logout', {
		method: 'POST'
	});

	if (response.ok) {
		user.set(null);
		if (browser) {
			window.location.href = '/';
		}
	}
}
