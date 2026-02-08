# Sports Card Collection Tracker - Product Requirements Document

## 1. Overview

A React-based sports card collection management application that runs locally or on a Google Cloud Platform (GCP) VM. The application helps collectors manage their card inventory through image processing, automated comp generation, and eBay store integration for bulk listing uploads.

## 2. Technical Requirements

### 2.1 Platform
- **Framework**: React with TypeScript
- **Runtime**: Must run locally on a developer machine or on a GCP VM
- **Storage**: Local filesystem for image and data files; IndexedDB (Dexie.js) for app state
- **Browser**: Modern browsers (Chrome, Firefox, Edge)

### 2.2 Deployment Options
- **Local**: `npm start` for development; `npm run build` for production static assets
- **GCP VM**: Deployed as a static build served via Nginx or similar, with filesystem access for image processing workflows

## 3. Core Features

### 3.1 Image Processing Pipeline

#### 3.1.1 Raw Image Upload & Evaluation
- Users upload raw card photos into a `raw/` folder
- The system evaluates each image in the `raw/` folder to identify the card content (player name, year, set, card number, manufacturer, etc.)
- Successfully identified images are **copied** to the `processed/` folder and **renamed** based on the card content (e.g., `2023-Topps-Chrome-Mike-Trout-1.jpg`)
- Images that cannot be identified or renamed are logged to `image-error.log` with:
  - Original filename
  - Timestamp
  - Reason for failure (e.g., "Unable to identify card content", "Image too blurry")

#### 3.1.2 Naming Convention
- Format: `{Year}-{Manufacturer}-{Set}-{PlayerName}-{CardNumber}.{ext}`
- Special characters replaced with hyphens
- Spaces replaced with hyphens
- All names normalized to title case

### 3.2 Comp Generation

