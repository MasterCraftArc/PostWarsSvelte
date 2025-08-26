import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Supabase admin client
const supabaseAdmin = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	}
);

async function createAdminUser() {
	console.log('🌱 Creating admin user in Supabase Auth...');

	try {
		// Create user in Supabase Auth
		const { data, error } = await supabaseAdmin.auth.admin.createUser({
			email: 'mikeslaughter@defenseunicorns.com',
			password: 'school12',
			user_metadata: {
				name: 'Mike',
				full_name: 'Mike'
			},
			email_confirm: true // Skip email confirmation for admin
		});

		if (error) {
			if (error.message.includes('already registered') || error.code === 'email_exists') {
				console.log('✅ Admin user already exists in Supabase Auth');
				// Get the existing user
				const { data: users } = await supabaseAdmin.auth.admin.listUsers();
				const existingUser = users.users.find(u => u.email === 'mikeslaughter@defenseunicorns.com');
				if (existingUser) {
					console.log('✅ Found existing user:', existingUser.id);
					return existingUser;
				}
			} else {
				throw error;
			}
		} else {
			console.log('✅ Created admin user in Supabase Auth:', {
				id: data.user.id,
				email: data.user.email
			});
			return data.user;
		}
	} catch (error) {
		console.error('❌ Failed to create admin user:', error.message);
		throw error;
	}
}

async function updateUserRole(userId) {
	console.log('🔧 Updating user role in database...');
	
	try {
		// First check if user exists in our users table
		const { data: existingUser } = await supabaseAdmin
			.from('users')
			.select('*')
			.eq('id', userId)
			.single();

		if (existingUser) {
			// Update existing user to admin
			const { data: updatedUser, error } = await supabaseAdmin
				.from('users')
				.update({ role: 'ADMIN' })
				.eq('id', userId)
				.select()
				.single();

			if (error) {
				throw error;
			}

			console.log('✅ Updated user role to ADMIN');
			return updatedUser;
		} else {
			// Create user record with admin role
			const { data: newUser, error } = await supabaseAdmin
				.from('users')
				.insert({
					id: userId,
					email: 'mikeslaughter@defenseunicorns.com',
					name: 'Mike',
					role: 'ADMIN'
				})
				.select()
				.single();

			if (error) {
				throw error;
			}

			console.log('✅ Created user record with ADMIN role');
			return newUser;
		}
	} catch (error) {
		console.error('❌ Failed to update user role:', error.message);
		throw error;
	}
}

createAdminUser()
	.then(async (user) => {
		if (user?.id) {
			await updateUserRole(user.id);
		}
		console.log('🎉 Admin user setup complete!');
		console.log('User ID:', user?.id);
		console.log('Email:', user?.email);
		console.log('\n📝 Next steps:');
		console.log('1. Go to your app: http://localhost:5173');
		console.log('2. Click "Login"');
		console.log('3. Use: mikeslaughter@defenseunicorns.com / school12');
		console.log('4. You should now see the "Admin" link in the navigation');
	})
	.catch(error => {
		console.error('❌ Setup failed:', error);
		process.exit(1);
	});