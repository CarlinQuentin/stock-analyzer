import { FinancialMetrics, MetricScores, FinancialStatement, ScoringConfig } from "../types";
import { calculateEPSTrend, calculateFCFTrend, calculateROICAnalysis } from "./financialCalculations";

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  universalScoreMetrics: {
    roic: { name: "ROIC", weight: 0.20, description: "Return on Invested Capital" },
    fcfMargin: { name: "FCF Margin", weight: 0.10, description: "Free Cash Flow Margin" },
    fcfConsistency: { name: "FCF Consistency", weight: 0.10, description: "Reliability of FCF generation" },
    fcfConversion: { name: "Avg FCF Conversion", weight: 0.10, description: "Multi-year average Free Cash Flow to Net Income ratio" },
    marginStability: { name: "Margin Stability", weight: 0.15, description: "Operating profitability trend stability" },
    netDebtToFCF: { name: "Net Debt / Normalized FCF", weight: 0.10, description: "Solvency & debt coverage by normalized 5-year average free cash flow" },
    shareDilution: { name: "Share Dilution", weight: 0.05, description: "Shareholder ownership change over time" },
    revenue: { name: "Revenue Growth", weight: 0.15, description: "Compound annual revenue growth rate" },
    eps: { name: "EPS Growth", weight: 0.05, description: "Earnings per share growth" },
  },
  informationalMetrics: {
    fcf: { name: "FCF Growth", weight: 0, description: "Free cash flow growth" },
    debt: { name: "Debt-to-Equity", weight: 0, description: "Financial leverage ratio" },
    profitability: { name: "Profitability Margins", weight: 0, description: "Overall profit margins" },
  },
  industryScoreMetrics: {},
};

export const SCORE_WEIGHTS: Record<string, number> = {
  roic: 0.20,
  fcfMargin: 0.10,
  fcfConsistency: 0.10,
  fcfConversion: 0.10,
  marginStability: 0.15,
  netDebtToFCF: 0.10,
  shareDilution: 0.05,
  revenue: 0.15,
  eps: 0.05,
};

export const SCORE_RANGES = {
  excellent: { min: 85, max: 100, label: "Excellent", color: "green" },
  good: { min: 70, max: 84.99, label: "Good", color: "blue" },
  average: { min: 50, max: 69.99, label: "Average", color: "yellow" },
  poor: { min: 0, max: 49.99, label: "Poor", color: "red" },
};

/**
 * Format a percentage metric value for UI display.
 * Handles both whole percentage values (e.g. 96 or 25.0) and decimal ratios (e.g. 0.96 or 0.25).
 * - A score of 96 displays as "96%"
 * - A score of 0.96 displays as "96%"
 * - A score of 100 displays as "100%"
 * - A score of 0 displays as "0%"
 * - Never displays "9600.00%"
 */
export function formatPercentageMetric(
  value: number | null | undefined,
  isAlreadyPercentage: boolean = false,
): string {
  if (value === null || value === undefined || isNaN(value)) return "N/A";

  let numVal: number;

  if (isAlreadyPercentage) {
    numVal = value;
    if (Number.isInteger(numVal)) {
      return `${numVal}%`;
    }
    return `${numVal.toFixed(2)}%`;
  }

  // Growth rate / decimal CAGR (isAlreadyPercentage = false)
  numVal = value * 100;
  return `${numVal.toFixed(2)}%`;
}

/**
 * Helper to interpolate scores based on threshold tiers
 */
function interpolateScore(
  val: number,
  tiers: { minVal: number; maxVal: number; minScore: number; maxScore: number }[]
): number {
  for (const tier of tiers) {
    if (val >= tier.minVal && val <= tier.maxVal) {
      if (tier.maxVal === tier.minVal) return Math.round(tier.minScore);
      const pct = (val - tier.minVal) / (tier.maxVal - tier.minVal);
      return Math.round(tier.minScore + pct * (tier.maxScore - tier.minScore));
    }
  }
  if (val > tiers[tiers.length - 1].maxVal) return Math.round(tiers[tiers.length - 1].maxScore);
  return Math.round(tiers[0].minScore);
}

/**
 * Score revenue growth (0-100)
 * Excellent: >= 15% (Score 85-100)
 * Good: 8% - 15%   (Score 70-84)
 * Average: 5% - 8% (Score 50-69)
 * Poor: < 5%       (Score 0-49)
 */
