# Comps Generation Algorithm

This document describes the algorithm the Sports Card Tracker uses to generate comparable sales ("comps") for a card. The system fetches pricing data from six independent sources, deduplicates and weights the sales, and produces a single aggregate valuation optionally adjusted by population report data.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Data Sources](#data-sources)
  - [SportsCardsPro / PriceCharting](#sportscardspro--pricecharting)
  - [eBay Sold Listings](#ebay-sold-listings)
  - [Card Ladder](#card-ladder)
  - [Market Movers](#market-movers)
  - [130Point](#130point)
  - [PSA Auction Prices](#psa-auction-prices)
- [Search Query Construction](#search-query-construction)
- [Per-Adapter Processing](#per-adapter-processing)
- [Cross-Source Aggregation](#cross-source-aggregation)
  - [Step 1: Pool All Sales](#step-1-pool-all-sales)
  - [Step 2: Sort by Source Priority](#step-2-sort-by-source-priority)
  - [Step 3: Deduplicate](#step-3-deduplicate)
  - [Step 4: Recency-Weighted Trimmed Mean](#step-4-recency-weighted-trimmed-mean)
  - [Step 5: Market Value Fallback](#step-5-market-value-fallback)
- [Population Report Adjustment](#population-report-adjustment)
- [Caching](#caching)
- [Error Handling](#error-handling)
- [Output Format](#output-format)
- [Constants Reference](#constants-reference)
- [API Endpoints](#api-endpoints)
- [Source Files](#source-files)

---

## Architecture Overview

```
CompRequest (card metadata)
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                     CompService                       │
│                                                       │
│  ┌──────────────┐  ┌──────────┐  ┌───────────┐        │
│  │SportsCardsPro│  │   eBay   │  │Card Ladder│        │
│  └──────┬───────┘  └────┬─────┘  └─────┬─────┘        │
│         │               │              │              │
│  ┌──────┴──────┐  ┌─────┴────┐  ┌──────┴─────┐        │
│  │Market Movers│  │ 130Point │  │    PSA     │        │
│  └──────┬──────┘  └─────┬────┘  └──────┬─────┘        │
│         │               │              │              │
│         └───────────┬───┴──────────────┘              │
│                     ▼                                 │
│           Pool + Deduplicate Sales                    │
│                     │                                 │
│                     ▼                                 │
│       Recency-Weighted Trimmed Mean                   │
│                     │                                 │
│                     ▼                                 │
│       Population Report Adjustment (graded cards)     │
│                     │                                 │
│                     ▼                                 │
│                CompReport                             │
└───────────────────────────────────────────────────────┘
```

Each adapter implements the `CompAdapter` interface and returns a `CompResult` with market value, individual sales, and per-source aggregates. All adapters run in parallel via `Promise.allSettled` — a single adapter failure or timeout does not block others. The `CompService` then pools all sales across sources and computes a single weighted aggregate.

---

## Data Sources

### SportsCardsPro / PriceCharting

**File:** `server/src/services/adapters/sportsCardsPro.ts`

Two modes of operation:

1. **API mode** (preferred): Uses PriceCharting REST API when `PRICECHARTING_API_TOKEN` is set.
   - Search: `GET https://www.pricecharting.com/api/products?q=QUERY&t=TOKEN`
   - Detail: `GET https://www.pricecharting.com/api/product?id=ID&t=TOKEN`
   - Uses first (best) search result

2. **Scraping fallback**: Puppeteer-based web scraping of sportscardspro.com when no API token.
   - URL: `https://www.sportscardspro.com/search-products?q=QUERY&type=prices`

**Price selection** (API mode, prices in pennies converted to dollars):

| Condition | API Field | Notes |
|-----------|-----------|-------|
| BGS 10 | `bgs-10-price` | |
| PSA 10 | `condition-18-price` | |
| PSA 9 | `condition-17-price` | |
| Any graded (fallback) | `graded-price` | |
| Raw / ungraded | `loose-price` | Final fallback |

**Output:** Market value + up to 15 recent sales (scraping mode only).

### eBay Sold Listings

**File:** `server/src/services/adapters/ebay.ts`

Scrapes eBay completed/sold listings via Puppeteer.

- **URL:** `https://www.ebay.com/sch/i.html?_nkw=QUERY&LH_Complete=1&LH_Sold=1&_sop=13`
- `_sop=13` sorts by end date (most recent first)
- Extracts up to **20 listings** (title, price, sold date)
- Skips injected "Shop on eBay" entries

**Relevance filtering:**
1. Filter to sales whose title contains the player's last name
2. Only apply filter if 3+ matches remain; otherwise keep all
3. For graded cards, further filter by grade extracted from title (same 3+ threshold)

**Grade extraction regex:** `/\b(PSA|BGS|SGC|CGC|HGA|BVG|GMA|MNT|CSG|AGS)\s*(\d+(?:\.\d+)?|Auth(?:entic)?)\b/i`

**Per-adapter average:** 15% trimmed mean of filtered prices.

### Card Ladder

**File:** `server/src/services/adapters/cardLadder.ts`

Queries Card Ladder's Firestore database (100M+ historical sales from eBay, Goldin, Heritage, Fanatics, etc.).

**Authentication:** Firebase email/password sign-in with token caching and refresh (5-minute buffer).

**Query:** Firestore structured query on `cards` collection filtered by exact player name match, limited to 500 results.

**Card matching** — scores each Firestore document against the request:

| Criterion | Points | Notes |
|-----------|--------|-------|
| Year mismatch | -1 (reject) | Hard filter |
| Player match | +10 | Already filtered by Firestore query |
| Card number exact match | +20 | Case-insensitive |
| Brand in set name | +5 | String inclusion |
| Set name in set name | +10 | String inclusion |
| Parallel/variation match | +10 | When parallel specified |
| Base card preference | +5 | When no parallel specified |
| Exact grade match | +15 | e.g. "PSA 10" |
| Same grading company | +5 | Partial match fallback |
| Raw card condition match | +15 | When not graded |

**Sales extraction:** Parses `dailySales` map (date -> `{p: price, n: count}`), sorted by date descending, limited to **15 sales**.

### Market Movers

**File:** `server/src/services/adapters/marketMovers.ts`

Queries Market Movers (by Sports Card Investor) via tRPC API endpoints.

**Authentication flow:**
1. WordPress SSO login via Puppeteer (`wp-login.php`)
2. Redirect to Market Movers dashboard triggers JWT exchange
3. JWT stored in localStorage (`mm_token`, `mm_rt`)
4. Token caching with 5-minute buffer; refresh via `auth.refreshToken` tRPC endpoint

**Two parallel data fetches:**

1. **Collectibles search** (`private.collectibles.search`):
   - Returns market stats (30-day, 90-day) for matched collectibles
   - Market value priority: `last30.endAvgPrice` > `last30.avgPrice` > `last90.endAvgPrice` > `last90.avgPrice`

2. **Raw sales search** (`private.rawSales.completed.search`):
   - Excludes terms: `lot`, `reprint`, `digital`, `custom`
   - Sorts by `saleDate` desc, then `score` desc
   - Up to 20 results, relevance-filtered to **15 sales**
   - Price: uses `offerPrice` if best offer accepted, otherwise `finalPrice`

**Collectible matching** — scoring (same pattern as Card Ladder):

| Criterion | Points | Notes |
|-----------|--------|-------|
| Year mismatch | -1 (reject) | |
| Player last name missing | -1 (reject) | |
| Player match | +10 | |
| Card number match | +20 | |
| Brand in set name | +5 | |
| Set name match | +10 | |
| Parallel/variation match | +10 | Checks `variation.name` and `displayName` |
| Base card preference | +5 | When no parallel specified |
| Exact grade match | +15 | |
| Same grading company | +5 | |
| Ungraded match | +15 | Raw card preference |
| Rookie bonus | +3 | Both request and item are rookie |

### 130Point

**File:** `server/src/services/adapters/oneThirtyPoint.ts`

Queries 130Point's HTTP API for aggregated auction data across multiple marketplaces.

**Request:** `POST https://back.130point.com/cards/` with form-encoded parameters:
- `query`: Search string
- `sort=date_desc`, `tab_id=1`, timezone, window dimensions

**Rate limiting:**
- 6-second minimum between requests (configurable)
- 1-hour block on HTTP 429 response

**Response parsing:** Extracts up to **30 rows** from HTML table response:
- Price: `data-price` attribute, then `$XX.XX` text fallback
- Date: `data-date` attribute, then cell text pattern matching (slash, ISO, natural)
- Marketplace detection from row content: Goldin, PWCC, Heritage, MySlabs, Pristine, eBay, or default "130Point"

**Filtering:** Same last-name relevance + grade filtering as eBay (3+ threshold).

**Per-adapter average:** 15% trimmed mean.

### PSA Auction Prices

**File:** `server/src/services/adapters/psa.ts`

Scrapes PSA's auction prices database via Puppeteer.

**Flow:**
1. Search: `https://www.psacard.com/auctionprices/search?q=QUERY`
2. Find first result link matching `/auctionprices/{category}/{set}/{player}/{specId}`
3. Navigate to detail page and extract table rows

**Table parsing** — dynamic cell detection:
- **Grade:** Scans backward from price cell for match against `/^(\d{1,2}(?:\.\d+)?|Auth(?:entic)?)$/i`
- **Price:** Last cell containing `$` and a numeric value
- **Date:** Second column (cells[1])
- **Auction house:** Third column (cells[2])
- Rows with fewer than 6 cells are skipped (grade summary rows)

**Grade filtering:** If the card is PSA-graded, only keep sales matching the exact grade. Falls back to all sales if no matches.

**Adapter skip rule:** The PSA adapter is skipped entirely when the card is graded by a company other than PSA (avoids irrelevant results for BGS/SGC cards).

**Per-adapter average:** 15% trimmed mean.

---

## Search Query Construction

Each adapter builds a search query from the `CompRequest` fields. The general pattern:

```
YEAR BRAND [SET_NAME] PLAYER [#]CARD_NUMBER [PARALLEL] [GRADING_INFO] [FEATURES]
```

Specific differences by adapter:

| Adapter | Card # prefix | Grading info | Features |
|---------|--------------|--------------|----------|
| SportsCardsPro | none | none | none |
| eBay | `#` | `COMPANY GRADE` | `auto`, `relic` |
| Card Ladder | none | none | none |
| Market Movers | `#` | `COMPANY GRADE` | none |
| 130Point | `#` | `COMPANY GRADE` | none |
| PSA | `#` | none (matched on detail page) | none |

Example: `2023 Panini Obsidian Stephen Curry #AUR-SCU Prizm PSA 9`

---

## Per-Adapter Processing

Each adapter independently:

1. Checks the adapter-level cache (24-hour TTL)
2. Authenticates if needed (Card Ladder: Firebase, Market Movers: WordPress SSO + JWT)
3. Fetches data (API call, Puppeteer scrape, or HTTP POST)
4. Filters results by relevance (last name, grade matching)
5. Computes a per-adapter 15% trimmed mean
6. Returns a `CompResult` with `marketValue`, `sales[]`, `averagePrice`, `low`, `high`
7. Caches successful results

The **15% trimmed mean** used by eBay, 130Point, and PSA adapters:
- Sort prices ascending
- If fewer than 5 prices: simple mean
- Otherwise: trim `floor(count * 0.15)` items from each tail, mean of remainder

---

## Cross-Source Aggregation

After all adapters complete (failures don't block others), the `CompService` aggregates results.

### Step 1: Pool All Sales

Collect every `CompSale` from every successful adapter into a single array. Each sale is normalized to:

```typescript
{
  price: number;
  dateMs: number | null;  // epoch milliseconds
  venue: string;
  sourceAdapter: CompSource;
}
```

**Date normalization** handles three formats:
- ISO: `YYYY-MM-DD`
- Slash: `MM/DD/YYYY` or `MM/DD/YY` (2-digit years assumed 2000s)
- Natural language: `Feb 23, 2026` (parsed via `new Date()`)

### Step 2: Sort by Source Priority

Sales are sorted by their source adapter's total sales count (descending). Sources with more sales get deduplication priority — their sales are "seen first" and kept when duplicates are found.

### Step 3: Deduplicate

Cross-source duplicate detection using three criteria — all must match:

| Criterion | Tolerance |
|-----------|-----------|
| Price | +/- max($0.50, 3% of average of two prices) |
| Date | +/- 2 days (172,800,000 ms) |
| Venue | Exact match, both contain "ebay", OR either is "130Point" |

**Venue matching** is handled by the `venuesOverlap()` function. Since 130Point is a meta-aggregator that scrapes sales from eBay, Goldin, Heritage, and others, a sale labeled `"130Point"` as its venue means the marketplace was unidentifiable — it could have come from any platform. These unknown-venue sales are treated as potential matches with any other venue, preventing the same eBay sale from appearing twice (once from the eBay adapter with venue `"eBay"` and once from 130Point with venue `"130Point"`).

The price tolerance is **percentage-based with a floor**: `max(DEDUP_PRICE_FLOOR, avgPrice * DEDUP_PRICE_PERCENT)` where `avgPrice = (priceA + priceB) / 2`. This adapts to card value — cheap cards ($5) use the $0.50 floor while expensive cards ($500) use 3% ($15). The crossover point is ~$16.67.

| Card Price | Tolerance |
|-----------|-----------|
| $5 | $0.50 (floor) |
| $16 | $0.50 (floor) |
| $17 | $0.51 (3%) |
| $100 | $3.00 (3%) |
| $500 | $15.00 (3%) |

Rules:
- Sales with `null` dates are **never** deduplicated (always kept)
- First-seen sale wins (per step 2 sort order)

### Step 4: Recency-Weighted Trimmed Mean

This is the core pricing algorithm. It applies exponential decay weighting and tail trimming.

**Recency weight function:**

```
weight(sale) = max(MIN_RECENCY_WEIGHT, 0.5 ^ (ageDays / 30))
```

A floor of `MIN_RECENCY_WEIGHT = 0.20` ensures old sales still contribute meaningfully, preventing over-concentration on a single recent sale for infrequently traded cards. Without the floor, a 90-day sale would have only 12.5% influence; with it, the minimum is 20%.

| Sale Age | Weight |
|----------|--------|
| Today | 1.000 |
| 7 days | 0.851 |
| 14 days | 0.724 |
| 30 days | 0.500 |
| 60 days | 0.250 |
| 70+ days | 0.200 (floor) |
| Unknown date | 0.100 (fixed penalty, below floor) |

**Trimmed mean procedure:**

1. Assign recency weights to all sales
2. Sort by price ascending
3. If **5+ sales**: trim 10% of **total weight** from each tail
   - Walk from lowest price upward, removing full items or partially reducing the boundary item's weight
   - Walk from highest price downward, same partial-trim logic
4. If **fewer than 5 sales**: skip trimming (simple weighted mean)
5. Compute weighted mean: `sum(price * weight) / sum(weight)`

**Output:** `{ average, low, high }` where `low`/`high` are the min/max prices of the trimmed set.

### Step 5: Market Value Fallback

If no individual sales exist across any source (all adapters returned only market values or errors), fall back to weighting market values by source reliability:

| Source | Reliability Weight |
|--------|-------------------|
| eBay | 1.00 |
| PSA | 0.95 |
| 130Point | 0.90 |
| Market Movers | 0.85 |
| Card Ladder | 0.80 |
| SportsCardsPro | 0.60 |

Computes: `weighted_avg = sum(value * weight) / sum(weight)`, with `low` = min and `high` = max across sources.

---

## Population Report Adjustment

For graded cards only. Runs after aggregate calculation; failures do not block the comp report.

**File:** `server/src/services/populationReportService.ts`

### When Applied

All three must be true:
- `isGraded === true`
- `gradingCompany` is set
- `grade` is set

### PSA Pop Scraper

**File:** `server/src/services/adapters/psaPopScraper.ts`

Uses progressive query fallback to find the card:
1. `setName + lastName + cardNumber` (most specific)
2. `year + brand + setName + lastName`
3. `year + brand + lastName + cardNumber`
4. `year + brand + lastName` (least specific)

Clicks "Show Pop" on the matched result page and intercepts the AJAX response containing population counts.

### Grade Breakdown

```
targetGradePop  = count for the requested grade
higherGradePop  = sum of all grades above the target
totalGraded     = sum of all grade counts
percentile      = ((targetGradePop + higherGradePop) / totalGraded) * 100
```

### Rarity Tier & Multiplier

| Target Grade Pop | Rarity Tier | Price Multiplier |
|-----------------|-------------|-----------------|
| 0-5 | ultra-low | 1.25x (+25%) |
| 6-25 | low | 1.10x (+10%) |
| 26-100 | medium | 1.00x (no change) |
| 101-500 | high | 1.00x (no change) |
| 501+ | very-high | 0.95x (-5%) |

**Pop-adjusted average:**

```
popAdjustedAverage = aggregateAverage * multiplier
```

### Caching

Population data is cached for **7 days** per card + grading company + grade combination in the `pop_report_snapshots` table.

### Other Grading Companies

BGS and SGC scrapers are stubbed (return `null`). Only PSA population data is currently functional.

---

## Caching

### Adapter-Level Cache

**File:** `server/src/services/compCacheService.ts`

| Property | Value |
|----------|-------|
| TTL | 24 hours (86,400,000 ms) |
| Storage | `comp_cache` SQLite table |
| Key format | `source\|player\|year\|brand\|cardNumber\|condition` (lowercase, trimmed) |
| Behavior | Check before fetch; store after successful fetch |
| Purge | Manual via `purgeExpired()` |

### Population Report Cache

| Property | Value |
|----------|-------|
| TTL | 7 days (604,800,000 ms) |
| Storage | `pop_report_snapshots` SQLite table |
| Key | `cardId + gradingCompany + grade` |

### Comp Report History

All generated reports are persisted to `card_comp_reports` + `card_comp_sources` tables. No automatic purge — full history is retained.

---

## Error Handling

- All adapters run in parallel via `Promise.allSettled`. A rejected adapter is mapped to a `CompResult` with an `error` field and empty data. One adapter's failure does not block or delay others.
- Failed sources are logged to `comp-error.log`:
  ```
  [YYYY-MM-DDTHH:MM:SS.sssZ] YEAR-BRAND-PLAYER-CARDNUMBER: SOURCE - error message
  ```
- If all adapters fail, the aggregate returns `null` for all values.
- Rate limit handling:
  - **130Point:** 6-second throttle between requests; 1-hour block on 429
  - **Card Ladder / Market Movers:** JWT refresh with fallback to full re-authentication
  - **eBay / PSA / SportsCardsPro:** Throttled via `BrowserService.navigateWithThrottle()`

---

## Output Format

### CompReport (returned to caller)

```typescript
{
  cardId: string;
  player: string;
  year: number;
  brand: string;
  cardNumber: string;
  condition: string;
  sources: CompResult[];         // One per adapter (6 max)
  aggregateAverage: number | null;
  aggregateLow: number | null;
  aggregateHigh: number | null;
  popData: PopulationData | null;
  popMultiplier?: number;
  popAdjustedAverage?: number | null;
  generatedAt: string;           // ISO timestamp
}
```

### Comp Text File

Written to `processed/{Year}-{Brand}-{Player}-{CardNumber}-comps.txt`:

```
Card: Mike Trout 2011 Topps #27
Condition: PSA 10
Generated: 2026-02-25T12:34:56.789Z

--- SportsCardsPro ---
Market Value: $156.50
Average Price: $154.32
Range: $120.00 - $189.99
Recent Sales:
  2026-02-20 - $150.00 (SportsCardsPro)
  ...

--- eBay ---
...

--- Aggregate ---
Average: $167.45
Low: $120.00
High: $189.99

--- Population Report ---
PSA 10 Pop: 42
Total Graded: 8234
Percentile: Top 1.2%
Rarity Tier: high
Pop-Adjusted Average: $167.45 (+0%)
```

### Database Storage

On `generateAndWriteComps()`, the report is also:
- Saved to `card_comp_reports` + `card_comp_sources` tables
- Card's `currentValue` is updated to `popAdjustedAverage` (or `aggregateAverage` if no pop data)

---

## Constants Reference

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `RECENCY_HALF_LIFE_DAYS` | 30 | compService.ts | Exponential decay half-life for sale weighting |
| `DEDUP_PRICE_FLOOR` | $0.50 | compService.ts | Minimum price tolerance for duplicate detection |
| `DEDUP_PRICE_PERCENT` | 0.03 (3%) | compService.ts | Percentage of avg price used for duplicate detection |
| `DEDUP_DATE_TOLERANCE_MS` | 172,800,000 (2 days) | compService.ts | Max date difference for duplicate detection |
| `TRIM_PERCENTAGE` | 0.10 | compService.ts | Weight percentage trimmed from each tail |
| `UNKNOWN_DATE_WEIGHT` | 0.10 | compService.ts | Fixed weight for sales with no date |
| `MIN_RECENCY_WEIGHT` | 0.20 | compService.ts | Floor for recency weight (prevents old sale under-weighting) |
| `MIN_SALES_FOR_TRIM` | 5 | compService.ts | Minimum sales count to enable trimming |
| `POP_CACHE_TTL_MS` | 604,800,000 (7 days) | populationReportService.ts | Population report cache TTL |
| Adapter cache TTL | 86,400,000 (24 hours) | compCacheService.ts | Default adapter result cache TTL |
| 130Point rate limit | 6,000 ms | oneThirtyPoint.ts | Minimum time between 130Point requests |
| 130Point block duration | 3,600,000 (1 hour) | oneThirtyPoint.ts | Block duration after 429 response |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/comps/generate` | Generate comps (no persistence) |
| `POST` | `/api/comps/generate-and-save` | Generate, persist to DB, write comp file, log errors |
| `GET` | `/api/comps/:cardId` | Get stored report or generate fresh if `?refresh=true` |
| `GET` | `/api/comps/:cardId/stored` | Latest stored report only (no generation) |
| `GET` | `/api/comps/:cardId/history?limit=20` | Historical comp reports |
| `GET` | `/api/comps/:cardId/pop-history?limit=50` | Population report snapshots |

---

## Source Files

| File | Purpose |
|------|---------|
| `server/src/services/compService.ts` | Main orchestrator, aggregation algorithm |
| `server/src/services/adapters/sportsCardsPro.ts` | SportsCardsPro/PriceCharting adapter |
| `server/src/services/adapters/ebay.ts` | eBay sold listings adapter |
| `server/src/services/adapters/cardLadder.ts` | Card Ladder (Firestore) adapter |
| `server/src/services/adapters/marketMovers.ts` | Market Movers (tRPC) adapter |
| `server/src/services/adapters/oneThirtyPoint.ts` | 130Point adapter |
| `server/src/services/adapters/psa.ts` | PSA auction prices adapter |
| `server/src/services/adapters/gradeUtils.ts` | Grade extraction and filtering utilities |
| `server/src/services/compCacheService.ts` | Adapter-level caching |
| `server/src/services/populationReportService.ts` | Population report orchestrator |
| `server/src/services/adapters/psaPopScraper.ts` | PSA pop report scraper |
| `server/src/routes/comps.ts` | REST API endpoints |
| `server/src/types.ts` | Type definitions (CompRequest, CompReport, etc.) |
| `server/src/database.ts` | SQLite schema and CRUD operations |
