const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configuration
const DEFAULT_EMAIL = process.env.LINKEDIN_EMAIL || '';
const DEFAULT_PASSWORD = process.env.LINKEDIN_PASSWORD || '';
const DEFAULT_STORAGE_STATE = process.env.LINKEDIN_STATE || 'auth_state.json';

// Post selectors for detection
const POST_SELECTORS = [
	"div[data-urn*='urn:li:activity']",
	"div[data-urn*='urn:li:ugcPost']",
	"div[data-urn*='urn:li:share']",
	'article[data-urn]',
	'.feed-shared-update-v2',
	'.occludable-update',
	"[data-id*='urn:li']"
];

// Single post selectors (for individual post URLs)
const SINGLE_POST_SELECTORS = [
	'.feed-shared-update-v2',
	"div[data-urn*='urn:li:activity']",
	"div[data-urn*='urn:li:ugcPost']",
	'article',
	'.single-post-container',
	'.post-detail-container'
];

// Text cleaning patterns
const REMOVE_PATTERNS = [
	/^Feed post number \d+$/,
	/^\d+(st|nd|rd|th)$/,
	/^Premium$/,
	/^•$/,
	/^\d+[wdhm]$/,
	/^(Follow|Connect|Message|Like|Comment|Repost|Share|Send|React|Save|Report|Copy link)$/,
	/^See more$/,
	/^\.\.\.more$/,
	/^Show more$/,
	/^Show less$/,
	/^\d+\s+(reaction|comment|repost|share)s?$/,
	/^\d+\s+[A-Za-z\s]+\s+and\s+\d+\s+others?$/,
	/^You and \d+ others?$/,
	/^\d+\s+(week|day|hour|month|year)s?\s+ago$/,
	/^Like\s+Comment\s+(?:Repost|Share)\s+Send$/,
	/^React\s+Comment\s+(?:Repost|Share)\s+Send$/
];

function normalizeCount(s) {
	const cleanStr = s.toString().trim().replace(/,/g, '').replace(/\s/g, '');
	if (!cleanStr) return 0;

	const match = cleanStr.match(/(\d+(?:\.\d+)?)\s*([KkMm])?/);
	if (!match) return 0;

	const [, num, suffix] = match;
	let value = parseFloat(num);

	if (suffix && suffix.toLowerCase() === 'k') {
		value *= 1000;
	} else if (suffix && suffix.toLowerCase() === 'm') {
		value *= 1000000;
	}

	return Math.floor(value);
}

function extractPostIdFromText(text) {
	const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 500);
	return crypto.createHash('md5').update(cleanText).digest('hex').substring(0, 16);
}

function parseRelativeTime(timeText) {
	if (!timeText) {
		return new Date().toISOString().split('T')[0];
	}

	const now = new Date();
	const lowerText = timeText.toLowerCase().trim();

	const match = lowerText.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/);
	if (!match) {
		return now.toISOString().split('T')[0];
	}

	const amount = parseInt(match[1]);
	const unit = match[2];

	let targetDate = new Date(now);

	switch (unit) {
		case 'second':
			targetDate.setSeconds(targetDate.getSeconds() - amount);
			break;
		case 'minute':
			targetDate.setMinutes(targetDate.getMinutes() - amount);
			break;
		case 'hour':
			targetDate.setHours(targetDate.getHours() - amount);
			break;
		case 'day':
			targetDate.setDate(targetDate.getDate() - amount);
			break;
		case 'week':
			targetDate.setDate(targetDate.getDate() - amount * 7);
			break;
		case 'month':
			targetDate.setDate(targetDate.getDate() - amount * 30);
			break;
		case 'year':
			targetDate.setDate(targetDate.getDate() - amount * 365);
			break;
	}

	return targetDate.toISOString().split('T')[0];
}

