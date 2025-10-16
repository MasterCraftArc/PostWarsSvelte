#!/usr/bin/env node

/**
 * Local testing script for analytics update performance
 *
 * Usage: node test-analytics-local.js
 *
 * This will:
 * 1. Run the analytics update with performance metrics
 * 2. Show timing for batches and total duration
 * 3. Verify parallel processing is working
 */

import { updateAllPostAnalytics } from './src/lib/cron/update-analytics.js';

console.log('🧪 Starting local analytics update test...\n');
console.log('📊 This will update posts older than 1 hour');
console.log('⚡ Using parallel processing with browser pool\n');
console.log('─'.repeat(60));

const testStartTime = Date.now();

updateAllPostAnalytics()
	.then((result) => {
		const testDuration = ((Date.now() - testStartTime) / 1000).toFixed(1);

		console.log('\n' + '═'.repeat(60));
		console.log('📋 TEST RESULTS:');
		console.log('═'.repeat(60));
		console.log(`✅ Success: ${result.success}`);
		console.log(`📦 Posts processed: ${result.processed || 0}`);
		console.log(`✅ Successes: ${result.successCount || 0}`);
		console.log(`❌ Errors: ${result.errorCount || 0}`);
		console.log(`⏱️  Total test time: ${testDuration}s`);

		if (result.processed > 0) {
			const avgTime = (testDuration / result.processed).toFixed(2);
			const postsPerMinute = ((result.processed / testDuration) * 60).toFixed(1);
			console.log(`📈 Average time per post: ${avgTime}s`);
			console.log(`🚀 Processing rate: ${postsPerMinute} posts/minute`);

			// Performance evaluation
			const targetTime = result.processed * 3; // Target: 3 seconds per post avg
			if (testDuration < targetTime) {
				console.log(`\n✅ PERFORMANCE: EXCELLENT (${testDuration}s < ${targetTime}s target)`);
			} else {
				console.log(`\n⚠️  PERFORMANCE: NEEDS IMPROVEMENT (${testDuration}s > ${targetTime}s target)`);
			}
		}

		console.log('═'.repeat(60));

		if (result.success) {
			console.log('\n✅ Test completed successfully!');
			process.exit(0);
		} else {
			console.log('\n❌ Test failed:', result.error);
			process.exit(1);
		}
	})
	.catch((error) => {
		console.error('\n❌ Test failed with error:', error);
		console.error('Stack trace:', error.stack);
		process.exit(1);
	});
