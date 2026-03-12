/**
 * Extracts pagination info from the parsed __NEXT_DATA__ object.
 *
 * Looks for a feed query in dehydratedState.queries, then falls back
 * to props.pageProps.search.results.feed.pagination.
 *
 * @param {object} nextData - Parsed __NEXT_DATA__ object
 * @returns {{ currentPage: number, totalPages: number } | null}
 */
export function getPaginationInfo(nextData) {
    if (!nextData) return null;

    // Primary path: dehydratedState feed query
    try {
        const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
        if (Array.isArray(queries)) {
            const feedQuery = queries.find(
                (q) => Array.isArray(q.queryKey) && q.queryKey.includes('feed'),
            );
            const pagination = feedQuery?.state?.data?.pagination;
            if (pagination) {
                // Yad2 uses { pages, perPage, total } format
                if (pagination.pages != null) {
                    return { totalPages: Number(pagination.pages) };
                }
                // Fallback: { currentPage, totalPages } format
                if (pagination.totalPages != null) {
                    return { totalPages: Number(pagination.totalPages) };
                }
            }
        }
    } catch {
        // fall through to fallback
    }

    // Fallback path: pageProps.search.results.feed.pagination
    try {
        const pagination = nextData?.props?.pageProps?.search?.results?.feed?.pagination;
        if (pagination) {
            if (pagination.pages != null) {
                return { totalPages: Number(pagination.pages) };
            }
            if (pagination.totalPages != null) {
                return { totalPages: Number(pagination.totalPages) };
            }
        }
    } catch {
        // pagination metadata not available
    }

    return null;
}

/**
 * Builds the next page URL by setting the page query parameter.
 * Preserves all existing query parameters from the current URL.
 *
 * @param {string} currentUrl - Current page URL
 * @param {number} nextPage - Next page number
 * @returns {string} URL with updated page query parameter
 */
export function buildNextPageUrl(currentUrl, nextPage) {
    const url = new URL(currentUrl);
    url.searchParams.set('page', String(nextPage));
    return url.toString();
}
