import { CompanyProfile, FinancialStatement, ValuationMetrics, ValuationScores } from "../types";

/**
 * Calculate Valuation Metrics
 */
export function calculateValuationMetrics(
  profile: CompanyProfile,
  incomeStatements: FinancialStatement[],
  balanceSheets: FinancialStatement[],
  cashFlowStatements: FinancialStatement[],
  keyMetrics: any[],
  financialRatios: any[]
): ValuationMetrics {
  const latestIncome = incomeStatements[0];
  const latestBalance = balanceSheets[0];
  const latestCashFlow = cashFlowStatements[0];

  let peRatio: number | null = null;
  let priceToSalesRatio: number | null = null;
  let evToSales: number | null = null;
  let priceToFreeCashFlowsRatio: number | null = null;

  // 1. P/E ratio manual calculation (Price / EPS or Market Cap / Net Income)
  if (profile.price && latestIncome && latestIncome.eps && latestIncome.eps > 0) {
    peRatio = profile.price / latestIncome.eps;
  } else if (profile.mktCap && latestIncome && latestIncome.netIncome && latestIncome.netIncome > 0) {
    peRatio = profile.mktCap / latestIncome.netIncome;
  }

  // 2. Price to Sales ratio manual calculation (Market Cap / Revenue)
  if (profile.mktCap && latestIncome && latestIncome.revenue && latestIncome.revenue > 0) {
    priceToSalesRatio = profile.mktCap / latestIncome.revenue;
  }

  // 3. EV / Sales ratio manual calculation (Enterprise Value / Revenue)
  if (profile.mktCap && latestIncome && latestIncome.revenue && latestIncome.revenue > 0 && latestBalance) {
    const totalDebt = latestBalance.totalDebt || 0;
    const cash = latestBalance.cashAndCashEquivalents || 0;
    const ev = profile.mktCap + totalDebt - cash;
    evToSales = ev / latestIncome.revenue;
  }

  // 4. Price to Free Cash Flow ratio manual calculation (Market Cap / FCF)
  if (latestCashFlow) {
    // CapEx is represented as negative in FMP, so we subtract Math.abs(capitalExpenditure) to get FCF
    const fcf = (latestCashFlow.operatingCashFlow || 0) - Math.abs(latestCashFlow.capitalExpenditure || 0);
    if (profile.mktCap && fcf > 0) {
      priceToFreeCashFlowsRatio = profile.mktCap / fcf;
    }
  }

  // Overwrite with financialRatios and keyMetrics if available
  if (financialRatios && financialRatios.length > 0) {
    const latestRatio = financialRatios[0];
    if (latestRatio.priceToEarningsRatio && latestRatio.priceToEarningsRatio > 0) peRatio = latestRatio.priceToEarningsRatio;
    if (latestRatio.priceToSalesRatio && latestRatio.priceToSalesRatio > 0) priceToSalesRatio = latestRatio.priceToSalesRatio;
    if (latestRatio.priceToFreeCashFlowRatio && latestRatio.priceToFreeCashFlowRatio > 0) {
      priceToFreeCashFlowsRatio = latestRatio.priceToFreeCashFlowRatio;
    }
  }

  if (keyMetrics && keyMetrics.length > 0) {
    const latestMetric = keyMetrics[0];
    if (latestMetric.evToSales && latestMetric.evToSales > 0) evToSales = latestMetric.evToSales;
  }

  // 5. Historical averages
  let historicalPeAverage: number | null = null;
  let historicalPsAverage: number | null = null;
  let historicalEvsAverage: number | null = null;
  let historicalPfcfAverage: number | null = null;
  let averagePremium: number | null = null;

  if (financialRatios && financialRatios.length > 0) {
    const validPes = financialRatios.map(m => m.priceToEarningsRatio).filter((v): v is number => v != null && v > 0);
    const validPss = financialRatios.map(m => m.priceToSalesRatio).filter((v): v is number => v != null && v > 0);
    const validPfcfs = financialRatios.map(m => m.priceToFreeCashFlowRatio).filter((v): v is number => v != null && v > 0);

    if (validPes.length > 0) historicalPeAverage = validPes.reduce((a, b) => a + b, 0) / validPes.length;
    if (validPss.length > 0) historicalPsAverage = validPss.reduce((a, b) => a + b, 0) / validPss.length;
    if (validPfcfs.length > 0) historicalPfcfAverage = validPfcfs.reduce((a, b) => a + b, 0) / validPfcfs.length;
  }

  if (keyMetrics && keyMetrics.length > 0) {
    const validEvss = keyMetrics.map(m => m.evToSales).filter((v): v is number => v != null && v > 0);
    if (validEvss.length > 0) historicalEvsAverage = validEvss.reduce((a, b) => a + b, 0) / validEvss.length;
  }

  // Calculate premium/discount compared to history
  const premiums: number[] = [];
  if (peRatio && historicalPeAverage) premiums.push((peRatio - historicalPeAverage) / historicalPeAverage);
  if (priceToSalesRatio && historicalPsAverage) premiums.push((priceToSalesRatio - historicalPsAverage) / historicalPsAverage);
  if (evToSales && historicalEvsAverage) premiums.push((evToSales - historicalEvsAverage) / historicalEvsAverage);
  if (priceToFreeCashFlowsRatio && historicalPfcfAverage) premiums.push((priceToFreeCashFlowsRatio - historicalPfcfAverage) / historicalPfcfAverage);

  if (premiums.length > 0) {
    averagePremium = premiums.reduce((a, b) => a + b, 0) / premiums.length;
  }

  return {
    peRatio,
    priceToSalesRatio,
    evToSales,
    priceToFreeCashFlowsRatio,
    historicalPeAverage,
    historicalPsAverage,
    historicalEvsAverage,
    historicalPfcfAverage,
    averagePremium,
  };
}