function cleanText(rawText, authorName = '') {
	const lines = rawText
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	const cleanedLines = [];
	const seenLines = new Set();

	const linkedinMetadataPatterns = [
		/^.*• 1st$/,
		/^Premium$/,
		/^\d+[wdhm] •.*$/,
		/^\d+ (days?|weeks?|hours?|months?) ago.*$/,
		/^Visible to anyone.*$/,
		/^Edited$/,
		/^.*• Edited •.*$/,
		/^.*on or off LinkedIn.*$/,
		/^.*Premium • 1st.*$/
	];

	let contentStartIdx = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (authorName && (line === authorName || line.includes(authorName))) {
			contentStartIdx = i + 1;
			continue;
		}

		if (
			linkedinMetadataPatterns.some((pattern) => pattern.test(line)) ||
			REMOVE_PATTERNS.some((pattern) => pattern.test(line))
		) {
			contentStartIdx = i + 1;
			continue;
		}

		if (line.length > 10 && !linkedinMetadataPatterns.some((pattern) => pattern.test(line))) {
			break;
		}
	}

	for (let i = contentStartIdx; i < lines.length; i++) {
		let line = lines[i];

		if (
			REMOVE_PATTERNS.some((pattern) => pattern.test(line)) ||
			linkedinMetadataPatterns.some((pattern) => pattern.test(line))
		)
			continue;
		if (
			authorName &&
			(line === authorName || line.includes(authorName) || authorName.includes(line))
		)
			continue;
		if (line.length < 2) continue;

		const lineKey = line.toLowerCase().trim();
		if (seenLines.has(lineKey)) continue;
		seenLines.add(lineKey);

		line = line.replace(/…more$|\.\.\.more$/, '').trim();
		line = line.replace(/^(View|See|Show)\s+(more|less|full).*$/i, '').trim();

		if (line && line.length > 3) {
			cleanedLines.push(line);
		}
	}

	let cleanedText = cleanedLines.join('\n');

	// Remove engagement footers
	const footerPatterns = [
		/\n*\d+\s+[A-Za-z\s]+\s+and\s+\d+\s+others.*$/,
		/\n*Like\s+Comment\s+(?:Repost|Share)\s+Send.*$/,
		/\n*\d+\s+reactions?\s*\d*\s*comments?\s*\d*\s*reposts?.*$/
	];

	footerPatterns.forEach((pattern) => {
		cleanedText = cleanedText.replace(pattern, '');
	});

	if (authorName) {
		const authorPattern = new RegExp(
			`\\n*${authorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`,
			'gmi'
		);
		cleanedText = cleanedText.replace(authorPattern, '');
	}

	cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
	cleanedText = cleanedText.replace(/[ \t]+/g, ' ');
	cleanedText = cleanedText.trim();

	return {
		full_text: cleanedText,
		word_count: cleanedText.split(/\s+/).length,
		char_count: cleanedText.length
	};
}

async function expandPostContent(postContainer) {
	const seeMoreSelectors = [
		"button:text-matches('see more', 'i')",
		"button:text-matches('show more', 'i')",
		'.feed-shared-inline-show-more-text__button'
	];

	for (const selector of seeMoreSelectors) {
		try {
			const button = postContainer.locator(selector).first();
			const count = await button.count();
			if (count > 0 && (await button.isVisible())) {
				await button.scrollIntoViewIfNeeded();
				await button.click();
				await postContainer.page().waitForTimeout(1500);
				return true;
			}
		} catch (e) {
			continue;
		}
	}
	return false;
}

async function extractAuthorData(postContainer) {
	const nameSelectors = [
		'.update-components-actor__name',
		'.feed-shared-actor__name',
		'.feed-shared-actor__name span',
		'.feed-shared-actor__name a span',
		"[data-control-name='actor'] span[aria-hidden='true']",
		'.feed-shared-update-v2__actor-name span',
		'.feed-shared-update-v2__actor-name'
	];

	let authorName = '';

	for (const selector of nameSelectors) {
		try {
			const elements = await postContainer.locator(selector).all();
			for (const nameEl of elements) {
				const count = await nameEl.count();
				if (count === 0) continue;

				const nameText = await nameEl.innerText({ timeout: 1000 });
				if (nameText && nameText.trim().length > 1) {
					const cleanName = nameText.trim();

					const skipPatterns = [
						/^\d+$/,
						/^(Like|Comment|Share|Repost|Send|Follow|Connect)$/,
						/^\d+[dwmyh]$/,
						/^(Premium|•|more|less)$/
					];

					if (skipPatterns.some((pattern) => pattern.test(cleanName))) continue;

					if (cleanName.length >= 2 && cleanName.length <= 100 && !cleanName.match(/^\d+$/)) {
						authorName = cleanName;
						break;
					}
				}
			}
			if (authorName) break;
		} catch (e) {
			continue;
		}
	}

	return { name: authorName };
}

