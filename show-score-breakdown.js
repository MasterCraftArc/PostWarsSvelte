import fs from 'fs';

// Read the score totals file
const data = JSON.parse(fs.readFileSync('score-totals-2025-11-10.json', 'utf8'));

console.log('📊 PostWars - Accurate Score Breakdown');
console.log('═'.repeat(80));
console.log(`Generated: ${new Date(data.generatedAt).toLocaleString()}\n`);

// Sort by final score descending
const sortedUsers = data.users.sort((a, b) => b.finalTotalScore - a.finalTotalScore);

console.log('Rank | Name                     | Posts | Comments | Post Pts | Comment Pts | Achievements | Total');
console.log('─'.repeat(120));

sortedUsers.forEach((user, index) => {
  const rank = `#${(index + 1).toString().padStart(2)}`;
  const name = user.name.padEnd(24);
  const posts = user.totalPosts.toString().padStart(5);
  const comments = user.totalCommentActivities.toString().padStart(8);
  const postPts = user.postScore.toFixed(1).padStart(8);
  const commentPts = user.commentActivityScore.toFixed(1).padStart(11);
  const achievementPts = user.achievementScore.toString().padStart(12);
  const total = user.finalTotalScore.toFixed(1).padStart(7);

  console.log(`${rank} | ${name} | ${posts} | ${comments} | ${postPts} | ${commentPts} | ${achievementPts} | ${total}`);
});

console.log('─'.repeat(120));

// Calculate platform totals
const totals = {
  posts: sortedUsers.reduce((sum, u) => sum + u.totalPosts, 0),
  comments: sortedUsers.reduce((sum, u) => sum + u.totalCommentActivities, 0),
  postScore: sortedUsers.reduce((sum, u) => sum + u.postScore, 0),
  commentScore: sortedUsers.reduce((sum, u) => sum + u.commentActivityScore, 0),
  achievements: sortedUsers.reduce((sum, u) => sum + u.achievementScore, 0),
  total: sortedUsers.reduce((sum, u) => sum + u.finalTotalScore, 0)
};

console.log(`TOTAL                           ${totals.posts.toString().padStart(5)} | ${totals.comments.toString().padStart(8)} | ${totals.postScore.toFixed(1).padStart(8)} | ${totals.commentScore.toFixed(1).padStart(11)} | ${totals.achievements.toString().padStart(12)} | ${totals.total.toFixed(1).padStart(7)}`);

console.log('\n📈 Detailed Breakdown:\n');

sortedUsers.forEach((user, index) => {
  console.log(`${index + 1}. ${user.name} (${user.teamId || 'No Team'})`);
  console.log(`   Posts: ${user.totalPosts} posts = ${user.postScore.toFixed(2)} pts`);
  console.log(`   Comments: ${user.totalCommentActivities} activities = ${user.commentActivityScore.toFixed(2)} pts`);
  console.log(`   Achievements: ${user.achievementScore} pts`);
  console.log(`   Max Streak: ${user.maxStreakAchieved} days`);
  console.log(`   ────────────────────────────────────────`);
  console.log(`   TOTAL: ${user.finalTotalScore.toFixed(2)} points\n`);
});

// Top streaks
console.log('\n🔥 Top Streaks:\n');
const topStreaks = [...sortedUsers]
  .sort((a, b) => b.maxStreakAchieved - a.maxStreakAchieved)
  .filter(u => u.maxStreakAchieved > 0)
  .slice(0, 10);

topStreaks.forEach((user, i) => {
  console.log(`${i + 1}. ${user.name.padEnd(25)} - ${user.maxStreakAchieved} days`);
});

// Most active posters
console.log('\n📝 Most Active Posters:\n');
const topPosters = [...sortedUsers]
  .sort((a, b) => b.totalPosts - a.totalPosts)
  .filter(u => u.totalPosts > 0)
  .slice(0, 10);

topPosters.forEach((user, i) => {
  console.log(`${i + 1}. ${user.name.padEnd(25)} - ${user.totalPosts} posts`);
});

// Most comment activities
console.log('\n💬 Most Comment Activities:\n');
const topCommenters = [...sortedUsers]
  .sort((a, b) => b.totalCommentActivities - a.totalCommentActivities)
  .filter(u => u.totalCommentActivities > 0)
  .slice(0, 10);

topCommenters.forEach((user, i) => {
  console.log(`${i + 1}. ${user.name.padEnd(25)} - ${user.totalCommentActivities} comments`);
});

console.log('\n' + '═'.repeat(80));