/**
 * Score P/E Ratio
 */
export function scorePERatio(pe: number | null): number | null {
  if (pe === null || pe <= 0) return null;
  if (pe <= 10) return 100;
  if (pe >= 50) return 10;
  const pct = (pe - 10) / (50 - 10);
  return Math.round(100 - pct * 90);
}

/**
 * Score P/S Ratio
 */
export function scorePSRatio(ps: number | null): number | null {
  if (ps === null || ps <= 0) return null;
  if (ps <= 0.5) return 100;
  if (ps >= 8.0) return 10;
  const pct = (ps - 0.5) / (8.0 - 0.5);
  return Math.round(100 - pct * 90);
}

/**
 * Score EV/Sales Ratio
 */
export function scoreEVSales(evs: number | null): number | null {
  if (evs === null || evs <= 0) return null;
  if (evs <= 0.5) return 100;
  if (evs >= 8.0) return 10;
  const pct = (evs - 0.5) / (8.0 - 0.5);
  return Math.round(100 - pct * 90);
}

/**
 * Score P/FCF Ratio
 */
export function scorePFCFRatio(pfcf: number | null): number | null {
  if (pfcf === null || pfcf <= 0) return null;
  if (pfcf <= 10) return 100;
  if (pfcf >= 50) return 10;
  const pct = (pfcf - 10) / (50 - 10);
  return Math.round(100 - pct * 90);
}

/**
 * Score Historical Valuation Comparison
 */
export function scoreHistoricalValuation(premium: number | null): number | null {
  if (premium === null) return null;
  if (premium <= -0.3) return 100;
  if (premium >= 0.3) return 10;
  const pct = (premium + 0.3) / 0.6;
  return Math.round(100 - pct * 90);
}

/**
 * Calculate Valuation Scores
 */
export function calculateValuationScores(metrics: ValuationMetrics): ValuationScores {
  return {
    pe: scorePERatio(metrics.peRatio),
    ps: scorePSRatio(metrics.priceToSalesRatio),
    evs: scoreEVSales(metrics.evToSales),
    pfcf: scorePFCFRatio(metrics.priceToFreeCashFlowsRatio),
    historical: scoreHistoricalValuation(metrics.averagePremium),
  };
}

/**
 * Calculate Overall Valuation Score (0-100)
 */
export function calculateOverallValuationScore(scores: ValuationScores): number {
  let sum = 0;
  let count = 0;

  const keys: (keyof ValuationScores)[] = ["pe", "ps", "evs", "pfcf", "historical"];
  for (const key of keys) {
    const score = scores[key];
    if (score !== null) {
      sum += score;
      count++;
    }
  }

  if (count === 0) return 0;
  return Math.round(sum / count);
}

/**
 * Calculate Valuation Confidence Score
 */
export function calculateValuationConfidenceScore(scores: ValuationScores): number {
  const keys: (keyof ValuationScores)[] = ["pe", "ps", "evs", "pfcf", "historical"];
  const total = keys.length;
  const valid = keys.filter(key => scores[key] !== null).length;
  return Math.round((valid / total) * 100);
}

/**
 * Get Unavailable Valuation Metrics
 */
export function getUnavailableValuationMetrics(scores: ValuationScores): string[] {
  const mapping: Record<keyof ValuationScores, string> = {
    pe: "P/E Ratio",
    ps: "P/S Ratio",
    evs: "EV/Sales",
    pfcf: "P/FCF Ratio",
    historical: "Historical Valuation",
  };

  const unavailable: string[] = [];
  (Object.keys(mapping) as (keyof ValuationScores)[]).forEach(key => {
    if (scores[key] === null) {
      unavailable.push(mapping[key]);
    }
  });

  return unavailable;
}

/**
 * Get Valuation Category & Explanation
 */
export function getValuationAnalysis(score: number): {
  label: string;
  color: string;
  explanation: string;
} {
  if (score >= 80) {
    return {
      label: "Strong Discount / Undervalued",
      color: "green",
      explanation: "The stock trades at multiples significantly below industry or historical averages, indicating a potential margin of safety.",
    };
  } else if (score >= 60) {
    return {
      label: "Reasonable / Fairly Valued",
      color: "blue",
      explanation: "The stock is priced reasonably relative to its sales, cash flow, and historical averages.",
    };
  } else if (score >= 40) {
    return {
      label: "Premium / Fully Valued",
      color: "yellow",
      explanation: "The stock trades at a slight premium, suggesting future growth is partially priced in.",
    };
  } else {
    return {
      label: "Expensive / Overvalued",
      color: "red",
      explanation: "The stock trades at high multiples relative to business fundamentals, posing a higher valuation risk.",
    };
  }
}