async function extractPostIdentifiers(postContainer, postIndex) {
	let postUrl = `#post-${postIndex}`;
	let postId = `post_${postIndex}`;

	const urlSelectors = [
		"a[href*='linkedin.com/feed/update/']",
		"a[href*='linkedin.com/activity/']",
		"a[href*='linkedin.com/posts/']"
	];

	for (const selector of urlSelectors) {
		try {
			const linkEl = postContainer.locator(selector).first();
			const count = await linkEl.count();
			if (count > 0) {
				let href = await linkEl.getAttribute('href');
				if (href) {
					if (href.startsWith('//')) href = 'https:' + href;
					else if (href.startsWith('/')) href = 'https://www.linkedin.com' + href;

					postUrl = href;
					const idMatch = href.match(/(?:activity|update|posts)[-/:]([^/?&]+)/);
					if (idMatch) postId = idMatch[1];
					break;
				}
			}
		} catch (e) {
			continue;
		}
	}

	try {
		const urn = await postContainer.getAttribute('data-urn');
		if (urn) {
			const urnMatch = urn.match(/urn:li:(?:activity|ugcPost|share):(\d+)/);
			if (urnMatch) postId = urnMatch[1];
		}
	} catch (e) {
		// Ignore
	}

	return { postUrl, postId };
}

async function extractTimestamp(postContainer) {
	const timestampSelectors = ['time[datetime]', 'time', "span[aria-label*='ago']"];

	for (const selector of timestampSelectors) {
		try {
			const timeEl = postContainer.locator(selector).first();
			const count = await timeEl.count();
			if (count > 0) {
				const datetimeAttr = await timeEl.getAttribute('datetime');
				if (datetimeAttr) {
					return datetimeAttr;
				}

				const timeText = await timeEl.innerText({ timeout: 1000 });
				if (timeText && timeText.trim()) {
					return timeText.trim();
				}
			}
		} catch (e) {
			continue;
		}
	}

	return '';
}

async function extractEngagementMetrics(postContainer) {
	let reactions = 0,
		comments = 0,
		reposts = 0;

	try {
		const fullText = await postContainer.innerText({ timeout: 2000 });

		// Parse from text patterns
		const engagementPattern =
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(reactions?|likes?|comments?|reposts?|shares?)/gi;
		const matches = [...fullText.matchAll(engagementPattern)];

		for (const [, countStr, metricType] of matches) {
			const count = normalizeCount(countStr);
			const metricLower = metricType.toLowerCase();

			if (metricLower.includes('reaction') || metricLower.includes('like')) {
				reactions = Math.max(reactions, count);
			} else if (metricLower.includes('comment')) {
				comments = Math.max(comments, count);
			} else if (metricLower.includes('repost') || metricLower.includes('share')) {
				reposts = Math.max(reposts, count);
			}
		}
	} catch (e) {
		// Ignore errors
	}

	return { reactions, comments, reposts };
}

async function ensureLoggedIn(context, page, email, password, storageStatePath) {
	try {
		console.log('[info] Checking authentication status...');
		await page.goto('https://www.linkedin.com/feed/', {
			waitUntil: 'domcontentloaded',
			timeout: 60000
		});
		await page.waitForTimeout(3000);

		const authIndicators = [
			"[data-test-global-nav-link='me']",
			'.global-nav__me',
			"button[aria-label*='me']"
		];

		for (const indicator of authIndicators) {
			const count = await page.locator(indicator).first().count();
			if (count > 0) {
				console.log('[info] Already authenticated');
				await context.storageState({ path: storageStatePath });
				return;
			}
		}
	} catch (e) {
		console.log(`[debug] Auth check failed: ${e}`);
	}

	if (!email || !password) {
		throw new Error('Not authenticated and no credentials provided.');
	}

	console.log('[info] Logging in...');
	await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

	await page.fill('input#username', email);
	await page.fill('input#password', password);
	await page.click("button[type='submit']");

	for (let i = 0; i < 60; i++) {
		await page.waitForTimeout(1000);
		if (
			page.url().includes('feed') ||
			(await page.locator("[data-test-global-nav-link='me']").count()) > 0
		) {
			await context.storageState({ path: storageStatePath });
			console.log('[info] Login successful');
			return;
		}
	}

	throw new Error('Login failed or timed out');
}

