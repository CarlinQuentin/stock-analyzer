export interface CompanyProfile {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  website?: string;
  description?: string;
  image?: string;
  mktCap?: number;
}

export interface FinancialStatement {
  date: string;
  revenue?: number;
  netIncome?: number;
  operatingCashFlow?: number;
  capitalExpenditure?: number;
  shares?: number;
  eps?: number;
  totalAssets?: number;
  totalDebt?: number;
  totalEquity?: number;
  grossProfit?: number;
  operatingIncome?: number;
}

export interface AnalysisResult {
  ticker: string;
  companyProfile: CompanyProfile;
  metrics: FinancialMetrics;
  scores: MetricScores;
  overallScore: number;
  analysis: string;
}

export interface FinancialMetrics {
  revenueCAGR: number | null;
  epsGrowth: number | null;
  fcfGrowth: number | null;
  roic: number | null;
  debtToEquity: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  sharesDilution: string;
}

export interface MetricScores {
  revenue: number;
  eps: number;
  fcf: number;
  roic: number;
  debt: number;
  profitability: number;
  dilution: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: string;
}
