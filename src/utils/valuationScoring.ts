import { CompanyProfile, FinancialStatement, ValuationMetrics, ValuationScores } from "../types";

/**
 * Calculate Premium % for a valuation metric vs historical average:
 * Premium % = (Current Multiple - Historical Average Multiple) / Historical Average Multiple
 *
 * Example:
 * Current P/FCF = 20x, Historical Avg P/FCF = 15x -> (20 - 15) / 15 = +0.3333 (+33.3%)
 * Current P/E = 12x, Historical Avg P/E = 15x -> (12 - 15) / 15 = -0.20 (-20.0%)
 * Current P/S = 15x, Historical Avg P/S = 15x -> (15 - 15) / 15 = 0.0 (0.0%)
 */
export function calculateValuationPremium(
  currentMultiple: number | null,
  historicalAverageMultiple: number | null
): number | null {
  if (
    currentMultiple === null ||
    currentMultiple <= 0 ||
    historicalAverageMultiple === null ||
    historicalAverageMultiple <= 0
  ) {
    return null;
  }

  return (currentMultiple - historicalAverageMultiple) / historicalAverageMultiple;
}

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

  // 5. Historical average multiples
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

  // Calculate premium/discount percentage for each valuation metric (P/E, P/S, EV/Sales, P/FCF)
  const premiums: number[] = [];

  const pePremium = calculateValuationPremium(peRatio, historicalPeAverage);
  if (pePremium !== null) premiums.push(pePremium);

  const psPremium = calculateValuationPremium(priceToSalesRatio, historicalPsAverage);
  if (psPremium !== null) premiums.push(psPremium);

  const evsPremium = calculateValuationPremium(evToSales, historicalEvsAverage);
  if (evsPremium !== null) premiums.push(evsPremium);

  const pfcfPremium = calculateValuationPremium(priceToFreeCashFlowsRatio, historicalPfcfAverage);
  if (pfcfPremium !== null) premiums.push(pfcfPremium);

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
 * Score P/E Ratio (0-100)
 * Tiers:
 * - Excellent (< 10.0x): Score 85-100
 * - Good (10.0x - 20.0x): Score 70-84
 * - Average (20.0x - 35.0x): Score 50-69
 * - Poor (> 35.0x): Score 0-49
 */
export function scorePERatio(pe: number | null | undefined): number | null {
  if (pe === null || pe === undefined || isNaN(pe) || pe <= 0) return null;
  if (pe <= 10.0) {
    return Math.min(100, Math.round(85 + ((10.0 - pe) / 5.0) * 15));
  }
  if (pe <= 20.0) {
    return Math.round(70 + ((20.0 - pe) / 10.0) * 14);
  }
  if (pe <= 35.0) {
    return Math.round(50 + ((35.0 - pe) / 15.0) * 19);
  }
  return Math.max(0, Math.round(49 - ((pe - 35.0) / 25.0) * 39));
}

/**
 * Score P/S Ratio (0-100)
 * Tiers:
 * - Excellent (< 1.5x): Score 85-100
 * - Good (1.5x - 3.5x): Score 70-84
 * - Average (3.5x - 6.0x): Score 50-69
 * - Poor (> 6.0x): Score 0-49
 */
export function scorePSRatio(ps: number | null | undefined): number | null {
  if (ps === null || ps === undefined || isNaN(ps) || ps <= 0) return null;
  if (ps <= 1.5) {
    return Math.min(100, Math.round(85 + ((1.5 - ps) / 1.0) * 15));
  }
  if (ps <= 3.5) {
    return Math.round(70 + ((3.5 - ps) / 2.0) * 14);
  }
  if (ps <= 6.0) {
    return Math.round(50 + ((6.0 - ps) / 2.5) * 19);
  }
  return Math.max(0, Math.round(49 - ((ps - 6.0) / 6.0) * 39));
}

/**
 * Score EV/Sales Ratio (0-100)
 * Tiers:
 * - Excellent (< 1.5x): Score 85-100
 * - Good (1.5x - 3.5x): Score 70-84
 * - Average (3.5x - 6.0x): Score 50-69
 * - Poor (> 6.0x): Score 0-49
 */
export function scoreEVSales(evs: number | null | undefined): number | null {
  if (evs === null || evs === undefined || isNaN(evs) || evs <= 0) return null;
  if (evs <= 1.5) {
    return Math.min(100, Math.round(85 + ((1.5 - evs) / 1.0) * 15));
  }
  if (evs <= 3.5) {
    return Math.round(70 + ((3.5 - evs) / 2.0) * 14);
  }
  if (evs <= 6.0) {
    return Math.round(50 + ((6.0 - evs) / 2.5) * 19);
  }
  return Math.max(0, Math.round(49 - ((evs - 6.0) / 6.0) * 39));
}

/**
 * Score P/FCF Ratio (0-100)
 * Tiers:
 * - Excellent (< 12.0x): Score 85-100
 * - Good (12.0x - 20.0x): Score 70-84
 * - Average (20.0x - 35.0x): Score 50-69
 * - Poor (> 35.0x): Score 0-49
 */
export function scorePFCFRatio(pfcf: number | null | undefined): number | null {
  if (pfcf === null || pfcf === undefined || isNaN(pfcf) || pfcf <= 0) return null;
  if (pfcf <= 12.0) {
    return Math.min(100, Math.round(85 + ((12.0 - pfcf) / 6.0) * 15));
  }
  if (pfcf <= 20.0) {
    return Math.round(70 + ((20.0 - pfcf) / 8.0) * 14);
  }
  if (pfcf <= 35.0) {
    return Math.round(50 + ((35.0 - pfcf) / 15.0) * 19);
  }
  return Math.max(0, Math.round(49 - ((pfcf - 35.0) / 25.0) * 39));
}

/**
 * Score Historical Valuation Comparison (0-100)
 * Evaluates current multiples against historical averages based on standard tiers:
 * - Excellent (< -15%): Score 85-100 (Deep discount to historical averages)
 * - Good (-15% to +10%): Score 70-84 (Reasonable valuation near or below historical averages)
 * - Average (+10% to +25%): Score 50-69 (Mild premium over historical averages)
 * - Poor (> +25%): Score 0-49 (Significant premium / elevated valuation risk)
 */
export function scoreHistoricalValuation(premium: number | null | undefined): number | null {
  if (premium === null || premium === undefined || isNaN(premium)) return null;

  if (premium <= -0.15) {
    // Excellent (< -15%): Score 85-100
    // At <= -0.30: 100
    // At -0.15: 85
    return Math.min(100, Math.round(85 + ((-0.15 - premium) / 0.15) * 15));
  }
  if (premium <= 0.10) {
    // Good (-15% to +10%): Score 70-84
    // At -0.15: 84
    // At 0.00: 76
    // At +0.0395 (Visa): 73
    // At +0.10: 70
    return Math.round(70 + ((0.10 - premium) / 0.25) * 14);
  }
  if (premium <= 0.25) {
    // Average (+10% to +25%): Score 50-69
    // At +0.10: 69
    // At +0.25: 50
    return Math.round(50 + ((0.25 - premium) / 0.15) * 19);
  }
  // Poor (> +25%): Score 0-49
  // At +0.25: 49
  // At >= +0.50: 10
  return Math.max(0, Math.round(49 - ((premium - 0.25) / 0.25) * 39));
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
