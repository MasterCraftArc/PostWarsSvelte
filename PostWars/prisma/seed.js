import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
	// Check if admin user already exists
	const existingAdmin = await prisma.user.findUnique({
		where: { email: 'mikeslaughter@defenseunicorns.com' }
	});

	if (existingAdmin) {
		console.log('Admin user already exists');
		return;
	}

	// Create the admin user
	const hashedPassword = await bcryptjs.hash('school12', 12);
	
	const adminUser = await prisma.user.create({
		data: {
			name: 'Mike',
			email: 'mikeslaughter@defenseunicorns.com',
			password: hashedPassword,
			role: 'ADMIN'
		}
	});

	console.log('Created admin user:', adminUser.email);

	// Create some sample achievements if they don't exist
	const achievementCount = await prisma.achievement.count();
	
	if (achievementCount === 0) {
		await prisma.achievement.createMany({
			data: [
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
			]
		});
		console.log('Created sample achievements');
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});