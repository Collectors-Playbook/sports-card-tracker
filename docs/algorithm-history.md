# Comps Algorithm — Evolution & History

This document traces the comps pricing algorithm from its initial stub implementation through the current production system. Each stage is presented chronologically with the key changes, motivations, and measurable impact on portfolio valuations.

For a detailed reference of the current algorithm's internals, see [comps-algorithm.md](./comps-algorithm.md).

---

## Timeline Summary

| Date | Commit | Stage | Key Change |
|------|--------|-------|------------|
| Feb 9 | `5daf5ee` | 1 | Stub adapters — scaffolding only |
| Feb 24 06:10 | `f051e42` | 2 | Full comp system with 4 real adapters |
| Feb 24 07:30 | `af2c8fd` | 3 | 130Point adapter (5th source) |
| Feb 24 07:30 | `b133512` | 4 | **Weighted aggregation algorithm** (replaces simple mean) |
| Feb 24 08:08–09:23 | `b264854`–`3c79aa2` | 5 | PSA adapter + grade filtering |
| Feb 24 10:48 | `47e436f` | 6 | PSA grade extraction fix, 130Point cap, dateless weight reduction |
| Feb 24 11:36 | `5469a83`–`ef690f4` | 7 | Population report service + PSA pop scraper |
| Feb 24 13:17–14:24 | `fd3c062`–`4bbf706` | 8 | PSA pop scraper rewrite (form-based search) |
| Feb 25 04:54 | `dfc0397` | — | Algorithm documentation (no code change) |
| Feb 25 05:04 | `815c740` | 9 | Parallel adapter fetches, adaptive dedup tolerance |
| Feb 25 05:13 | `5c73c06` | 10 | 130Point venue overlap handling, recency weight floor |
| Feb 25 05:40 | `96f6b7c` | 11 | Tiered grade filtering fallback |
| Feb 25 06:20 | `bdc39b1` | 12 | **Continuous log₁₀ pop multiplier** (replaces step function) |
| Feb 25 06:31 | `5f9dab8` | 13 | Source reliability weights in aggregation |
| Feb 25 07:09 | `0e78b3c` | 14 | Median-date proxy for undated sales |
| Feb 25 09:18–09:54 | `ffa1302`–`f4989ab` | 15 | CGC pop scraper, GemRate universal fallback scraper |
| Feb 25 14:30 | `0ce486a` | 16 | Grading company normalization + API retry |

---

## Stage 1: Stub Adapters

**Commit:** `5daf5ee` (Feb 9)

The initial implementation laid out the adapter-based architecture. Four adapter files were created — SportsCardsPro, eBay, CardLadder, MarketMovers — but each returned a stub error (`"Not yet implemented"`). The `CompService` class was defined with its constructor signature and the `generateComps` / `generateAndWriteComps` methods.

**Aggregation:** None. All adapters returned errors, so no pricing data was produced.

**Purpose:** Establish the multi-source adapter pattern and file structure so real adapters could be added incrementally.

---

## Stage 2: Full Comp System

**Commit:** `f051e42` (Feb 24)

All four adapters were implemented with real web scraping via Puppeteer (`BrowserService`):

| Adapter | Source | Method |
|---------|--------|--------|
| SportsCardsPro | sportscardspro.com | Scrape search results page for market value |
| eBay | ebay.com | Scrape completed/sold listings |
| CardLadder | cardladder.com | Scrape historical sales database |
| MarketMovers | marketmoversapp.com | Scrape daily-updated sales records |

A `CompCacheService` was also introduced — each adapter can cache its results in SQLite with a configurable TTL (default 24h) to avoid redundant scrapes.

**Aggregation:** Simple unweighted arithmetic mean across all source averages. For each source that returned a non-null `averagePrice`, all values were summed and divided by count. No deduplication, no recency weighting, no trimming.

```
aggregateAverage = sum(source.averagePrice) / count
aggregateLow = min(source.low)
aggregateHigh = max(source.high)
```

**Limitation:** A source with 3 sales and a source with 300 sales contributed equally. Stale sales from months ago had the same weight as yesterday's sale. Duplicate sales appearing across multiple sources inflated the average.

---

## Stage 3: 130Point Adapter

**Commit:** `af2c8fd` (Feb 24)

Added a 5th data source: **130Point** (130point.com), a meta-aggregator of eBay sold listings with historical data going back years. This was a scraping adapter like the others.

