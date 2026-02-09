# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
