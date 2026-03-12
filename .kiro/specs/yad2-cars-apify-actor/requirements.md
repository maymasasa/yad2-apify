# Requirements Document

## Introduction

This document specifies the requirements for the Yad2 Cars Scraper, an Apify Store-quality actor that scrapes car listings from Yad2 (yad2.co.il). The actor accepts one or more Yad2 car search result URLs, extracts listing data from `__NEXT_DATA__` JSON embedded in pages, handles pagination, optionally enriches results from detail pages, deduplicates listings, and pushes normalized records to the Apify dataset. The actor replaces an existing Node.js monitoring script, removing all Telegram, local file persistence, alerting, and workflow automation logic.

## Glossary

- **Actor**: An Apify serverless program that runs in the Apify cloud or locally via the Apify CLI.
- **Crawlee**: A web scraping and browser automation library for Node.js, maintained by Apify.
- **CheerioCrawler**: A Crawlee crawler class that fetches pages via HTTP and parses HTML using Cheerio (no browser).
- **Dataset**: An Apify storage abstraction for pushing structured output records.
- **Next_Data**: The JSON payload embedded in a `<script id="__NEXT_DATA__">` tag on Next.js-rendered pages.
- **Feed_Query**: A query object inside the Next_Data dehydrated state whose queryKey includes "feed", containing listing arrays.
- **Item_Token**: A unique string identifier (token) assigned to each Yad2 listing, used in item URLs.
- **Search_Result_Page**: A Yad2 URL that returns a paginated list of car listings matching filter criteria.
- **Detail_Page**: A Yad2 URL for a single listing item (e.g., `https://www.yad2.co.il/item/{token}`), containing enriched data.
- **Deduplication_Set**: An in-memory Set of Item_Tokens used to skip already-seen listings within a single actor run.
- **Input_Schema**: A JSON schema file (`.actor/INPUT_SCHEMA.json`) that defines the actor's configurable input parameters for the Apify platform.
- **Normalized_Record**: A flat, snake_case output object representing one car listing pushed to the Dataset.
- **ShieldSquare_Captcha**: A bot-detection challenge page served by Yad2 instead of the expected content.
- **Promoted_Listing**: A listing marked as an advertisement or promoted placement (type "ad") that appears in feed results but is not an organic listing.

## Requirements

### Requirement 1: Actor Input Validation

**User Story:** As a user, I want to configure the actor with well-defined input parameters, so that I can control scraping scope and behavior.

#### Acceptance Criteria

1. THE Actor SHALL accept an input object conforming to the Input_Schema with the following fields: `startUrls` (array of strings, required), `maxPagesPerSearch` (integer, default 10), `maxRequestsPerCrawl` (integer, default 1000), `proxyConfiguration` (Apify proxy object, optional), `includeItemDetails` (boolean, default true), `maxConcurrency` (integer, default 5), and `debugLog` (boolean, default false).
2. IF the `startUrls` array is empty or missing, THEN THE Actor SHALL throw a descriptive error and exit with a non-zero exit code.
3. IF a URL in `startUrls` does not match the pattern `https://www.yad2.co.il/vehicles/cars*`, THEN THE Actor SHALL log a warning and skip that URL.
4. THE Input_Schema SHALL define type, description, default value, and constraints for each input field.

### Requirement 2: Search Result Page Crawling

**User Story:** As a user, I want the actor to crawl Yad2 car search result pages, so that I can collect listings matching my search criteria.

#### Acceptance Criteria

1. WHEN a Search_Result_Page URL is enqueued, THE CheerioCrawler SHALL fetch the page using HTTP GET with realistic browser headers.
2. WHEN the CheerioCrawler receives an HTML response for a Search_Result_Page, THE Actor SHALL extract the Next_Data JSON from the `<script id="__NEXT_DATA__">` tag.
3. IF the Next_Data script tag is missing from a Search_Result_Page, THEN THE Actor SHALL log an error with the URL and skip that page without crashing.
4. WHEN Next_Data is extracted, THE Actor SHALL locate the Feed_Query from `dehydratedState.queries` by finding a query whose queryKey includes "feed".
5. IF the Feed_Query is not found in the dehydrated state, THEN THE Actor SHALL attempt to read listings from `props.pageProps.search.results.feed.data` as a fallback.
6. IF neither the Feed_Query nor the fallback structure contains listings, THEN THE Actor SHALL log a warning with the URL and continue processing other pages.

