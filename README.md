# 🏆 Sports Card Tracker

A comprehensive web application for managing and tracking sports card collections. Built with React, TypeScript, and modern web technologies, featuring advanced analytics, professional reporting, and eBay integration.

![Tests](https://github.com/Collectors-Playbook/sports-card-tracker/actions/workflows/test.yml/badge.svg)
[![codecov](https://codecov.io/gh/Collectors-Playbook/sports-card-tracker/branch/main/graph/badge.svg)](https://codecov.io/gh/Collectors-Playbook/sports-card-tracker)
![GitHub last commit](https://img.shields.io/github/last-commit/Collectors-Playbook/sports-card-tracker)
![GitHub issues](https://img.shields.io/github/issues/Collectors-Playbook/sports-card-tracker)
![GitHub pull requests](https://img.shields.io/github/issues-pr/Collectors-Playbook/sports-card-tracker)
![GitHub stars](https://img.shields.io/github/stars/Collectors-Playbook/sports-card-tracker)
![GitHub forks](https://img.shields.io/github/forks/Collectors-Playbook/sports-card-tracker)
![GitHub repo size](https://img.shields.io/github/repo-size/Collectors-Playbook/sports-card-tracker)
![License](https://img.shields.io/github/license/Collectors-Playbook/sports-card-tracker)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

![Version](https://img.shields.io/badge/version-0.7.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![React](https://img.shields.io/badge/react-18.x-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)
![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-blue.svg)
![Recharts](https://img.shields.io/badge/recharts-data%20viz-orange.svg)
![Jest](https://img.shields.io/badge/tested%20with-jest-99424f.svg)
![Playwright](https://img.shields.io/badge/e2e-playwright-2EAD33.svg)
![ESLint](https://img.shields.io/badge/code%20style-eslint-4B32C3.svg)

## 📋 Table of Contents

- [Features](#-features)
- [What's New](#-whats-new)
- [Getting Started](#-getting-started)
- [Documentation](#-documentation)
- [Technologies](#-technologies)
- [Contributing](#-contributing)
- [Support](#-support)

## ✨ Features

### 👥 Multi-User Support

- **User Authentication**: Secure login and registration system
- **Role-Based Access**: Admin and regular user roles
- **Personal Collections**: Each user has their own card collection
- **Admin Dashboard**: Comprehensive admin tools for user management

### 📦 Collection Management

- **Smart Card Entry**: Classic and Enhanced forms with 100+ fields
- **Photo-Based Entry**: Upload card photos for automatic data extraction
- **Collections Feature**: Organize cards into custom collections
- **Bulk Import**: CSV import for large collections
- **Advanced Search**: Multi-criteria filtering and search
- **Image Management**: High-resolution image support (up to 100MB)
- **Grading Integration**: PSA, BGS, SGC, and other major grading companies

### 📊 Professional Reporting Suite

- **Executive Dashboard**: High-level KPIs and strategic insights
- **Tax Reports**: IRS-compliant capital gains/losses documentation
- **Insurance Appraisals**: Professional valuations for coverage
- **Portfolio Analytics**: ROI tracking and performance metrics
- **Market Analysis**: Trends, comparisons, and opportunities
- **Custom Reports**: Flexible date ranges and filters

### 💰 eBay Integration

- **Professional Listing Generator**: Create optimized eBay listings instantly
- **Smart Title Builder**: 80-character titles with key features
- **HTML Descriptions**: Beautiful, mobile-responsive templates
- **Bulk Export**: Generate listings for multiple cards at once
- **File Exchange Ready**: CSV export for eBay bulk upload
- **AI-Powered Recommendations**: Smart listing suggestions with scoring
- **Price Optimization**: Market-based pricing suggestions

### 📈 Analytics & Insights

- **Real-Time Dashboard**: Live portfolio metrics and charts
- **Performance Tracking**: ROI, win rates, and growth trends
- **Category Analysis**: Breakdown by sport, brand, and player
- **Risk Assessment**: Concentration and volatility metrics
- **Investment Tools**: Hold/sell recommendations

### 🎨 Modern UI/UX

- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Dark Mode**: Eye-friendly viewing (coming soon)
- **Interactive Charts**: Powered by Recharts
- **Drag & Drop**: Intuitive card organization
- **Quick Actions**: Streamlined workflows
- **Collection Icons**: Customizable emojis for collection organization

### 💾 Data Management

- **Local Storage**: All data stored locally using IndexedDB
- **Backup & Restore**: Manual and automatic backup options
- **Export Options**: CSV, JSON, and custom formats
- **Import Tools**: Bulk import from CSV files
- **Data Migration**: Seamless upgrades between versions

## 🆕 What's New (v0.7.0)

### 🛒 Server-Side eBay CSV Generation

- **Backend Export Service**: Full server-side eBay File Exchange CSV generation with title/description generation, category/condition mapping, and CSV escaping
- **eBay Template**: `eBay-draft-listing-template.csv` with 24-column eBay File Exchange headers
- **Export API Routes**: Sync and async generation, download, template retrieval, and status endpoints
- **UI Toggle**: "Generate on server" option in BulkEbayExport with loading state, keeping all client-side export paths unchanged
- **PC Card Exclusion**: Personal Collection cards excluded at the server-side export layer
- **API Sync**: Cards from the backend API now sync into Dexie on load via `useApi` hook
- **Test Coverage**: 21 new backend tests (12 service unit + 9 route integration), bringing total to 217 server tests across 18 suites

## 📚 Previous Updates

### v0.6.0 - PC vs Inventory Split

- **Collection Type Tagging**: Cards tagged as Personal Collection (PC) or Inventory
- **Dashboard Filtering**: Toggle tabs for All / Inventory / Personal Collection with filtered stats
- **CardList Filter**: Dropdown filter for collection type
- **Form Integration**: Type selector on Classic, Enhanced, and Photo card forms
- **eBay Exclusion**: PC cards excluded from all eBay exports and listing recommendations
- **Backend Support**: `collectionType` query param filter on GET `/cards`

### v0.5.0 - Collectors Playbook Brand Redesign

- Brand redesign and UI refresh

### v0.4.0 - Image Processing Pipeline

- Photo-based card entry with OCR
- Card detection and text extraction services
- Front and back image support

### v0.3.0 - Auth Routes & Comp Proxy Layer

- Authentication routes and user management
- Comp proxy layer for price data

## 🚀 Getting Started

### Prerequisites

- Node.js 16.0 or higher
- npm or yarn
- Modern web browser

### Quick Install

```bash
# Clone the repository
git clone https://github.com/Collectors-Playbook/sports-card-tracker.git
cd sports-card-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

### First Steps

1. Create an account or use demo credentials
2. Add your first card using the intuitive form (Classic, Enhanced, or Photo)
3. Organize cards into collections
4. Explore the dashboard to see your collection metrics
5. Generate professional reports or eBay listings

### Default Admin Access

For admin features, use:
- Email: `admin@sportscard.local`
- Password: `admin123`

For detailed setup instructions, see our [Installation Guide](docs/guides/installation.md).

## 📖 Documentation

### 📚 User Guides

- [Quick Start Guide](docs/guides/quick-start.md) - Get running in 5 minutes
- [Adding Cards Guide](docs/guides/adding-cards.md) - Master card entry
- [Reports Overview](docs/features/reports.md) - Generate professional reports
- [eBay Integration](docs/features/ebay-integration.md) - Optimize your listings

### 🔧 Technical Docs

- [API Reference](docs/api/README.md) - Backend API documentation
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Troubleshooting](docs/guides/troubleshooting.md) - Common issues
- [FAQ](docs/guides/faq.md) - Frequently asked questions

### 🎯 Feature Guides

- [Dashboard Overview](docs/features/dashboard.md)
- [Executive Dashboard](docs/features/executive-dashboard.md)
- [Tax Reports](docs/features/tax-reports.md)
- [Insurance Reports](docs/features/insurance-reports.md)

## 🛠️ Technologies

### Frontend

- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Dexie.js** - IndexedDB wrapper for local storage
- **Recharts** - Beautiful data visualizations
- **CSS3** - Modern styling with gradients and animations
- **Context API** - State management

### Storage

- **IndexedDB** - Primary data storage via Dexie.js
- **LocalStorage** - User preferences and settings
- **SessionStorage** - Temporary state management

### Backend (Optional)

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **JWT** - Authentication

### Tools & Libraries

- **date-fns** - Date manipulation
- **jsPDF** - PDF generation
- **Concurrently** - Process management
- **ESLint/Prettier** - Code quality

## 📁 Project Structure

```
sports-card-tracker/
├── docs/                   # Comprehensive documentation
│   ├── api/               # API reference
│   ├── features/          # Feature guides
│   ├── guides/            # User guides
│   └── screenshots/       # UI screenshots
├── public/                # Static assets
├── server/                # Backend server (optional)
├── src/                   # Frontend source
│   ├── components/        # React components
│   │   ├── Dashboard/     # Main dashboard
│   │   ├── AdminDashboard/# Admin tools
│   │   ├── Reports/       # Reporting suite
│   │   ├── CardForm/      # Card entry forms
│   │   ├── Collections/   # Collections management
│   │   ├── About/         # About page
│   │   └── EbayListings/  # eBay tools
│   ├── context/           # State management
│   ├── db/                # Database layer (Dexie)
│   ├── services/          # Business logic
│   ├── types/             # TypeScript types
│   └── utils/             # Utilities
└── README.md              # You are here!
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Guide

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
```

## 📈 Roadmap

### Coming Soon

- [ ] Mobile app (iOS/Android)
- [ ] Automatic price updates via API integration
- [ ] Social features and trading
- [x] AI card recognition (Photo-based entry added!)
- [ ] Direct eBay API integration
- [x] Multi-user collections (Added in v2.2.0!)
- [ ] Dark mode theme
- [ ] Cloud sync and backup
- [ ] Advanced search with filters

### Future Enhancements

- Blockchain authentication
- NFT integration
- Advanced AI analytics
- Voice commands
- AR card viewing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Sports card collecting community
- Open source contributors
- Beta testers and early adopters
- UI/UX design inspiration from modern web apps

## 📞 Support

### Get Help

- 📖 [Documentation](docs/README.md)
- ❓ [FAQ](docs/guides/faq.md)
- 🐛 [Issue Tracker](https://github.com/Collectors-Playbook/sports-card-tracker/issues)
- 💬 [Discussions](https://github.com/Collectors-Playbook/sports-card-tracker/discussions)
- 📧 Email: sct-support@collectorsplaybook.com

<!-- ### Community

- [Discord Server](https://discord.gg/sportscards)
- [Reddit Community](https://reddit.com/r/sportscardtracker)
- [Twitter Updates](https://twitter.com/sportscardtrack) -->

---

<div align="center">

**[Live Demo](https://sportscardtracker.com)** | **[Documentation](docs/README.md)** | **[Report Bug](https://github.com/Collectors-Playbook/sports-card-tracker/issues)** | **[Request Feature](https://github.com/Collectors-Playbook/sports-card-tracker/issues)**

Made with ❤️ by collectors, for collectors

**Version**: 0.7.0 | **Last Updated**: February 2026

</div>
