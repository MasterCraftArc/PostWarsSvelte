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
	console.log('🔍 Expanding post content...');
	
	// First, scroll the entire post into view to trigger lazy loading
	try {
		await postContainer.scrollIntoViewIfNeeded();
		await postContainer.page().waitForTimeout(2000);
		console.log('✅ Scrolled post into view');
	} catch (e) {
		console.log('Could not scroll post into view');
	}

	const seeMoreSelectors = [
		"button:text-matches('see more', 'i')",
		"button:text-matches('show more', 'i')",
		'.feed-shared-inline-show-more-text__button',
		'.feed-shared-text__see-more-link',
		'button[aria-expanded="false"]'
	];

	let expanded = false;
	for (const selector of seeMoreSelectors) {
		try {
			const button = postContainer.locator(selector).first();
			const count = await button.count();
			if (count > 0 && (await button.isVisible())) {
				console.log(`🔄 Clicking expand button: ${selector}`);
				await button.scrollIntoViewIfNeeded();
				await button.click();
				await postContainer.page().waitForTimeout(2000);
				expanded = true;
				break;
			}
		} catch (e) {
			continue;
		}
	}
	
	// Additional wait for content to fully load after expansion
	if (expanded) {
		console.log('✅ Post expanded, waiting for content to load...');
		await postContainer.page().waitForTimeout(3000);
	}
	
	// Scroll to bottom of post to ensure engagement section is loaded
	try {
		const engagementSection = postContainer.locator('.feed-shared-social-action-bar, .social-details-social-counts').first();
		if (await engagementSection.count() > 0) {
			await engagementSection.scrollIntoViewIfNeeded();
			await postContainer.page().waitForTimeout(1000);
			console.log('✅ Scrolled engagement section into view');
		}
	} catch (e) {
		console.log('Could not scroll to engagement section');
	}
	
	return expanded;
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
			// PRIORITY: Simple text-based selectors (most reliable for "10 reposts")
			'*:has-text("reposts")',
			'*:has-text(" reposts")', // With space prefix
			'span:has-text("reposts")',
			'button:has-text("reposts")',
			// LinkedIn specific DOM selectors
			'button.social-details-social-counts__count-value-hover span[aria-hidden="true"]',
			'.social-details-social-counts__btn span[aria-hidden="true"]'
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

		// COMPREHENSIVE DEBUG: Let's see ALL text in the post
		try {
			const fullPostText = await postContainer.innerText({ timeout: 3000 });
			console.log(`🔍 FULL POST TEXT DEBUG (first 1000 chars):`);
			console.log(`"${fullPostText.substring(0, 1000)}"`);
			console.log(`🔍 Searching for "repost" patterns in full text...`);
			
			// Look for any occurrence of numbers + repost
			const debugPatterns = [
				/\d+.*?repost/gi,
				/repost.*?\d+/gi,
				/\d+\s+repost/gi,
				/17/gi  // Specifically look for "17"
			];
			
			for (const pattern of debugPatterns) {
				const matches = [...fullPostText.matchAll(pattern)];
				if (matches.length > 0) {
					console.log(`🎯 Pattern "${pattern}" found ${matches.length} matches:`);
					matches.forEach((match, i) => console.log(`  Match ${i}: "${match[0]}"`));
				}
			}
		} catch (e) {
			console.log('Could not debug full post text');
		}

		// Debug: Let's see what spans with aria-hidden="true" actually exist
		try {
			const allAriaHiddenSpans = await postContainer.locator('span[aria-hidden="true"]').all();
			console.log(`🔍 Found ${allAriaHiddenSpans.length} spans with aria-hidden="true"`);
			for (let i = 0; i < Math.min(allAriaHiddenSpans.length, 15); i++) {
				const spanText = await allAriaHiddenSpans[i].textContent();
				console.log(`  Span ${i}: "${spanText}"`);
			}
		} catch (e) {
			console.log('Could not debug aria-hidden spans');
		}

		// Debug: Let's see ALL elements containing "17" 
		try {
			const seventeenElements = await postContainer.locator('*:has-text("17")').all();
			console.log(`🔍 Found ${seventeenElements.length} elements containing "17"`);
			for (let i = 0; i < Math.min(seventeenElements.length, 10); i++) {
				const elementText = await seventeenElements[i].textContent();
				const tagName = await seventeenElements[i].evaluate(el => el.tagName);
				console.log(`  Element ${i} (${tagName}): "${elementText?.trim()}"`);
			}
		} catch (e) {
			console.log('Could not debug elements containing "17"');
		}

		for (const selector of repostSelectors) {
			try {
				const elements = await postContainer.locator(selector).all();
				console.log(`🔍 Trying selector "${selector}": found ${elements.length} elements`);
				
				for (const element of elements) {
					if (await element.isVisible({ timeout: 1000 })) {
						const text = await element.textContent();
						console.log(`  Element text: "${text?.trim()}"`);
						
						// Enhanced pattern matching for "X reposts" format
						const repostPatterns = [
							/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)\s+reposts?/gi,  // "10 reposts"
							/reposts?\s*:?\s*(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/gi, // "reposts: 10" or "reposts 10"
							/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/  // Any number in repost-containing element
						];
						
						for (const pattern of repostPatterns) {
							const match = text?.match(pattern);
							if (match) {
								const count = normalizeCount(match[1], `reposts selector: ${text?.trim()}`);
								if (count > reposts && count <= 100000) { // Reasonable upper limit
									reposts = count;
									console.log(`✅ Found reposts via selector "${selector}": ${reposts} (text: "${text?.trim()}")`);
									break;
								}
							}
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

		// ENHANCED: Focused repost detection with priority order
		if (reposts === 0) {
			try {
				console.log('🔍 Enhanced repost detection starting...');
				
				// PRIORITY 1: LinkedIn's standard social engagement bar
				const socialEngagementSelectors = [
					// Most reliable: LinkedIn's social counts
					'.social-details-social-counts__item-count:has-text("reposts")',
					'.social-details-social-counts__item-count:has-text("Reposts")', 
					'button[aria-label*="reposts"] span[aria-hidden="true"]',
					'button[aria-label*="Reposts"] span[aria-hidden="true"]',
					// Alternative engagement patterns
					'.feed-shared-social-counts .repost-count',
					'.feed-shared-social-counts [data-test-id*="repost"]'
				];

				for (const selector of socialEngagementSelectors) {
					const element = await postContainer.locator(selector).first();
					if (await element.count() > 0) {
						const text = await element.textContent();
						const numberMatch = text?.match(/(\d+(?:,\d{3})*|\d+(?:\.\d+)?[KkMm]?)/);
						if (numberMatch) {
							const count = normalizeCount(numberMatch[1], `social engagement: ${text?.trim()}`);
							if (count > 0) {
								reposts = count;
								console.log(`✅ Found reposts via priority selector: ${reposts}`);
								break;
							}
						}
					}
				}

				// PRIORITY 2: Repost attribution (e.g., "John Doe reposted this")
				if (reposts === 0) {
					const repostAttributionText = await postContainer.innerText({ timeout: 1000 });
					const attributionPatterns = [
						/(\w+\s+\w+|\w+)\s+reposted\s+this/gi,  // "John Doe reposted this"
						/reposted\s+by\s+(\w+\s+\w+|\w+)/gi,    // "Reposted by John Doe"  
						/(\d+(?:,\d{3})*)\s+(?:people\s+)?reposted\s+this/gi, // "5 people reposted this"
						/(\d+(?:,\d{3})*)\s+others?\s+reposted/gi  // "5 others reposted"
					];

					for (const pattern of attributionPatterns) {
						const matches = [...repostAttributionText.matchAll(pattern)];
						for (const match of matches) {
							if (match[1] && /^\d/.test(match[1])) {
								// First group is a number
								const count = normalizeCount(match[1], `attribution: ${match[0]}`);
								if (count > 0) {
									reposts = count;
									console.log(`✅ Found reposts via attribution: ${reposts} from "${match[0]}"`);
									break;
								}
							} else if (match[1]) {
								// First group is a name, this indicates at least 1 repost
								reposts = Math.max(reposts, 1);
								console.log(`✅ Found repost attribution (at least 1): "${match[0]}"`);
							}
						}
						if (reposts > 0) break;
					}
				}

				// PRIORITY 3: Focused text patterns (only if previous methods failed)
				if (reposts === 0) {
					const postText = await postContainer.innerText({ timeout: 1000 });
					const focusedPatterns = [
						/(\d+(?:,\d{3})*)\s+reposts?\s*$/gmi,      // "5 reposts" at line end
						/^(\d+(?:,\d{3})*)\s+reposts?/gmi,        // "5 reposts" at line start
						/reposts?\s*:\s*(\d+(?:,\d{3})*)/gi,      // "Reposts: 5"
						/(\d+(?:,\d{3})*)\s+(?:people\s+)?(?:have\s+)?reposted/gi // "5 people reposted"
					];

					for (const pattern of focusedPatterns) {
						const matches = [...postText.matchAll(pattern)];
						for (const match of matches) {
							const count = normalizeCount(match[1], `focused pattern: ${match[0]}`);
							if (count > 0 && count <= 10000) { // Conservative upper limit
								reposts = Math.max(reposts, count);
								console.log(`✅ Found reposts via focused pattern: ${reposts} from "${match[0]}"`);
							}
						}
					}
				}
			} catch (e) {
				console.log('Error in enhanced repost detection:', e.message);
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
		await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
		console.log('✅ Page loaded, waiting for content to stabilize...');
		await page.waitForTimeout(8000);  // Longer wait for LinkedIn's lazy loading

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
