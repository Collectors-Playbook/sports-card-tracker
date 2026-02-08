# Sports Card Tracker - Project Context for Claude

## Project Overview
A React/TypeScript sports card collection management application that runs locally or on a GCP VM. The app processes raw card photos, generates comps from SportsCardsPro.com and eBay sold listings, and produces eBay bulk upload CSVs for store integration.

## Core Workflows

### 1. Image Processing Pipeline
- Raw card photos are placed in the `raw/` folder
- The system evaluates each image to identify card content (player, year, set, manufacturer, card number)
- Successfully identified images are **copied** to `processed/` and **renamed** based on content
  - Naming format: `{Year}-{Manufacturer}-{Set}-{PlayerName}-{CardNumber}.{ext}`
- Images that cannot be identified are logged to `image-error.log`
  - Format: `[YYYY-MM-DD HH:MM:SS] FILENAME: reason for failure`

### 2. Comp Generation
- For each card in `processed/`, comps are pulled from:
  - **SportsCardsPro.com** - market values and price data
  - **eBay Sold Listings** - recent completed sales
  - **Card Ladder** (cardladder.com) - 100M+ historical sales from eBay, Goldin, Heritage, Fanatics, etc. Enterprise API available.
  - **Market Movers** (marketmoversapp.com) - millions of daily-updated sales records across major marketplaces. By Sports Card Investor.
- Comp data is stored as individual text files in `processed/` (e.g., `2023-Topps-Chrome-Mike-Trout-1-comps.txt`)
- Each comp file includes: card details, market values, recent sale prices, Card Ladder historical data, Market Movers pricing, average price across all sources, price range, date generated
- Cards without comps are logged to `comp-error.log`
  - Format: `[YYYY-MM-DD HH:MM:SS] FILENAME: source (SportsCardsPro|eBay|CardLadder|MarketMovers|All) - reason`

### 3. eBay CSV Generation
- Generates `ebay-draft-upload-batch.csv` for eBay bulk upload
- Uses card data from `processed/` directory and comp data from comp text files
- Uses `eBay-draft-listing-template.csv` as the reference template for column structure and formatting
- Each row includes: title, description, category, price (from comps), condition, photos, shipping, return policy, item specifics

### 4. Inventory & Organization
- **Grading Submission Tracker**: Track cards sent to PSA/BGS/SGC with submission #, status (Submitted → Received → Grading → Shipped Back → Complete), turnaround, cost. Alert when grades post.
- **Bin/Box/Location Mapping**: Physical storage tracking (Room → Shelf → Box → Row → Slot). Search by card to find location.
- **Barcode/QR Label Printing**: Generate QR codes linking to card detail pages. Print-ready Avery-compatible label sheets.
- **Duplicate Detection**: Flag during image processing when a card already exists in inventory. Match on player + year + set + card number + manufacturer.

### 5. Pricing & Investment
- **Auto Price Alerts**: Set per-card price thresholds. Notify on threshold crossings (daily/weekly check).
- **Break-Even Calculator**: Factor in purchase price, grading fees, eBay fees (12.9% + $0.30), shipping, promoted listing fees. Show break-even price and net profit at any sale price.
- **Portfolio Heatmap**: Visual grid color-coded by performance (7d, 30d, 90d, YTD, all-time). Filter by category/year/set/grade.
- **Tax Lot Tracking**: Track cost basis per card, record sale proceeds, calculate short-term vs. long-term capital gains. Year-end tax summary export (CSV/PDF).

### 6. eBay Selling Workflow
- **Listing Performance Tracker**: Track views, watchers, click-through rate on active listings. Suggest price adjustments.
- **Relist Automation**: Generate updated CSVs for unsold cards with adjusted pricing (reduce by X% or re-comp). Track relist count.
- **Shipping Label Integration**: Pre-fill weight/dimensions by card type (PWE, BMWT, slab). Shipping cost estimation.
- **Sold Item Reconciliation**: Match eBay sold notifications to inventory. Auto-mark as sold, calculate actual profit, update portfolio.

### 7. Image Processing Enhancements
- **Front/Back Photo Pairing**: Associate front/back photos per card (`{card}-front.ext`, `{card}-back.ext`). Both included in listings.
- **Auto-Crop & Background Removal**: Detect card edges, crop, replace background with clean white. eBay-ready output.
- **Condition Detection**: Analyze images for centering, corner sharpness, surface issues, edge wear. Output estimated grade range.
- **Batch Watermarking**: Add store branding (logo/text) to images. Configurable position and opacity. Originals preserved.

### 8. Data & Reporting
- **PC vs. Inventory Split**: Tag cards as "Personal Collection" (never sell) or "Inventory" (for sale). Separate dashboards. PC excluded from eBay exports.
- **Sell-Through Rate by Category**: Track which sport/year/set/manufacturer sells fastest. Average days to sell.
- **Grading ROI Analysis**: For raw cards, project value increase if graded. Factor in pop report odds and grading cost. Recommend Grade / Don't Grade / Borderline.
- **Monthly P&L Statement**: Revenue, COGS, expenses (grading, eBay fees, shipping, supplies). Net profit with month-over-month trends. PDF/CSV export.

### 9. Sourcing & Buying
- **Break Calculator**: Input box/case price + checklist. Calculate EV based on current comps and hit odds. Track actual vs. expected results.
- **Want List**: Cards you're looking for with max buy price. Alert when found below target. Track set completion progress.
- **Deal Scanner**: Flag underpriced eBay listings based on comp data. Configurable threshold (e.g., 30%+ below market). Show projected flip ROI.

