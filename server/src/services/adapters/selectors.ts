/**
 * Centralized CSS selectors for comp scraping sites.
 * When a site changes its DOM structure, update selectors here only.
 */

export const EBAY_SELECTORS = {
  /** Container for each sold listing result */
  itemContainer: 'ul.srp-results > li[data-viewport]',
  /** Item title text — targets the actual title span, not badges like "New Listing" */
  itemTitle: '.s-card__title .su-styled-text.primary',
  /** Sold price element */
  itemPrice: '.s-card__price',
  /** Sold date label (e.g., "Sold  Feb 23, 2026") */
  itemDate: '.s-card__caption .su-styled-text.positive',
  /** "Results matching fewer words" separator — stop scraping past this */
  resultsSeparator: '.srp-river-answer--REWRITE_START',
};

export const SPORTSCARDSPRO_SELECTORS = {
  /** Search result links on the search page (PriceCharting/SportsCardsPro DOM) */
  resultLink: '#games_table td.title a',
  /** Price value on the detail page */
  priceValue: '#full-prices td.price',
  /** Price table rows containing grade/condition prices */
  priceTableRow: '#full-prices table tr',
  /** Recent sales rows on the detail page */
  recentSaleRow: '#game-page .tab-frame tbody tr',
  /** Sale price cell within a row */
  salePrice: 'td.price',
  /** Sale date cell within a row */
  saleDate: 'td:first-child',
};

export const CARDLADDER_SELECTORS = {
  /** Search input field */
  searchInput: 'input[type="search"], input[placeholder*="Search"]',
  /** Search result card/link */
  resultCard: '.card-result, .search-result a',
  /** Historical sale price element */
  salePrice: '.sale-price, .price',
  /** Historical sale date element */
  saleDate: '.sale-date, .date',
  /** Market value display */
  marketValue: '.market-value, .current-value',
};

export const PSA_SELECTORS = {
  /** Search input field on the auction prices page */
  searchInput: 'input[type="text"][name="q"], input[type="search"]',
  /** Search submit button */
  searchSubmit: 'button[type="submit"], input[type="submit"]',
  /** Search result row/link in the results table */
  resultRow: '.results-table tbody tr, .auction-prices-results a',
  /** Result link to the detail page */
  resultLink: '.results-table tbody tr a, .auction-prices-results a',
  /** Sales table on the detail page */
  salesTable: 'table.table tbody tr, .auction-prices-detail table tbody tr',
  /** Sale date cell */
  saleDate: 'td:nth-child(1)',
  /** Sale grade cell */
  saleGrade: 'td:nth-child(2)',
  /** Sale qualifier cell */
  saleQualifier: 'td:nth-child(3)',
  /** Sale price cell */
  salePrice: 'td:nth-child(4)',
  /** Auction house cell */
  saleAuctionHouse: 'td:nth-child(5)',
  /** Seller cell */
  saleSeller: 'td:nth-child(6)',
  /** Cert number cell */
  saleCertNumber: 'td:nth-child(7)',
};

export const MARKETMOVERS_SELECTORS = {
  /** WordPress login username field */
  wpLoginUsername: '#user_login',
  /** WordPress login password field */
  wpLoginPassword: '#user_pass',
  /** WordPress login submit button */
  wpLoginSubmit: '#wp-submit',
};