async function buildContext(headed, storageStatePath) {
	const browser = await chromium.launch({
		headless: !headed,
		args: ['--disable-blink-features=AutomationControlled', '--disable-web-security']
	});

	const contextKwargs = {
		viewport: { width: 1920, height: 1080 },
		userAgent:
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
	};

	if (
		storageStatePath &&
		(await fs
			.access(storageStatePath)
			.then(() => true)
			.catch(() => false))
	) {
		contextKwargs.storageState = storageStatePath;
	}

	const context = await browser.newContext(contextKwargs);
	const page = await context.newPage();

	return { browser, context, page };
}

async function extractPostData(postContainer, postIndex) {
	try {
		await expandPostContent(postContainer);

		const rawText = await postContainer.innerText({ timeout: 3000 });
		if (rawText.trim().length < 10) return null;

		const authorInfo = await extractAuthorData(postContainer);
		const authorName = authorInfo.name || '';

		const contentData = cleanText(rawText, authorName);
		if (contentData.char_count < 15) return null;

		const { postUrl, postId } = await extractPostIdentifiers(postContainer, postIndex);
		const timestampRaw = await extractTimestamp(postContainer);
		const engagementData = await extractEngagementMetrics(postContainer);

		return {
			id: postId,
			url: postUrl,
			text: contentData.full_text,
			word_count: contentData.word_count,
			char_count: contentData.char_count,
			timestamp: parseRelativeTime(timestampRaw),
			timestamp_raw: timestampRaw,
			author: authorName,
			reactions: engagementData.reactions,
			comments: engagementData.comments,
			reposts: engagementData.reposts,
			total_engagement: engagementData.reactions + engagementData.comments + engagementData.reposts,
			extracted_at: new Date().toISOString()
		};
	} catch (e) {
		console.log(`[debug] Failed to extract post data: ${e}`);
		return null;
	}
}

function isSinglePostUrl(url) {
	return (
		url.includes('/feed/update/') ||
		url.includes('/activity/') ||
		url.includes('/posts/') ||
		url.includes('ugcPost')
	);
}

async function scrapeSinglePost(url, options = {}) {
	const {
		headed = false,
		email = '',
		password = '',
		storageStatePath = DEFAULT_STORAGE_STATE
	} = options;

	console.log(`[info] Scraping single post: ${url}`);

	const { browser, context, page } = await buildContext(headed, storageStatePath);

	try {
		if (email && password) {
			await ensureLoggedIn(context, page, email, password, storageStatePath);
		}

		console.log(`[info] Navigating to post...`);
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForTimeout(5000);

		// Try to find the post container
		let postContainer = null;
		for (const selector of SINGLE_POST_SELECTORS) {
			try {
				const container = page.locator(selector).first();
				const count = await container.count();
				if (count > 0) {
					postContainer = container;
					console.log(`[info] Found post using selector: ${selector}`);
					break;
				}
			} catch (e) {
				continue;
			}
		}

		if (!postContainer) {
			throw new Error('Could not find post container on page');
		}

		const postData = await extractPostData(postContainer, 0);
		if (!postData) {
			throw new Error('Failed to extract post data');
		}

		console.log(
			`[success] Extracted single post: ${postData.char_count} chars, ${postData.total_engagement} engagements`
		);
		return postData;
	} finally {
		await context.close();
		await browser.close();
	}
}

