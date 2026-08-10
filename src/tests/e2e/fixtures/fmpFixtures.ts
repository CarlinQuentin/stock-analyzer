/**
 * Deterministic Raw FMP API Fixtures for E2E Data Mapping Tests (Layer 1)
 *
 * IMPORTANT DESIGN PRINCIPLE:
 * Related fields use DELIBERATELY DISTINCTIVE values so tests prove exactly
 * which FMP field is being extracted and processed by the application.
 */

/** Raw FMP Income Statement Response (5 years) */
export const mockRawFmpIncomeStatements = [
  {
    date: "2025-12-31",
    symbol: "AAPL",
    revenue: 10000000000,
    grossProfit: 6000000000,
    operatingIncome: 3000000000,
    netIncome: 1800000000,
    eps: 12.5,
    epsdiluted: 12.5,
    weightedAverageShsOutDil: 160000000,
    weightedAverageShsOut: 150000000,
    weightedAverageSharesDiluted: 160000000,
    weightedAverageSharesOutstanding: 150000000,
  },
  {
    date: "2024-12-31",
    symbol: "AAPL",
    revenue: 9000000000,
    grossProfit: 5400000000,
    operatingIncome: 2700000000,
    netIncome: 1620000000,
    eps: 11.25,
    epsdiluted: 11.25,
    weightedAverageShsOutDil: 165000000,
    weightedAverageShsOut: 155000000,
    weightedAverageSharesDiluted: 165000000,
    weightedAverageSharesOutstanding: 155000000,
  },
  {
    date: "2023-12-31",
    symbol: "AAPL",
    revenue: 8000000000,
    grossProfit: 4800000000,
    operatingIncome: 2400000000,
    netIncome: 1440000000,
    eps: 10.0,
    epsdiluted: 10.0,
    weightedAverageShsOutDil: 170000000,
    weightedAverageShsOut: 160000000,
    weightedAverageSharesDiluted: 170000000,
    weightedAverageSharesOutstanding: 160000000,
  },
  {
    date: "2022-12-31",
    symbol: "AAPL",
    revenue: 7000000000,
    grossProfit: 4200000000,
    operatingIncome: 2100000000,
    netIncome: 1260000000,
    eps: 8.75,
    epsdiluted: 8.75,
    weightedAverageShsOutDil: 175000000,
    weightedAverageShsOut: 165000000,
    weightedAverageSharesDiluted: 175000000,
    weightedAverageSharesOutstanding: 165000000,
  },
  {
    date: "2021-12-31",
    symbol: "AAPL",
    revenue: 6000000000,
    grossProfit: 3600000000,
    operatingIncome: 1800000000,
    netIncome: 1080000000,
    eps: 7.5,
    epsdiluted: 7.5,
    weightedAverageShsOutDil: 180000000,
    weightedAverageShsOut: 170000000,
    weightedAverageSharesDiluted: 180000000,
    weightedAverageSharesOutstanding: 170000000,
  },
];

/** Raw FMP Balance Sheet Response (5 years) */
export const mockRawFmpBalanceSheets = [
  {
    date: "2025-12-31",
    symbol: "AAPL",
    totalAssets: 25000000000,
    totalDebt: 5000000000,
    totalEquity: 10000000000,
    totalStockholdersEquity: 10000000000,
    cashAndCashEquivalents: 1200000000,
    commonStockSharesIssued: 185000000,
  },
  {
    date: "2024-12-31",
    symbol: "AAPL",
    totalAssets: 23000000000,
    totalDebt: 5500000000,
    totalEquity: 9000000000,
    totalStockholdersEquity: 9000000000,
    cashAndCashEquivalents: 1100000000,
    commonStockSharesIssued: 190000000,
  },
  {
    date: "2023-12-31",
    symbol: "AAPL",
    totalAssets: 21000000000,
    totalDebt: 6000000000,
    totalEquity: 8000000000,
    totalStockholdersEquity: 8000000000,
    cashAndCashEquivalents: 1000000000,
    commonStockSharesIssued: 195000000,
  },
  {
    date: "2022-12-31",
    symbol: "AAPL",
    totalAssets: 19000000000,
    totalDebt: 6500000000,
    totalEquity: 7000000000,
    totalStockholdersEquity: 7000000000,
    cashAndCashEquivalents: 900000000,
    commonStockSharesIssued: 200000000,
  },
  {
    date: "2021-12-31",
    symbol: "AAPL",
    totalAssets: 17000000000,
    totalDebt: 7000000000,
    totalEquity: 6000000000,
    totalStockholdersEquity: 6000000000,
    cashAndCashEquivalents: 800000000,
    commonStockSharesIssued: 205000000,
  },
];

