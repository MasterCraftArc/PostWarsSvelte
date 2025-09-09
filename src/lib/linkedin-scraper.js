import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import crypto from 'crypto';

const DEFAULT_STORAGE_STATE = 'linkedin_auth_state.json';

const POST_SELECTORS = [
	"div[data-urn*='urn:li:activity']",
	"div[data-urn*='urn:li:ugcPost']",
	"div[data-urn*='urn:li:share']",
	'article[data-urn]',
	'.feed-shared-update-v2',
	'.occludable-update',
	"[data-id*='urn:li']"
];

const SINGLE_POST_SELECTORS = [
	'.feed-shared-update-v2',
	"div[data-urn*='urn:li:activity']",
	"div[data-urn*='urn:li:ugcPost']",
	'article',
	'.single-post-container',
	'.post-detail-container'
];

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

function normalizeCount(s, context = '') {
	const cleanStr = s.toString().trim().replace(/,/g, '').replace(/\s/g, '');
	if (!cleanStr) return 0;

	// CRITICAL: Filter out time patterns that are mistaken for engagement
	if (cleanStr.match(/^\d+[wdhms]$/i)) {
		console.log(`🚫 Filtered time pattern: "${cleanStr}" in context: "${context}"`);
		return 0;
	}

	const match = cleanStr.match(/(\d+(?:\.\d+)?)\s*([KkMm])?/);
	if (!match) return 0;

	const [, num, suffix] = match;
	let value = parseFloat(num);

	if (suffix && suffix.toLowerCase() === 'k') {
		value *= 1000;
	} else if (suffix && suffix.toLowerCase() === 'm') {
		value *= 1000000;
	}

	const result = Math.floor(value);

	// Additional validation: engagement numbers should be reasonable (allow higher for views/impressions)
	const isViewsOrImpressions = context.includes('view') || context.includes('impression');
	const maxLimit = isViewsOrImpressions ? 10000000 : 1000000;
	
	if (result > maxLimit) {
		console.log(`🚫 Filtered unrealistic engagement: ${result} in context: "${context}"`);
		return 0;
	}

	return result;
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
	let postId = null;

	const urlSelectors = [
		"a[href*='linkedin.com/feed/update/']",
		"a[href*='linkedin.com/activity/']",
		"a[href*='linkedin.com/posts/']"
	];

	// Try to extract from URL links
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
					if (idMatch) {
						postId = idMatch[1];
						console.log(`✅ Extracted LinkedIn ID from URL: ${postId}`);
						break;
					}
				}
			}
		} catch (e) {
			continue;
		}
	}

	// Try to extract from data-urn attribute
	if (!postId) {
		try {
			const urn = await postContainer.getAttribute('data-urn');
			if (urn) {
				const urnMatch = urn.match(/urn:li:(?:activity|ugcPost|share):(\d+)/);
				if (urnMatch) {
					postId = urnMatch[1];
					console.log(`✅ Extracted LinkedIn ID from URN: ${postId}`);
				}
			}
		} catch (e) {
			// Ignore
		}
	}

	// If we still don't have a valid postId, create a unique one
	if (!postId) {
		try {
			// Use a hash of the post content + timestamp to create a unique ID
			const postText = await postContainer.innerText({ timeout: 2000 });
			const contentSnippet = postText.substring(0, 100).replace(/[^a-zA-Z0-9]/g, '');
			const contentHash = crypto.createHash('md5').update(contentSnippet + Date.now()).digest('hex').substring(0, 8);
			postId = `extracted_${contentHash}`;
			console.log(`⚠️  Generated unique LinkedIn ID from content: ${postId}`);
		} catch (e) {
			// Final fallback with timestamp
			postId = `post_${postIndex}_${Date.now()}`;
			console.log(`⚠️  Using timestamp-based LinkedIn ID: ${postId}`);
		}
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
		// Try multiple approaches to extract engagement metrics

		// Method 1: Target specific LinkedIn social count classes (most reliable)
		const reactionSelectors = [
			// Primary: LinkedIn's specific social counts classes
			'.social-details-social-counts__reactions-count',
			'span.social-details-social-counts__reactions-count',
			// Alternative formats
			'.social-counts-reactions__count',
			'.reactions-count',
			'.social-counts__reactions',
			// Fallback selectors
			'span[aria-hidden="true"]:has-text("reactions")',
			'span[aria-hidden="true"]:has-text("likes")',
			'button[aria-label*="reaction"]:has([aria-hidden="true"])',
			'button[aria-label*="like"]:has([aria-hidden="true"])'
		];

		const commentSelectors = [
			// Primary: LinkedIn's specific social counts classes
			'.social-details-social-counts__comments-count',
			'span.social-details-social-counts__comments-count',
			// Alternative formats
			'.social-counts-comments__count',
			'.comments-count',
			'.social-counts__comments',
			// Fallback selectors
			'span[aria-hidden="true"]:has-text("comments")',
			'span[aria-hidden="true"]:has-text("comment")',
			'button[aria-label*="comment"]:has([aria-hidden="true"])'
		];

		const repostSelectors = [
			// WORKING PATTERNS: From successful Python scraper
			'.social-details-social-counts__reposts',
			'[aria-label*="repost"]',
			'[aria-label*="share"]', 
			'.feed-shared-social-count-reposts',
			// PRIORITY: Exact DOM pattern from LinkedIn (2024 structure)
			'.social-details-social-counts__btn[aria-label*="reposts"] span[aria-hidden="true"]',
			'.social-details-social-counts__btn[aria-label*="shares"] span[aria-hidden="true"]',
			'.social-details-social-counts__count-value-hover[aria-label*="reposts"] span[aria-hidden="true"]',
			'.social-details-social-counts__count-value-hover[aria-label*="shares"] span[aria-hidden="true"]',
			'button[aria-label*="reposts"] span[aria-hidden="true"]',
			'button[aria-label*="shares"] span[aria-hidden="true"]',
			// Alternative: Direct match for the exact pattern you found
			'span[aria-hidden="true"]:has-text("reposts")',
			'span[aria-hidden="true"]:has-text("shares")',
			'span[aria-hidden="true"]:text-matches("\\d+\\s+reposts?")',
			'span[aria-hidden="true"]:text-matches("\\d+\\s+shares?")',
			// Primary: LinkedIn's specific social counts classes
			'.social-details-social-counts__shares-count',
			'.social-details-social-counts__reposts-count',
			'span.social-details-social-counts__shares-count',
			'span.social-details-social-counts__reposts-count',
			// Updated LinkedIn selectors (2024)
			'.feed-shared-social-action-bar__action-button .social-details-social-counts__count-value',
			'.feed-shared-social-action-bar [aria-label*="repost"] .social-details-social-counts__count-value',
			'.feed-shared-social-action-bar [aria-label*="share"] .social-details-social-counts__count-value',
			'.feed-shared-social-action-bar button[aria-label*="repost"] span[aria-hidden="true"]',
			'.feed-shared-social-action-bar button[aria-label*="share"] span[aria-hidden="true"]',
			// Alternative formats
			'.social-counts-shares__count',
			'.reposts-count', 
			'.shares-count',
			'.social-counts__shares',
			'.social-counts__reposts',
			// Button-based selectors
			'button[data-control-name="share"] span[aria-hidden="true"]',
			'button[data-control-name="repost"] span[aria-hidden="true"]',
			'button[aria-label*="repost"] span:not([aria-label])',
			'button[aria-label*="share"] span:not([aria-label])',
			// Fallback selectors
			'button[aria-label*="repost"]:has([aria-hidden="true"])',
			'button[aria-label*="share"]:has([aria-hidden="true"])',
			// Generic social action selectors
			'.social-actions-button[aria-label*="repost"] span',
			'.social-actions-button[aria-label*="share"] span'
		];

		// Try to extract from engagement bar
		for (const selector of reactionSelectors) {
			try {
				const element = await postContainer.locator(selector).first();
				if (await element.isVisible({ timeout: 1000 })) {
					const text = await element.textContent();
					const match = text?.match(/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/);
					if (match) {
						const count = normalizeCount(match[1], `reactions selector: ${text?.trim()}`);
						if (count > reactions) {
							reactions = count;
							console.log(`✅ Found reactions via selector "${selector}": ${reactions} (text: "${text?.trim()}")`);
						}
					}
				}
			} catch (e) {
				// Continue to next selector
			}
		}

		for (const selector of commentSelectors) {
			try {
				const element = await postContainer.locator(selector).first();
				if (await element.isVisible({ timeout: 1000 })) {
					const text = await element.textContent();
					const match = text?.match(/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/);
					if (match) {
						const count = normalizeCount(match[1], `comments selector: ${text?.trim()}`);
						if (count > comments) {
							comments = count;
							console.log(`✅ Found comments via selector "${selector}": ${comments} (text: "${text?.trim()}")`);
						}
					}
				}
			} catch (e) {
				// Continue to next selector
			}
		}

		// Debug: Let's see what spans with aria-hidden="true" actually exist
		try {
			const allAriaHiddenSpans = await postContainer.locator('span[aria-hidden="true"]').all();
			console.log(`🔍 Found ${allAriaHiddenSpans.length} spans with aria-hidden="true"`);
			for (let i = 0; i < Math.min(allAriaHiddenSpans.length, 10); i++) {
				const spanText = await allAriaHiddenSpans[i].textContent();
				console.log(`  Span ${i}: "${spanText}"`);
			}
		} catch (e) {
			console.log('Could not debug aria-hidden spans');
		}

		for (const selector of repostSelectors) {
			try {
				const element = await postContainer.locator(selector).first();
				const elementCount = await element.count();
				console.log(`🔍 Trying selector "${selector}": found ${elementCount} elements`);
				
				if (elementCount > 0 && await element.isVisible({ timeout: 1000 })) {
					const text = await element.textContent();
					console.log(`  Element text: "${text?.trim()}"`);
					const match = text?.match(/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/);
					if (match) {
						const count = normalizeCount(match[1], `reposts selector: ${text?.trim()}`);
						if (count > reposts) {
							reposts = count;
							console.log(`✅ Found reposts via selector "${selector}": ${reposts} (text: "${text?.trim()}")`);
						}
					}
				}
			} catch (e) {
				console.log(`  Error with selector "${selector}": ${e.message}`);
			}
		}

		// Additional repost extraction: Look for specific repost/share button patterns
		try {
			// Method 1: Look in social action bars
			const socialActionButtons = await postContainer.locator('.feed-shared-social-action-bar button').all();
			for (const button of socialActionButtons) {
				const ariaLabel = await button.getAttribute('aria-label');
				if (ariaLabel && (ariaLabel.toLowerCase().includes('repost') || ariaLabel.toLowerCase().includes('share'))) {
					const buttonText = await button.textContent();
					const countMatch = buttonText?.match(/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/);
					if (countMatch) {
						const count = normalizeCount(countMatch[1]);
						if (count > reposts) {
							reposts = count;
							console.log(`✅ Found reposts from social action button "${ariaLabel}": ${reposts}`);
						}
					}
				}
			}

			// Method 2: Look for the specific LinkedIn social details buttons
			const socialDetailsButtons = await postContainer.locator('button[aria-label*="reposts"], button[aria-label*="shares"]').all();
			for (const button of socialDetailsButtons) {
				const ariaLabel = await button.getAttribute('aria-label');
				const buttonText = await button.textContent();
				console.log(`🔍 Found social details button with aria-label: "${ariaLabel}", text: "${buttonText?.trim()}"`);
				
				if (buttonText) {
					const countMatch = buttonText.match(/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/);
					if (countMatch) {
						const count = normalizeCount(countMatch[1]);
						if (count > reposts) {
							reposts = count;
							console.log(`✅ Found reposts from social details button "${ariaLabel}": ${reposts}`);
						}
					}
				}
			}
		} catch (e) {
			console.log('Error in additional repost extraction:', e.message);
		}

		// Method 2: Enhanced text parsing (always run to catch missed numbers)
		const fullText = await postContainer.innerText({ timeout: 2000 });
		console.log('Analyzing post text:', fullText.substring(0, 800));

		// More comprehensive patterns to catch various formats
		const patterns = [
			// Standard "X reactions" format
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(reactions?|likes?)/gi,
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(comments?)/gi,
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(reposts?|shares?)/gi,
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(impressions?|views?)/gi,
			// Enhanced repost patterns
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(?:people?\s+)?(?:reposted|shared)\s+this/gi,
			/repost(?:ed)?\s+by\s+(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/gi,
			/shared?\s+by\s+(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/gi,
			// Numbers followed by "others reacted" or similar
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(?:others?\s+)?(?:reacted|liked)/gi,
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+(?:others?\s+)?(?:reposted|shared)/gi,
			// Numbers at start of lines (common in engagement stats)
			/^(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s*$/gm,
			// Numbers in parentheses or following specific patterns
			/\((\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\)/gi,
			// LinkedIn specific patterns
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+reposts?\s*$/gmi,
			/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+shares?\s*$/gmi
		];

		// Extract all numbers from the text
		const allNumbers = [];
		for (const pattern of patterns) {
			const matches = [...fullText.matchAll(pattern)];
			for (const match of matches) {
				const countStr = match[1];
				const context = match[0].toLowerCase();
				const count = normalizeCount(countStr, context);
				
				// Skip if count is 0 (filtered out)
				if (count > 0) {
					allNumbers.push({ count, context, original: match[0] });
					console.log(`Found number: ${count} in context: "${match[0]}"`);
				}
			}
		}

		// Sort numbers by value to help identify the largest engagement metrics
		allNumbers.sort((a, b) => b.count - a.count);

		// Separate numbers by type: contextual vs standalone
		const contextualNumbers = allNumbers.filter(n => 
			n.context.includes('reaction') || n.context.includes('like') || 
			n.context.includes('comment') || n.context.includes('repost') || 
			n.context.includes('share') || n.context.includes('impression') || 
			n.context.includes('view')
		);
		
		// ENHANCED: Filter out time-based numbers and metadata (prevents timestamp confusion)
		const standaloneNumbers = allNumbers.filter(n => 
			!n.context.includes('reaction') && !n.context.includes('like') && 
			!n.context.includes('comment') && !n.context.includes('repost') && 
			!n.context.includes('share') && !n.context.includes('impression') && 
			!n.context.includes('view') && !n.context.includes('reposted') && 
			!n.context.includes('shared') &&
			// CRITICAL: Enhanced time pattern filtering 
			!n.original.match(/\d+[wdhms]\s*$/i) && // Filter "51m", "2h", "3d", "30s"
			!n.original.match(/\d+\s*(second|minute|hour|day|week|month|year)s?\s*(ago)?/i) &&
			!n.context.includes('ago') && 
			!n.context.includes('week') && !n.context.includes('day') && 
			!n.context.includes('hour') && !n.context.includes('minute') &&
			!n.context.includes('month') && !n.context.includes('year') &&
			!n.context.includes('edited') && !n.context.includes('premium') &&
			n.count > 1 && n.count < 100000 // Reasonable engagement bounds
		);

		console.log(`Found ${contextualNumbers.length} contextual numbers and ${standaloneNumbers.length} standalone numbers`);

		// First, assign based on explicit context
		for (const { count, context, original } of contextualNumbers) {
			if (context.includes('reaction') || context.includes('like')) {
				reactions = Math.max(reactions, count);
				console.log(`Assigned ${count} to reactions from context: "${original}"`);
			} else if (context.includes('comment')) {
				comments = Math.max(comments, count);
				console.log(`Assigned ${count} to comments from context: "${original}"`);
			} else if (context.includes('repost') || context.includes('share') || 
					   context.includes('reposted') || context.includes('shared')) {
				reposts = Math.max(reposts, count);
				console.log(`Assigned ${count} to reposts from context: "${original}"`);
			} else if (context.includes('impression') || context.includes('view')) {
				impressions = Math.max(impressions, count);
				console.log(`Assigned ${count} to impressions from context: "${original}"`);
			}
		}

		// Then, if we have standalone numbers that are larger than our contextual finds,
		// assign the largest ones to reactions (most common engagement metric)
		if (standaloneNumbers.length > 0) {
			// Sort standalone numbers by size (largest first)
			standaloneNumbers.sort((a, b) => b.count - a.count);
			
			for (const { count, original } of standaloneNumbers) {
				// If this number is significantly larger than our current reaction count,
				// it's likely the actual reaction count
				if (count > reactions && count > 2) {
					console.log(`🎯 Upgrading reactions from ${reactions} to ${count} (standalone number: "${original}")`);
					reactions = count;
					break; // Only take the largest standalone number for reactions
				}
			}
		}

		// Final repost detection attempt using more aggressive approaches
		if (reposts === 0) {
			try {
				console.log('🔍 No reposts found via selectors, trying direct text search...');
				
				// Method 1: Find all elements containing "repost" or "share" text
				const repostElements = await postContainer.locator('*:has-text("repost"), *:has-text("reposts"), *:has-text("share"), *:has-text("shares")').all();
				console.log(`Found ${repostElements.length} elements containing repost/share text`);
				
				for (const element of repostElements) {
					try {
						const elementText = await element.textContent();
						console.log(`  Checking element: "${elementText?.trim()}"`);
						
						// Look for number + repost/share patterns - be more aggressive
						const patterns = [
							/(\d+(?:,\d{3})*)\s*repost/gi,
							/(\d+(?:,\d{3})*)\s*share/gi,
							/repost\s*(\d+(?:,\d{3})*)/gi,
							/share\s*(\d+(?:,\d{3})*)/gi,
							// Additional patterns for LinkedIn variations
							/(\d+(?:,\d{3})*)\s*people.*repost/gi,
							/(\d+(?:,\d{3})*)\s*people.*shar/gi,
							/(\d+(?:,\d{3})*)\s*others.*repost/gi,
							/(\d+(?:,\d{3})*)\s*others.*shar/gi
						];
						
						for (const pattern of patterns) {
							const match = elementText?.match(pattern);
							if (match) {
								const count = normalizeCount(match[1]);
								if (count > 0 && count < 1000000) {
									reposts = Math.max(reposts, count);
									console.log(`🎯 Found reposts in element text: ${count} from "${match[0]}"`);
									break;
								}
							}
						}
					} catch (e) {
						continue;
					}
				}
				
				// Method 1.5: Look specifically at the page header/top for repost indicators
				try {
					const pageHeader = await postContainer.page().locator('header, .feed-shared-header, .update-components-header').first();
					if (await pageHeader.count() > 0) {
						const headerText = await pageHeader.textContent();
						console.log(`🔍 Checking page header for repost info: "${headerText?.substring(0, 200)}"`);
						
						const headerPatterns = [
							/(\d+(?:,\d{3})*)\s*people.*repost/gi,
							/(\d+(?:,\d{3})*)\s*people.*shar/gi,
							/(\d+(?:,\d{3})*)\s*others.*repost/gi,
							/(\d+(?:,\d{3})*)\s*others.*shar/gi,
							/repost.*(\d+(?:,\d{3})*)/gi,
							/shar.*(\d+(?:,\d{3})*)/gi
						];
						
						for (const pattern of headerPatterns) {
							const match = headerText?.match(pattern);
							if (match) {
								const count = normalizeCount(match[1]);
								if (count > 0 && count < 1000000) {
									reposts = Math.max(reposts, count);
									console.log(`🎯 Found reposts in page header: ${count} from "${match[0]}"`);
									break;
								}
							}
						}
					}
				} catch (e) {
					console.log('Could not check page header for reposts');
				}
				
				// Method 2: Check the entire page (not just post container) for repost indicators
				if (reposts === 0) {
					try {
						const entirePageText = await postContainer.page().textContent();
						console.log('🔍 Searching entire page for repost indicators...');
						console.log(`Page text sample: "${entirePageText.substring(0, 500)}"`);
						
						// Look for patterns that indicate reposts at page level
						const pageRepostPatterns = [
							/(\d+(?:,\d{3})*)\s*people.*repost/gi,
							/(\d+(?:,\d{3})*)\s*people.*shar/gi,
							/(\d+(?:,\d{3})*)\s*others.*repost/gi, 
							/(\d+(?:,\d{3})*)\s*others.*shar/gi,
							/repost.*by.*(\d+(?:,\d{3})*)/gi,
							/shared.*by.*(\d+(?:,\d{3})*)/gi,
							/(\d+(?:,\d{3})*)\s*reposts?/gi,
							/(\d+(?:,\d{3})*)\s*shares?/gi
						];
						
						for (const pattern of pageRepostPatterns) {
							const matches = [...entirePageText.matchAll(pattern)];
							for (const match of matches) {
								const count = normalizeCount(match[1]);
								if (count > 0 && count < 1000000) {
									reposts = Math.max(reposts, count);
									console.log(`🎯 Found reposts from entire page: ${count} from pattern: "${match[0]}"`);
								}
							}
						}
					} catch (e) {
						console.log('Could not search entire page text');
					}
				}
				
				// Method 3: Full text search as backup
				if (reposts === 0) {
					const allPostText = await postContainer.innerText({ timeout: 2000 });
					console.log('🔍 Trying full text search for repost patterns...');
					
					const repostIndicators = [
						/(\d+(?:,\d{3})*)\s*reposts?/gi,
						/(\d+(?:,\d{3})*)\s*shares?/gi,
						/reposts?\s*(\d+(?:,\d{3})*)/gi,
						/shares?\s*(\d+(?:,\d{3})*)/gi,
						/(\d+(?:,\d{3})*)\s*(?:people\s+)?(?:reposted|shared)/gi
					];
					
					for (const pattern of repostIndicators) {
						const matches = [...allPostText.matchAll(pattern)];
						for (const match of matches) {
							const count = normalizeCount(match[1]);
							if (count > 0 && count < 1000000) { // Reasonable upper limit
								reposts = Math.max(reposts, count);
								console.log(`🎯 Final repost detection found: ${count} from pattern: "${match[0]}"`);
							}
						}
					}
				}
			} catch (e) {
				console.log('Error in final repost detection:', e.message);
			}
		}

		console.log(`Extracted metrics - Reactions: ${reactions}, Comments: ${comments}, Reposts: ${reposts}`);
	} catch (e) {
		console.error('Error extracting engagement metrics:', e.message);
	}

	// Try to extract impressions (only visible to post author)
	let impressions = 0;
	try {
		const impressionSelectors = [
			// Direct impression text
			'span:has-text("impressions")',
			'span:has-text("views")',
			'span:has-text("impression")',
			// Analytics data attributes
			'[data-test-id*="impression"]',
			'[data-test-id*="view"]',
			'[aria-label*="impression"]',
			'[aria-label*="view"]',
			// Social stats areas
			'.impression-count',
			'.views-count',
			'.post-stats-impression',
			// Numbers near impression text
			'span:text-matches("\\d+(?:,\\d{3})*"):near(span:has-text("impressions"))',
			'span:text-matches("\\d+(?:,\\d{3})*"):near(span:has-text("views"))'
		];

		for (const selector of impressionSelectors) {
			try {
				const element = await postContainer.locator(selector).first();
				if (await element.isVisible({ timeout: 1000 })) {
					const text = await element.textContent();
					const match = text?.match(/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/);
					if (match) {
						const count = normalizeCount(match[1]);
						if (count > impressions) {
							impressions = count;
							console.log(`Found impressions via selector "${selector}": ${impressions}`);
						}
					}
				}
			} catch (e) {
				// Continue to next selector
			}
		}
	} catch (e) {
		console.log('Could not extract impressions (may not be visible)');
	}

	return { reactions, comments, reposts, impressions };
}

async function buildContext(headed = false, storageStatePath = DEFAULT_STORAGE_STATE) {
	const browser = await chromium.launch({
		headless: !headed,
		args: ['--disable-blink-features=AutomationControlled', '--disable-web-security']
	});

	const contextKwargs = {
		viewport: { width: 1920, height: 1080 },
		userAgent:
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
	};

	try {
		await fs.access(storageStatePath);
		contextKwargs.storageState = storageStatePath;
	} catch (e) {
		// File doesn't exist, continue without storage state
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
			content: contentData.full_text,
			linkedinId: postId,
			authorName: authorName,
			postedAt: parseRelativeTime(timestampRaw),
			word_count: contentData.word_count,
			char_count: contentData.char_count,
			timestamp: parseRelativeTime(timestampRaw),
			timestamp_raw: timestampRaw,
			author: authorName,
			reactions: engagementData.reactions,
			comments: engagementData.comments,
			reposts: engagementData.reposts,
			impressions: engagementData.impressions || 0,
			total_engagement: engagementData.reactions + engagementData.comments + engagementData.reposts,
			extracted_at: new Date().toISOString()
		};
	} catch (e) {
		console.log(`Failed to extract post data: ${e}`);
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

export async function scrapeSinglePost(url, options = {}) {
	const { headed = false, storageStatePath = DEFAULT_STORAGE_STATE } = options;

	console.log(`Scraping single post: ${url}`);

	const { browser, context, page } = await buildContext(headed, storageStatePath);

	try {
		console.log(`Navigating to post...`);
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForTimeout(5000);

		let postContainer = null;
		for (const selector of SINGLE_POST_SELECTORS) {
			try {
				const container = page.locator(selector).first();
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

		const postData = await extractPostData(postContainer, 0);
		if (!postData) {
			throw new Error('Failed to extract post data');
		}

		console.log(
			`Extracted single post: ${postData.char_count} chars, ${postData.total_engagement} engagements`
		);
		return postData;
	} finally {
		await context.close();
		await browser.close();
	}
}

export async function linkedinScraper(url, options = {}) {
	if (isSinglePostUrl(url)) {
		return await scrapeSinglePost(url, options);
	} else {
		throw new Error('Only single post scraping is supported in this version');
	}
}

// Export constants and functions needed by other modules
export { SINGLE_POST_SELECTORS, extractPostData, isSinglePostUrl };
