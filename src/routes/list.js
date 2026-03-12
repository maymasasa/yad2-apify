import { extractNextData } from '../utils/extract-next-data.js';
import { normalizeListing } from '../utils/normalize-listing.js';
import { getPaginationInfo, buildNextPageUrl } from '../utils/pagination.js';
import { Actor } from 'apify';

/**
 * Extracts feed data from the Next_Data JSON.
 * Tries dehydratedState.queries first, then falls back to pageProps.search.results.feed.data.
 *
 * @param {object} nextData - Parsed __NEXT_DATA__ object
 * @returns {object|null} Feed data object with commercial/private arrays, or null
 */
function extractFeedData(nextData) {
    // Primary: dehydratedState feed query
    try {
        const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
        if (Array.isArray(queries)) {
            const feedQuery = queries.find(
                (q) => Array.isArray(q.queryKey) && q.queryKey.includes('feed'),
            );
            if (feedQuery?.state?.data) {
                return feedQuery.state.data;
            }
        }
    } catch {
        // fall through to fallback
    }

    // Fallback: pageProps.search.results.feed.data
    try {
        const fallback = nextData?.props?.pageProps?.search?.results?.feed?.data;
        if (fallback) {
            return fallback;
        }
    } catch {
        // no feed data available
    }

    return null;
}

/**
 * Creates a LIST route handler for search result pages.
 *
 * @param {Set<string>} seenTokens - Deduplication set
 * @param {object} stats - Mutable stats counters { pushed, duplicates, pages }
 * @param {object} options - { includeItemDetails, maxPagesPerSearch, debugLog }
 * @returns {Function} Crawlee request handler
 */
export function createListHandler(seenTokens, stats, options) {
    const { includeItemDetails, maxPagesPerSearch, debugLog } = options;

    return async ({ request, $, log, crawler }) => {
        const url = request.url;

        // Detect ShieldSquare captcha — throw to trigger Crawlee retry
        const pageTitle = $('title').text();
        if (pageTitle.includes('ShieldSquare') || pageTitle.includes('Captcha')) {
            log.warning(`ShieldSquare captcha detected on ${url}, retrying...`);
            throw new Error(`ShieldSquare captcha detected on ${url}`);
        }

        // Extract __NEXT_DATA__
        const nextData = extractNextData($);
        if (!nextData) {
            log.error(`No __NEXT_DATA__ found on ${url}, skipping page.`);
            return;
        }

        // Extract feed data
        const feedData = extractFeedData(nextData);
        if (!feedData) {
            log.warning(`No feed data found on ${url}, skipping page.`);
            return;
        }

        // Combine commercial and private listings
        const commercial = Array.isArray(feedData.commercial) ? feedData.commercial : [];
        const privateListing = Array.isArray(feedData.private) ? feedData.private : [];
        const allListings = [...commercial, ...privateListing];

        if (allListings.length === 0) {
            log.warning(`No listings found in feed data on ${url}.`);
            return;
        }

        // Filter out ads and process listings
        const listings = allListings.filter((item) => item.type !== 'ad');

        for (const item of listings) {
            // Derive token with fallback to id
            const token = String(item.token ?? item.id ?? '');
            if (!token) continue;

            // Deduplication check
            if (seenTokens.has(token)) {
                stats.duplicates++;
                continue;
            }
            seenTokens.add(token);

            if (includeItemDetails) {
                // Enqueue detail page for enrichment
                await crawler.addRequests([{
                    url: `https://www.yad2.co.il/vehicles/item/${token}`,
                    userData: {
                        label: 'DETAIL',
                        token,
                        listingData: item,
                        debugLog,
                    },
                }]);
            } else {
                // Normalize and push immediately
                const record = normalizeListing(item, { debugLog });
                await Actor.pushData(record);
                stats.pushed++;
            }
        }

        // Increment pages counter
        stats.pages++;

        // Pagination: enqueue next page if within limits
        const currentPage = request.userData.currentPage || 1;
        const maxPages = request.userData.maxPages || maxPagesPerSearch;
        const paginationInfo = getPaginationInfo(nextData);

        if (paginationInfo) {
            const { totalPages } = paginationInfo;
            if (currentPage < totalPages && currentPage < maxPages) {
                const nextPage = currentPage + 1;
                const nextUrl = buildNextPageUrl(url, nextPage);
                await crawler.addRequests([{
                    url: nextUrl,
                    userData: {
                        label: 'LIST',
                        maxPages,
                        currentPage: nextPage,
                    },
                }]);
            }
        } else {
            log.warning(`No pagination metadata found on ${url}, processing only current page.`);
        }
    };
}
