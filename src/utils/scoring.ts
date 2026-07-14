import { FinancialMetrics, MetricScores } from "../types";

export const SCORE_WEIGHTS = {
  revenue: 0.2, // 20%
  eps: 0.2, // 20%
  fcf: 0.15, // 15%
  roic: 0.15, // 15%
  debt: 0.1, // 10%
  profitability: 0.15, // 15%
  dividends: 0.05, // 5%
  dilution: 0.0, // 0%
};

export const SCORE_RANGES = {
  excellent: { min: 85, max: 100, label: "Excellent", color: "green" },
  good: { min: 70, max: 84.99, label: "Good", color: "blue" },
  average: { min: 50, max: 69.99, label: "Average", color: "yellow" },
  poor: { min: 0, max: 49.99, label: "Poor", color: "red" },
};

/**
 * Score revenue growth (0-100)
 * Excellent: > 15%
 * Good: 8-15%
 * Poor: < 8%
 */
export function scoreRevenueGrowth(cagr: number | null): number | null {
  if (cagr === null) {
    return null;
  }

  if (cagr <= -0.1) {
    return 0;
  }

  if (cagr >= 0.2) {
    return 100;
  }

  return Math.round(100 * Math.pow((cagr + 0.1) / 0.3, 0.8));
}

/**
 * Score EPS growth (0-100)
 * Excellent: > 15%
 * Good: 5-15%
 * Poor: negative growth
 */
export function scoreEPSGrowth(cagr: number | null): number | null {
  if (cagr === null) {
    return null;
  }

  const minGrowth = -0.1; // -10% EPS CAGR = 0
  const maxGrowth = 0.25; // 25% EPS CAGR = 100

  const score = ((cagr - minGrowth) / (maxGrowth - minGrowth)) * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Score FCF growth (0-100)
 * Excellent: > 10%
 * Good: 5-10%
 * Poor: negative
 */
export function scoreFCFGrowth(cagr: number | null): number | null {
  if (cagr === null) {
    return null;
  }

  const minGrowth = -0.1; // -10% CAGR = 0
  const maxGrowth = 0.2; // 20% CAGR = 100

  const score = ((cagr - minGrowth) / (maxGrowth - minGrowth)) * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Score ROIC (0-100)
 * Excellent: > 15%
 * Good: 10-15%
 * Poor: < 10%
 */
export function scoreROIC(roic: number | null): number | null {
  if (roic === null) {
    return null;
  }

  const minROIC = 0;
  const maxROIC = 25;

  const score = ((roic - minROIC) / (maxROIC - minROIC)) * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Score debt-to-equity ratio (0-100)
 * Excellent: < 0.5
 * Good: 0.5-1
 * Poor: > 1
 */
export function scoreDebtToEquity(debtToEquity: number | null): number | null {
  if (debtToEquity === null) {
    return null;
  }

  if (debtToEquity < 0) {
    return 0; // Negative equity is usually a red flag
  }

  const maxDebt = 2.5;

  const score = 100 - (debtToEquity / maxDebt) * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Score profitability based on margins (0-100)
 * Looks at net, operating, and gross margins
 */
function scoreMargin(
  margin: number | null,
  poor: number,
  excellent: number,
): number | null {
  if (margin === null) {
    return null;
  }

  const score = ((margin - poor) / (excellent - poor)) * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreProfitability(
  netMargin: number | null,
  operatingMargin: number | null,
  grossMargin: number | null,
): number | null {
  const scores = [];

  const net = scoreMargin(netMargin, 0, 25);
  if (net !== null) {
    scores.push(net);
  }

  const op = scoreMargin(operatingMargin, 0, 30);
  if (op !== null) {
    scores.push(op);
  }

  const gross = scoreMargin(grossMargin, 0, 60);
  if (gross !== null) {
    scores.push(gross);
  }

  if (scores.length === 0) {
    return null;
  }

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function scoreDividendQuality(
  dividendYield: number | null,
  dividendPayoutRatio: number | null,
): number | null {
  const scores = [];

  const yieldScore = scoreDividendYield(dividendYield);
  if (yieldScore !== null) {
    scores.push(yieldScore);
  }

  const payoutScore = scoreDividendPayoutRatio(dividendPayoutRatio);
  if (payoutScore !== null) {
    scores.push(payoutScore);
  }

  if (scores.length === 0) {
    return null;
  }

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function scoreDividendYield(
  dividendYield: number | null,
): number | null {
  if (dividendYield == null) {
    return null;
  }

  const percentage = dividendYield * 100;

  return Math.min(100, Math.max(0, (percentage / 4) * 100));
}

export function scoreDividendPayoutRatio(
  payoutRatio: number | null,
): number | null {
  if (payoutRatio == null) {
    return null;
  }

  const percentage = payoutRatio * 100;

  // Company has negative earnings
  if (percentage < 0) {
    return 0;
  }

  if (percentage >= 30 && percentage <= 60) {
    return 100;
  }

  if (percentage < 30) {
    return (percentage / 30) * 100;
  }

  if (percentage <= 100) {
    return 100 - ((percentage - 60) / 40) * 100;
  }

  return 0;
}

/**
 * Score shareholder dilution (0-100)
 */
export function scoreDilution(analysis: string): number | null {
  if (
    !analysis ||
    analysis === "Insufficient data" ||
    analysis === "Data not available"
  ) {
    return null;
  }
  if (analysis.includes("buyback") || analysis.includes("Stable")) {
    return 80;
  } else if (analysis.includes("dilution")) {
    return 40;
  } else {
    return 50;
  }
}

/**
 * Calculate all metric scores
 */
export function calculateMetricScores(metrics: FinancialMetrics): MetricScores {
  return {
    revenue: scoreRevenueGrowth(metrics.revenueCAGR),
    eps: scoreEPSGrowth(metrics.epsGrowth),
    fcf: scoreFCFGrowth(metrics.fcfGrowth),
    roic: scoreROIC(metrics.roic),
    debt: scoreDebtToEquity(metrics.debtToEquity),
    profitability: scoreProfitability(
      metrics.netMargin,
      metrics.operatingMargin,
      metrics.grossMargin,
    ),
    dividends: scoreDividendQuality(
      metrics.dividendYield,
      metrics.dividendPayoutRatio,
    ),
    dilution: scoreDilution(metrics.sharesDilution),
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
    "dividends",
    "dilution",
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
    dividends: "Dividends",
    dilution: "Share Dilution",
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
    "dividends",
    "dilution",
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
