import { log } from 'crawlee';

const YAD2_CARS_URL_PREFIX = 'https://www.yad2.co.il/vehicles/cars';

/**
 * Validates and applies defaults to the raw actor input.
 *
 * @param {object} rawInput - Raw input from Actor.getInput()
 * @returns {object} Validated input with defaults applied
 * @throws {Error} If startUrls is missing or empty
 */
export function validateInput(rawInput) {
    const input = rawInput ?? {};

    // Check startUrls exists and is a non-empty array
    if (!Array.isArray(input.startUrls) || input.startUrls.length === 0) {
        throw new Error(
            'Input field "startUrls" is required and must be a non-empty array of Yad2 car search URLs.',
        );
    }

    // Normalize URLs: requestListSources sends { url: "..." } objects, plain strings also supported
    const normalizedUrls = input.startUrls.map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && typeof entry.url === 'string') return entry.url;
        return null;
    });

    // Filter URLs to only valid Yad2 cars URLs, warn for each skipped
    const startUrls = normalizedUrls.filter((url) => {
        if (typeof url === 'string' && url.startsWith(YAD2_CARS_URL_PREFIX)) {
            return true;
        }
        log.warning(`Skipping invalid URL (does not match ${YAD2_CARS_URL_PREFIX}*): ${url}`);
        return false;
    });

    if (startUrls.length === 0) {
        throw new Error(
            'None of the provided startUrls match the required pattern "https://www.yad2.co.il/vehicles/cars*". Please provide valid Yad2 car search URLs.',
        );
    }

    return {
        startUrls,
        maxPagesPerSearch: input.maxPagesPerSearch ?? 10,
        maxRequestsPerCrawl: input.maxRequestsPerCrawl ?? 1000,
        proxyConfiguration: input.proxyConfiguration ?? undefined,
        includeItemDetails: input.includeItemDetails ?? true,
        maxConcurrency: input.maxConcurrency ?? 5,
        debugLog: input.debugLog ?? false,
    };
}
