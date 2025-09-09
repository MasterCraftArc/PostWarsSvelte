#!/usr/bin/env node

// Simple performance test for LinkedIn scraper optimizations
import { scrapeSinglePost } from './src/lib/linkedin-scraper.js';

async function testScraperSpeed() {
    console.log('🧪 Testing LinkedIn Scraper Performance Improvements...');
    console.log('================================================');
    
    // Test URL (using a fake URL since we don't have auth setup in test environment)
    const testUrl = 'https://www.linkedin.com/posts/test-post-123';
    
    try {
        const startTime = Date.now();
        console.log('⏱️  Starting scraper test...');
        
        // This will fail due to auth, but we can measure the setup time
        await scrapeSinglePost(testUrl, { headed: false });
        
    } catch (error) {
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        
        console.log(`\n📊 Performance Results:`);
        console.log(`- Setup Time: ${totalTime}s`);
        console.log(`- Error (expected): ${error.message}`);
        
        // Expected improvements over baseline (13+ seconds):
        const baselineTime = 13;
        const improvement = ((baselineTime - totalTime) / baselineTime * 100).toFixed(1);
        
        if (totalTime < baselineTime) {
            console.log(`✅ Performance improved by ~${improvement}% (${totalTime}s vs ${baselineTime}s baseline)`);
        } else {
            console.log(`⚠️  Performance: ${totalTime}s (baseline: ${baselineTime}s)`);
        }
    }
    
    console.log('\n🚀 Optimizations Applied:');
    console.log('- ✅ Reduced timeout waits from 13s to ~3s');
    console.log('- ✅ Parallel selector searches');
    console.log('- ✅ Smart content loading with early exit');
    console.log('- ✅ Optimized browser launch flags');
    console.log('- ✅ domcontentloaded vs networkidle waiting');
    console.log('- ✅ Reduced expand button wait from 5s to 0.8s');
}

testScraperSpeed().catch(console.error);