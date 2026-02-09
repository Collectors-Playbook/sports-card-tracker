# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] - 2026-02-09

### Added
- Collectors Playbook brand identity across frontend UI ([#36](https://github.com/Collectors-Playbook/sports-card-tracker/issues/36), [PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Brand color system as CSS custom properties: navy (`#0f1b2d`) and gold (`#f5a623`) with supporting tokens (`--brand-*`, `--accent-*`, `--text-on-dark`, `--shadow-card`, `--gradient-brand`) ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Inter font via Google Fonts (weights 400/500/600/700) ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Dark navy header with white text, gold accent buttons, pill-shaped stat badges with `rgba` overlays ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Gold `::after` active indicator on navigation items ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Multi-column footer: brand logo + tagline, social icons (X, Instagram, Facebook, Discord, eBay), Quick Links column, Account column, copyright bar ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Marketplace-style card grid: fixed 3-column layout (2-col at 1024px, 1-col at 768px), `aspect-ratio: 3/4` image section, left-aligned card info ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Gold focus rings on search/filter inputs, gold selection ring and accent buttons on card list ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- `logo.png` with transparent corners in header (white border), footer, favicon, and manifest ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))

### Changed
- Auth page background from purple gradient (`#667eea`/`#764ba2`) to brand navy gradient (`#0f1b2d`/`#1a2b45`) ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Auth submit button, focus rings, and toggle links from purple to gold ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Form type selector buttons from purple to gold border/background with navy text ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Global focus outline and spinner from `#007bff` to `var(--accent-color)` ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Header title shortened from "Collectors Playbook Card Tracker" to "Collectors Playbook" ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))
- Theme color from `#000000` to `#0f1b2d` in index.html and manifest.json ([PR #37](https://github.com/Collectors-Playbook/sports-card-tracker/pull/37))

---

## [0.4.0] - 2026-02-09

### Added
- Server-side image processing pipeline with Tesseract.js OCR ([#1](https://github.com/Collectors-Playbook/sports-card-tracker/issues/1), [#7](https://github.com/Collectors-Playbook/sports-card-tracker/issues/7), [#16](https://github.com/Collectors-Playbook/sports-card-tracker/issues/16), [PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- Card text parser with brand, player, team, and feature detection (`cardParserService`) ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- Batch image processing orchestrator with async job support, dedup, and idempotency (`imageProcessingService`) ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- Duplicate card detection during image processing ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- Front/back photo pairing with naming convention ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- Player/team database for lookup validation (`playerDatabase`) ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- Image processing API routes: POST /process (async), POST /process-sync, GET /status ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- Admin user seed script (`server/seed.ts`) ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- 74 new server tests (194 total server tests) ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))

### Changed
- Frontend auth wired to backend JWT API, replacing local in-browser userService ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))
- E2E tests updated to start backend server and seed database ([PR #34](https://github.com/Collectors-Playbook/sports-card-tracker/pull/34))

---

## [0.3.0] - 2026-02-09

### Added
- Auth routes: POST /register, POST /login, GET /me, PUT /profile with JWT tokens and bcrypt password hashing ([#29](https://github.com/Collectors-Playbook/sports-card-tracker/issues/29), [PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33))
- Comp proxy service with stub adapters for SportsCardsPro, eBay, CardLadder, and MarketMovers ([#29](https://github.com/Collectors-Playbook/sports-card-tracker/issues/29), [PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33))
- Comp routes: POST /generate, POST /generate-and-save, GET /:cardId ([PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33))
- Comp-generation job handler for async batch processing via job queue ([PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33))
- `CompSource`, `CompSale`, `CompResult`, `CompReport`, `CompRequest`, `CompAdapter` type interfaces ([PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33))
- `updateUserPassword()` method on Database class ([PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33))
- 27 new backend tests for auth routes, comp service, and comp routes (120 total) ([PR #33](https://github.com/Collectors-Playbook/sports-card-tracker/pull/33))

---

## [0.2.0] - 2026-02-09

### Added
- Express server with TypeScript and SQLite database ([#29](https://github.com/Collectors-Playbook/sports-card-tracker/issues/29), [PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- Card, User, Collection, and Job data models with full CRUD operations ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- Filesystem routes for `raw/`, `processed/`, and log file management ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- Background job queue with SSE real-time status updates ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- Auth middleware: `authenticateToken`, `optionalAuth`, `requireAdmin` ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- Request logging and error handling middleware ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- Health check route with database and filesystem status ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- Environment configuration for local and GCP VM deployment ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- `server-test` CI job in GitHub Actions ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))
- 93 backend tests across 9 suites ([PR #32](https://github.com/Collectors-Playbook/sports-card-tracker/pull/32))

---

## [0.1.0] - 2026-02-09

### Added
- Jest test framework with 354 unit and integration tests across 19 suites ([#30](https://github.com/Collectors-Playbook/sports-card-tracker/issues/30), [PR #31](https://github.com/Collectors-Playbook/sports-card-tracker/pull/31))
- Playwright E2E framework with 15 tests across 4 spec files ([PR #31](https://github.com/Collectors-Playbook/sports-card-tracker/pull/31))
- `fake-indexeddb` for Dexie database testing ([PR #31](https://github.com/Collectors-Playbook/sports-card-tracker/pull/31))
- GitHub Actions CI with test and e2e jobs ([PR #31](https://github.com/Collectors-Playbook/sports-card-tracker/pull/31))
- Coverage thresholds: 40% branches, 50% functions, 45% lines/statements ([PR #31](https://github.com/Collectors-Playbook/sports-card-tracker/pull/31))
- Test helpers: factories, mock browser APIs, `renderWithProviders` ([PR #31](https://github.com/Collectors-Playbook/sports-card-tracker/pull/31))
- React frontend with card collection management, auth, admin dashboard ([initial development](https://github.com/Collectors-Playbook/sports-card-tracker))
- Card detection, text extraction, and image processing services (simulated) ([initial development](https://github.com/Collectors-Playbook/sports-card-tracker))
- Dexie.js IndexedDB database with card, collection, and user stores ([initial development](https://github.com/Collectors-Playbook/sports-card-tracker))
- Recharts data visualization and reporting dashboards ([initial development](https://github.com/Collectors-Playbook/sports-card-tracker))
- Comprehensive PRD and ROADMAP documentation ([initial development](https://github.com/Collectors-Playbook/sports-card-tracker))