130Point was significant because it frequently surfaces the same sales as the eBay adapter (since it tracks eBay). This created the first cross-source duplication problem — the same sale at the same price on the same date could appear in both eBay and 130Point results, inflating the average.

**Aggregation:** Still simple unweighted mean. The duplication problem was not yet addressed.

---

## Stage 4: Weighted Aggregation Algorithm

**Commit:** `b133512` (Feb 24)

**This was the single largest algorithmic change.** The simple mean was replaced with a multi-step weighted aggregation pipeline:

### Step 1: Pool All Sales
Instead of averaging per-source averages, all individual sales from all sources are pooled into a single array with normalized metadata:

```typescript
interface NormalizedSale {
  price: number;
  dateMs: number | null;
  venue: string;
  sourceAdapter: CompSource;
}
```

### Step 2: Deduplicate Cross-Source
Sales that likely represent the same transaction are removed. Two sales are considered duplicates if all three conditions hold:
- **Price** within $0.50 of each other
- **Date** within 2 days
- **Venue** is the same (case-insensitive string match)

Null-date sales are never deduped (can't confirm they're the same transaction).

### Step 3: Recency-Weighted Trimmed Mean
Each sale receives a recency weight via exponential decay:
```
weight = 0.5 ^ (ageDays / 30)
```
- A sale from today: weight = 1.0
- A sale from 30 days ago: weight = 0.5
- A sale from 60 days ago: weight = 0.25

Sales without dates receive a fixed weight of 0.25 (substantial penalty for missing date information).

The 10% most extreme weights are trimmed from each tail (low and high prices) to reduce the impact of outliers — but only when 5+ sales exist.

The final value is the weighted mean of the remaining (untrimmed) sales.

### Step 4: Market Value Fallback
If no individual sales exist (only market value summaries), fall back to a simple average of market values.

**Impact:** Portfolio total went from $3,669.52 (old simple mean) to $4,201.60 (new weighted algorithm), a +14.5% shift. 14 of 21 cards increased in value, 3 decreased. The biggest winner was Leo De Vries (+449.5%) — the old algorithm was dragged down by a low static market value from a single source. The biggest loser was Saquon Barkley (-88.9%) — with 216 sales, the trimming and recency decay removed outlier historic highs that had inflated the old unweighted average.

---

## Stage 5: PSA Adapter + Grade Filtering

**Commits:** `b264854`, `3766a4d`, `f170439`, `31bbed4`, `3c79aa2` (Feb 24)

Added the 6th and final data source: **PSA Auction Prices** (psacard.com). The PSA adapter scrapes the auction prices realized database for verified PSA-graded card sales.

This phase also introduced **grade filtering** — a critical accuracy improvement:

- **`gradeUtils.ts`**: A shared utility that extracts numeric grade values from sale descriptions (e.g., "PSA 10" → 10, "BGS 9.5" → 9.5) using regex patterns
- **eBay adapter**: Now filters sold listings to only include sales matching the requested grade (±0.5 tolerance)
- **130Point adapter**: Same grade filtering applied
- **PSA adapter**: Only activated for PSA-graded cards (skipped entirely for BGS/CGC/SGC cards)

Without grade filtering, a PSA 10 card's comps would include PSA 8 and PSA 9 sales, significantly understating the card's value.

---

## Stage 6: Tuning Pass

**Commit:** `47e436f` (Feb 24)

Three targeted fixes based on observed inaccuracies:

1. **Robust PSA grade extraction**: The grade extraction regex was strengthened to handle more formats (e.g., "Mint 9", "GEM-MT 10", grade in parentheses)
2. **130Point cap at 30 sales**: 130Point could return hundreds of results going back years. Capped at the 30 most recent to prevent ancient sales from diluting the weighted mean
3. **Reduced dateless weight**: Sales without dates changed from 0.25 to 0.10 weight. At 0.25, undated sales had disproportionate influence on cards with few dated sales

---

## Stage 7: Population Report Service

**Commits:** `5469a83`, `ef690f4` (Feb 24)

Introduced the `PopulationReportService` — a separate service that fetches grading population data (how many copies of a card exist at each grade level) and applies a price adjustment.

- **PSA pop scraper**: Scrapes psacard.com pop reports for PSA-graded cards
- **Population data model**: `targetGradePop` (count at this grade), `higherGradePop`, `totalGraded`, `percentile`, `rarityTier`
- **Rarity tiers**: ultra-low (≤5), low (≤25), medium (≤100), high (≤500), very-high (>500)

The initial price adjustment used a **step-function multiplier**:

