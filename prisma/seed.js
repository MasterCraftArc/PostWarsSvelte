import { supabaseAdmin } from '../src/lib/supabase-server.js';
import { createSupabaseAdmin } from '../src/lib/supabase-auth.js';

async function main() {
	console.log('🌱 Starting database seed...');

	// Check if admin user already exists in local database
	const { data: existingAdmin } = await supabaseAdmin
		.from('users')
		.select('*')
		.eq('email', 'mikeslaughter@defenseunicorns.com')
		.single();

	if (existingAdmin) {
		console.log('✅ Admin user already exists, skipping seed');
		return;
	}

	// Create admin user in Supabase Auth and local database
	try {
		const { supabaseUser, localUser } = await createSupabaseAdmin(
			'mikeslaughter@defenseunicorns.com',
			'school12',
			'Mike'
		);

		console.log('✅ Created admin user in Supabase:', {
			supabaseId: supabaseUser.id,
			email: supabaseUser.email
		});

		console.log('✅ Created admin user in local DB:', {
			id: localUser.id,
			email: localUser.email,
			name: localUser.name,
			role: localUser.role
		});
	} catch (error) {
		console.error('❌ Failed to create admin user:', error.message);
		
		// If user already exists in Supabase, that's okay
		if (error.message.includes('already registered')) {
			console.log('✅ Admin user already exists in Supabase');
		} else {
			throw error;
		}
	}

	// Create some sample achievements if they don't exist
	const { count } = await supabaseAdmin
		.from('achievements')
		.select('*', { count: 'exact', head: true });
	
	if (count === 0) {
		const { error } = await supabaseAdmin
			.from('achievements')
			.insert([
				{
					name: 'First Post',
					description: 'Submit your first LinkedIn post',
					icon: '🎉',
					points: 10,
					requirementType: 'posts_count',
					requirementValue: 1
				},
				{
					name: 'Engaged Poster',
					description: 'Get 50 total engagements',
					icon: '👥',
					points: 25,
					requirementType: 'engagement_total',
					requirementValue: 50
				},
				{
					name: 'Content Creator',
					description: 'Submit 10 posts',
					icon: '✍️',
					points: 50,
					requirementType: 'posts_count',
					requirementValue: 10
				},
				{
					name: 'Viral Post',
					description: 'Get 100 reactions on a single post',
					icon: '🔥',
					points: 100,
					requirementType: 'single_post_reactions',
					requirementValue: 100
				},
				{
					name: 'Consistent Creator',
					description: 'Maintain a 7-day posting streak',
					icon: '📅',
					points: 75,
					requirementType: 'streak_days',
					requirementValue: 7
				}
			]);

		if (error) {
			console.error('❌ Error creating achievements:', error);
		} else {
			console.log('✅ Created sample achievements');
		}
	}

	console.log('🎉 Database seeded successfully!');
}

main()
	.catch((e) => {
		console.error('❌ Error seeding database:', e);
		process.exit(1);
	});