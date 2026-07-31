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

export interface AnalysisResult {
  ticker: string;
  companyProfile: CompanyProfile;
  metrics: FinancialMetrics;
  scores: MetricScores;
  overallScore: number;
  analysis: string;
  dataConfidenceScore: number;
  unavailableMetrics: string[];
  fcfHistory?: { label: string; value: number }[];
  revenueHistory?: { label: string; value: number }[];
  epsHistory?: { label: string; value: number }[];
  roicHistory?: { label: string; value: number }[];
  debtEquityHistory?: { label: string; value: number }[];
  profitabilityHistory?: { label: string; value: number }[];
  
  // Valuation fields
  valuationMetrics: ValuationMetrics;
  valuationScores: ValuationScores;
  overallValuationScore: number;
  valuationConfidenceScore: number;
  unavailableValuationMetrics: string[];
  peHistory?: { label: string; value: number }[];
  psHistory?: { label: string; value: number }[];
  evsHistory?: { label: string; value: number }[];
  pfcfHistory?: { label: string; value: number }[];
  valuationPremiumHistory?: { label: string; value: number }[];
}

export interface FinancialMetrics {
  revenueCAGR: number | null;
  epsGrowth: number | null;
  fcfGrowth: number | null;
  roic: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  dividendPayoutRatio: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

export interface MetricScores {
  revenue: number | null;
  eps: number | null;
  fcf: number | null;
  roic: number | null;
  debt: number | null;
  profitability: number | null;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: string;
}