| Population | Multiplier | Effect |
|-----------|-----------|--------|
| ≤5 | 1.25 | +25% premium |
| ≤25 | 1.15 | +15% premium |
| ≤100 | 1.05 | +5% premium |
| ≤500 | 1.00 | No adjustment |
| >500 | 0.95 | -5% discount |

Pop data is cached in SQLite for 7 days to avoid redundant scraping.

**Impact:** Graded cards with low populations (scarce in that grade) received value premiums, while mass-graded commodity cards got slight discounts. The adjustment is multiplicative, applied after the weighted trimmed mean.

---

## Stage 8: PSA Pop Scraper Rewrite

**Commits:** `fd3c062`, `8bf44bc`, `4bbf706` (Feb 24)

The PSA pop scraper went through two rewrites due to PSA's website structure:

1. **First rewrite** (`fd3c062`): Switched from scraping rendered HTML to using PSA's form-based search endpoint that returns JSON via their internal API
2. **Category threading** (`8bf44bc`): Passed the card's sport category (baseball, basketball, etc.) to the PSA scraper to narrow search results
3. **Second rewrite** (`4bbf706`): Adopted PSA's data format (`PSAData`) and matched against the correct cert lookup response structure

---

## Stage 9: Parallel Fetches + Adaptive Dedup

**Commit:** `815c740` (Feb 25)

Two performance/accuracy improvements:

1. **Parallel adapter execution**: Changed from sequential adapter calls to `Promise.allSettled()` — all 6 adapters run concurrently. A slow or failing adapter no longer blocks the others
2. **Adaptive dedup tolerance**: The fixed $0.50 price tolerance for deduplication was replaced with a dynamic formula:

```
tolerance = max($0.50, avgPrice × 3%)
```

For a $10 card, tolerance is $0.50 (the floor). For a $500 card, tolerance is $15. This prevents false negatives on expensive cards where two reports of the same sale might differ by a few dollars due to rounding or fee inclusion.

---

## Stage 10: 130Point Venue Overlap + Recency Floor

**Commit:** `5c73c06` (Feb 25)

Two deduplication/weighting refinements:

1. **130Point venue overlap**: 130Point is a meta-aggregator — its sales have a venue of "130Point" but could have originally occurred on eBay, Heritage, or elsewhere. The dedup logic was updated to treat `venue === "130point"` as a wildcard that matches any other venue. This prevents the same eBay sale from appearing once via the eBay adapter and again via 130Point

2. **Recency weight floor**: Added a minimum weight of 0.20 so that old sales never drop below 20% influence. Without this, at 90+ days the exponential decay made sales nearly invisible (0.125 at 90 days, 0.0625 at 120 days). For cards with sparse recent data, this preserves older-but-valid pricing signals:

```
weight = max(0.20, 0.5 ^ (ageDays / 30))
```

---

## Stage 11: Tiered Grade Filtering Fallback

**Commit:** `96f6b7c` (Feb 25)

Grade filtering (Stage 5) was too strict for cards with few sales at the exact grade. A tiered fallback was added:

1. First, try exact grade match (±0.5 tolerance)
2. If too few results, expand to ±1.0 grade tolerance
3. If still too few, accept any graded sale from the same grading company

This ensures cards with thin liquidity at a specific grade still get reasonable comps from nearby grades rather than returning no data.

---

## Stage 12: Continuous Pop Multiplier

**Commit:** `bdc39b1` (Feb 25)

Replaced the step-function population multiplier (Stage 7) with a continuous **log₁₀ decay curve**:

```
multiplier = max(0.95, 1.25 - 0.30 × log₁₀(pop) / log₁₀(1000))
```

| Population | Step (old) | Log curve (new) |
|-----------|-----------|-----------------|
| 1 | 1.25 | 1.250 |
| 5 | 1.25 | 1.180 |
| 10 | 1.15 | 1.150 |
| 25 | 1.15 | 1.110 |
| 50 | 1.05 | 1.080 |
| 100 | 1.05 | 1.050 |
| 250 | 1.00 | 1.010 |
| 500 | 1.00 | 0.980 |
| 1000 | 0.95 | 0.950 |
| 5000 | 0.95 | 0.950 |

**Motivation:** The step function created artificial cliffs — a card at pop 5 and pop 6 had very different multipliers (1.25 vs 1.15), despite being nearly identical in scarcity. The log curve provides smooth, continuous price adjustment that better reflects the gradual relationship between supply and value.

