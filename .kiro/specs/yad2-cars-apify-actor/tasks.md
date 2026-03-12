# Implementation Plan: Yad2 Cars Apify Actor

## Overview

Complete rewrite of the existing Yad2 car scraper into an Apify Store-quality actor using Crawlee's CheerioCrawler. The implementation follows an incremental approach: project scaffolding → utility functions → route handlers → main entry point → config/packaging → cleanup. Each step builds on the previous and ends with wiring everything together.

## Tasks

- [x] 1. Set up project structure and dependencies
  - [x] 1.1 Update `package.json` with Apify SDK and Crawlee dependencies
    - Set `"type": "module"` for ES module support
    - Add `apify` and `crawlee` as dependencies
    - Set `"start": "node src/main.js"` script
    - Remove any legacy dependencies (node-telegram-bot-api, etc.)
    - _Requirements: 10.3, 11.3_
  - [x] 1.2 Create directory structure and placeholder modules
    - Create `src/main.js`, `src/input.js`, `src/routes/list.js`, `src/routes/detail.js`, `src/utils/extract-next-data.js`, `src/utils/normalize-listing.js`, `src/utils/pagination.js`
    - Each file exports a stub function with the correct signature from the design
    - _Requirements: 11.1_

- [x] 2. Implement input validation module
  - [x] 2.1 Implement `validateInput()` in `src/input.js`
    - Accept raw input object, apply defaults for `maxPagesPerSearch` (10), `maxRequestsPerCrawl` (1000), `includeItemDetails` (true), `maxConcurrency` (5), `debugLog` (false)
    - Throw descriptive error if `startUrls` is missing or empty
    - Filter out URLs not matching `https://www.yad2.co.il/vehicles/cars*`, log warning for each skipped URL
    - Return clean validated input object
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ]* 2.2 Write unit tests for `validateInput()`
    - Test default application, missing startUrls error, URL filtering
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Implement utility modules
  - [x] 3.1 Implement `extractNextData($)` in `src/utils/extract-next-data.js`
    - Select `script#__NEXT_DATA__` tag, parse JSON content
    - Return `null` on missing or malformed data (no throwing)
    - _Requirements: 2.2, 2.3_
  - [x] 3.2 Implement `normalizeListing(item, options)` in `src/utils/normalize-listing.js`
    - Map raw listing fields to all 30+ snake_case output fields per the design's output schema
    - Set missing fields to `null`
    - Derive `seller_type` from `merchant` / `customer.agencyName`
    - Derive `dealer_name` from `customer.agencyName`
    - Include `raw_data` only when `debugLog` is true
    - Set `source` to constant `"yad2"`, `insertion_time` to current ISO timestamp
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 3.3 Implement `getPaginationInfo(nextData)` and `buildNextPageUrl(currentUrl, nextPage)` in `src/utils/pagination.js`
    - Extract `currentPage` and `totalPages` from feed query pagination metadata
    - Build next page URL using `URL` + `URLSearchParams`, preserving existing query params
    - Return `null` from `getPaginationInfo` when pagination metadata is missing
    - _Requirements: 4.1, 4.3, 4.5_
  - [ ]* 3.4 Write unit tests for utility modules
    - Test `extractNextData` with valid HTML, missing script tag, malformed JSON
    - Test `normalizeListing` field mapping, null defaults, seller_type derivation, debugLog toggle
    - Test `getPaginationInfo` and `buildNextPageUrl` with various URL shapes
    - _Requirements: 2.2, 2.3, 4.1, 4.3, 6.1, 6.4, 6.5_

