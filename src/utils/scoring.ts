import { FinancialMetrics, MetricScores, FinancialStatement } from "../types";
import { calculateFCF } from "./financialCalculations";

export const SCORE_WEIGHTS = {
  revenue: 0.2, // 20%
  eps: 0.2, // 20%
  fcf: 0.15, // 15%
  roic: 0.15, // 15%
  debt: 0.1, // 10%
  profitability: 0.2, // 20%
};

export const SCORE_RANGES = {
  excellent: { min: 85, max: 100, label: "Excellent", color: "green" },
  good: { min: 70, max: 84.99, label: "Good", color: "blue" },
  average: { min: 50, max: 69.99, label: "Average", color: "yellow" },
  poor: { min: 0, max: 49.99, label: "Poor", color: "red" },
};

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
export function scoreRevenueGrowth(cagr: number | null): number | null {
  if (cagr === null) return null;

  return interpolateScore(cagr, [
    { minVal: -0.10, maxVal: 0.00, minScore: 0, maxScore: 29 },
    { minVal: 0.00, maxVal: 0.05, minScore: 30, maxScore: 49 },
    { minVal: 0.05, maxVal: 0.08, minScore: 50, maxScore: 69 },
    { minVal: 0.08, maxVal: 0.15, minScore: 70, maxScore: 84 },
    { minVal: 0.15, maxVal: 0.25, minScore: 85, maxScore: 100 },
  ]);
}

/**
 * Score EPS growth (0-100)
 * Excellent: >= 15% (Score 85-100)
 * Good: 8% - 15%   (Score 70-84)
 * Average: 5% - 8% (Score 50-69)
 * Poor: < 5%       (Score 0-49)
 */
export function scoreEPSGrowth(cagr: number | null): number | null {
  if (cagr === null) return null;

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

  if (cashFlowStatements && cashFlowStatements.length >= 2) {
    const sortedByDate = [...cashFlowStatements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const lastStatement = sortedByDate[sortedByDate.length - 1];
    const endingFCF = calculateFCF(
      lastStatement.operatingCashFlow,
      lastStatement.capitalExpenditure,
    );

    if (endingFCF !== null && endingFCF <= 0) {
      // Check if any prior statement had positive FCF (Beginning FCF > 0)
      const hasPriorPositive = sortedByDate.slice(0, -1).some((s) => {
        const fcf = calculateFCF(s.operatingCashFlow, s.capitalExpenditure);
        return fcf !== null && fcf > 0;
      });

      if (hasPriorPositive) {
        return 0;
      }
    }
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
export function scoreROIC(roic: number | null): number | null {
  if (roic === null) return null;

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

/**
 * Calculate all metric scores
 */
export function calculateMetricScores(
  metrics: FinancialMetrics,
  cashFlowStatements?: FinancialStatement[],
): MetricScores {
  return {
    revenue: scoreRevenueGrowth(metrics.revenueCAGR),
    eps: scoreEPSGrowth(metrics.epsGrowth),
    fcf: scoreFCFGrowth(metrics.fcfGrowth, cashFlowStatements),
    roic: scoreROIC(metrics.roic),
    debt: scoreDebtToEquity(metrics.debtToEquity),
    profitability: scoreProfitability(
      metrics.netMargin,
      metrics.operatingMargin,
      metrics.grossMargin,
    ),
  };
}

/**
 * Calculate weighted overall score (0-100)
 * Only includes available metrics in calculation
 */
export function calculateOverallScore(scores: MetricScores): number {
  let weightedSum = 0;
  let weightSum = 0;

  const keys: (keyof MetricScores)[] = [
    "revenue",
    "eps",
    "fcf",
    "roic",
    "debt",
    "profitability",
  ];

  for (const key of keys) {
    const score = scores[key];
    if (score !== null) {
      weightedSum += score * SCORE_WEIGHTS[key];
      weightSum += SCORE_WEIGHTS[key];
    }
  }

  if (weightSum === 0) {
    return 0;
  }

  return Math.round(weightedSum / weightSum);
}

/**
 * Get list of names of unavailable metrics
 */
export function getUnavailableMetrics(scores: MetricScores): string[] {
  const mapping: Record<keyof MetricScores, string> = {
    revenue: "Revenue Growth",
    eps: "EPS Growth",
    fcf: "FCF Growth",
    roic: "ROIC",
    debt: "Debt-to-Equity",
    profitability: "Profitability",
  };

  const unavailable: string[] = [];
  (Object.keys(mapping) as (keyof MetricScores)[]).forEach((key) => {
    if (scores[key] === null) {
      unavailable.push(mapping[key]);
    }
  });

  return unavailable;
}

/**
 * Calculate data confidence score based on available metrics
 */
export function calculateDataConfidenceScore(scores: MetricScores): number {
  const keys: (keyof MetricScores)[] = [
    "revenue",
    "eps",
    "fcf",
    "roic",
    "debt",
    "profitability",
  ];

  const total = keys.length;
  const valid = keys.filter((key) => scores[key] !== null).length;

  return Math.round((valid / total) * 100);
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