The 0.95 floor ensures even mass-graded cards (pop 5000+) retain 95% of their sales-based value. The multiplier never goes below 0.95 because population alone shouldn't halve a card's value — it's one factor among many.

---

## Stage 13: Source Reliability Weights

**Commit:** `5f9dab8` (Feb 25)

Added per-source reliability weights that are multiplied with each sale's recency weight in the weighted mean calculation:

| Source | Weight | Rationale |
|--------|--------|-----------|
| eBay | 1.00 | Primary marketplace, most liquid, prices directly observable |
| PSA | 0.95 | Verified auction prices, but limited to PSA-graded only |
| 130Point | 0.90 | eBay aggregator, slight discount for potential stale/duplicate data |
| MarketMovers | 0.85 | Good coverage but some prices are estimated/interpolated |
| CardLadder | 0.80 | Historical data, may lag current market |
| SportsCardsPro | 0.60 | Market values are often estimates, not observed transactions |

Each sale's composite weight becomes:
```
compositeWeight = recencyWeight × sourceReliability
```

This means an eBay sale from 30 days ago (recency 0.5 × reliability 1.0 = 0.50) outweighs a SportsCardsPro value from today (recency 1.0 × reliability 0.6 = 0.60) only slightly, preserving the recency signal while also accounting for data quality.

---

## Stage 14: Median-Date Proxy for Undated Sales

**Commit:** `0e78b3c` (Feb 25)

Sales without dates had been receiving the harsh fixed penalty weight of 0.10 (Stage 6). This was replaced with a smarter approach:

1. Compute the **median date** of all dated sales in the pool
2. Use that median as a proxy date for undated sales
3. Apply the normal recency decay formula to the proxy date

```typescript
function medianDateMs(sales: NormalizedSale[]): number | null {
  const dates = sales.map(s => s.dateMs).filter(d => d !== null).sort();
  if (dates.length === 0) return null;
  const mid = Math.floor(dates.length / 2);
  return dates.length % 2 === 0
    ? Math.round((dates[mid - 1] + dates[mid]) / 2)
    : dates[mid];
}
```

If no dated sales exist at all, undated sales still receive the 0.10 fixed weight as a final fallback.

**Motivation:** The fixed 0.10 weight was too harsh. Many sources provide recent sales without exact dates. Assuming they're approximately as old as the median of known-date sales is a better heuristic than treating them as nearly worthless.

---

## Stage 15: CGC Pop Scraper + GemRate Fallback

**Commits:** `ffa1302`, `f5c8497`, `f4989ab` (Feb 25)

Expanded population report coverage beyond PSA:

1. **CGC pop scraper** (`cgcPopScraper.ts`): Scrapes CGC's population report page for CGC-graded cards. CGC is the second-most-popular grading company, especially for modern cards
2. **GemRate universal scraper** (`gemratePopScraper.ts`): Scrapes gemrate.com as a universal fallback. GemRate aggregates pop data from multiple grading companies (PSA, BGS, SGC, CGC). Used when no primary scraper exists for a grading company, or when the primary scraper returns no data
3. **Fallback chain**: `PopulationReportService` now accepts an optional `fallbackScraper`. If the primary company-specific scraper returns null, the fallback (GemRate) is tried automatically

Pop scraper roster at this stage:
- **PSA** → `psaPopScraper.ts` (primary for PSA cards)
- **CGC** → `cgcPopScraper.ts` (primary for CGC cards)
- **BGS** → `bgsPopScraper.ts` (primary for BGS/Beckett cards)
- **SGC** → `sgcPopScraper.ts` (primary for SGC cards)
- **GemRate** → `gemratePopScraper.ts` (universal fallback)

---

## Stage 16: Grading Company Normalization + Retry

**Commit:** `0ce486a` (Feb 25)

Minor robustness fix:
- Normalize grading company names before scraper lookup (e.g., `"CGC Cards"` → `"CGC"`, `"PSA/DNA"` → `"PSA"`)
- Add retry logic for pop API calls that fail due to transient network issues

---

## Current Algorithm (Post-Stage 16)

The complete pipeline for generating a comp value:

