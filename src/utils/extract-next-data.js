/**
 * Extracts and parses the __NEXT_DATA__ JSON from a Cheerio-loaded document.
 *
 * @param {import('cheerio').CheerioAPI} $ - Cheerio-loaded document
 * @returns {object|null} Parsed __NEXT_DATA__ JSON, or null if not found/malformed
 */
export function extractNextData($) {
    try {
        const scriptEl = $('script#__NEXT_DATA__');
        if (!scriptEl.length) {
            return null;
        }
        const text = scriptEl.html();
        if (!text) {
            return null;
        }
        return JSON.parse(text);
    } catch {
        return null;
    }
}