/** Raw FMP Cash Flow Statement Response (5 years) */
export const mockRawFmpCashFlowStatements = [
  {
    date: "2025-12-31",
    symbol: "AAPL",
    operatingCashFlow: 2600000000,
    capitalExpenditure: -500000000,
    freeCashFlow: 2100000000,
  },
  {
    date: "2024-12-31",
    symbol: "AAPL",
    operatingCashFlow: 2350000000,
    capitalExpenditure: -450000000,
    freeCashFlow: 1900000000,
  },
  {
    date: "2023-12-31",
    symbol: "AAPL",
    operatingCashFlow: 2100000000,
    capitalExpenditure: -400000000,
    freeCashFlow: 1700000000,
  },
  {
    date: "2022-12-31",
    symbol: "AAPL",
    operatingCashFlow: 1850000000,
    capitalExpenditure: -350000000,
    freeCashFlow: 1500000000,
  },
  {
    date: "2021-12-31",
    symbol: "AAPL",
    operatingCashFlow: 1600000000,
    capitalExpenditure: -300000000,
    freeCashFlow: 1300000000,
  },
];

/** Raw FMP Company Profile Response */
export const mockRawFmpProfile = [
  {
    symbol: "AAPL",
    price: 185.5,
    beta: 1.25,
    volAvg: 55000000,
    mktCap: 2850000000000,
    marketCap: 2850000000000,
    lastDiv: 0.96,
    range: "165.0-199.5",
    changes: 2.5,
    companyName: "Apple Inc.",
    currency: "USD",
    cik: "0000320193",
    isin: "US0378331005",
    cusip: "037833100",
    exchange: "NASDAQ Global Select Market",
    exchangeShortName: "NASDAQ",
    industry: "Consumer Electronics",
    website: "https://www.apple.com",
    description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.",
    ceo: "Tim Cook",
    sector: "Technology",
    country: "US",
    fullTimeEmployees: "164000",
    phone: "408-996-1010",
    address: "One Apple Park Way",
    city: "Cupertino",
    state: "CA",
    zip: "95014",
    dcfDiff: 15.2,
    dcf: 190.5,
    image: "https://financialmodelingprep.com/image-stock/AAPL.png",
    ipoDate: "1980-12-12",
    defaultImage: false,
    isEtf: false,
    isActivelyTrading: true,
    isAdr: false,
    isFund: false,
  },
];

/** Raw FMP Ratios TTM Response */
export const mockRawFmpRatiosTTM = [
  {
    dividendYieldTTM: 0.015,
    dividendPerShareTTM: 0.96,
    dividendPayoutRatioTTM: 0.15,
  },
];

/** Raw FMP Dividends Response */
export const mockRawFmpDividends = [
  {
    date: "2025-11-10",
    label: "November 10, 25",
    adjDividend: 0.25,
    dividend: 0.25,
    recordDate: "2025-11-10",
    paymentDate: "2025-11-13",
    declarationDate: "2025-11-01",
    yield: 0.005,
    frequency: "Quarterly",
  },
  {
    date: "2025-08-11",
    label: "August 11, 25",
    adjDividend: 0.25,
    dividend: 0.25,
    recordDate: "2025-08-11",
    paymentDate: "2025-08-14",
    declarationDate: "2025-08-01",
    yield: 0.005,
    frequency: "Quarterly",
  },
];

/** Raw FMP Key Metrics Response */
export const mockRawFmpKeyMetrics = [
  {
    date: "2025-12-31",
    peRatio: 28.5,
    priceToSalesRatio: 7.2,
    evToSales: 7.5,
    pfcfRatio: 32.1,
    priceToFreeCashFlowsRatio: 32.1,
  },
  {
    date: "2024-12-31",
    peRatio: 26.0,
    priceToSalesRatio: 6.8,
    evToSales: 7.0,
    pfcfRatio: 30.0,
    priceToFreeCashFlowsRatio: 30.0,
  },
];

/** Raw FMP Financial Ratios Response */
export const mockRawFmpFinancialRatios = [
  {
    date: "2025-12-31",
    priceToEarningsRatio: 28.5,
    priceEarningsRatio: 28.5,
    priceToSalesRatio: 7.2,
    priceToFreeCashFlowsRatio: 32.1,
    priceToFreeCashFlowRatio: 32.1,
  },
  {
    date: "2024-12-31",
    priceToEarningsRatio: 26.0,
    priceEarningsRatio: 26.0,
    priceToSalesRatio: 6.8,
    priceToFreeCashFlowsRatio: 30.0,
    priceToFreeCashFlowRatio: 30.0,
  },
];

