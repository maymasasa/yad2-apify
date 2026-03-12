import { Actor } from 'apify';
import { CheerioCrawler, createCheerioRouter, log } from 'crawlee';
import { validateInput } from './input.js';
import { createListHandler } from './routes/list.js';
import { createDetailHandler } from './routes/detail.js';

await Actor.init();

try {
    const rawInput = await Actor.getInput();
    const input = validateInput(rawInput);

    if (input.debugLog) {
        log.setLevel(log.LEVELS.DEBUG);
    }

    // Shared state
    const seenTokens = new Set();
    const stats = { pushed: 0, duplicates: 0, pages: 0, details: 0, errors: 0 };

    // Options for route handlers
    const options = {
        includeItemDetails: input.includeItemDetails,
        maxPagesPerSearch: input.maxPagesPerSearch,
        debugLog: input.debugLog,
    };

    // Create router with labeled routes
    const router = createCheerioRouter();
    router.addHandler('LIST', createListHandler(seenTokens, stats, options));
    router.addHandler('DETAIL', createDetailHandler(stats, options));

    // Configure proxy if provided
    const proxyConfiguration = input.proxyConfiguration
        ? await Actor.createProxyConfiguration(input.proxyConfiguration)
        : undefined;

    // Create and configure crawler
    const crawler = new CheerioCrawler({
        requestHandler: router,
        proxyConfiguration,
        maxRequestsPerCrawl: input.maxRequestsPerCrawl,
        maxConcurrency: input.maxConcurrency,
        additionalMimeTypes: ['application/json'],
        preNavigationHooks: [
            (_crawlingContext, requestAsBrowserOptions) => {
                requestAsBrowserOptions.headers = {
                    ...requestAsBrowserOptions.headers,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                };
            },
        ],
    });

    // Enqueue start URLs
    const requests = input.startUrls.map((url) => ({
        url,
        userData: {
            label: 'LIST',
            maxPages: input.maxPagesPerSearch,
            currentPage: 1,
        },
    }));

    await crawler.run(requests);

    // Log summary
    log.info('=== Crawl Summary ===');
    log.info(`Records pushed: ${stats.pushed}`);
    log.info(`Pages crawled: ${stats.pages}`);
    log.info(`Detail pages: ${stats.details}`);
    log.info(`Duplicates skipped: ${stats.duplicates}`);
} catch (error) {
    log.error(`Actor failed: ${error.message}`);
    throw error;
} finally {
    await Actor.exit();
}