async function scrapeMultiplePosts(url, options = {}) {
	const {
		maxPosts = null,
		maxTimeMinutes = 10,
		headed = false,
		email = '',
		password = '',
		storageStatePath = DEFAULT_STORAGE_STATE
	} = options;

	if (maxPosts) {
		console.log(`[info] Scraping up to ${maxPosts} posts (max ${maxTimeMinutes} minutes)`);
	} else {
		console.log(`[info] Scraping posts (max ${maxTimeMinutes} minutes)`);
	}

	const { browser, context, page } = await buildContext(headed, storageStatePath);

	try {
		if (email && password) {
			await ensureLoggedIn(context, page, email, password, storageStatePath);
		}

		console.log(`[info] Navigating to ${url}`);
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForTimeout(5000);

		// Simple scroll strategy
		const startTime = Date.now();
		const maxTimeMs = maxTimeMinutes * 60 * 1000;

		while (Date.now() - startTime < maxTimeMs) {
			await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
			await page.waitForTimeout(3000);

			// Check if we have enough posts
			if (maxPosts) {
				let totalPosts = 0;
				for (const selector of POST_SELECTORS) {
					try {
						const count = await page.locator(selector).count();
						totalPosts = Math.max(totalPosts, count);
					} catch (e) {
						continue;
					}
				}
				if (totalPosts >= maxPosts * 2) break; // Buffer for duplicates
			}
		}

		// Extract posts
		console.log('[info] Extracting posts...');

		const allPostContainers = [];
		for (const selector of POST_SELECTORS) {
			try {
				const containers = await page.locator(selector).all();
				allPostContainers.push(...containers);
			} catch (e) {
				continue;
			}
		}

		console.log(`[info] Processing ${allPostContainers.length} post containers...`);

		const results = [];
		const seenHashes = new Set();

		for (let idx = 0; idx < allPostContainers.length; idx++) {
			if (maxPosts && results.length >= maxPosts) {
				console.log(`[info] Reached target of ${maxPosts} posts`);
				break;
			}

			const postContainer = allPostContainers[idx];

			try {
				const postData = await extractPostData(postContainer, idx);
				if (!postData) continue;

				// Simple duplicate detection
				const textHash = extractPostIdFromText(postData.text);
				if (seenHashes.has(textHash)) {
					console.log(`[debug] Skipping duplicate post ${idx}`);
					continue;
				}
				seenHashes.add(textHash);

				results.push(postData);
				console.log(`[success] Extracted post ${results.length}: ${postData.char_count} chars`);
			} catch (e) {
				console.log(`[debug] Failed to process post ${idx}: ${e}`);
				continue;
			}
		}

		console.log(`[info] Extraction completed. Total posts: ${results.length}`);
		return results;
	} finally {
		await context.close();
		await browser.close();
	}
}

async function linkedinScraper(url, options = {}) {
	if (isSinglePostUrl(url)) {
		return await scrapeSinglePost(url, options);
	} else {
		return await scrapeMultiplePosts(url, options);
	}
}

module.exports = {
	linkedinScraper,
	scrapeSinglePost,
	scrapeMultiplePosts
};

// CLI support
if (require.main === module) {
	const args = process.argv.slice(2);
	const options = {};
	let url = '';

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === '--url' && i + 1 < args.length) {
			url = args[i + 1];
			i++;
		} else if (arg === '--max-posts' && i + 1 < args.length) {
			options.maxPosts = parseInt(args[i + 1]);
			i++;
		} else if (arg === '--max-time' && i + 1 < args.length) {
			options.maxTimeMinutes = parseInt(args[i + 1]);
			i++;
		} else if (arg === '--headed') {
			options.headed = true;
		} else if (arg === '--email' && i + 1 < args.length) {
			options.email = args[i + 1];
			i++;
		} else if (arg === '--password' && i + 1 < args.length) {
			options.password = args[i + 1];
			i++;
		}
	}

	if (!url) {
		console.error('Error: --url parameter is required');
		console.log('Usage: node linkedin_scraper_minimal.js --url <linkedin-url> [options]');
		console.log('Options:');
		console.log('  --max-posts <number>    Maximum posts to scrape');
		console.log('  --max-time <minutes>    Maximum time to spend scraping');
		console.log('  --headed                Run with visible browser');
		console.log('  --email <email>         LinkedIn email');
		console.log('  --password <password>   LinkedIn password');
		process.exit(1);
	}

	// Set defaults
	options.email = options.email || DEFAULT_EMAIL;
	options.password = options.password || DEFAULT_PASSWORD;
	options.maxTimeMinutes = options.maxTimeMinutes || 10;

	(async () => {
		try {
			const result = await linkedinScraper(url, options);
			console.log(JSON.stringify(result, null, 2));
		} catch (error) {
			console.error('Error:', error.message);
			process.exit(1);
		}
	})();
}
