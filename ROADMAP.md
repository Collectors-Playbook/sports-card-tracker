# Sports Card Tracker - Roadmap

## Overview

This roadmap organizes all planned work into sequential phases based on dependencies, business value, and technical complexity. Each phase builds on the previous one. Issues link to the [GitHub issue tracker](https://github.com/Collectors-Playbook/sports-card-tracker/issues).

---

## Phase 0: Foundation & Quality (Current State Hardening) -- COMPLETE

**Goal**: Establish a testing foundation and stabilize the existing codebase before adding new features.

| Issue | Feature | Priority | Effort | Status |
|-------|---------|----------|--------|--------|
| [#30](https://github.com/Collectors-Playbook/sports-card-tracker/issues/30) | Unit, integration, and E2E test suite | Critical | Large | Done ([PR #31](https://github.com/Collectors-Playbook/sports-card-tracker/pull/31)) |

**Deliverables**:
- [x] Jest configured with unit tests for all existing services and utilities (354 tests, 19 suites)
- [x] `fake-indexeddb` for Dexie database testing
- [x] Playwright E2E framework installed (15 E2E tests across 4 spec files)
- [x] E2E tests for auth, card CRUD, collections, and navigation workflows
- [x] GitHub Actions CI running tests on every PR (test + e2e jobs)
- [x] Coverage thresholds enforced: 40% branches, 50% functions, 45% lines/statements
- [x] Test helpers: factories, mock browser APIs, renderWithProviders

**Coverage**: 42.8% branches, 56.55% functions, 47.49% lines, 47.02% statements

---

## Phase 1: Backend Service & Core Pipeline

**Goal**: Build the server-side foundation and implement the three core PRD workflows (image processing, comp generation, eBay CSV).

**Dependencies**: None (this is the foundation everything else builds on)

### 1A: Backend Service -- COMPLETE

| Issue | Feature | Priority | Effort | Status |
|-------|---------|----------|--------|--------|
| [#29](https://github.com/Collectors-Playbook/sports-card-tracker/issues/29) | Node.js backend service | Critical | Large | Done ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32), [PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33)) |

**Deliverables**:
- [x] Express server with TypeScript running alongside React frontend
- [x] SQLite database with Card, User, Collection, and Job models
- [x] Filesystem read/write routes for `raw/`, `processed/`, and log files
- [x] API proxy layer with comp adapter stubs (SportsCardsPro, eBay, CardLadder, MarketMovers)
- [x] Background job queue with SSE for real-time pipeline status updates to frontend
- [x] Auth routes: register, login, me, profile with JWT and bcrypt
- [x] Comp routes: generate, generate-and-save, get by cardId
- [x] Environment configuration for local and GCP VM deployment
- [x] Request logging and error handling middleware
- [x] 120 backend tests across 12 suites (93 core + 27 auth/comp)

### 1B: Image Processing Pipeline

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#1](https://github.com/Collectors-Playbook/sports-card-tracker/issues/1) | Filesystem image processing pipeline (raw -> processed) | Critical | Large |
| [#7](https://github.com/Collectors-Playbook/sports-card-tracker/issues/7) | Duplicate card detection | High | Medium |
| [#16](https://github.com/Collectors-Playbook/sports-card-tracker/issues/16) | Front/back photo pairing | Medium | Small |

**Deliverables**:
- `raw/` folder monitoring (manual trigger or file watcher)
- Real OCR integration (Tesseract.js or Google Cloud Vision API)
- Content-based file renaming and copy to `processed/`
- `image-error.log` for failed identifications
- Duplicate detection during processing
- Front/back photo association with naming convention
- Idempotent re-runs (no duplicate files)
- Frontend UI for pipeline status and error log viewing

### 1C: Comp Generation

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#2](https://github.com/Collectors-Playbook/sports-card-tracker/issues/2) | Comp generation (SportsCardsPro, eBay, Card Ladder, Market Movers) | Critical | X-Large |

**Deliverables**:
- API adapters for all four data sources
- Rate limiting and retry logic per API
- Per-card comp text files in `processed/`
- `comp-error.log` for failed lookups
- Partial comp generation (when some sources fail)
- Result caching to avoid redundant API calls
- Frontend UI to view comp data per card

**Blockers**: Requires API access/credentials for SportsCardsPro, eBay Developer Program, Card Ladder enterprise API, and Market Movers.

### 1D: Template-Driven eBay CSV

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#3](https://github.com/Collectors-Playbook/sports-card-tracker/issues/3) | Template-driven eBay CSV + store API connection | Critical | Large |

**Deliverables**:
- `eBay-draft-listing-template.csv` with all required eBay columns and defaults
- Template parser that populates rows from card + comp data
- `ebay-draft-upload-batch.csv` output file
- eBay Developer Program registration and OAuth flow
- eBay API service for listing CRUD, sales tracking, inventory sync

---

## Phase 2: Inventory Management & Organization

**Goal**: Give collectors full control over their physical and digital inventory.

**Dependencies**: Phase 1A (backend for filesystem operations)

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#20](https://github.com/Collectors-Playbook/sports-card-tracker/issues/20) | PC (Personal Collection) vs Inventory split | High | Small |
| [#4](https://github.com/Collectors-Playbook/sports-card-tracker/issues/4) | Grading submission tracker | High | Medium |
| [#5](https://github.com/Collectors-Playbook/sports-card-tracker/issues/5) | Physical storage location mapping | Medium | Medium |
| [#6](https://github.com/Collectors-Playbook/sports-card-tracker/issues/6) | QR code / barcode label printing | Low | Medium |

**Deliverables**:
- PC vs. Inventory tagging with separate dashboards; PC excluded from eBay exports
- Grading submission lifecycle tracking (Submitted -> Complete) with cost tracking
- Hierarchical storage locations (Room -> Shelf -> Box -> Row -> Slot)
- Card-to-location search and bulk assignment
- QR code labels for bins and cards with print-ready Avery templates

---

## Phase 3: Pricing, Fees & Financial Tracking

**Goal**: Give collectors accurate profitability data by accounting for all costs and providing investment analytics.

**Dependencies**: Phase 1C (comp generation for live pricing data)

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#9](https://github.com/Collectors-Playbook/sports-card-tracker/issues/9) | Break-even calculator | High | Medium |
| [#14](https://github.com/Collectors-Playbook/sports-card-tracker/issues/14) | Shipping label integration | High | Medium |
| [#11](https://github.com/Collectors-Playbook/sports-card-tracker/issues/11) | Tax lot tracking | High | Medium |
| [#23](https://github.com/Collectors-Playbook/sports-card-tracker/issues/23) | Monthly P&L statement | Medium | Medium |
| [#22](https://github.com/Collectors-Playbook/sports-card-tracker/issues/22) | Grading ROI analysis | Medium | Medium |

**Deliverables**:
- True break-even calculation: purchase + grading + eBay fees (12.9% + $0.30) + shipping + promos
- Shipping presets by card type (PWE, BMWT, slab by grading company)
- Cost basis tracking per card with short-term vs. long-term capital gains
- Year-end tax summary export (CSV/PDF)
- Monthly P&L: revenue, COGS, itemized expenses, net profit trends
- Grading ROI projections: expected value by grade, population report odds, Grade/Don't Grade recommendation

---

## Phase 4: eBay Selling Optimization

**Goal**: Close the loop between listing, selling, and relisting on eBay.

**Dependencies**: Phase 1D (eBay API connection), Phase 3 (break-even calculator for profit calculations)

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#15](https://github.com/Collectors-Playbook/sports-card-tracker/issues/15) | Sold item reconciliation | High | Medium |
| [#12](https://github.com/Collectors-Playbook/sports-card-tracker/issues/12) | Listing performance tracker | High | Medium |
| [#13](https://github.com/Collectors-Playbook/sports-card-tracker/issues/13) | Relist automation | Medium | Medium |
| [#21](https://github.com/Collectors-Playbook/sports-card-tracker/issues/21) | Sell-through rate by category | Medium | Small |

**Deliverables**:
- eBay sold items matched back to inventory; cards auto-marked as sold
- Actual profit calculated per sale (using break-even from Phase 3)
- Active listing metrics: views, watchers, click-through rate
- Underperforming listing detection with price adjustment suggestions
- Relist CSV generation with configurable price reduction or re-comp
- Sell-through rate analytics by sport, year, set, manufacturer, graded vs. raw

---

## Phase 5: Image Processing Enhancements

**Goal**: Produce eBay-ready card images automatically.

**Dependencies**: Phase 1B (image processing pipeline)

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#17](https://github.com/Collectors-Playbook/sports-card-tracker/issues/17) | Auto-crop and background removal | Medium | Large |
| [#19](https://github.com/Collectors-Playbook/sports-card-tracker/issues/19) | Batch watermarking | Medium | Medium |
| [#18](https://github.com/Collectors-Playbook/sports-card-tracker/issues/18) | Condition detection | Low | X-Large |

**Deliverables**:
- Card edge detection with auto-crop to boundaries
- Background removal/replacement with clean white
- Configurable batch watermarking (logo/text, position, opacity)
- Originals preserved; processed versions saved separately
- Image condition analysis: centering ratios, corner sharpness, surface defects, edge wear
- Estimated grade range per card; "worth grading" flag

**Note**: Condition detection (#18) is the most technically complex feature in the roadmap. It may require training a custom ML model or integrating a third-party computer vision service. Consider a phased approach: start with centering measurement (geometric calculation), then add corner/surface/edge analysis.

---

## Phase 6: Portfolio Intelligence

**Goal**: Give collectors real-time visibility into portfolio performance and market opportunities.

**Dependencies**: Phase 1C (comp generation for live pricing), Phase 3 (financial tracking)

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#10](https://github.com/Collectors-Playbook/sports-card-tracker/issues/10) | Portfolio heatmap | Medium | Medium |
| [#8](https://github.com/Collectors-Playbook/sports-card-tracker/issues/8) | Auto price alerts | Medium | Medium |

**Deliverables**:
- Visual heatmap grid: cards color-coded by performance (7d, 30d, 90d, YTD, all-time)
- Filterable by category, year, set, grading status
- Click-through to card detail
- Per-card price thresholds with configurable check frequency
- Notification system for threshold crossings (in-app + browser notifications)
- Alert history log

---

## Phase 7: Sourcing & Buying Tools

**Goal**: Help collectors find deals and make smarter purchasing decisions.

**Dependencies**: Phase 1C (comp generation for pricing data), Phase 1D (eBay API for listing data)

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#25](https://github.com/Collectors-Playbook/sports-card-tracker/issues/25) | Want list | Medium | Small |
| [#24](https://github.com/Collectors-Playbook/sports-card-tracker/issues/24) | Break calculator | Medium | Medium |
| [#26](https://github.com/Collectors-Playbook/sports-card-tracker/issues/26) | Deal scanner | Low | Large |

**Deliverables**:
- Want list with target buy prices and set completion tracking
- Alerts when wanted cards appear below target price
- Hobby box/case EV calculator based on current comps and hit odds
- Actual vs. expected break result tracking
- eBay active listing scanner flagging underpriced cards (configurable threshold)
- Projected flip ROI per deal

---

## Phase 8: Multi-Channel Expansion

**Goal**: Expand beyond eBay to sell across all major card marketplaces.

**Dependencies**: Phase 4 (eBay selling workflow proven and stable)

| Issue | Feature | Priority | Effort |
|-------|---------|----------|--------|
| [#27](https://github.com/Collectors-Playbook/sports-card-tracker/issues/27) | Cross-platform listing (COMC, MySlabs, Fanatics) | Medium | Large |
| [#28](https://github.com/Collectors-Playbook/sports-card-tracker/issues/28) | Consignment tracking | Low | Medium |

**Deliverables**:
- Platform-specific CSV templates and field mappings for COMC, MySlabs, Fanatics
- Multi-platform export UI with platform selector
- Cross-platform inventory sync (sold on one = removed from all)
- Consignment shipment tracking with fee split management
- Consignment lifecycle: Sent -> Received -> Listed -> Sold -> Payment Received
- Consignment P&L report per partner

---

## Dependency Graph

```
Phase 0: Testing Foundation
    │
Phase 1A: Backend Service ──────────────────────────────┐
    │                                                     │
    ├── Phase 1B: Image Pipeline ── Phase 5: Image Enhancements
    │       │
    │       └── Phase 1C: Comp Generation ──┬── Phase 6: Portfolio Intelligence
    │               │                       │
    │               └── Phase 3: Pricing ───┤
    │                       │               │
    │                       └───────────────┴── Phase 4: eBay Selling
    │                                               │
    ├── Phase 1D: eBay CSV/API ─────────────────────┘
    │                                               │
    ├── Phase 2: Inventory Management               ├── Phase 7: Sourcing & Buying
    │                                               │
    └───────────────────────────────────────────────└── Phase 8: Multi-Channel
```

---

## Effort Estimates

| Size | Approximate Scope |
|------|-------------------|
| Small | 1-3 files changed, single component or service |
| Medium | 3-8 files, new service + UI component + data model |
| Large | 8-15 files, multiple services, API integration, significant UI |
| X-Large | 15+ files, external API research, complex algorithms, ML/CV |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| API access denied or expensive (SportsCardsPro, Card Ladder, Market Movers) | Blocks Phase 1C comp generation | Start with eBay sold listings (free API), add others incrementally |
| eBay API rate limits or restrictions | Limits Phase 4 selling workflow and Phase 7 deal scanner | Implement aggressive caching, batch requests, respect rate limits |
| OCR accuracy too low for reliable card identification | Degrades Phase 1B image pipeline | Use Google Cloud Vision API on GCP; allow manual correction UI |
| Condition detection ML model too complex | Delays Phase 5 | Start with centering only (geometric), defer corner/surface analysis |
| Cross-platform CSV formats change | Breaks Phase 8 multi-channel | Abstract format behind adapter pattern; version templates separately |
| No backend experience on team | Delays Phase 1A | Use Express.js (minimal learning curve for React/TS developers) |

---

## Milestone Summary

| Milestone | Phases | What Users Can Do |
|-----------|--------|-------------------|
| **M0: Quality Gate** | Phase 0 | **COMPLETE** - 354 unit/integration tests, 15 E2E tests, CI pipeline running |
| **M1: Core Pipeline** | Phase 1 | Drop photos in folder -> get comps -> get eBay CSV. **Phase 1A complete**: backend service with auth, comp proxy, job queue, 120 tests. |
| **M2: Full Inventory** | Phase 2 | Track grading submissions, find cards physically, tag PC vs. inventory |
| **M3: True Profitability** | Phase 3 | Know actual profit per card after all fees. Tax-ready reports. |
| **M4: Sell Smarter** | Phase 4 | See what's selling, what's not, auto-relist, track sold items |
| **M5: Pro Images** | Phase 5 | Auto-cropped, watermarked, eBay-ready photos with condition estimates |
| **M6: Market Intelligence** | Phase 6 | Portfolio heatmap, price alerts, real-time market visibility |
| **M7: Buy Smarter** | Phase 7 | Find deals, track wants, calculate break EV |
| **M8: Everywhere** | Phase 8 | Sell on eBay, COMC, MySlabs, Fanatics from one app |

---

*Last updated: 2026-02-09*
