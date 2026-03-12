# Yad2 Cars Scraper

Scrape car listings from [Yad2](https://www.yad2.co.il) — Israel's largest classifieds platform. The actor crawls Yad2 car search result pages, extracts listing data from embedded Next.js JSON, handles pagination automatically, optionally enriches results from detail pages, deduplicates listings, and outputs normalized records to the Apify Dataset.

## Features

- Scrapes car listings from one or more Yad2 search URLs with any filters applied
- Automatic pagination — follows all result pages up to a configurable limit
- Optional detail page enrichment for description, phone number, test date, and more
- In-memory deduplication ensures no duplicate listings in the output
- Filters out promoted/ad listings automatically
- Flat, snake_case output schema with 33 fields per record
- Configurable concurrency and request limits for cost control
- Proxy support with residential proxy recommendation for Yad2
- ShieldSquare captcha detection with automatic retry
- Debug mode to include raw source data in output

## Input Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `startUrls` | `array<string>` | Yes | — | One or more Yad2 car search result URLs (e.g. `https://www.yad2.co.il/vehicles/cars`). Each URL should be a valid Yad2 vehicles/cars search page with optional filters. |
| `maxPagesPerSearch` | `integer` | No | `10` | Maximum number of pagination pages to crawl per start URL. The start URL counts as page 1. Range: 1–100. |
| `maxRequestsPerCrawl` | `integer` | No | `1000` | Upper bound on total HTTP requests during the entire actor run. Use this to control costs and run duration. Range: 1–100,000. |
| `proxyConfiguration` | `object` | No | — | Apify proxy settings. See [Proxy Recommendation](#proxy-recommendation) below. |
| `includeItemDetails` | `boolean` | No | `true` | Fetch each listing's detail page for enriched data (description, phone number, test date, vehicle condition). Disabling this speeds up the crawl but produces less complete records. |
| `maxConcurrency` | `integer` | No | `5` | Maximum number of concurrent HTTP requests. Lower values reduce the chance of being blocked. Range: 1–50. |
| `debugLog` | `boolean` | No | `false` | Include a `raw_data` field in each output record containing the original unprocessed listing object. Useful for debugging but increases dataset size. |

## Example Input

```json
{
    "startUrls": [
        "https://www.yad2.co.il/vehicles/cars?manufacturer=21&year=2020--2024"
    ],
    "maxPagesPerSearch": 5,
    "maxRequestsPerCrawl": 200,
    "includeItemDetails": true,
    "maxConcurrency": 3,
    "debugLog": false
}
```

## Output Schema

Each record in the output dataset contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `item_id` | `string` | Unique listing identifier (token or id) |
| `item_url` | `string` | Direct URL to the listing on Yad2 |
| `source` | `string` | Constant `"yad2"` |
| `insertion_time` | `string` | ISO 8601 timestamp when the record was scraped |
| `item_time` | `string\|null` | Listing publication or last update time |
| `title` | `string\|null` | Listing title or constructed from manufacturer + model |
| `price` | `number\|null` | Listed price |
| `currency` | `string\|null` | Price currency (typically `"ILS"`) |
| `manufacturer` | `string\|null` | Car manufacturer name |
| `model` | `string\|null` | Car model name |
| `sub_model` | `string\|null` | Car sub-model / trim level |
| `year` | `number\|null` | Year of production |
| `hand` | `number\|null` | Number of previous owners (hand) |
| `km` | `number\|null` | Odometer reading in kilometers |
| `engine_volume` | `number\|null` | Engine displacement (cc) |
| `gearbox` | `string\|null` | Transmission type (e.g. automatic, manual) |
| `fuel_type` | `string\|null` | Fuel type (e.g. petrol, diesel, electric, hybrid) |
| `color` | `string\|null` | Exterior color |
| `ownership_type` | `string\|null` | Ownership type (e.g. private, leasing) |
| `city` | `string\|null` | City where the car is located |
| `area` | `string\|null` | Geographic area / region |
| `seller_type` | `string` | `"private"` or `"dealer"` — derived from merchant/agency data |
| `dealer_name` | `string\|null` | Dealer or agency name (null for private sellers) |
| `images` | `array<string>` | Array of image URLs |
| `image_count` | `number` | Number of images |
| `description` | `string\|null` | Full listing description (from detail page) |
| `test_until` | `string\|null` | Vehicle test (Teste) expiry date (from detail page) |
| `vehicle_condition` | `string\|null` | Reported vehicle condition (from detail page) |
| `previous_owners` | `number\|null` | Number of previous owners (from detail page) |
| `phone_number_exposed` | `string\|null` | Seller phone number (from detail page) |
| `geographic_location` | `object\|null` | GPS coordinates `{ lat, lon }` (from detail page) |
| `raw_item_type` | `string\|null` | Original item type from the raw listing data |
| `raw_data` | `object\|null` | Full raw listing object (only when `debugLog` is enabled) |

Fields marked "from detail page" are only populated when `includeItemDetails` is `true` and the detail page was successfully fetched.

## Example Output

```json
{
    "item_id": "gludk5nm",
    "item_url": "https://www.yad2.co.il/item/gludk5nm",
    "source": "yad2",
    "insertion_time": "2024-12-15T10:30:00.000Z",
    "item_time": "2024-12-14T08:22:00.000Z",
    "title": "Toyota Corolla 2021",
    "price": 125000,
    "currency": "ILS",
    "manufacturer": "טויוטה",
    "model": "קורולה",
    "sub_model": "GLI Premium",
    "year": 2021,
    "hand": 1,
    "km": 45000,
    "engine_volume": 1800,
    "gearbox": "אוטומטית",
    "fuel_type": "בנזין",
    "color": "לבן",
    "ownership_type": "פרטית",
    "city": "תל אביב",
    "area": "מרכז",
    "seller_type": "private",
    "dealer_name": null,
    "images": [
        "https://img.yad2.co.il/Pic/202412/14/1_1/o/y2_1_01234_20241214.jpg",
        "https://img.yad2.co.il/Pic/202412/14/1_1/o/y2_1_01234_20241214_2.jpg"
    ],
    "image_count": 2,
    "description": "רכב שמור במצב מעולה, בעלות יחידה, ללא תאונות.",
    "test_until": "2025-06-01",
    "vehicle_condition": "מצב מעולה",
    "previous_owners": 1,
    "phone_number_exposed": "050-1234567",
    "geographic_location": {
        "lat": 32.0853,
        "lon": 34.7818
    },
    "raw_item_type": "private",
    "raw_data": null
}
```

## Notes and Limitations

- The actor relies on Yad2's `__NEXT_DATA__` JSON structure embedded in server-rendered pages. If Yad2 changes their frontend framework or data structure, the actor may need updates.
- Yad2 uses ShieldSquare bot detection. The actor detects captcha pages and retries automatically, but aggressive scraping may still result in blocks.
- Detail page enrichment (`includeItemDetails: true`) significantly increases the number of requests. For large-scale scrapes, consider disabling it for faster results.
- Phone numbers are only available from detail pages and may not always be exposed by the seller.
- Hebrew text in fields like manufacturer, model, city, and description is preserved as-is from the source.
- The actor deduplicates listings within a single run using an in-memory Set. Deduplication does not persist across runs.
- Geographic coordinates are only available when the seller has shared their location on the detail page.

## Proxy Recommendation

Yad2 employs ShieldSquare bot detection, which can block datacenter IP addresses. For reliable scraping, **residential proxies are strongly recommended**.

Recommended proxy configuration:

```json
{
    "proxyConfiguration": {
        "useApifyProxy": true,
        "apifyProxyGroups": ["RESIDENTIAL"]
    }
}
```

If you don't have access to residential proxies, datacenter proxies may work for small-scale runs with low concurrency (`maxConcurrency: 1–2`), but expect higher failure rates.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Set up your input by editing `.actor/input.json` or creating `storage/key_value_stores/default/INPUT.json`.

3. Run the actor locally using the Apify CLI:

```bash
npx apify run
```

Results will be stored in `storage/datasets/default/` as JSON files.

4. Run tests:

```bash
npm test
```

## Deployment

1. Install the Apify CLI if you haven't already:

```bash
npm install -g apify-cli
```

2. Log in to your Apify account:

```bash
apify login
```

3. Push the actor to the Apify platform:

```bash
apify push
```

The actor will be built and deployed. You can then run it from the Apify Console or via the API.

## Legal Disclaimer

This actor is provided for educational and research purposes. The user is solely responsible for ensuring that their use of this actor complies with Yad2's Terms of Service, applicable laws, and regulations — including data protection and privacy laws. The author assumes no liability for any misuse of this tool or the data collected with it. Always respect the target website's `robots.txt` and rate limits. Use responsibly.
