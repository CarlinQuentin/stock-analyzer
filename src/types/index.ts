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
  yoyChange?: number | null;
}

export type HistoricalPeriod = "10Y" | "5Y" | "3Y";
export type ROICTrendDirection = "Improving" | "Stable" | "Declining" | "Mixed" | "N/A";
export type ROICConsistencyLevel = "Highly Consistent" | "Consistent" | "Moderate" | "Inconsistent" | "N/A";

export interface ROICAnalysisDetail {
  roic10Y: number | null;
  roic5Y: number | null;
  roic3Y: number | null;
  latestROIC: number | null;
  levelScorePoints: number; // 0 to 10.0 pts
  trend: ROICTrendDirection;
  trendScorePoints: number; // 0 to 5.0 pts
  consistency: ROICConsistencyLevel;
  consistencyScorePoints: number; // 0 to 5.0 pts
  stdDev: number | null; // Standard deviation of annual ROIC values (e.g. 2.1%)
  totalROICPoints: number; // 0 to 20.0 pts
  totalROICScore100: number; // 0 to 100
  annualHistory: { year: string; roic: number }[];
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
  selectedPeriod?: HistoricalPeriod;
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
  roicDetail?: ROICAnalysisDetail;
  
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
  roic10Y?: number | null;
  roic5Y?: number | null;
  roic3Y?: number | null;
  roicTrend?: ROICTrendDirection;
  roicTrendScorePoints?: number;
  roicConsistency?: ROICConsistencyLevel;
  roicConsistencyScorePoints?: number;
  roicStdDev?: number | null;
  roicLevelScorePoints?: number;
  roicTotalPoints?: number;
  roicDetail?: ROICAnalysisDetail;
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

export interface PreviousRole {
  company: string;
  title: string;
  startYear?: number | string;
  endYear?: number | string;
}

export interface ExecutiveProfile {
  id: string;
  name: string;
  title: string;
  bio?: string;
  tenureStartYear?: number;
  yearBorn?: number;
  gender?: string;
  pay?: number;
  currencyPay?: string;
  previousRoles: PreviousRole[];
  education?: string[];
  isKeyOfficer: boolean;
}

export interface LeadershipQualityScoreSupport {
  /** Extension points for future Leadership Quality Scoring algorithm */
  executiveExperienceScore?: number | null;
  industryTenureYears?: number | null;
  priorPerformanceRating?: "High" | "Moderate" | "Low" | null;
  insiderAlignmentScore?: number | null;
}

export interface LeadershipProfile {
  symbol: string;
  companyName: string;
  executives: ExecutiveProfile[];
  careerSummary?: string;
  strengths?: string[];
  leadershipScoreSupport?: LeadershipQualityScoreSupport;
  source: string;
  lastUpdated: string;
}

export type CompetitorBadgeType =
  | "Primary Competitor"
  | "Direct Competitor"
  | "Emerging Competitor"
  | "Global Competitor"
  | "Regional Competitor";

export interface CompetitorProfile {
  symbol: string;
  companyName: string;
  industry: string;
  sector?: string;
  description: string;
  marketCap: number;
  price?: number;
  headquarters?: string;
  logo?: string;
  website?: string;
  reasonForCompetition: string;
  badge: CompetitorBadgeType;
  marketCapComparisonRatio?: number;
  revenueComparisonRatio?: number;
  employeeCount?: number | string;
}

export interface CompetitorData {
  targetSymbol: string;
  targetCompanyName: string;
  targetMarketCap: number;
  competitors: CompetitorProfile[];
  source: string;
  lastUpdated: string;
}

export interface AnalystEstimatePoint {
  symbol: string;
  date: string;
  fiscalYear: string;
  epsAvg: number | null;
  epsHigh: number | null;
  epsLow: number | null;
  numAnalystsEps: number | null;
  revenueAvg: number | null;
  revenueHigh: number | null;
  revenueLow: number | null;
  numAnalystsRevenue: number | null;
  ebitdaAvg: number | null;
  ebitdaHigh: number | null;
  ebitdaLow: number | null;
  epsYoYGrowthPct?: number | null;
  revenueYoYGrowthPct?: number | null;
  ebitdaYoYGrowthPct?: number | null;
}

export interface PriceTargetData {
  symbol: string;
  targetHigh: number | null;
  targetLow: number | null;
  targetConsensus: number | null;
  targetMedian: number | null;
  currentPrice: number | null;
  impliedUpsidePct: number | null;
  analystCount?: number | null;
  lastMonthAvgPriceTarget?: number | null;
  lastQuarterAvgPriceTarget?: number | null;
  lastYearAvgPriceTarget?: number | null;
}

export interface PriceTargetNewsItem {
  publishedDate: string;
  newsTitle: string;
  priceTarget?: number | null;
  priceWhenPosted?: number | null;
  analystCompany?: string;
  newsPublisher?: string;
}

export interface AnalystGradeItem {
  date: string;
  gradingCompany: string;
  previousGrade?: string;
  newGrade?: string;
  action?: string;
}

export interface FutureOutlookData {
  symbol: string;
  companyName?: string;
  estimates: AnalystEstimatePoint[];
  priceTarget: PriceTargetData | null;
  recentPriceTargetNews: PriceTargetNewsItem[];
  recentGrades: AnalystGradeItem[];
  forwardEpsGrowthPct: number | null;
  forwardRevenueGrowthPct: number | null;
  forwardEbitdaGrowthPct: number | null;
  historicalEpsCagr: number | null;
  historicalRevenueCagr: number | null;
  epsTrendStatus: "Accelerating" | "Stable" | "Decelerating" | "N/A";
  revenueTrendStatus: "Accelerating" | "Stable" | "Decelerating" | "N/A";
  lastUpdated: string;
}