- [x] 4. Checkpoint - Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement route handlers
  - [x] 5.1 Implement `createListHandler()` in `src/routes/list.js`
    - Call `extractNextData($)` to get Next_Data JSON
    - Locate Feed_Query from `dehydratedState.queries` by finding queryKey including "feed"
    - Fallback to `props.pageProps.search.results.feed.data` if Feed_Query not found
    - Log warning and return if neither source has listings
    - Extract listings from `commercial` and `private` arrays
    - Filter out items with `type === "ad"`
    - For each listing: derive token (fallback to `id`), check dedup Set, skip if seen
    - If `includeItemDetails`: enqueue DETAIL request with `userData` carrying `{ label: 'DETAIL', token, listingData, debugLog }`
    - If not `includeItemDetails`: normalize and `Actor.pushData()` immediately
    - Call pagination logic: if currentPage < totalPages and < maxPagesPerSearch, enqueue next page with label `LIST`
    - Detect ShieldSquare captcha via `$('title').text()` check, throw to trigger retry
    - Increment `stats.pages` counter
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 7.3, 9.1_
  - [x] 5.2 Implement `createDetailHandler()` in `src/routes/detail.js`
    - Extract `__NEXT_DATA__` from detail page
    - Find item query from `dehydratedState.queries` by matching queryKey containing "item" and the token
    - Merge enriched fields (description, phone, test_until, vehicle_condition, previous_owners, geographic_location) with `request.userData.listingData`
    - Normalize merged data and push to Dataset via `Actor.pushData()`
    - On failure: log warning, push record with search result data only
    - Increment `stats.details` counter
    - _Requirements: 5.3, 5.4, 5.5, 9.1_
  - [ ]* 5.3 Write unit tests for route handlers
    - Test list handler feed extraction, ad filtering, deduplication, pagination enqueuing
    - Test detail handler enrichment merging and fallback behavior
    - _Requirements: 2.4, 3.1, 3.2, 3.4, 5.3, 5.4, 5.5_

- [x] 6. Implement main entry point and wire everything together
  - [x] 6.1 Implement `src/main.js`
    - Call `Actor.init()` at start, `Actor.exit()` at end
    - Read input via `Actor.getInput()`, validate with `validateInput()`
    - Initialize shared state: `seenTokens` Set and `stats` object
    - Create `createCheerioRouter()`, add LIST route via `createListHandler()` and DETAIL route via `createDetailHandler()`
    - Configure `CheerioCrawler` with router, `proxyConfiguration`, `maxRequestsPerCrawl`, `maxConcurrency`, and realistic default headers
    - Enqueue each validated `startUrl` with `userData: { label: 'LIST', maxPages: input.maxPagesPerSearch, currentPage: 1 }`
    - Run crawler, then log summary with `stats.pushed`, `stats.pages`, `stats.duplicates`
    - _Requirements: 1.1, 2.1, 7.1, 7.2, 8.1, 8.2, 8.3, 9.3_

- [x] 7. Checkpoint - Ensure actor runs locally
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create actor configuration and packaging files
  - [x] 8.1 Create `.actor/actor.json`
    - Set actor name to `"yad2-cars-scraper"`, version, and build configuration pointing to Dockerfile
    - _Requirements: 10.1_
  - [x] 8.2 Create `.actor/INPUT_SCHEMA.json`
    - Define all 7 input parameters with types, descriptions, defaults, and validation constraints
    - _Requirements: 1.4, 10.2_
  - [x] 8.3 Create `Dockerfile`
    - Standard Apify Node.js actor Dockerfile
    - _Requirements: 10.1_
  - [x] 8.4 Create sample input file at `.actor/input.json`
    - Include a working example with a Yad2 cars search URL
    - _Requirements: 10.4_

- [x] 9. Create README documentation
  - [x] 9.1 Create `.actor/README.md`
    - Include all required sections: title, description, features, input parameters table, example input JSON, output schema table, example output JSON, notes/limitations, proxy recommendation, local dev instructions, deployment instructions, legal disclaimer
    - Document every input parameter and output field
    - Include a working example input JSON
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 10. Remove legacy code and files
  - [x] 10.1 Delete legacy files
    - Remove `scraper.js`, `config.json`, `debug_yad2.html`, `data/` directory, and any other legacy files
    - Ensure zero references to Telegram, local file persistence, alerting, or workflow flags remain
    - _Requirements: 11.2_

- [x] 11. Final checkpoint - Ensure all tests pass and actor is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses JavaScript (ES modules) with Apify SDK + Crawlee
- Checkpoints ensure incremental validation
- All legacy code (Telegram, local persistence, monitoring) is removed in task 10