export function scoreRevenueGrowth(cagr: number | null | undefined): number {
  if (cagr === null || cagr === undefined || isNaN(cagr)) return 0;

  return interpolateScore(cagr, [
    { minVal: -0.10, maxVal: 0.00, minScore: 0, maxScore: 30 },
    { minVal: 0.00, maxVal: 0.05, minScore: 30, maxScore: 49 },
    { minVal: 0.05, maxVal: 0.08, minScore: 50, maxScore: 69 },
    { minVal: 0.08, maxVal: 0.15, minScore: 70, maxScore: 84 },
    { minVal: 0.15, maxVal: 0.25, minScore: 85, maxScore: 100 },
  ]);
}

/**
 * Score EPS growth (0-100) based on EPS CAGR evaluation standards:
 * - Excellent: > 15% (Score 85-100)
 * - Good: 8% - 15% (Score 70-84)
 * - Average: 5% - 8% (Score 50-69)
 * - Poor: < 5% (Score 0-49)
 */
export function scoreEPSGrowth(cagr: number | null | undefined): number | null {
  if (cagr === null || cagr === undefined || isNaN(cagr)) return null;

  return interpolateScore(cagr, [
    { minVal: -0.10, maxVal: 0.00, minScore: 0, maxScore: 29 },
    { minVal: 0.00, maxVal: 0.05, minScore: 30, maxScore: 49 },
    { minVal: 0.05, maxVal: 0.08, minScore: 50, maxScore: 69 },
    { minVal: 0.08, maxVal: 0.15, minScore: 70, maxScore: 84 },
    { minVal: 0.15, maxVal: 0.25, minScore: 85, maxScore: 100 },
  ]);
}

/**
 * Score FCF growth (0-100)
 * Excellent: >= 15% (Score 85-100)
 * Good: 8% - 15%   (Score 70-84)
 * Average: 5% - 8% (Score 50-69)
 * Poor: < 5%       (Score 0-49)
 */
/**
 * Score FCF growth (0-100)
 * Excellent: >= 15% (Score 85-100)
 * Good: 8% - 15%   (Score 70-84)
 * Average: 5% - 8% (Score 50-69)
 * Poor: < 5%       (Score 0-49)
 *
 * If CAGR is null, check if initial FCF in historical series was positive but ending FCF is <= 0.
 * If so, assign a score of 0 (cash destruction). Otherwise return null (N/A).
 */
export function scoreFCFGrowth(
  cagr: number | null,
  cashFlowStatements?: FinancialStatement[],
): number | null {
  if (cagr !== null) {
    return interpolateScore(cagr, [
      { minVal: -0.10, maxVal: 0.00, minScore: 0, maxScore: 29 },
      { minVal: 0.00, maxVal: 0.05, minScore: 30, maxScore: 49 },
      { minVal: 0.05, maxVal: 0.08, minScore: 50, maxScore: 69 },
      { minVal: 0.08, maxVal: 0.15, minScore: 70, maxScore: 84 },
      { minVal: 0.15, maxVal: 0.25, minScore: 85, maxScore: 100 },
    ]);
  }

  if (cashFlowStatements && cashFlowStatements.length >= 1) {
    return calculateFCFTrend(cashFlowStatements).score;
  }

  return null;
}

/**
 * Score ROIC (0-100)
 * Excellent: >= 15% (Score 85-100)
 * Good: 10% - 15%  (Score 70-84)
 * Average: 6% - 10% (Score 50-69)
 * Poor: < 6%       (Score 0-49)
 */
export function scoreROIC(
  roic: number | null,
  incomeStatements?: FinancialStatement[],
  balanceSheets?: FinancialStatement[],
): number | null {
  if (roic === null) return null;

  if (incomeStatements && balanceSheets && incomeStatements.length > 0 && balanceSheets.length > 0) {
    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets);
    return analysis.totalROICScore100;
  }

  return interpolateScore(roic, [
    { minVal: -5, maxVal: 0, minScore: 0, maxScore: 19 },
    { minVal: 0, maxVal: 6, minScore: 20, maxScore: 49 },
    { minVal: 6, maxVal: 10, minScore: 50, maxScore: 69 },
    { minVal: 10, maxVal: 15, minScore: 70, maxScore: 84 },
    { minVal: 15, maxVal: 25, minScore: 85, maxScore: 100 },
  ]);
}

/**
 * Score debt-to-equity ratio (0-100)
 * Excellent: < 0.50  (Score 85-100)
 * Good: 0.50 - 1.50  (Score 70-84)
 * Average: 1.50 - 3.00 (Score 50-69)
 * Poor: > 3.00       (Score 0-49)
 */