/** Raw FMP Key Executives Response */
export const mockRawFmpKeyExecutives = [
  {
    title: "Chief Executive Officer & Director",
    name: "Tim Cook",
    pay: 63209845,
    currencyPay: "USD",
    gender: "male",
    yearBorn: 1960,
    titlePay: "CEO",
  },
  {
    title: "Chief Financial Officer",
    name: "Luca Maestri",
    pay: 26950000,
    currencyPay: "USD",
    gender: "male",
    yearBorn: 1963,
    titlePay: "CFO",
  },
];

/** Raw FMP Stock Peers Response */
export const mockRawFmpStockPeers = [
  {
    symbol: "AAPL",
    peersList: ["MSFT", "GOOGL", "AMZN", "NVDA"],
  },
];

/** Raw FMP Stock Screener Response */
export const mockRawFmpStockScreener = [
  {
    symbol: "MSFT",
    companyName: "Microsoft Corporation",
    marketCap: 3100000000000,
    price: 415.2,
    sector: "Technology",
    industry: "Software - Infrastructure",
  },
  {
    symbol: "GOOGL",
    companyName: "Alphabet Inc.",
    marketCap: 2100000000000,
    price: 175.8,
    sector: "Technology",
    industry: "Internet Content & Information",
  },
];

/** Raw FMP Historical Price EOD Response */
export const mockRawFmpHistoricalPrices = [
  {
    date: "2025-12-31",
    open: 184.0,
    high: 186.5,
    low: 183.5,
    close: 185.5,
    volume: 45000000,
    change: 1.5,
    changePercent: 0.815,
  },
  {
    date: "2025-12-30",
    open: 182.0,
    high: 184.5,
    low: 181.5,
    close: 184.0,
    volume: 40000000,
    change: 2.0,
    changePercent: 1.098,
  },
];

/** Raw FMP Analyst Estimates Response */
export const mockRawFmpAnalystEstimates = [
  {
    symbol: "AAPL",
    date: "2026-12-31",
    epsAvg: 8.8,
    epsHigh: 9.5,
    epsLow: 8.2,
    numAnalystsEps: 29,
    revenueAvg: 477480180873,
    revenueHigh: 500000000000,
    revenueLow: 450000000000,
    numAnalystsRevenue: 28,
    ebitdaAvg: 156400000000,
    ebitdaHigh: 170000000000,
    ebitdaLow: 145000000000,
  },
  {
    symbol: "AAPL",
    date: "2027-12-31",
    epsAvg: 9.6,
    epsHigh: 10.5,
    epsLow: 8.9,
    numAnalystsEps: 31,
    revenueAvg: 520726659294,
    revenueHigh: 550000000000,
    revenueLow: 490000000000,
    numAnalystsRevenue: 30,
    ebitdaAvg: 172000000000,
    ebitdaHigh: 185000000000,
    ebitdaLow: 160000000000,
  },
];

/** Raw FMP Price Target Consensus Response */
export const mockRawFmpPriceTargetConsensus = [
  {
    symbol: "AAPL",
    targetHigh: 400,
    targetLow: 245,
    targetConsensus: 337.43,
    targetMedian: 355,
  },
];

/** Raw FMP Price Target Summary Response */
export const mockRawFmpPriceTargetSummary = [
  {
    symbol: "AAPL",
    lastMonthCount: 12,
    lastMonthAvgPriceTarget: 324.06,
    lastQuarterCount: 18,
    lastQuarterAvgPriceTarget: 332.15,
    lastYearCount: 70,
    lastYearAvgPriceTarget: 306.06,
  },
];

/** Raw FMP Price Target News Response */
export const mockRawFmpPriceTargetNews = [
  {
    symbol: "AAPL",
    publishedDate: "2026-07-31T10:36:01.000Z",
    newsTitle: "Apple price target raised to $350 from $310 at Wells Fargo",
    priceTarget: 350,
    priceWhenPosted: 313.33,
    newsPublisher: "TheFly",
    analystCompany: "Wells Fargo",
  },
];

/** Raw FMP Analyst Rating Grades Response */
export const mockRawFmpGrades = [
  {
    symbol: "AAPL",
    date: "2026-07-31",
    gradingCompany: "JP Morgan",
    previousGrade: "Overweight",
    newGrade: "Overweight",
    action: "maintain",
  },
];