#### 3.2.1 Data Sources
- **SportsCardsPro.com**: Pull comparable sales data and market values
- **eBay Sold Listings**: Pull recent sold/completed listing data for comparable cards
- **Card Ladder** (https://www.cardladder.com/): 100M+ historical sales aggregated from eBay, Goldin, Heritage, Fanatics, and other marketplaces. Provides Market Efficiency Score, historical indexes, and pop report tracking. Enterprise API available.
- **Market Movers** (https://www.marketmoversapp.com/): Millions of sales records aggregated from major online marketplaces, updated daily. Covers 2M+ cards with real-time pricing data. By Sports Card Investor.

#### 3.2.2 Comp Workflow
- For each card image in the `processed/` folder, the system generates comps by querying all data sources
- Comp data is stored in individual text files in the `processed/` folder, named to match the card image (e.g., `2023-Topps-Chrome-Mike-Trout-1-comps.txt`)
- Each comp file includes:
  - Card identification details
  - SportsCardsPro.com market value / price data
  - eBay sold listing prices (recent sales, date sold, condition/grade)
  - Card Ladder historical sales and Market Efficiency Score
  - Market Movers pricing data and trends
  - Average sale price (across all sources)
  - Price range (low/high)
  - Date comps were generated
- Cards for which comps cannot be located are logged to `comp-error.log` with:
  - Card filename
  - Timestamp
  - Source(s) that failed (SportsCardsPro, eBay, Card Ladder, Market Movers)
  - Reason for failure

### 3.3 eBay Store Integration

#### 3.3.1 eBay Bulk Upload CSV Generation
- The system generates an `ebay-draft-upload-batch.csv` file for uploading to eBay
- The CSV is populated using:
  - Card data extracted from images in the `processed/` directory
  - Comp data from the associated comp text files
  - Column structure and formatting from `eBay-draft-listing-template.csv` (the reference template)
- The template file (`eBay-draft-listing-template.csv`) defines:
  - Required eBay fields and column headers
  - Default values for common fields (shipping, returns policy, etc.)
  - Formatting rules for the CSV

#### 3.3.2 eBay Draft Listing Fields
At minimum, each row in `ebay-draft-upload-batch.csv` should include:
- Title (constructed from card details, max 80 characters per eBay rules)
- Description (detailed card information)
- Category
- Starting price / Buy It Now price (informed by comp data)
- Condition
- Photos (reference to processed image files)
- Shipping details
- Return policy
- Item specifics (Sport, Player, Year, Set, Manufacturer, Card Number, etc.)

#### 3.3.3 eBay Store Connection
- Integration with the user's eBay store for:
  - Listing management
  - Sales tracking
  - Inventory sync

### 3.4 Inventory & Organization

#### 3.4.1 Grading Submission Tracker
- Track cards submitted to grading companies (PSA, BGS, SGC)
- Fields: submission number, grading company, date submitted, expected turnaround, grading tier/cost
- Status tracking: Submitted → Received → Grading → Shipped Back → Complete
- Alert when grades are posted (manual check or API integration when available)
- Track total grading spend and average grade received

#### 3.4.2 Bin/Box/Location Mapping
- Physical storage tracking for cards (e.g., "Box 3, Row 2, Slot 15")
- Hierarchical structure: Room → Shelf → Box → Row → Slot
- Quick lookup: search by card to find physical location
- Bulk assignment: assign multiple cards to the same storage location

#### 3.4.3 Barcode/QR Label Printing
- Generate QR code labels for storage bins and individual cards
- QR codes link back to the card's detail page in the app
- Print-ready label sheets (Avery-compatible templates)
- Scan QR code to quickly pull up card info on mobile

#### 3.4.4 Duplicate Detection
- During image processing, flag when a card already exists in inventory
- Match on player + year + set + card number + manufacturer
- Prompt user: keep both, skip, or merge records
- Duplicate report showing all suspected duplicates in collection

### 3.5 Pricing & Investment

#### 3.5.1 Auto Price Alerts
- Set price thresholds per card (e.g., "Alert when value exceeds $500" or "Alert when value drops below $100")
- Notification system for threshold crossings
- Configurable check frequency (daily, weekly)
- Alert history log

#### 3.5.2 Break-Even Calculator
- Factor in all costs to determine true profit per card:
  - Purchase price
  - Grading fees (submission cost + shipping to grader)
  - eBay fees (12.9% final value fee + $0.30 per order)
  - Shipping cost to buyer (materials + postage)
  - eBay promoted listing fees (if applicable)
  - Sales tax considerations
- Display break-even selling price
- Show net profit at any given sale price

#### 3.5.3 Portfolio Heatmap
- Visual grid of cards color-coded by performance
- Time periods: 7-day, 30-day, 90-day, YTD, all-time
- Green (up) → Yellow (flat) → Red (down) color scale
- Click through to individual card details
- Filter by category, year, set, or grading status

#### 3.5.4 Tax Lot Tracking
- Track cost basis per card (purchase price + grading + fees)
- Record sale proceeds per card
- Calculate capital gains/losses (short-term vs. long-term based on holding period)
- Generate year-end tax summary report
- Export tax data for accountant or tax software (CSV/PDF)

### 3.6 eBay Selling Workflow

#### 3.6.1 Listing Performance Tracker
- Track metrics on active eBay listings: views, watchers, click-through rate
- Identify underperforming listings (low views, no watchers)
- Suggest price adjustments based on views-to-watchers ratio
- Historical listing performance data

#### 3.6.2 Relist Automation
- Auto-detect unsold/expired eBay listings
- Generate updated CSV with adjusted pricing (configurable: reduce by X% or set to new comp value)
- Track relist count per card
- Suggest when to switch from auction to Buy It Now (or vice versa)

#### 3.6.3 Shipping Label Integration
- Pre-fill weight and dimensions based on card type:
  - Raw single card: PWE (1 oz) or BMWT (4 oz)
  - Graded slab: weight by grading company and case size
  - Lots: calculated based on card count
- Shipping cost estimation per listing
- Integration with shipping rate calculators

#### 3.6.4 Sold Item Reconciliation
- Match eBay sold notifications back to inventory records
- Auto-mark cards as sold with sale date and final price
- Calculate actual profit (sale price minus all costs)
- Update portfolio metrics in real time
- Flag discrepancies between expected and actual sale price

### 3.7 Image Processing Enhancements

#### 3.7.1 Front/Back Photo Pairing
- Associate front and back photos of the same card
- Naming convention: `{card-name}-front.{ext}` and `{card-name}-back.{ext}`
- Both images included in eBay listings
- UI to manually pair unpaired images

#### 3.7.2 Auto-Crop and Background Removal
- Detect card edges and crop to card boundaries
- Remove or replace background with clean white/neutral backdrop
- Output eBay-ready images that meet marketplace photo standards
- Preserve original raw images; cropped versions saved separately

#### 3.7.3 Condition Detection
- Analyze card images for visible defects:
  - Centering measurement (left/right, top/bottom ratios)
  - Corner sharpness assessment
  - Surface scratches or print defects
  - Edge wear indicators
- Output estimated condition/grade range
- Flag cards that may not be worth grading

#### 3.7.4 Batch Watermarking
- Add store branding/watermark to images before listing
- Configurable: logo, text, position, opacity
- Apply to all images in a batch export
- Watermarked copies saved separately (originals preserved)

### 3.8 Data & Reporting

#### 3.8.1 PC (Personal Collection) vs. Inventory Split
- Tag cards as "Personal Collection" (never selling) or "Inventory" (for sale)
- Separate dashboard views for each category
- PC cards excluded from eBay CSV generation and selling recommendations
- Portfolio valuation shows both combined and split totals

#### 3.8.2 Sell-Through Rate by Category
- Track which categories sell fastest on eBay
- Metrics by: sport, year, set, manufacturer, graded vs. raw
- Average days to sell per category
- Inform future buying decisions based on sell-through data

#### 3.8.3 Grading ROI Analysis
- For each raw card, project value increase if graded
- Inputs: current raw value, projected graded value by grade (PSA 9, PSA 10, etc.), grading cost
- Expected value calculation based on population report odds
- Recommend: "Grade" / "Don't Grade" / "Borderline" with projected ROI
- Batch analysis: rank all raw cards by grading ROI potential

#### 3.8.4 Monthly P&L Statement
- Revenue: total eBay sales + other platform sales
- COGS: total card purchase costs for sold cards
- Expenses: grading fees, eBay fees, shipping costs, supplies, platform subscriptions
- Net profit/loss with month-over-month trends
- Export as PDF or CSV

### 3.9 Sourcing & Buying

#### 3.9.1 Break Calculator
- Input: hobby box/case price + product checklist
- Calculate expected value (EV) based on current comp data for hits and base cards
- Factor in odds for autographs, memorabilia, numbered parallels
- Show EV vs. cost with profit/loss projection
- Track break results after opening (actual vs. expected)

#### 3.9.2 Want List
- Maintain a list of cards the user is actively looking for
- Fields: player, year, set, card number, max buy price
- Alert when a wanted card appears in comp data below target price
- Track acquisition progress (e.g., "23 of 50 cards in set completed")

#### 3.9.3 Deal Scanner
- Flag underpriced eBay listings based on comp data
- Configurable threshold (e.g., "Alert when listed at 30%+ below market value")
- Filter by category, price range, condition
- Quick-buy recommendations with projected flip ROI

### 3.10 Multi-Channel Selling

#### 3.10.1 Cross-Platform Listing
- Generate upload CSVs for multiple marketplaces:
  - eBay (primary, existing)
  - COMC (Check Out My Cards)
  - MySlabs
  - Fanatics marketplace
- Platform-specific templates and field mappings
- Sync inventory across platforms (mark as sold everywhere when sold on one)

#### 3.10.2 Consignment Tracking
- Track cards sent to consignment shops or breakers
- Fields: consignment partner, date sent, agreed fee split, card list
- Status: Sent → Received → Listed → Sold → Payment Received
- Calculate net proceeds after consignment fees
- Consignment P&L report

## 4. Folder Structure

```
project-root/
├── raw/                              # Raw uploaded card photos (input)
├── processed/                        # Renamed card images + comp text files (output)
│   ├── 2023-Topps-Chrome-Mike-Trout-1.jpg
│   ├── 2023-Topps-Chrome-Mike-Trout-1-comps.txt
│   └── ...
├── eBay-draft-listing-template.csv   # eBay upload template (reference)
├── ebay-draft-upload-batch.csv       # Generated eBay upload file (output)
├── image-error.log                   # Failed image processing log
├── comp-error.log                    # Failed comp generation log
└── src/                              # React application source
```

## 5. Workflow Summary

```
1. User places raw card photos in raw/ folder
   │
2. Image Evaluation & Processing
   ├── Success: Copy to processed/ with content-based filename
   └── Failure: Log to image-error.log
   │
3. Comp Generation
   ├── Query SportsCardsPro.com for each processed card
   ├── Query eBay sold listings for each processed card
   ├── Query Card Ladder for historical sales data
   ├── Query Market Movers for pricing data
   ├── Success: Write comp data to {card}-comps.txt in processed/
   └── Failure: Log to comp-error.log
   │
4. eBay CSV Generation
   ├── Read all card data from processed/
   ├── Read comp data from comp text files
   ├── Apply eBay-draft-listing-template.csv format
   └── Output: ebay-draft-upload-batch.csv
```

## 6. Error Handling

### 6.1 image-error.log Format
```
[YYYY-MM-DD HH:MM:SS] FILENAME: reason for failure
```

### 6.2 comp-error.log Format
```
[YYYY-MM-DD HH:MM:SS] FILENAME: source (SportsCardsPro|eBay|CardLadder|MarketMovers|All) - reason for failure
```

## 7. Non-Functional Requirements

- **Performance**: Image processing and comp generation should handle batches of 100+ cards
- **Portability**: Must work identically on local machines and GCP VMs
- **Resilience**: Failures on individual cards must not halt the batch; errors are logged and processing continues
- **Idempotency**: Re-running the pipeline on the same raw images should not create duplicates in processed/

## 8. Future Considerations

- Mobile app version for on-the-go photo capture and QR code scanning
- Real OCR integration (e.g., Google Cloud Vision API) for card identification
- Backend API for multi-device sync and real-time data
- Social features for collectors (trade offers, showcase collections)
- Direct eBay API integration for automated listing/relisting without CSV
- Machine learning model for condition grading from photos

---
*Last updated: 2026-02-08*