export function scoreDebtToEquity(debtToEquity: number | null): number | null {
  if (debtToEquity === null || debtToEquity < 0) return 0;

  if (debtToEquity <= 0.50) {
    return Math.round(100 - (debtToEquity / 0.50) * 15); // 0 -> 100, 0.50 -> 85
  } else if (debtToEquity <= 1.50) {
    return Math.round(84 - ((debtToEquity - 0.50) / 1.00) * 14); // 0.50 -> 84, 1.50 -> 70
  } else if (debtToEquity <= 3.00) {
    return Math.round(69 - ((debtToEquity - 1.50) / 1.50) * 19); // 1.50 -> 69, 3.00 -> 50
  } else if (debtToEquity <= 5.00) {
    return Math.round(49 - ((debtToEquity - 3.00) / 2.00) * 49); // 3.00 -> 49, 5.00 -> 0
  }
  return 0;
}

/**
 * Score profitability based on margins (0-100)
 */
function scoreSingleMargin(
  margin: number | null,
  poorMax: number,
  avgMax: number,
  goodMax: number,
  excellentMax: number
): number | null {
  if (margin === null) return null;

  return interpolateScore(margin, [
    { minVal: 0, maxVal: poorMax, minScore: 0, maxScore: 49 },
    { minVal: poorMax, maxVal: avgMax, minScore: 50, maxScore: 69 },
    { minVal: avgMax, maxVal: goodMax, minScore: 70, maxScore: 84 },
    { minVal: goodMax, maxVal: excellentMax, minScore: 85, maxScore: 100 },
  ]);
}

export function scoreProfitability(
  netMargin: number | null,
  operatingMargin: number | null,
  grossMargin: number | null,
): number | null {
  const scores = [];

  // Net Margin: Excellent >= 15%, Good 8-15%, Average 5-8%, Poor < 5%
  const net = scoreSingleMargin(netMargin, 5, 8, 15, 25);
  if (net !== null) scores.push(net);

  // Operating Margin: Excellent >= 20%, Good 10-20%, Average 6-10%, Poor < 6%
  const op = scoreSingleMargin(operatingMargin, 6, 10, 20, 30);
  if (op !== null) scores.push(op);

  // Gross Margin: Excellent >= 40%, Good 25-40%, Average 15-25%, Poor < 15%
  const gross = scoreSingleMargin(grossMargin, 15, 25, 40, 60);
  if (gross !== null) scores.push(gross);

  if (scores.length === 0) return null;

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function scoreFCFConsistency(val: number | null | undefined): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return Math.min(100, Math.max(0, Math.round(val)));
}

export function scoreFCFConversion(conversion: number | null | undefined): number | null {
  if (conversion === null || conversion === undefined || isNaN(conversion)) return null;
  if (conversion <= 0) return 0;
  if (conversion >= 120) return 100;
  if (conversion >= 100) {
    return Math.round(85 + ((conversion - 100) / 20) * 15);
  }
  if (conversion >= 80) {
    return Math.round(70 + ((conversion - 80) / 20) * 15);
  }
  if (conversion >= 50) {
    return Math.round(50 + ((conversion - 50) / 30) * 20);
  }
  return Math.round((conversion / 50) * 50);
}

export function scoreMarginStability(val: number | null | undefined): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return Math.min(100, Math.max(0, Math.round(val)));
}

/**
 * Score Net Debt / FCF (0-100)
 * Guidelines:
 * - Net cash position (< 0x) = 100 score (Excellent)
 * - < 2.0x = 90 - 100 score (Excellent)
 * - 2.0x - 4.0x = 70 - 89 score (Good)
 * - 4.0x - 6.0x = 50 - 69 score (Moderate risk)
 * - > 6.0x or FCF burn with net debt = 0 - 49 score (High leverage)
 */
export function scoreNetDebtToFCF(ratio: number | null | undefined): number | null {
  if (ratio === null || ratio === undefined || isNaN(ratio)) return null;

  if (ratio < 0) {
    return 100;
  }
  if (ratio < 2.0) {
    return Math.round(100 - (ratio / 2.0) * 10);
  }
  if (ratio <= 4.0) {
    return Math.round(89 - ((ratio - 2.0) / 2.0) * 19);
  }
  if (ratio <= 6.0) {
    return Math.round(69 - ((ratio - 4.0) / 2.0) * 19);
  }
  return Math.max(0, Math.round(49 - (ratio - 6.0) * 8));
}

/**
 * Format raw share counts as shortened numbers with 1 decimal place and NO percentage symbol.
 * Examples: 242017000 -> "242.0M", 148404000 -> "148.4M", 2500000000 -> "2.5B"
 */