### Requirement 3: Listing Extraction and Filtering

**User Story:** As a user, I want only genuine car listings extracted, so that my dataset is free of advertisements and noise.

#### Acceptance Criteria

1. WHEN feed data is retrieved from a Search_Result_Page, THE Actor SHALL extract listings from both the `commercial` and `private` arrays within the feed data.
2. THE Actor SHALL exclude any item whose `type` field equals "ad" from the extracted listings.
3. THE Actor SHALL assign each listing a stable unique identifier using the `token` field, falling back to the `id` field when `token` is absent.
4. WHEN a listing's Item_Token already exists in the Deduplication_Set, THE Actor SHALL skip that listing without pushing it to the Dataset.
5. WHEN a listing's Item_Token does not exist in the Deduplication_Set, THE Actor SHALL add the Item_Token to the Deduplication_Set and proceed with normalization.

### Requirement 4: Pagination Handling

**User Story:** As a user, I want the actor to automatically follow pagination, so that I get all listings from a search without manually providing each page URL.

#### Acceptance Criteria

1. WHEN Next_Data is extracted from a Search_Result_Page, THE Actor SHALL determine the current page number and total number of pages from the pagination metadata.
2. WHEN the current page number is less than the total number of pages AND less than `maxPagesPerSearch`, THE Actor SHALL enqueue the next page URL.
3. THE Actor SHALL construct the next page URL by setting or incrementing the `page` query parameter while preserving all existing query parameters from the original URL.
4. THE Actor SHALL enqueue at most `maxPagesPerSearch - 1` additional pages per start URL (the start URL counts as page 1).
5. IF pagination metadata is missing from Next_Data, THEN THE Actor SHALL log a warning and process only the current page.

### Requirement 5: Detail Page Enrichment

**User Story:** As a user, I want the actor to optionally fetch detail pages for each listing, so that I get enriched data like full description, phone number, and additional vehicle attributes.

#### Acceptance Criteria

1. WHILE `includeItemDetails` is true, THE Actor SHALL enqueue a Detail_Page URL (`https://www.yad2.co.il/item/{token}`) for each non-duplicate listing found on Search_Result_Pages.
2. WHILE `includeItemDetails` is false, THE Actor SHALL push Normalized_Records using only the data available from the Search_Result_Page feed.
3. WHEN a Detail_Page is fetched, THE Actor SHALL extract the Next_Data JSON and locate the item query from `dehydratedState.queries` by finding a query whose queryKey includes "item" and the Item_Token.
4. WHEN detail data is successfully extracted, THE Actor SHALL merge the enriched fields into the Normalized_Record before pushing to the Dataset.
5. IF a Detail_Page fetch fails or returns no parseable data, THEN THE Actor SHALL log a warning and push the Normalized_Record with only the data available from the search result page.

### Requirement 6: Record Normalization

**User Story:** As a user, I want all output records in a consistent, flat, snake_case schema, so that I can easily process and analyze the data.

#### Acceptance Criteria

1. THE Actor SHALL produce Normalized_Records with the following fields: `item_id`, `item_url`, `source` (constant "yad2"), `insertion_time`, `item_time`, `title`, `price`, `currency`, `manufacturer`, `model`, `sub_model`, `year`, `hand`, `km`, `engine_volume`, `gearbox`, `fuel_type`, `color`, `ownership_type`, `city`, `area`, `seller_type` ("private" or "dealer"), `dealer_name`, `images` (array of URLs), `image_count`, `description`, `test_until`, `vehicle_condition`, `previous_owners`, `phone_number_exposed`, `geographic_location`, `raw_item_type`.
2. WHILE `debugLog` is true, THE Actor SHALL include a `raw_data` field containing the original unprocessed item object in each Normalized_Record.
3. WHILE `debugLog` is false, THE Actor SHALL omit the `raw_data` field from Normalized_Records.
4. THE Actor SHALL set missing or unparseable fields to `null` rather than omitting them from the Normalized_Record.
5. THE Actor SHALL derive `seller_type` as "dealer" when the listing has a truthy `merchant` field or a non-empty `customer.agencyName`, and "private" otherwise.
6. THE Actor SHALL derive `dealer_name` from `customer.agencyName` when available, and set it to `null` otherwise.

