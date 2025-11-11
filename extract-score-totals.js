import fs from 'fs';

// Read the accurate scores file
const data = JSON.parse(fs.readFileSync('accurate-scores-2025-11-10.json', 'utf8'));

// Extract just the summary totals
const totals = {
  generatedAt: data.generatedAt,
  users: data.users.map(user => ({
    name: user.name,
    teamId: user.teamId,
    totalPosts: user.summary.totalPosts,
    totalCommentActivities: user.summary.totalCommentActivities,
    postScore: user.summary.postScore,
    commentActivityScore: user.summary.commentActivityScore,
    achievementScore: user.summary.achievementScore,
    finalTotalScore: user.summary.finalTotalScore,
    maxStreakAchieved: user.summary.maxStreakAchieved
  })).sort((a, b) => b.finalTotalScore - a.finalTotalScore) // Sort by score descending
};

// Save to new file
const filename = 'score-totals-2025-11-10.json';
fs.writeFileSync(filename, JSON.stringify(totals, null, 2));

console.log('✅ Score totals extracted!');
console.log(`📄 Saved to: ${filename}`);
console.log(`\n📊 Top 10 Users:`);

totals.users.slice(0, 10).forEach((user, i) => {
  console.log(`${i + 1}. ${user.name.padEnd(25)} - ${user.finalTotalScore} pts`);
});