export function formatShortenedShareCount(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) {
    return `${sign}${(abs / 1e12).toFixed(1)}T`;
  }
  if (abs >= 1e9) {
    return `${sign}${(abs / 1e9).toFixed(1)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${(abs / 1e6).toFixed(1)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${(abs / 1e3).toFixed(1)}K`;
  }
  return `${sign}${abs.toLocaleString()}`;
}

/**
 * Score Share Dilution (Annual CAGR %) (0-100)
 * Tiers:
 * - <= -3.0% (buybacks / accretive) = 90 - 100 score (Excellent)
 * - -3.0% to -1.0% (strong buybacks) = 75 - 89 score (Strong)
 * - -1.0% to +1.0% (neutral / stable) = 55 - 74 score (Neutral / Fair)
 * - +1.0% to +3.0% (mild dilution) = 35 - 54 score (Weak)
 * - > +3.0% (high dilution) = 0 - 34 score (Poor)
 */
export function scoreShareDilution(dilutionPct: number | null | undefined): number | null {
  if (dilutionPct === null || dilutionPct === undefined || isNaN(dilutionPct)) return null;

  if (dilutionPct <= -3.0) {
    return Math.min(100, Math.round(90 + Math.min(2.0, -3.0 - dilutionPct) * 5));
  }
  if (dilutionPct <= -1.0) {
    return Math.round(75 + ((-1.0 - dilutionPct) / 2.0) * 14);
  }
  if (dilutionPct <= 1.0) {
    return Math.round(55 + ((1.0 - dilutionPct) / 2.0) * 19);
  }
  if (dilutionPct <= 3.0) {
    return Math.round(35 + ((3.0 - dilutionPct) / 2.0) * 19);
  }
  return Math.max(0, Math.round(34 - ((dilutionPct - 3.0) / 4.0) * 34));
}

/**
 * Calculate all metric scores
 */
export function calculateMetricScores(
  metrics: FinancialMetrics,
  cashFlowStatements?: FinancialStatement[],
  incomeStatements?: FinancialStatement[],
  balanceSheets?: FinancialStatement[],
): MetricScores {
  let epsScore: number | null = null;
  if (metrics.epsGrowth !== null && metrics.epsGrowth !== undefined) {
    epsScore = scoreEPSGrowth(metrics.epsGrowth);
  } else if (metrics.epsTrendScore !== undefined && metrics.epsTrendScore !== null) {
    epsScore = metrics.epsTrendScore;
  } else if (incomeStatements) {
    epsScore = calculateEPSTrend(incomeStatements).score;
  } else {
    epsScore = null;
  }

  let fcfScore: number | null = null;
  if (metrics.fcfGrowth !== null && metrics.fcfGrowth !== undefined) {
    fcfScore = scoreFCFGrowth(metrics.fcfGrowth, cashFlowStatements);
  } else if (metrics.fcfTrendScore !== undefined && metrics.fcfTrendScore !== null) {
    fcfScore = metrics.fcfTrendScore;
  } else if (cashFlowStatements) {
    fcfScore = calculateFCFTrend(cashFlowStatements).score;
  } else {
    fcfScore = null;
  }

  return {
    revenue: scoreRevenueGrowth(metrics.revenueCAGR),
    eps: epsScore,
    fcf: fcfScore,
    fcfMargin: scoreFCFMargin(metrics.fcfMargin),
    fcfConsistency: scoreFCFConsistency(metrics.fcfConsistency),
    fcfConversion: scoreFCFConversion(metrics.fcfConversion),
    marginStability: scoreMarginStability(metrics.marginStability),
    netDebtToFCF: scoreNetDebtToFCF(metrics.netDebtToFCF),
    shareDilution: scoreShareDilution(metrics.shareDilution),
    roic: scoreROIC(metrics.roic, incomeStatements, balanceSheets),
    debt: scoreDebtToEquity(metrics.debtToEquity),
    profitability: scoreProfitability(
      metrics.netMargin,
      metrics.operatingMargin,
      metrics.grossMargin,
    ),
  };
}

/**
 * Score FCF Margin (0-100)
 * Guidelines:
 * - 20%+ = 100 score
 * - 15%-20% = 85 score
 * - 10%-15% = 75 score
 * - 5%-10% = 50 score
 * - 0%-5% = 25 score
 * - Negative (< 0%) = 0 score
 */