### 10. Multi-Channel Selling
- **Cross-Platform Listing**: Generate CSVs for eBay, COMC, MySlabs, Fanatics. Platform-specific templates. Sync inventory across platforms.
- **Consignment Tracking**: Track cards sent to consignment shops. Fields: partner, date, fee split, status (Sent → Listed → Sold → Payment Received). Consignment P&L report.

## Technical Architecture

### Stack
- **React 18** with TypeScript
- **Dexie.js** for IndexedDB (local app state)
- **Recharts** for data visualization
- **React Router** for navigation
- **Context API** for state management

### Deployment
- **Local**: `npm start` for dev; `npm run build` for production
- **GCP VM**: Static build served via Nginx with filesystem access for image/data workflows

### Key Services
- **Card Detection Service**: Image evaluation, card identification, condition detection
- **Text Extraction Service**: Text parsing from card images
- **Image Processing Service**: Auto-crop, background removal, watermarking, front/back pairing
- **Comp Service**: Queries SportsCardsPro.com, eBay sold listings, Card Ladder, and Market Movers
- **eBay Listing Service**: CSV generation, listing performance tracking, relist automation, sold reconciliation
- **Multi-Channel Export Service**: Generate platform-specific CSVs (eBay, COMC, MySlabs, Fanatics)
- **Pricing Service**: Break-even calculator, price alerts, deal scanner, grading ROI analysis
- **Inventory Service**: Storage location mapping, duplicate detection, PC vs. inventory tagging, QR labels
- **Grading Service**: Submission tracking, status updates, grading ROI projections
- **Reporting Service**: P&L statements, sell-through rates, portfolio heatmap, tax lot tracking
- **Sourcing Service**: Break calculator, want list management, deal scanning
- **Player Database**: Local player information lookup
- **Manufacturer Database**: Card manufacturer details
- **User Service**: Authentication and user management

## Folder Structure
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
├── src/
│   ├── components/                   # React components
│   ├── context/                      # React Context providers
│   ├── services/                     # Business logic services
│   ├── types/                        # TypeScript type definitions
│   ├── utils/                        # Utility functions
│   ├── hooks/                        # Custom React hooks
│   └── db/                           # Database configuration
├── PRD.md                            # Product Requirements Document
└── CLAUDE.md                         # This file
```

## Data Models
- **Basic Card**: Core fields (player, team, year, set, card number, manufacturer)
- **Enhanced Card**: 50+ fields including grading, autographs, memorabilia, investment metrics, market data

## Development Guidelines

### Code Style
- TypeScript with strict mode
- Functional React components with hooks
- CSS modules for styling
- Comprehensive error handling
- No emojis unless requested

### Common Commands
```bash
npm start          # Start development server
npm run build      # Build for production
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript compiler
```

### Error Handling Principles
- Failures on individual cards must not halt the batch pipeline
- All failures logged to appropriate error files (`image-error.log`, `comp-error.log`)
- Re-running the pipeline on the same raw images should not create duplicates in `processed/`

## Business Logic

### eBay Integration
- Connects to user's eBay store for listing management, sales tracking, and sold item reconciliation
- CSV generation uses `eBay-draft-listing-template.csv` as the column/format reference
- Titles max 80 characters per eBay rules
- Pricing informed by SportsCardsPro.com, eBay sold listings, Card Ladder, and Market Movers comps
- Relist unsold cards with adjusted pricing; track relist count
- Shipping pre-filled by card type: PWE (1 oz), BMWT (4 oz), slab (varies by grader)

### Multi-Channel Selling
- eBay (primary), COMC, MySlabs, Fanatics
- Platform-specific CSV templates
- Inventory synced across platforms (sold on one = removed from all)
- Consignment tracking with fee split calculations

### Card Categories
- Baseball, Basketball, Football, Hockey, Soccer, Pokemon, Other

### Investment Logic
- ROI: (currentValue - purchasePrice) / purchasePrice
- Break-even: purchase price + grading fees + eBay fees (12.9% + $0.30) + shipping + promoted listing fees
- Graded cards have higher value/liquidity
- Peak selling season: November-January
- Tax lots: short-term (<1 year) vs. long-term capital gains
- Grading ROI: projected graded value minus raw value minus grading cost, weighted by grade probability

### Inventory Management
- Cards tagged as PC (Personal Collection) or Inventory
- Physical location tracking (Room → Shelf → Box → Row → Slot)
- Duplicate detection on player + year + set + card number + manufacturer
- Want list with target buy prices and set completion tracking

## Debugging & Troubleshooting

### Common Issues
1. **Data not persisting**: Check IndexedDB in browser DevTools
2. **Image processing failures**: Check `image-error.log`
3. **Missing comps**: Check `comp-error.log`
4. **CSV export issues**: Verify `eBay-draft-listing-template.csv` exists and is formatted correctly
5. **Performance**: Large batches (100+ cards) may take time for comp generation

### Useful Tools
- Browser DevTools > Application > IndexedDB
- React Developer Tools extension
- `image-error.log` and `comp-error.log` for pipeline debugging
- Console for error messages

## Known Limitations
- **No Real OCR Yet**: Card detection from photos is simulated (Google Cloud Vision API planned)
- **No Live API Integration**: SportsCardsPro.com, eBay, Card Ladder, and Market Movers comp lookups need API implementation
- **Local Auth Only**: User authentication system is local-only
- **No Backend**: All data stored locally in browser (IndexedDB) and filesystem

---
*Last updated: 2026-02-08*
