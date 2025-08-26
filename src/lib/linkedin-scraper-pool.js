import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import path from 'path';

// Import scraping functions from original scraper
import { 
	extractPostData, 
	isSinglePostUrl, 
	SINGLE_POST_SELECTORS 
} from './linkedin-scraper.js';

class BrowserPool {
	constructor(options = {}) {
		this.maxBrowsers = options.maxBrowsers || 3;
		this.maxPagesPerBrowser = options.maxPagesPerBrowser || 5;
		this.browsers = [];
		this.queue = [];
		this.processing = false;
		this.browserTimeout = options.browserTimeout || 300000; // 5 minutes
		this.pageTimeout = options.pageTimeout || 60000; // 1 minute
	}

	async getBrowser(userId) {
		// Find existing browser with available capacity
		let browser = this.browsers.find(b => 
			b.pages.length < this.maxPagesPerBrowser && 
			!b.closing
		);

		if (!browser) {
			if (this.browsers.length < this.maxBrowsers) {
				browser = await this.createBrowser();
			} else {
				// Wait for available browser
				return new Promise((resolve) => {
					this.queue.push({ userId, resolve });
					this.processQueue();
				});
			}
		}

		return browser;
	}

	async createBrowser() {
		console.log('Creating new browser instance...');
		
		const browserInstance = await chromium.launch({
			headless: true,
			args: [
				'--disable-blink-features=AutomationControlled',
				'--disable-web-security',
				'--no-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu'
			]
		});

		const browser = {
			instance: browserInstance,
			pages: [],
			lastUsed: Date.now(),
			closing: false
		};

		this.browsers.push(browser);

		// Auto-cleanup after timeout
		setTimeout(() => {
			this.cleanupBrowser(browser);
		}, this.browserTimeout);

		return browser;
	}

	async getPage(browser, userId) {
		const storageStatePath = this.getUserStoragePath(userId);
		
		try {
			// Check if storage state exists
			let contextOptions = {
				viewport: { width: 1920, height: 1080 },
				userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
			};

			try {
				await fs.access(storageStatePath);
				contextOptions.storageState = storageStatePath;
			} catch (e) {
				// File doesn't exist, continue without storage state
			}

			const context = await browser.instance.newContext(contextOptions);
			const page = await context.newPage();

			const pageInfo = {
				page,
				context,
				userId,
				createdAt: Date.now()
			};

			browser.pages.push(pageInfo);
			browser.lastUsed = Date.now();

			// Auto-cleanup page after timeout
			setTimeout(() => {
				this.cleanupPage(browser, pageInfo);
			}, this.pageTimeout);

			return pageInfo;

		} catch (error) {
			console.error('Failed to create page:', error);
			throw error;
		}
	}

	getUserStoragePath(userId) {
		return path.join(process.cwd(), `linkedin_auth_${userId}.json`);
	}

	async releasePage(browser, pageInfo) {
		try {
			await pageInfo.context.close();
			browser.pages = browser.pages.filter(p => p !== pageInfo);
			browser.lastUsed = Date.now();
			
			// Process queue if there are waiting requests
			this.processQueue();
		} catch (error) {
			console.error('Failed to release page:', error);
		}
	}

	async cleanupPage(browser, pageInfo) {
		if (browser.pages.includes(pageInfo)) {
			try {
				await pageInfo.context.close();
				browser.pages = browser.pages.filter(p => p !== pageInfo);
				console.log(`Cleaned up page for user ${pageInfo.userId}`);
			} catch (error) {
				console.error('Failed to cleanup page:', error);
			}
		}
	}

	async cleanupBrowser(browser) {
		if (browser.closing) return;
		
		browser.closing = true;
		
		try {
			// Close all pages first
			for (const pageInfo of browser.pages) {
				try {
					await pageInfo.context.close();
				} catch (error) {
					console.error('Failed to close page context:', error);
				}
			}
			
			await browser.instance.close();
			this.browsers = this.browsers.filter(b => b !== browser);
			console.log('Cleaned up browser instance');
			
			// Process queue in case there were waiting requests
			this.processQueue();
		} catch (error) {
			console.error('Failed to cleanup browser:', error);
		}
	}

	processQueue() {
		if (this.processing || this.queue.length === 0) return;
		
		this.processing = true;
		
		// Check for available browsers
		const availableBrowser = this.browsers.find(b => 
			b.pages.length < this.maxPagesPerBrowser && 
			!b.closing
		);

		if (availableBrowser && this.queue.length > 0) {
			const request = this.queue.shift();
			request.resolve(availableBrowser);
		}

		this.processing = false;
		
		// Continue processing if more items in queue
		if (this.queue.length > 0) {
			setTimeout(() => this.processQueue(), 100);
		}
	}

	async cleanup() {
		console.log('Cleaning up browser pool...');
		
		for (const browser of this.browsers) {
			await this.cleanupBrowser(browser);
		}
		
		this.browsers = [];
		this.queue = [];
	}

	getStats() {
		return {
			totalBrowsers: this.browsers.length,
			totalPages: this.browsers.reduce((sum, b) => sum + b.pages.length, 0),
			queueLength: this.queue.length,
			activeBrowsers: this.browsers.filter(b => !b.closing).length
		};
	}
}

// Singleton browser pool
const browserPool = new BrowserPool({
	maxBrowsers: 3,
	maxPagesPerBrowser: 5,
	browserTimeout: 300000, // 5 minutes
	pageTimeout: 60000 // 1 minute
});

// Cleanup on process exit
process.on('SIGINT', async () => {
	console.log('Shutting down browser pool...');
	await browserPool.cleanup();
	process.exit();
});

process.on('SIGTERM', async () => {
	console.log('Shutting down browser pool...');
	await browserPool.cleanup();
	process.exit();
});

// Main scraping function using pool
export async function scrapeSinglePostQueued(url, userId, options = {}) {
	if (!isSinglePostUrl(url)) {
		throw new Error('Only single post URLs are supported');
	}

	console.log(`Scraping post for user ${userId}: ${url}`);

	const browser = await browserPool.getBrowser(userId);
	const pageInfo = await browserPool.getPage(browser, userId);

	try {
		console.log('Navigating to post...');
		await pageInfo.page.goto(url, { 
			waitUntil: 'domcontentloaded', 
			timeout: 60000 
		});
		
		// Wait for content to load
		await pageInfo.page.waitForTimeout(5000);

		// Find post container
		let postContainer = null;
		for (const selector of SINGLE_POST_SELECTORS) {
			try {
				const container = pageInfo.page.locator(selector).first();
				const count = await container.count();
				if (count > 0) {
					postContainer = container;
					console.log(`Found post using selector: ${selector}`);
					break;
				}
			} catch (e) {
				continue;
			}
		}

		if (!postContainer) {
			throw new Error('Could not find post container on page');
		}

		// Extract post data using existing logic
		const postData = await extractPostData(postContainer, 0);
		
		if (!postData) {
			throw new Error('Failed to extract post data');
		}

		console.log(`Extracted post: ${postData.char_count} chars, ${postData.total_engagement} engagements`);
		
		// Save auth state for this user
		try {
			const storageStatePath = browserPool.getUserStoragePath(userId);
			const storageState = await pageInfo.context.storageState();
			await fs.writeFile(storageStatePath, JSON.stringify(storageState, null, 2));
		} catch (error) {
			console.warn('Failed to save storage state:', error.message);
		}

		return postData;

	} catch (error) {
		console.error('Scraping failed:', error);
		throw error;
	} finally {
		// Release page back to pool
		await browserPool.releasePage(browser, pageInfo);
	}
}

// Export browser pool for monitoring
export { browserPool };