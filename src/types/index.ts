export interface CompanyProfile {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  website?: string;
  description?: string;
  image?: string;
  mktCap?: number;
  price?: number;
}

export interface CompanySearchResult {
  symbol: string;
  name: string;
  currency?: string;
  exchange?: string;
  exchangeFullName?: string;
}

export interface FinancialStatement {
  date: string;
  revenue?: number;
  netIncome?: number;
  operatingCashFlow?: number;
  capitalExpenditure?: number;
  shares?: number;
  weightedAverageShsOutDil?: number;
  weightedAverageShsOut?: number;
  eps?: number;
  totalAssets?: number;
  totalDebt?: number;
  totalEquity?: number;
  grossProfit?: number;
  operatingIncome?: number;
  dividend?: number;
  dividendYield?: number;
  dividendPerShare?: number;
  dividendPayoutRatio?: number;
  dividendFrequency?: "Monthly" | "Quarterly" | "Semiannual" | "Annual";
  cashAndCashEquivalents?: number;
}

export interface DividendMetrics {
  dividendYield: number | null;
  dividendPerShare: number | null;
  dividendPayoutRatio: number | null;
}

export interface ValuationMetrics {
  peRatio: number | null;
  priceToSalesRatio: number | null;
  evToSales: number | null;
  priceToFreeCashFlowsRatio: number | null;
  historicalPeAverage: number | null;
  historicalPsAverage: number | null;
  historicalEvsAverage: number | null;
  historicalPfcfAverage: number | null;
  averagePremium: number | null;
}

export interface ValuationScores {
  pe: number | null;
  ps: number | null;
  evs: number | null;
  pfcf: number | null;
  historical: number | null;
}

export interface HistoricalPricePoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  change?: number;
  changePercent?: number;
}

export type MetricCategory = "universalScoreMetrics" | "informationalMetrics" | "industryScoreMetrics";

export interface MetricConfig {
  id: string;
  name: string;
  category: MetricCategory;
  weight: number;
  description?: string;
  isPercentage?: boolean;
}

export interface ScoringConfig {
  universalScoreMetrics: Record<string, { name: string; weight: number; description?: string }>;
  informationalMetrics: Record<string, { name: string; weight: number; description?: string }>;
  industryScoreMetrics?: Record<string, { name: string; weight: number; description?: string }>;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  netIncome?: number;
  fcf?: number;
  revenue?: number;
  operatingIncome?: number;
}

export interface AnalysisResult {
  ticker: string;
  companyProfile: CompanyProfile;
  metrics: FinancialMetrics;
  scores: MetricScores;
  overallScore: number;
  analysis: string;
  dataConfidenceScore: number;
  unavailableMetrics: string[];
  priceHistory?: HistoricalPricePoint[];
  fcfHistory?: ChartDataPoint[];
  revenueHistory?: ChartDataPoint[];
  epsHistory?: ChartDataPoint[];
  roicHistory?: ChartDataPoint[];
  debtEquityHistory?: ChartDataPoint[];
  profitabilityHistory?: ChartDataPoint[];
  fcfMarginHistory?: ChartDataPoint[];
  fcfConsistencyHistory?: ChartDataPoint[];
  fcfConversionHistory?: ChartDataPoint[];
  marginStabilityHistory?: ChartDataPoint[];
  netDebtToFCFHistory?: ChartDataPoint[];
  shareDilutionHistory?: ChartDataPoint[];
  
  // Valuation fields
  valuationMetrics: ValuationMetrics;
  valuationScores: ValuationScores;
  overallValuationScore: number;
  valuationConfidenceScore: number;
  unavailableValuationMetrics: string[];
  peHistory?: ChartDataPoint[];
  psHistory?: ChartDataPoint[];
  evsHistory?: ChartDataPoint[];
  pfcfHistory?: ChartDataPoint[];
  valuationPremiumHistory?: ChartDataPoint[];
}

export interface FCFTrendResult {
  trend: "Improving" | "Deteriorating" | "Declining" | "Flat" | "Turnaround" | "Emerging";
  isPositive: boolean;
  score: number;
  burnChangePct: number | null;
}

export interface FinancialMetrics {
  /**
   * Metric Score & Percentage Representation Convention:
   * - Percentage-based metrics & quality scores (e.g., fcfConsistency, fcfConversion, marginStability, shareDilution, fcfMargin, roic, grossMargin, netMargin)
   *   are represented as whole percentages (e.g., 96 for 96%, 100 for 100%, 0 for 0%) or decimal ratios (0.96 -> 96%).
   * - Growth rates (e.g., revenueCAGR, epsGrowth, fcfGrowth) are represented as decimal rates (e.g., 0.15 for 15%).
   * - Display and formatting utilities (formatPercentageMetric, MetricCard) accept both whole percentage values (96)
   *   and decimal ratio inputs (0.96) seamlessly, formatting both as "96%".
   */
  revenueCAGR: number | null;
  epsGrowth: number | null;
  epsTrend?: "Improving" | "Deteriorating" | "Declining" | "Flat" | "Turnaround" | "Emerging";
  epsTrendScore?: number | null;
  epsChangePct?: number | null;
  fcfGrowth: number | null;
  fcfTrend?: "Improving" | "Deteriorating" | "Declining" | "Flat" | "Turnaround" | "Emerging";
  fcfTrendScore?: number | null;
  fcfBurnChangePct?: number | null;
  fcfMargin: number | null;
  /** Stored as whole percentage (0-100), e.g. 96 for 96% */
  fcfConsistency: number | null;
  /** Stored as whole percentage (0-100+), e.g. 105 for 105% */
  fcfConversion: number | null;
  /** Stored as whole percentage (0-100), e.g. 80 for 80% */
  marginStability: number | null;
  /** Stored as leverage ratio, e.g. 1.5 for 1.5x, -0.8 for net cash position */
  netDebtToFCF: number | null;
  /** Stored as percentage change in shares outstanding over measurement period, e.g. -5.2 for -5.2% buyback */
  shareDilution: number | null;
  roic: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  dividendPayoutRatio: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  [key: string]: any;
}

export interface MetricScores {
  revenue: number | null;
  eps: number | null;
  fcf: number | null;
  fcfMargin: number | null;
  /** Stored as whole percentage score (0-100), e.g. 96 for 96% */
  fcfConsistency: number | null;
  /** Stored as whole percentage score (0-100), e.g. 100 for 100% */
  fcfConversion: number | null;
  /** Stored as whole percentage score (0-100), e.g. 80 for 80% */
  marginStability: number | null;
  /** Stored as whole percentage score (0-100), e.g. 90 for 90% */
  netDebtToFCF: number | null;
  /** Stored as whole percentage score (0-100), e.g. 95 for 95% */
  shareDilution: number | null;
  roic: number | null;
  debt: number | null;
  profitability: number | null;
  [key: string]: number | null | undefined;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: string;
}

export interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  exchange?: string;
}

export interface SavedStock {
  ticker: string;
  companyName: string;
  score: number;
  lastAnalyzed: string;
  sector?: string;
  industry?: string;
  image?: string;
}