### Requirement 7: Anti-Blocking and Proxy Support

**User Story:** As a user, I want the actor to handle bot detection and use proxies, so that scraping runs reliably without being blocked.

#### Acceptance Criteria

1. WHEN `proxyConfiguration` is provided in the input, THE Actor SHALL configure the CheerioCrawler to use the specified Apify proxy settings.
2. THE CheerioCrawler SHALL send realistic HTTP headers including a modern User-Agent string with each request.
3. WHEN a response page title equals "ShieldSquare Captcha", THE Actor SHALL detect the bot-detection page, log a warning with the blocked URL, and retry the request.
4. IF a request fails after all retry attempts, THEN THE Actor SHALL log an error with the URL and failure reason and continue processing remaining requests.

### Requirement 8: Crawl Limits and Concurrency

**User Story:** As a user, I want to control the scale of the crawl, so that I can manage costs and avoid overloading the target site.

#### Acceptance Criteria

1. THE CheerioCrawler SHALL respect the `maxRequestsPerCrawl` input parameter as the upper bound on total HTTP requests made during the actor run.
2. THE CheerioCrawler SHALL respect the `maxConcurrency` input parameter as the upper bound on concurrent requests.
3. WHEN the `maxRequestsPerCrawl` limit is reached, THE Actor SHALL stop enqueuing new requests and finish processing in-flight requests.

### Requirement 9: Dataset Output

**User Story:** As a user, I want results pushed to the Apify dataset, so that I can access them via the Apify API, UI, or export tools.

#### Acceptance Criteria

1. THE Actor SHALL push each Normalized_Record to the default Apify Dataset using `Actor.pushData()`.
2. WHEN the actor run completes, THE Dataset SHALL contain one record per unique listing (no duplicates by `item_id`).
3. THE Actor SHALL log a summary at the end of the run including the total number of records pushed, pages crawled, and duplicates skipped.

### Requirement 10: Actor Configuration and Packaging

**User Story:** As a developer, I want proper Apify actor configuration files, so that the actor can be deployed to the Apify Store and run locally.

#### Acceptance Criteria

1. THE Actor SHALL include a `.actor/actor.json` file with the actor name "yad2-cars-scraper", version, and build configuration.
2. THE Actor SHALL include a `.actor/INPUT_SCHEMA.json` file defining all input parameters with types, descriptions, defaults, and validation constraints.
3. THE Actor SHALL include a `package.json` with scripts for local execution (`start`) and Apify CLI compatibility.
4. THE Actor SHALL include a sample input file for local testing at `.actor/input.json` or `storage/key_value_stores/default/INPUT.json`.

### Requirement 11: Project Structure and Code Quality

**User Story:** As a developer, I want a clean, modular codebase, so that the actor is maintainable and individual utilities are testable.

#### Acceptance Criteria

1. THE Actor SHALL organize source code into the following modules: `src/main.js` (entry point), `src/routes/list.js` (search result page handler), `src/routes/detail.js` (detail page handler), `src/utils/extract-next-data.js` (Next_Data extraction), `src/utils/normalize-listing.js` (record normalization), `src/utils/pagination.js` (pagination logic), and `src/input.js` (input validation).
2. THE Actor SHALL contain zero references to Telegram, local file persistence, alerting, workflow flag files, or monitoring automation.
3. THE Actor SHALL use JavaScript (ES modules or CommonJS) with Apify SDK and Crawlee as primary dependencies.
4. Each utility module SHALL export pure functions that can be tested independently without requiring a running crawler.

### Requirement 12: README Documentation

**User Story:** As a potential user browsing the Apify Store, I want a polished README, so that I understand what the actor does and how to use it.

#### Acceptance Criteria

1. THE Actor SHALL include a `.actor/README.md` file with the following sections: title, description, features list, input parameters table, example input JSON, output schema table, example output JSON, notes and limitations, proxy recommendation, local development instructions, deployment instructions, and legal/compliance disclaimer.
2. THE README SHALL document every input parameter with its name, type, required/optional status, default value, and description.
3. THE README SHALL document every output field with its name, type, and description.
4. THE README SHALL include a working example input JSON that can be used for a test run.