```
1. Build search query from card metadata (player, year, brand, card #, set, grade)
2. Run all 6 adapters in parallel (Promise.allSettled)
   - SportsCardsPro, eBay, CardLadder, MarketMovers, 130Point, PSA
   - PSA adapter skipped for non-PSA graded cards
   - Each adapter: search → extract sales → grade filter → cache result
3. Pool all individual sales into a single NormalizedSale array
4. Sort by source sales count descending (dedup priority)
5. Deduplicate: price within max($0.50, 3% of avg), date within 2 days, venues overlap
   - "130Point" venue treated as wildcard (matches any venue)
   - Null-date sales never deduped
6. Compute weighted trimmed mean:
   - Recency weight: max(0.20, 0.5^(ageDays/30))
   - Undated sales: use median date of all dated sales as proxy
   - Source reliability: eBay=1.0, PSA=0.95, 130Point=0.9, MM=0.85, CL=0.8, SCP=0.6
   - Composite weight = recencyWeight × sourceReliability
   - Trim 10% of total weight from each tail (if ≥5 sales)
   - Weighted mean of remaining sales
7. Fallback: if no sales, average market values weighted by source reliability
8. Fetch population data (graded cards only):
   - Try primary scraper (PSA/CGC/BGS/SGC) → fallback to GemRate
   - Cache for 7 days
9. Apply pop multiplier: max(0.95, 1.25 - 0.30 × log₁₀(pop) / log₁₀(1000))
10. Output: CompReport with per-source results, aggregate value, pop adjustment
```

### Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `RECENCY_HALF_LIFE_DAYS` | 30 | Exponential decay half-life |
| `MIN_RECENCY_WEIGHT` | 0.20 | Floor for recency weight |
| `UNKNOWN_DATE_WEIGHT` | 0.10 | Fallback weight when no dated sales exist |
| `DEDUP_PRICE_FLOOR` | $0.50 | Minimum dedup price tolerance |
| `DEDUP_PRICE_PERCENT` | 3% | Proportional dedup price tolerance |
| `DEDUP_DATE_TOLERANCE_MS` | 2 days | Date proximity for dedup |
| `TRIM_PERCENTAGE` | 10% | Weight trimmed from each tail |
| `MIN_SALES_FOR_TRIM` | 5 | Minimum sales before trimming applies |
| `POP_CACHE_TTL_MS` | 7 days | Population data cache duration |

---

## Impact Summary

| Metric | Stage 2 (Simple Mean) | Stage 4+ (Weighted) | Change |
|--------|----------------------|---------------------|--------|
| Portfolio total (21 cards) | $3,669.52 | $4,201.60 | +14.5% |
| Cards that increased | — | 14 | — |
| Cards that decreased | — | 3 | — |
| Largest increase | — | Leo De Vries +449.5% | — |
| Largest decrease | — | Saquon Barkley -88.9% | — |

The weighted algorithm generally **increased** valuations because:
- Recency weighting emphasizes recent sales, which trend higher in an appreciating market
- Trimming removes outlier lows (damaged/misidentified sales)
- Deduplication removes double-counted sales that diluted averages

Cards that **decreased** were those where:
- Historical high sales were trimmed as outliers
- Recency decay down-weighted old peak-market sales
- Cross-source dedup removed inflated duplicate entries

---

## Source Files

| File | Role |
|------|------|
| `server/src/services/compService.ts` | Orchestrator + aggregation logic |
| `server/src/services/populationReportService.ts` | Pop data fetching + multiplier |
| `server/src/services/compCacheService.ts` | Adapter result caching (SQLite, 24h TTL) |
| `server/src/services/browserService.ts` | Puppeteer browser management for scrapers |
| `server/src/services/adapters/sportsCardsPro.ts` | SportsCardsPro / PriceCharting adapter |
| `server/src/services/adapters/ebay.ts` | eBay sold listings adapter |
| `server/src/services/adapters/cardLadder.ts` | Card Ladder adapter |
| `server/src/services/adapters/marketMovers.ts` | Market Movers adapter |
| `server/src/services/adapters/oneThirtyPoint.ts` | 130Point adapter |
| `server/src/services/adapters/psa.ts` | PSA Auction Prices adapter |
| `server/src/services/adapters/gradeUtils.ts` | Grade extraction + filtering utilities |
| `server/src/services/adapters/psaPopScraper.ts` | PSA population report scraper |
| `server/src/services/adapters/cgcPopScraper.ts` | CGC population report scraper |
| `server/src/services/adapters/bgsPopScraper.ts` | BGS population report scraper |
| `server/src/services/adapters/sgcPopScraper.ts` | SGC population report scraper |
| `server/src/services/adapters/gemratePopScraper.ts` | GemRate universal fallback scraper |
| `docs/comps-algorithm.md` | Current algorithm reference documentation |
