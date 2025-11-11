import fs from 'fs';
import path from 'path';

// Read the accurate scores file
const data = JSON.parse(fs.readFileSync('accurate-scores-2025-11-10.json', 'utf8'));

// Create directory for user breakdowns
const dir = 'user-breakdowns';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

console.log('📊 Generating Individual User Breakdowns...\n');

data.users.forEach(user => {
  const lines = [];

  lines.push('═'.repeat(80));
  lines.push(`PostWars - Score Breakdown for ${user.name}`);
  lines.push('═'.repeat(80));
  lines.push(`Team: ${user.teamId || 'No Team'}`);
  lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString()}`);
  lines.push('');

  // Summary
  lines.push('📊 SUMMARY');
  lines.push('─'.repeat(80));
  lines.push(`Total Posts: ${user.summary.totalPosts}`);
  lines.push(`Total Comment Activities: ${user.summary.totalCommentActivities}`);
  lines.push(`Max Streak Achieved: ${user.summary.maxStreakAchieved} days`);
  lines.push('');
  lines.push(`Post Points: ${user.summary.postScore} pts`);
  lines.push(`Comment Points: ${user.summary.commentActivityScore} pts`);
  lines.push(`Achievement Points: ${user.summary.achievementScore} pts`);
  lines.push(`─`.repeat(80));
  lines.push(`FINAL TOTAL: ${user.summary.finalTotalScore} points`);
  lines.push('═'.repeat(80));
  lines.push('');

  if (user.scoredItems.length > 0) {
    lines.push('📝 DETAILED BREAKDOWN');
    lines.push('');

    user.scoredItems.forEach((item, index) => {
      if (item.type === 'post') {
        lines.push(`Post #${index + 1} - ${item.date}`);
        lines.push(`  URL: ${item.url}`);
        lines.push(`  Streak: ${item.streak} days (${item.multiplier}x multiplier)`);
        lines.push(`  Engagement: ${item.reactions} reactions, ${item.comments} comments`);
        lines.push(`  Base Score: ${item.rawBaseScore} pts × ${item.multiplier} = ${item.baseScoreWithMultiplier} pts`);
        lines.push(`  Engagement Score: ${item.engagementScore} pts`);
        lines.push(`  Calculated Total: ${item.baseScoreWithMultiplier} + ${item.engagementScore} = ${item.calculatedScore} pts`);
        lines.push(`  ────────────────────────────────────────`);
        lines.push(`  FINAL: ${item.finalScore} pts (rounded up from ${item.calculatedScore})`);
        lines.push('');
      } else if (item.type === 'comment_activity') {
        lines.push(`Comment Activity #${index + 1} - ${item.date}`);
        lines.push(`  URL: ${item.url}`);
        lines.push(`  Streak: ${item.streak} days (${item.multiplier}x multiplier)`);
        lines.push(`  Base Score: ${item.rawBaseScore} pts × ${item.multiplier} = ${item.calculatedScore} pts`);
        lines.push(`  ────────────────────────────────────────`);
        lines.push(`  FINAL: ${item.finalScore} pts (rounded up from ${item.calculatedScore})`);
        lines.push('');
      }
    });
  } else {
    lines.push('No posts or comment activities recorded.');
    lines.push('');
  }

  lines.push('═'.repeat(80));
  lines.push('Scoring Formula:');
  lines.push('  Posts: (1 base point × streak multiplier) + (reactions × 0.1) + (comments × 0.5)');
  lines.push('  Comments: (0.5 base points × streak multiplier)');
  lines.push('  Streak Multiplier: 1 + (streak × 0.15), capped at 2.0x');
  lines.push('  All scores rounded UP to nearest whole number');
  lines.push('═'.repeat(80));

  // Write to file
  const filename = path.join(dir, `${user.name.replace(/\s+/g, '-').toLowerCase()}-breakdown.txt`);
  fs.writeFileSync(filename, lines.join('\n'));

  console.log(`✅ Generated: ${filename}`);
});

console.log(`\n✨ Complete! Generated ${data.users.length} user breakdown files in ./${dir}/`);