export function scoreFCFMargin(fcfMargin: number | null): number | null {
  if (fcfMargin === null || fcfMargin === undefined || isNaN(fcfMargin)) return null;

  if (fcfMargin >= 20) {
    return 100;
  }
  if (fcfMargin >= 15) {
    return Math.round(85 + ((fcfMargin - 15) / 5) * 15);
  }
  if (fcfMargin >= 10) {
    return Math.round(75 + ((fcfMargin - 10) / 5) * 10);
  }
  if (fcfMargin >= 5) {
    return Math.round(50 + ((fcfMargin - 5) / 5) * 25);
  }
  if (fcfMargin >= 0) {
    return Math.round(25 + (fcfMargin / 5) * 25);
  }
  return 0;
}

/**
 * Calculate Universal Business Quality Score (0-100) using only configured universal metrics.
 */
export function calculateUniversalBusinessScore(
  scores: MetricScores,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  let weightedSum = 0;
  let weightSum = 0;

  const universalMetrics = config.universalScoreMetrics;

  for (const key of Object.keys(universalMetrics)) {
    const score = scores[key];
    const weight = universalMetrics[key].weight;
    if (score !== null && score !== undefined) {
      weightedSum += score * weight;
      weightSum += weight;
    }
  }

  if (weightSum === 0) {
    return 0;
  }

  return Math.round(weightedSum / weightSum);
}

/**
 * Industry-specific score placeholder pipeline for future expansion.
 */
export function calculateIndustryScore(
  scores: MetricScores,
  industryConfig?: Record<string, { name: string; weight: number }>,
): number | null {
  if (!industryConfig || Object.keys(industryConfig).length === 0) {
    return null;
  }

  let weightedSum = 0;
  let weightSum = 0;

  for (const key of Object.keys(industryConfig)) {
    const score = scores[key];
    const weight = industryConfig[key].weight;
    if (score !== null && score !== undefined) {
      weightedSum += score * weight;
      weightSum += weight;
    }
  }

  if (weightSum === 0) return null;
  return Math.round(weightedSum / weightSum);
}

/**
 * Primary Business Quality Score calculation (alias to Universal Business Quality Score)
 */
export function calculateOverallScore(
  scores: MetricScores,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  return calculateUniversalBusinessScore(scores, config);
}

/**
 * Get list of names of unavailable universal metrics
 */
export function getUnavailableMetrics(
  scores: MetricScores,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): string[] {
  const unavailable: string[] = [];
  const universalMetrics = config.universalScoreMetrics;

  for (const key of Object.keys(universalMetrics)) {
    if (scores[key] === null || scores[key] === undefined) {
      unavailable.push(universalMetrics[key].name);
    }
  }

  return unavailable;
}

/**
 * Calculate data confidence score based on available universal score metrics
 */
export function calculateDataConfidenceScore(
  scores: MetricScores,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  const keys = Object.keys(config.universalScoreMetrics);
  if (keys.length === 0) return 0;
  const valid = keys.filter((key) => scores[key] !== null && scores[key] !== undefined).length;

  return Math.round((valid / keys.length) * 100);
}

/**
 * Get rating category and color
 */
export function getScoreCategory(score: number): {
  label: string;
  color: string;
} {
  if (score >= SCORE_RANGES.excellent.min) {
    return {
      label: SCORE_RANGES.excellent.label,
      color: SCORE_RANGES.excellent.color,
    };
  } else if (score >= SCORE_RANGES.good.min) {
    return { label: SCORE_RANGES.good.label, color: SCORE_RANGES.good.color };
  } else if (score >= SCORE_RANGES.average.min) {
    return {
      label: SCORE_RANGES.average.label,
      color: SCORE_RANGES.average.color,
    };
  } else {
    return { label: SCORE_RANGES.poor.label, color: SCORE_RANGES.poor.color };
  }
}

/**
 * Get color class for Tailwind CSS
 */
export function getScoreColorClass(score: number): string {
  const category = getScoreCategory(score);
  const colorMap: { [key: string]: string } = {
    green: "text-excellent",
    blue: "text-good",
    yellow: "text-average",
    red: "text-poor",
  };
  return colorMap[category.color] || "text-gray-600";
}

/**
 * Get background color class for Tailwind CSS
 */
export function getScoreBgColorClass(score: number): string {
  const category = getScoreCategory(score);
  const colorMap: { [key: string]: string } = {
    green: "bg-excellent",
    blue: "bg-good",
    yellow: "bg-average",
    red: "bg-poor",
  };
  return colorMap[category.color] || "bg-gray-100";
}

/**
 * Get metric performance analysis
 */
export function getMetricAnalysis(score: number | null): string {
  if (score === null) {
    return "N/A";
  }
  if (score >= 85) {
    return "Strong";
  } else if (score >= 70) {
    return "Good";
  } else if (score >= 50) {
    return "Fair";
  } else {
    return "Weak";
  }
}
