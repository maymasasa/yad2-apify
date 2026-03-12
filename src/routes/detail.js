import { extractNextData } from '../utils/extract-next-data.js';
import { normalizeListing } from '../utils/normalize-listing.js';
import { Actor } from 'apify';

/**
 * Creates a DETAIL route handler for individual listing pages.
 *
 * @param {object} stats - Mutable stats counters
 * @param {object} options - { debugLog }
 * @returns {Function} Crawlee request handler
 */
export function createDetailHandler(stats, options) {
    const { debugLog } = options;

    return async ({ request, $, log }) => {
        const { token, listingData } = request.userData;
        const url = request.url;

        try {
            // Extract __NEXT_DATA__ from the detail page
            const nextData = extractNextData($);
            if (!nextData) {
                throw new Error(`No __NEXT_DATA__ found on detail page ${url}`);
            }

            // Find the item query from dehydratedState.queries
            const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
            if (!Array.isArray(queries)) {
                throw new Error(`No dehydratedState queries found on detail page ${url}`);
            }

            const itemQuery = queries.find(
                (q) => Array.isArray(q.queryKey)
                    && q.queryKey.some((k) => typeof k === 'string' && k.includes('item'))
                    && q.queryKey.includes(token),
            );

            if (!itemQuery?.state?.data) {
                throw new Error(`No item query data found for token ${token} on ${url}`);
            }

            const detailData = itemQuery.state.data;

            // Merge full detail data over search listing data.
            // Detail page has richer data for most fields (km, color, gearBox,
            // address with city, description in metaData, testDate, owner, etc.)
            const merged = {
                ...listingData,
                ...detailData,
                // Preserve metaData from detail (has description + full images)
                metaData: { ...listingData.metaData, ...detailData.metaData },
                // Preserve address from detail (has city, not just area)
                address: { ...listingData.address, ...detailData.address },
            };

            // Normalize and push to Dataset
            const record = normalizeListing(merged, { debugLog });
            await Actor.pushData(record);
            stats.pushed++;
        } catch (error) {
            // On failure: log warning and push record with search result data only
            log.warning(`Failed to enrich detail for ${token}: ${error.message}`);
            const record = normalizeListing(listingData, { debugLog });
            await Actor.pushData(record);
            stats.pushed++;
        }

        // Increment detail pages counter
        stats.details++;
    };
}
