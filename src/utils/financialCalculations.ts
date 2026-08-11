import {
  FinancialStatement,
  FinancialMetrics,
  DividendMetrics,
  FCFTrendResult,
  HistoricalPeriod,
  ROICAnalysisDetail,
  ROICTrendDirection,
  ROICConsistencyLevel,
} from "../types";

/**
 * Get maximum annual statement count limit for a given HistoricalPeriod.
 * - 10Y: up to 11 annual statements (10 year intervals)
 * - 5Y: up to 6 annual statements (5 year intervals)
 * - 3Y: up to 4 annual statements (3 year intervals)
 */
export function getPeriodStatementLimit(period: HistoricalPeriod): number {
  switch (period) {
    case "3Y":
      return 4;
    case "5Y":
      return 6;
    case "10Y":
    default:
      return 11;
  }
}

/**
 * Slice financial statements to match the lookback limit of a given HistoricalPeriod.
 * Preserves original statement sorting (newest first).
 */
export function sliceStatementsForPeriod<T>(
  statements: T[] | null | undefined,
  period: HistoricalPeriod,
): T[] {
  if (!statements || !Array.isArray(statements) || statements.length === 0) {
    return [];
  }
  const limit = getPeriodStatementLimit(period);
  return statements.slice(0, limit);
}

/**
 * Calculate Compound Annual Growth Rate (CAGR)
 * Formula: ((Ending Value / Beginning Value) ^ (1 / Years)) - 1
 */
export function calculateCAGR(
  beginningValue: number,
  endingValue: number,
  years: number,
): number {
  if (beginningValue <= 0 || endingValue <= 0 || years <= 0) {
    return 0;
  }
  return Math.pow(endingValue / beginningValue, 1 / years) - 1;
}

/**
 * Calculate Revenue CAGR from income statements.
 * Formula: CAGR = (Ending Revenue / Beginning Revenue) ^ (1 / n) - 1
 * Where:
 * - Beginning Revenue = revenue from the starting fiscal year (first statement)
 * - Ending Revenue = revenue from the ending fiscal year (last statement)
 * - n = number of growth periods (Ending Fiscal Year - Beginning Fiscal Year)
 * Returns 0 whenever CAGR cannot be calculated due to zero/negative values or invalid data.
 */
export function calculateRevenueCAGR(
  statements: FinancialStatement[] | null | undefined,
): number {
  if (!statements || !Array.isArray(statements) || statements.length < 2) {
    return 0;
  }

  // Filter out invalid statement objects or missing/non-numeric revenue
  const validStatements = statements.filter(
    (s) =>
      s &&
      s.date &&
      typeof s.revenue === "number" &&
      !isNaN(s.revenue) &&
      isFinite(s.revenue),
  );

  if (validStatements.length < 2) {
    return 0;
  }

  // Clone to prevent mutating input array and sort chronologically by date
  const sortedByDate = [...validStatements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Handle duplicate dates by keeping the latest occurrence
  const uniqueByDate: FinancialStatement[] = [];
  const seenDates = new Set<string>();
  for (let i = sortedByDate.length - 1; i >= 0; i--) {
    const dateStr = new Date(sortedByDate[i].date).toISOString().split("T")[0];
    if (!seenDates.has(dateStr)) {
      seenDates.add(dateStr);
      uniqueByDate.unshift(sortedByDate[i]);
    }
  }

  if (uniqueByDate.length < 2) {
    return 0;
  }

  const firstStatement = uniqueByDate[0];
  const lastStatement = uniqueByDate[uniqueByDate.length - 1];

  const firstRevenue = firstStatement.revenue!;
  const lastRevenue = lastStatement.revenue!;

  // Business rule: return 0 if starting or ending revenue <= 0
  if (firstRevenue <= 0 || lastRevenue <= 0) {
    return 0;
  }

  const firstYear = new Date(firstStatement.date).getFullYear();
  const lastYear = new Date(lastStatement.date).getFullYear();
  const yearDiff = lastYear - firstYear;
  const years = yearDiff > 0 ? yearDiff : uniqueByDate.length - 1;

  if (years <= 0) {
    return 0;
  }

  return calculateCAGR(firstRevenue, lastRevenue, years);
}

export interface EPSTrendResult {
  trend: "Improving" | "Deteriorating" | "Declining" | "Flat" | "Turnaround" | "Emerging";
  isProfitable: boolean;
  score: number;
  changePct: number | null;
}

/**
 * Calculate EPS Growth (CAGR) from income statements.
 * Rules:
 * 1. Search chronologically for the earliest fiscal year where EPS is positive (> 0).
 * 2. Use that year as beginning EPS value.
 * 3. Use the latest available fiscal year EPS as ending EPS value.
 * 4. Calculate CAGR if ending EPS > 0 and endingYear - beginningYear >= 1.
 * 5. Returns null (N/A) if no positive EPS baseline exists, ending EPS <= 0, or insufficient periods.
 */
export function calculateEPSGrowth(
  statements: FinancialStatement[] | null | undefined,
): number | null {
  if (!statements || !Array.isArray(statements) || statements.length < 2) {
    return null;
  }

  // Filter out invalid statement objects or missing/non-numeric EPS
  const validStatements = statements.filter(
    (s) =>
      s &&
      s.date &&
      typeof s.eps === "number" &&
      !isNaN(s.eps) &&
      isFinite(s.eps),
  );

  if (validStatements.length < 2) {
    return null;
  }

  // Clone to prevent mutating input array and sort chronologically by date
  const sortedByDate = [...validStatements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Handle duplicate dates by keeping the latest occurrence
  const uniqueByDate: FinancialStatement[] = [];
  const seenDates = new Set<string>();
  for (let i = sortedByDate.length - 1; i >= 0; i--) {
    const dateStr = new Date(sortedByDate[i].date).toISOString().split("T")[0];
    if (!seenDates.has(dateStr)) {
      seenDates.add(dateStr);
      uniqueByDate.unshift(sortedByDate[i]);
    }
  }

  if (uniqueByDate.length < 2) {
    return null;
  }

  // Use up to 10 years of EPS history (up to 11 statement entries)
  const windowStatements =
    uniqueByDate.length > 11 ? uniqueByDate.slice(-11) : uniqueByDate;

  const lastStatement = windowStatements[windowStatements.length - 1];
  const lastEPS = lastStatement.eps!;

  // Business rule: ending EPS must be positive (> 0)
  if (lastEPS <= 0) {
    return null;
  }

  // Search chronologically from oldest to newest for the first positive EPS statement (> 0)
  const firstPositiveIdx = windowStatements.findIndex((s) => s.eps! > 0);
  if (firstPositiveIdx === -1 || firstPositiveIdx === windowStatements.length - 1) {
    return null;
  }

  const firstPositiveStatement = windowStatements[firstPositiveIdx];
  const firstEPS = firstPositiveStatement.eps!;

  const firstYear = new Date(firstPositiveStatement.date).getFullYear();
  const lastYear = new Date(lastStatement.date).getFullYear();
  const yearDiff = lastYear - firstYear;
  const years = yearDiff > 0 ? yearDiff : windowStatements.length - 1 - firstPositiveIdx;

  // Minimum period requirement: EPS CAGR requires at least 2 compounding periods (>= 2 years)
  if (years < 2) {
    return null;
  }

  return calculateCAGR(firstEPS, lastEPS, years);
}

/**
 * Calculate dynamic EPS Quality Score (0-100) based on starting EPS, ending EPS, and profitability.
 * Profitability Rule: Unprofitable companies (endingEPS <= 0) are strictly capped below 50.
 */
export function calculateEPSQualityScore(
  startingEPS: number,
  endingEPS: number,
): number {
  const netChange = endingEPS - startingEPS;
  const isFlat = Math.abs(netChange) <= 0.02;

  if (startingEPS > 0 && endingEPS > 0) {
    // Both positive (Profitable)
    if (isFlat) return 50;
    if (netChange > 0) {
      // Growing profitable EPS: range 80 - 100
      const pctGrowth = netChange / startingEPS;
      return Math.min(100, Math.round(80 + Math.min(pctGrowth * 20, 20)));
    } else {
      // Declining profitable EPS: range 10 - 39
      const pctDecline = Math.abs(netChange) / startingEPS;
      return Math.max(10, Math.round(40 - Math.min(pctDecline * 30, 30)));
    }
  }

  if (startingEPS <= 0 && endingEPS > 0) {
    // Turnaround into profitability: range 70 - 90
    const turnaroundRatio = endingEPS / Math.max(Math.abs(startingEPS), 0.1);
    return Math.min(90, Math.round(70 + Math.min(turnaroundRatio * 20, 20)));
  }

  if (startingEPS > 0 && endingEPS <= 0) {
    // Profit turned into loss (Deterioration): range 0 - 15
    const lossSeverity = Math.abs(endingEPS) / startingEPS;
    return Math.max(0, Math.round(15 - Math.min(lossSeverity * 15, 15)));
  }

  // Both non-positive (endingEPS <= 0) -> Strictly capped below 50
  if (isFlat) return 25;

  if (netChange > 0) {
    // Shrinking losses: range 25 - 45
    const lossReductionPct = (endingEPS - startingEPS) / Math.abs(startingEPS);
    return Math.min(45, Math.round(25 + Math.min(lossReductionPct * 20, 20)));
  } else {
    // Expanding losses: range 0 - 15
    const lossExpansion = Math.abs(netChange) / Math.max(Math.abs(startingEPS), 0.1);
    return Math.max(0, Math.round(15 - Math.min(lossExpansion * 15, 15)));
  }
}


/**
 * Calculate directional EPS Trend and dynamic EPS Quality Score when CAGR is unavailable or to supplement analysis.
 * Rules:
 * 1. Sort financial statements chronologically by fiscal date.
 * 2. Determine startingEPS, endingEPS, and isProfitable (endingEPS > 0).
 * 3. Categorize EPS Trend (Improving | Deteriorating | Declining | Flat | Turnaround | Emerging).
 * 4. Compute dynamic EPS Quality Score using calculateEPSQualityScore.
 */
export function calculateEPSTrend(
  statements: FinancialStatement[] | null | undefined,
): EPSTrendResult {
  if (!statements || !Array.isArray(statements) || statements.length === 0) {
    return { trend: "Flat", isProfitable: false, score: 25, changePct: null };
  }

  const validStatements = statements.filter(
    (s) =>
      s &&
      s.date &&
      typeof s.eps === "number" &&
      !isNaN(s.eps) &&
      isFinite(s.eps),
  );

  if (validStatements.length === 0) {
    return { trend: "Flat", isProfitable: false, score: 25, changePct: null };
  }

  // 1. Sort financial statements chronologically by fiscal date
  const sortedByDate = [...validStatements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const uniqueByDate: FinancialStatement[] = [];
  const seenDates = new Set<string>();
  for (let i = sortedByDate.length - 1; i >= 0; i--) {
    const dateStr = new Date(sortedByDate[i].date).toISOString().split("T")[0];
    if (!seenDates.has(dateStr)) {
      seenDates.add(dateStr);
      uniqueByDate.unshift(sortedByDate[i]);
    }
  }

  // 2. Determine startingEPS, endingEPS, and isProfitable
  const epsValues = uniqueByDate.map((s) => s.eps!);
  const startingEPS = epsValues[0];
  const endingEPS = epsValues[epsValues.length - 1];
  const isProfitable = endingEPS > 0;

  if (epsValues.length === 1) {
    return {
      trend: "Flat",
      isProfitable,
      score: isProfitable ? 50 : 20,
      changePct: null,
    };
  }

  // 3. Determine EPS trend using transition rules
  const netChange = endingEPS - startingEPS;
  const isFlat = Math.abs(netChange) <= 0.02;

  let trend: "Improving" | "Deteriorating" | "Declining" | "Flat" | "Turnaround" | "Emerging" = "Flat";
  if (isFlat) {
    trend = "Flat";
  } else if (startingEPS <= 0 && endingEPS > 0) {
    trend = startingEPS === 0 ? "Emerging" : "Turnaround";
  } else if (startingEPS > 0 && endingEPS <= 0) {
    trend = endingEPS === 0 ? "Declining" : "Deteriorating";
  } else if (netChange > 0) {
    trend = "Improving";
  } else {
    trend = "Declining";
  }

  let changePct: number | null = null;
  if (startingEPS !== 0) {
    if (startingEPS <= 0 && endingEPS > 0) {
      changePct = ((endingEPS - startingEPS) / Math.abs(startingEPS)) * 100;
    } else if (startingEPS > 0 && endingEPS <= 0) {
      changePct = ((endingEPS - startingEPS) / startingEPS) * 100;
    } else if (startingEPS <= 0 && endingEPS <= 0) {
      const absStart = Math.abs(startingEPS);
      const absEnd = Math.abs(endingEPS);
      changePct = ((absStart - absEnd) / absStart) * 100;
    } else {
      changePct = (netChange / startingEPS) * 100;
    }
  }

  // 4. Calculate dynamic EPS Quality Score using helper function
  const score = calculateEPSQualityScore(startingEPS, endingEPS);

  return { trend, isProfitable, score, changePct };
}

/**
 * Calculate Free Cash Flow (FCF) = Operating Cash Flow - Capital Expenditure
 */
export function calculateFCF(
  operatingCashFlow: number | undefined,
  capitalExpenditure: number | undefined,
): number | null {
  if (operatingCashFlow === undefined || capitalExpenditure === undefined) {
    return null;
  }
  return operatingCashFlow - Math.abs(capitalExpenditure || 0);
}

/**
 * Calculate FCF Growth (CAGR) from cash flow statements.
 * Rules:
 * 1. Search chronologically for the earliest fiscal year in history where FCF > 0.
 * 2. Use that year as beginning FCF baseline value.
 * 3. Use the latest available fiscal year FCF as ending FCF value.
 * 4. Calculate CAGR if ending FCF > 0 and endingYear - beginningYear >= 3.
 * 5. Returns null (N/A) if no positive FCF baseline exists, ending FCF <= 0, or positive FCF period is < 3 years.
 */
export function calculateFCFGrowth(
  cashFlowStatements: FinancialStatement[] | null | undefined,
): number | null {
  if (!cashFlowStatements || !Array.isArray(cashFlowStatements) || cashFlowStatements.length < 2) {
    return null;
  }

  const validStatements = cashFlowStatements.filter(
    (s) =>
      s &&
      s.date &&
      typeof s.operatingCashFlow === "number" &&
      typeof s.capitalExpenditure === "number",
  );

  if (validStatements.length < 2) {
    return null;
  }

  const sortedByDate = [...validStatements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const statementsWithFCF = sortedByDate
    .map((statement) => ({
      statement,
      fcf: calculateFCF(statement.operatingCashFlow, statement.capitalExpenditure),
    }))
    .filter((item): item is { statement: FinancialStatement; fcf: number } => item.fcf !== null);

  if (statementsWithFCF.length < 2) {
    return null;
  }

  // Use up to 10 years of FCF history (up to 11 statement entries)
  const windowStatements =
    statementsWithFCF.length > 11 ? statementsWithFCF.slice(-11) : statementsWithFCF;

  const lastStatement = windowStatements[windowStatements.length - 1];
  const lastFCF = lastStatement.fcf;

  // Business rule: ending FCF must be positive (> 0)
  if (lastFCF <= 0) {
    return null;
  }

  // Search chronologically from oldest to newest for the first positive FCF statement (> 0)
  const firstPositiveIdx = windowStatements.findIndex((item) => item.fcf > 0);
  if (firstPositiveIdx === -1 || firstPositiveIdx === windowStatements.length - 1) {
    return null;
  }

  const firstPositiveItem = windowStatements[firstPositiveIdx];
  const firstPositiveFCF = firstPositiveItem.fcf;

  const firstYear = new Date(firstPositiveItem.statement.date).getFullYear();
  const lastYear = new Date(lastStatement.statement.date).getFullYear();
  const yearDiff = lastYear - firstYear;
  const years = yearDiff > 0 ? yearDiff : windowStatements.length - 1 - firstPositiveIdx;

  // Requirement: positive FCF period must be >= 3 years
  if (years < 3) {
    return null;
  }

  return calculateCAGR(firstPositiveFCF, lastFCF, years);
}

/**
 * Calculate FCF Trend and dynamic Quality Score when CAGR is invalid or misleading.
 */
export function calculateFCFTrend(
  cashFlowStatements: FinancialStatement[] | null | undefined,
): FCFTrendResult {
  if (!cashFlowStatements || !Array.isArray(cashFlowStatements) || cashFlowStatements.length === 0) {
    return { trend: "Flat", isPositive: false, score: 25, burnChangePct: null };
  }

  const sortedByDate = [...cashFlowStatements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const statementsWithFCF = sortedByDate
    .map((statement) => ({
      statement,
      fcf: calculateFCF(statement.operatingCashFlow, statement.capitalExpenditure),
    }))
    .filter((item): item is { statement: FinancialStatement; fcf: number } => item.fcf !== null);

  if (statementsWithFCF.length === 0) {
    return { trend: "Flat", isPositive: false, score: 25, burnChangePct: null };
  }

  const startingFCF = statementsWithFCF[0].fcf;
  const endingFCF = statementsWithFCF[statementsWithFCF.length - 1].fcf;
  const isPositive = endingFCF > 0;

  if (statementsWithFCF.length === 1) {
    return {
      trend: "Flat",
      isPositive,
      score: isPositive ? 50 : 20,
      burnChangePct: null,
    };
  }

  const netChange = endingFCF - startingFCF;
  const isFlat = startingFCF !== 0
    ? Math.abs(netChange) <= 0.01 * Math.abs(startingFCF)
    : Math.abs(netChange) <= 0.01;

  // Scenario 1: Positive FCF -> Positive FCF
  if (startingFCF > 0 && endingFCF > 0) {
    const trend = isFlat ? "Flat" : netChange > 0 ? "Improving" : "Deteriorating";
    const pctGrowth = netChange / startingFCF;
    const score = netChange > 0
      ? Math.min(100, Math.round(80 + Math.min(pctGrowth * 20, 20)))
      : Math.max(10, Math.round(40 - Math.min(Math.abs(netChange / startingFCF) * 30, 30)));
    return { trend, isPositive, score, burnChangePct: (netChange / startingFCF) * 100 };
  }

  // Scenario 2: Negative/Zero FCF -> Positive FCF (Turnaround or Emerging)
  // Formula: ((Ending FCF - Beginning FCF) / ABS(Beginning FCF)) * 100
  if (startingFCF <= 0 && endingFCF > 0) {
    const improvementPct = startingFCF !== 0
      ? ((endingFCF - startingFCF) / Math.abs(startingFCF)) * 100
      : null;
    return {
      trend: startingFCF === 0 ? "Emerging" : "Turnaround",
      isPositive: true,
      score: 75,
      burnChangePct: improvementPct,
    };
  }

  // Scenario 3: Positive FCF -> Zero/Negative FCF (Declining or Deterioration)
  // Formula: ((Ending FCF - Beginning FCF) / Beginning FCF) * 100
  if (startingFCF > 0 && endingFCF <= 0) {
    const deteriorationPct = ((endingFCF - startingFCF) / startingFCF) * 100;
    return {
      trend: endingFCF === 0 ? "Declining" : "Deteriorating",
      isPositive: false,
      score: 0,
      burnChangePct: deteriorationPct,
    };
  }

  // Scenario 4: Negative FCF -> Negative FCF (Both Negative / Cash Burn)
  // Formula: ((ABS(startingFCF) - ABS(endingFCF)) / ABS(startingFCF)) * 100
  const absStart = Math.abs(startingFCF);
  const absEnd = Math.abs(endingFCF);
  const burnChangePct = ((absStart - absEnd) / absStart) * 100;

  if (isFlat) {
    return { trend: "Flat", isPositive: false, score: 25, burnChangePct };
  }

  if (endingFCF > startingFCF) {
    // Cash burn shrinking (e.g. -200M -> -50M, burnChangePct = +75%)
    const score = Math.min(45, Math.round(25 + Math.min((burnChangePct / 100) * 20, 20)));
    return { trend: "Improving", isPositive: false, score, burnChangePct };
  } else {
    // Cash burn worsening (e.g. -45.9M -> -321.8M, burnChangePct = -601.09%)
    return { trend: "Deteriorating", isPositive: false, score: 0, burnChangePct };
  }
}

/**
 * Return dynamic FCF formula string based on starting and ending FCF values.
 */
export function getFCFFormula(
  data: { label?: string; value?: number; operatingCashFlow?: number; capitalExpenditure?: number }[] | null | undefined,
  actualCAGR: number | null,
): string {
  if (actualCAGR !== null) {
    return "FCF CAGR = (Ending FCF / Beginning FCF) ^ (1 / n) - 1";
  }
  if (!data || !Array.isArray(data) || data.length < 2) {
    return "FCF Growth Formula";
  }

  const getFCFVal = (item: { value?: number; operatingCashFlow?: number; capitalExpenditure?: number }): number | null => {
    if (typeof item.value === "number") return item.value;
    if (typeof item.operatingCashFlow === "number" && typeof item.capitalExpenditure === "number") {
      return item.operatingCashFlow - item.capitalExpenditure;
    }
    return null;
  };

  const first = getFCFVal(data[0]);
  const last = getFCFVal(data[data.length - 1]);

  if (first === null || last === null) {
    return "FCF Growth Formula";
  }

  if (first <= 0 && last > 0) {
    return "FCF Improvement % = ((Ending FCF - Beginning FCF) / ABS(Beginning FCF)) * 100";
  }
  if (first > 0 && last <= 0) {
    return "FCF Deterioration % = ((Ending FCF - Beginning FCF) / Beginning FCF) * 100";
  }
  if (first <= 0 && last <= 0) {
    return "Cash Burn Change % = ((ABS(Beginning FCF) - ABS(Ending FCF)) / ABS(Beginning FCF)) * 100";
  }
  return "FCF CAGR = (Ending FCF / Beginning FCF) ^ (1 / n) - 1";
}

export function calculateDividendCAGR(
  dividends: FinancialStatement[],
): number | null {
  if (!dividends || dividends.length === 0) {
    return null;
  }

  // Sum dividends by calendar year
  const annualDividends = dividends.reduce<Record<number, number>>(
    (acc, statement) => {
      if (statement.dividend == null) {
        return acc;
      }

      const year = new Date(statement.date).getFullYear();

      acc[year] = (acc[year] ?? 0) + statement.dividend;

      return acc;
    },
    {},
  );

  const years = Object.keys(annualDividends)
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length < 2) {
    return null;
  }

  const firstDividend = annualDividends[years[0]];
  const lastDividend = annualDividends[years[years.length - 1]];

  if (firstDividend <= 0 || lastDividend <= 0) {
    return null;
  }

  return calculateCAGR(firstDividend, lastDividend, years.length - 1);
}

/**
 * Calculate Return on Invested Capital (ROIC)
 * ROIC = NOPAT / Invested Capital
 * Simplified: NOPAT = Operating Income * (1 - Tax Rate)
 * Tax Rate approximated from net income / operating income
 */
export function calculateROIC(
  operatingIncome: number | undefined,
  netIncome: number | undefined,
  investedCapital: number | undefined,
): number | null {
  if (!operatingIncome || !investedCapital || investedCapital <= 0) {
    return null;
  }

  // Approximate tax rate
  let taxRate = 0.25; // Default 25% tax rate
  if (netIncome && operatingIncome > 0) {
    taxRate = Math.max(0, 1 - netIncome / operatingIncome);
    taxRate = Math.min(1, taxRate); // Clamp between 0 and 1
  }

  const nopat = operatingIncome * (1 - taxRate);
  return (nopat / investedCapital) * 100;
}

/**
 * Calculate annual paired ROIC series from income statements and balance sheets
 */
export function calculateROICSeries(
  incomeStatements: FinancialStatement[],
  balanceSheets: FinancialStatement[],
): { year: string; roic: number }[] {
  if (!incomeStatements || !balanceSheets || incomeStatements.length === 0 || balanceSheets.length === 0) {
    return [];
  }

  const sortedIncome = [...incomeStatements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const series: { year: string; roic: number }[] = [];

  for (const inc of sortedIncome) {
    if (!inc.date || inc.operatingIncome === undefined) continue;
    const yearNum = new Date(inc.date).getFullYear();

    const bal = balanceSheets.find(
      (b) => b.date && new Date(b.date).getFullYear() === yearNum
    );

    if (!bal || bal.totalEquity === undefined || bal.totalDebt === undefined) continue;

    const investedCapital = bal.totalEquity + bal.totalDebt;
    if (investedCapital <= 0) continue;

    const roic = calculateROIC(inc.operatingIncome, inc.netIncome, investedCapital);
    if (roic !== null && !isNaN(roic) && isFinite(roic)) {
      series.push({ year: yearNum.toString(), roic });
    }
  }

  return series;
}

/**
 * Calculate average ROIC for a specific historical period (10Y, 5Y, 3Y)
 */
export function calculateROICAverageForPeriod(
  incomeStatements: FinancialStatement[],
  balanceSheets: FinancialStatement[],
  period: HistoricalPeriod
): number | null {
  const series = calculateROICSeries(incomeStatements, balanceSheets);
  if (series.length === 0) return null;

  let limit = 10;
  let minRequired = 4;

  if (period === "3Y") {
    limit = 3;
    minRequired = 2;
  } else if (period === "5Y") {
    limit = 5;
    minRequired = 3;
  } else if (period === "10Y") {
    limit = 10;
    minRequired = 4;
  }

  const periodSeries = series.slice(0, limit);
  if (periodSeries.length < minRequired) {
    return null;
  }

  const sum = periodSeries.reduce((acc, curr) => acc + curr.roic, 0);
  return sum / periodSeries.length;
}

/**
 * Full Multi-Period ROIC Analysis: Level (10 pts) + Trend (5 pts) + Consistency (5 pts) = 20 pts max
 */
export function calculateROICAnalysis(
  incomeStatements: FinancialStatement[],
  balanceSheets: FinancialStatement[],
  _selectedPeriod: HistoricalPeriod = "10Y"
): ROICAnalysisDetail {
  const series = calculateROICSeries(incomeStatements, balanceSheets);
  const latestROIC = series.length > 0 ? series[0].roic : null;

  const roic3Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "3Y");
  const roic5Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "5Y");
  const roic10Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "10Y");

  // Determine effective ROIC Level
  let effectiveROIC: number | null = null;
  if (roic3Y !== null && roic5Y !== null && roic10Y !== null) {
    effectiveROIC = 0.50 * roic3Y + 0.30 * roic5Y + 0.20 * roic10Y;
  } else if (roic3Y !== null && roic5Y !== null) {
    effectiveROIC = 0.60 * roic3Y + 0.40 * roic5Y;
  } else {
    effectiveROIC = roic3Y ?? roic5Y ?? roic10Y ?? latestROIC;
  }

  // 1. ROIC Level Score (0 to 10.0 points)
  let levelScorePoints = 0;
  if (effectiveROIC !== null) {
    if (effectiveROIC >= 25) {
      levelScorePoints = 10.0;
    } else if (effectiveROIC >= 20) {
      levelScorePoints = 8.5 + ((effectiveROIC - 20) / 5) * 1.5;
    } else if (effectiveROIC >= 15) {
      levelScorePoints = 7.0 + ((effectiveROIC - 15) / 5) * 1.5;
    } else if (effectiveROIC >= 10) {
      levelScorePoints = 5.0 + ((effectiveROIC - 10) / 5) * 2.0;
    } else if (effectiveROIC >= 5) {
      levelScorePoints = 3.0 + ((effectiveROIC - 5) / 5) * 2.0;
    } else if (effectiveROIC >= 0) {
      levelScorePoints = 0.5 + (effectiveROIC / 5) * 2.5;
    } else {
      levelScorePoints = 0;
    }
  }

  // 2. ROIC Trend Classification & Score (0 to 5.0 points)
  let trend: ROICTrendDirection = "N/A";
  let trendScorePoints = 2.5;

  if (roic3Y !== null && roic5Y !== null && roic10Y !== null) {
    if (roic3Y >= roic5Y + 0.75 && roic5Y >= roic10Y + 0.75) {
      trend = "Improving";
    } else if (roic3Y >= roic10Y + 2.0 && roic3Y >= roic5Y) {
      trend = "Improving";
    } else if (roic3Y <= roic5Y - 0.75 && roic5Y <= roic10Y - 0.75) {
      trend = "Declining";
    } else if (roic3Y <= roic10Y - 2.0 && roic3Y <= roic5Y) {
      trend = "Declining";
    } else if (Math.abs(roic3Y - roic10Y) <= 2.0 && Math.abs(roic5Y - roic10Y) <= 2.0) {
      trend = "Stable";
    } else {
      trend = "Mixed";
    }
  } else if (roic3Y !== null && roic5Y !== null) {
    if (roic3Y >= roic5Y + 1.0) {
      trend = "Improving";
    } else if (roic3Y <= roic5Y - 1.0) {
      trend = "Declining";
    } else {
      trend = "Stable";
    }
  } else if (series.length >= 2) {
    const oldest = series[series.length - 1].roic;
    const newest = series[0].roic;
    if (newest >= oldest + 1.5) trend = "Improving";
    else if (newest <= oldest - 1.5) trend = "Declining";
    else trend = "Stable";
  }

  if (trend === "Improving") {
    trendScorePoints = 4.5 + (roic3Y && roic3Y >= 15 ? 0.5 : 0.3);
  } else if (trend === "Stable") {
    trendScorePoints = 3.8;
  } else if (trend === "Mixed") {
    trendScorePoints = 2.5;
  } else if (trend === "Declining") {
    trendScorePoints = 0.8;
  }

  // 3. ROIC Consistency Classification & Score (0 to 5.0 points)
  let consistency: ROICConsistencyLevel = "N/A";
  let consistencyScorePoints = 2.5;
  let stdDev: number | null = null;

  if (series.length >= 2) {
    const meanRoic = series.reduce((acc, curr) => acc + curr.roic, 0) / series.length;
    const variance = series.reduce((acc, curr) => acc + Math.pow(curr.roic - meanRoic, 2), 0) / (series.length - 1);
    stdDev = Math.sqrt(variance);

    const positiveCount = series.filter(s => s.roic > 0).length;
    const posRatio = positiveCount / series.length;

    if (stdDev <= 3.0 && posRatio === 1.0) {
      consistency = "Highly Consistent";
      consistencyScorePoints = 4.8 + Math.min(0.2, (3.0 - stdDev) / 3.0 * 0.2);
    } else if (stdDev <= 6.0 && posRatio >= 0.8) {
      consistency = "Consistent";
      consistencyScorePoints = 3.6 + ((6.0 - stdDev) / 3.0) * 0.8;
    } else if (stdDev <= 10.0 && posRatio >= 0.6) {
      consistency = "Moderate";
      consistencyScorePoints = 2.5 + ((10.0 - stdDev) / 4.0) * 0.9;
    } else {
      consistency = "Inconsistent";
      consistencyScorePoints = Math.max(0, 2.0 - ((stdDev - 10.0) / 10.0) * 1.5);
    }
  }

  // Round points
  levelScorePoints = Math.min(10.0, Math.max(0, Number(levelScorePoints.toFixed(1))));
  trendScorePoints = Math.min(5.0, Math.max(0, Number(trendScorePoints.toFixed(1))));
  consistencyScorePoints = Math.min(5.0, Math.max(0, Number(consistencyScorePoints.toFixed(1))));

  const totalROICPoints = Math.min(20.0, Math.max(0, Number((levelScorePoints + trendScorePoints + consistencyScorePoints).toFixed(1))));
  const totalROICScore100 = Math.min(100, Math.max(0, Math.round((totalROICPoints / 20.0) * 100)));

  return {
    roic10Y,
    roic5Y,
    roic3Y,
    latestROIC,
    levelScorePoints,
    trend,
    trendScorePoints,
    consistency,
    consistencyScorePoints,
    stdDev,
    totalROICPoints,
    totalROICScore100,
    annualHistory: [...series].reverse(), // chronologically ordered (oldest to newest)
  };
}

/**
 * Calculate average ROIC from latest financial statements
 */
export function calculateAverageROIC(
  incomeStatements: FinancialStatement[],
  balanceSheets: FinancialStatement[],
): number | null {
  const series = calculateROICSeries(incomeStatements, balanceSheets);
  return series.length > 0 ? series[0].roic : null;
}

/**
 * Calculate Debt-to-Equity ratio
 */
export function calculateDebtToEquity(
  totalDebt: number | undefined,
  totalEquity: number | undefined,
): number | null {
  if (
    totalDebt === undefined ||
    totalEquity === undefined ||
    totalEquity === 0
  ) {
    return null;
  }
  return totalDebt / totalEquity;
}

/**
 * Calculate profit margins
 */
export function calculateMargins(statement: FinancialStatement): {
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
} {
  return {
    grossMargin:
      statement.grossProfit && statement.revenue
        ? (statement.grossProfit / statement.revenue) * 100
        : null,
    operatingMargin:
      statement.operatingIncome && statement.revenue
        ? (statement.operatingIncome / statement.revenue) * 100
        : null,
    netMargin:
      statement.netIncome && statement.revenue
        ? (statement.netIncome / statement.revenue) * 100
        : null,
  };
}

/**
 * Calculate average margins from all available statements
 */
export function calculateAverageMargins(statements: FinancialStatement[]): {
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
} {
  if (!statements || statements.length === 0) {
    return { grossMargin: null, operatingMargin: null, netMargin: null };
  }

  let totalGross = 0,
    totalOp = 0,
    totalNet = 0;
  let grossCount = 0,
    opCount = 0,
    netCount = 0;

  for (const statement of statements) {
    const margins = calculateMargins(statement);

    if (margins.grossMargin !== null) {
      totalGross += margins.grossMargin;
      grossCount++;
    }
    if (margins.operatingMargin !== null) {
      totalOp += margins.operatingMargin;
      opCount++;
    }
    if (margins.netMargin !== null) {
      totalNet += margins.netMargin;
      netCount++;
    }
  }

  return {
    grossMargin: grossCount > 0 ? totalGross / grossCount : null,
    operatingMargin: opCount > 0 ? totalOp / opCount : null,
    netMargin: netCount > 0 ? totalNet / netCount : null,
  };
}

/**
 * Calculate FCF Margin from the most recent fiscal year statements.
 * Formula: (Free Cash Flow / Revenue) * 100
 * Returns null if Revenue or FCF is unavailable, invalid, or Revenue is 0.
 */
export function calculateFCFMargin(
  incomeStatements?: FinancialStatement[] | null,
  cashFlowStatements?: FinancialStatement[] | null,
): number | null {
  if (!incomeStatements || !cashFlowStatements || incomeStatements.length === 0 || cashFlowStatements.length === 0) {
    return null;
  }

  const sortedIncome = [...incomeStatements]
    .filter((s) => s && s.date && typeof s.revenue === "number" && !isNaN(s.revenue) && isFinite(s.revenue))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sortedCashFlow = [...cashFlowStatements]
    .filter((s) => s && s.date && s.operatingCashFlow !== undefined && s.capitalExpenditure !== undefined)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedIncome.length === 0 || sortedCashFlow.length === 0) {
    return null;
  }

  const latestIncome = sortedIncome[0];
  const latestYear = new Date(latestIncome.date).getFullYear();

  let matchingCashFlow = sortedCashFlow.find(
    (c) => new Date(c.date).getFullYear() === latestYear,
  );

  if (!matchingCashFlow) {
    matchingCashFlow = sortedCashFlow[0];
  }

  const revenue = latestIncome.revenue;
  if (!revenue || revenue === 0) {
    return null;
  }

  const fcf = calculateFCF(matchingCashFlow.operatingCashFlow, matchingCashFlow.capitalExpenditure);
  if (fcf === null) {
    return null;
  }

  return (fcf / revenue) * 100;
}

/**
 * Calculate historical annual FCF Margin for charts and trend displays.
 */
export function calculateFCFMarginHistory(
  incomeStatements?: FinancialStatement[] | null,
  cashFlowStatements?: FinancialStatement[] | null,
): { label: string; value: number }[] {
  if (!incomeStatements || !cashFlowStatements || incomeStatements.length === 0 || cashFlowStatements.length === 0) {
    return [];
  }

  const sortedIncome = [...incomeStatements]
    .filter((s) => s && s.date && typeof s.revenue === "number" && !isNaN(s.revenue) && isFinite(s.revenue))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const sortedCashFlow = [...cashFlowStatements]
    .filter((s) => s && s.date && s.operatingCashFlow !== undefined && s.capitalExpenditure !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const history: { label: string; value: number }[] = [];

  for (const inc of sortedIncome) {
    const year = new Date(inc.date).getFullYear();
    const cf = sortedCashFlow.find((c) => new Date(c.date).getFullYear() === year);
    if (cf && inc.revenue && inc.revenue !== 0) {
      const fcf = calculateFCF(cf.operatingCashFlow, cf.capitalExpenditure);
      if (fcf !== null) {
        history.push({
          label: String(year),
          value: (fcf / inc.revenue) * 100,
        });
      }
    }
  }

  return history;
}

/**
 * Calculate FCF Consistency score (0-100) measuring reliability of free cash flow generation.
 * Includes:
 * - Number of profitable FCF years
 * - Percentage of years with positive FCF
 * - FCF volatility/trend
 */
export function calculateFCFConsistency(
  cashFlowStatements: FinancialStatement[] | null | undefined,
): number | null {
  if (!cashFlowStatements || !Array.isArray(cashFlowStatements) || cashFlowStatements.length === 0) {
    return null;
  }

  const validStatements = cashFlowStatements.filter(
    (s) =>
      s &&
      s.date &&
      typeof s.operatingCashFlow === "number" &&
      typeof s.capitalExpenditure === "number",
  );

  if (validStatements.length === 0) {
    return null;
  }

  const fcfValues: number[] = [];
  for (const s of validStatements) {
    const fcf = calculateFCF(s.operatingCashFlow, s.capitalExpenditure);
    if (fcf !== null) {
      fcfValues.push(fcf);
    }
  }

  if (fcfValues.length === 0) {
    return null;
  }

  const totalYears = fcfValues.length;
  const positiveYears = fcfValues.filter((val) => val > 0).length;
  const positivePct = positiveYears / totalYears;

  const ratioScore = positivePct * 100;
  const countScore = Math.min(100, (positiveYears / Math.min(5, Math.max(totalYears, 1))) * 100);

  let volatilityScore = 50;
  const mean = fcfValues.reduce((sum, val) => sum + val, 0) / totalYears;

  if (mean > 0 && totalYears >= 2) {
    const variance =
      fcfValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totalYears;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    if (cv <= 0.3) {
      volatilityScore = 100;
    } else if (cv <= 0.8) {
      volatilityScore = Math.round(100 - ((cv - 0.3) / 0.5) * 30);
    } else if (cv <= 1.5) {
      volatilityScore = Math.round(70 - ((cv - 0.8) / 0.7) * 40);
    } else {
      volatilityScore = Math.max(0, Math.round(30 - (cv - 1.5) * 15));
    }
  } else if (positiveYears === totalYears) {
    volatilityScore = 85;
  } else if (positiveYears === 0) {
    volatilityScore = 0;
  }

  const finalConsistency = Math.round(
    0.5 * ratioScore + 0.25 * countScore + 0.25 * volatilityScore,
  );

  return Math.min(100, Math.max(0, finalConsistency));
}

/**
 * Calculate Multi-Year Cumulative FCF Conversion (%)
 * Formula: (Sum of Free Cash Flow over up to 10 historical years / Sum of Net Income over same period) * 100
 * Requirements:
 * - Uses up to 10 most recent available fiscal years.
 * - Requires at least 3 years of aligned data. Returns null if fewer than 3 years.
 * - Returns 0 if cumulative Net Income is non-positive (<= 0).
 */
export function calculateFCFConversion(
  incomeStatements: FinancialStatement[] | null | undefined,
  cashFlowStatements: FinancialStatement[] | null | undefined,
): number | null {
  if (!incomeStatements || !cashFlowStatements || incomeStatements.length === 0 || cashFlowStatements.length === 0) {
    return null;
  }

  // 1. Group income statements by fiscal year (YYYY)
  const incomeByYear = new Map<string, number>();
  for (const s of incomeStatements) {
    if (s && s.date && typeof s.netIncome === "number" && !isNaN(s.netIncome) && isFinite(s.netIncome)) {
      const year = new Date(s.date).getFullYear().toString();
      incomeByYear.set(year, s.netIncome);
    }
  }

  // 2. Group cash flow statements by fiscal year (YYYY) and compute FCF
  const fcfByYear = new Map<string, number>();
  for (const c of cashFlowStatements) {
    if (c && c.date && typeof c.operatingCashFlow === "number" && typeof c.capitalExpenditure === "number") {
      const fcf = calculateFCF(c.operatingCashFlow, c.capitalExpenditure);
      if (fcf !== null && !isNaN(fcf) && isFinite(fcf)) {
        const year = new Date(c.date).getFullYear().toString();
        fcfByYear.set(year, fcf);
      }
    }
  }

  // 3. Find common fiscal years present in both datasets and sort descending (most recent first)
  const commonYears = Array.from(incomeByYear.keys())
    .filter((y) => fcfByYear.has(y))
    .sort((a, b) => b.localeCompare(a));

  // Minimum requirement: at least 3 years of aligned data
  if (commonYears.length < 3) {
    return null;
  }

  // Take up to 10 most recent fiscal years
  const targetYears = commonYears.slice(0, 10);

  let cumulativeNetIncome = 0;
  let cumulativeFCF = 0;

  for (const year of targetYears) {
    cumulativeNetIncome += incomeByYear.get(year)!;
    cumulativeFCF += fcfByYear.get(year)!;
  }

  // If cumulative net income is zero or negative, return 0
  if (cumulativeNetIncome <= 0) {
    return 0;
  }

  const conversionPct = (cumulativeFCF / cumulativeNetIncome) * 100;
  if (!isFinite(conversionPct)) {
    return null;
  }

  return Number(conversionPct.toFixed(2));
}

/**
 * Historical FCF Conversion Generator:
 * Generates historical annual FCF Conversion ratios (%) alongside raw FCF and Net Income values
 * for visual trend analysis and tooltip details.
 * Answers: "Why did this company receive its FCF Conversion score?"
 */
export function calculateFCFConversionHistory(
  incomeStatements: FinancialStatement[] | null | undefined,
  cashFlowStatements: FinancialStatement[] | null | undefined,
): { label: string; value: number; netIncome?: number; fcf?: number }[] {
  if (!incomeStatements || !cashFlowStatements || incomeStatements.length === 0 || cashFlowStatements.length === 0) {
    return [];
  }

  const result: { label: string; value: number; netIncome?: number; fcf?: number }[] = [];
  const reversedIncome = [...incomeStatements].reverse();

  for (const s of reversedIncome) {
    if (!s || !s.date || typeof s.netIncome !== "number" || isNaN(s.netIncome) || s.netIncome <= 0) {
      continue;
    }

    const year = new Date(s.date).getFullYear().toString();
    const matchCF = cashFlowStatements.find(c => c && c.date && new Date(c.date).getFullYear().toString() === year);

    if (matchCF && typeof matchCF.operatingCashFlow === "number" && typeof matchCF.capitalExpenditure === "number") {
      const fcf = calculateFCF(matchCF.operatingCashFlow, matchCF.capitalExpenditure);
      if (fcf !== null) {
        const conversion = (fcf / s.netIncome) * 100;
        if (isFinite(conversion)) {
          result.push({
            label: year,
            value: Number(conversion.toFixed(2)),
            netIncome: s.netIncome,
            fcf: fcf,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Calculate Margin Stability score (0-100) measuring whether operating profitability is improving, stable, or deteriorating over time.
 */
export function calculateMarginStability(
  incomeStatements: FinancialStatement[] | null | undefined,
): number | null {
  if (!incomeStatements || !Array.isArray(incomeStatements) || incomeStatements.length < 2) {
    return null;
  }

  const validStatements = incomeStatements
    .filter(
      (s) =>
        s &&
        s.date &&
        typeof s.revenue === "number" &&
        s.revenue > 0 &&
        typeof s.operatingIncome === "number",
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validStatements.length < 2) {
    return null;
  }

  const opMargins = validStatements.map(
    (s) => (s.operatingIncome! / s.revenue!) * 100,
  );

  const total = opMargins.length;
  const mean = opMargins.reduce((a, b) => a + b, 0) / total;
  const variance =
    opMargins.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / total;
  const stdDev = Math.sqrt(variance);

  let baseStability = 100;
  if (stdDev <= 1.0) {
    baseStability = 100;
  } else if (stdDev <= 3.0) {
    baseStability = Math.round(100 - ((stdDev - 1.0) / 2.0) * 15);
  } else if (stdDev <= 5.0) {
    baseStability = Math.round(85 - ((stdDev - 3.0) / 2.0) * 15);
  } else if (stdDev <= 10.0) {
    baseStability = Math.round(70 - ((stdDev - 5.0) / 5.0) * 20);
  } else {
    baseStability = Math.max(10, Math.round(50 - (stdDev - 10.0) * 3));
  }

  const netChange = opMargins[opMargins.length - 1] - opMargins[0];
  let trendAdjustment = 0;
  if (netChange > 1.0) {
    trendAdjustment = 10;
  } else if (netChange < -3.0) {
    trendAdjustment = -15;
  }

  let score = baseStability + trendAdjustment;

  if (mean < 0) {
    score = Math.min(40, score);
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Historical Margin Stability Generator:
 * Generates historical annual Operating Margins (%) alongside Revenue and Operating Income
 * for visual trend analysis, reference line calculations, and interactive tooltips.
 * Answers: "Why did this company receive its Margin Stability score?"
 */
export function calculateMarginStabilityHistory(
  incomeStatements: FinancialStatement[] | null | undefined,
): { label: string; value: number; revenue?: number; operatingIncome?: number }[] {
  if (!incomeStatements || !Array.isArray(incomeStatements) || incomeStatements.length === 0) {
    return [];
  }

  const result: { label: string; value: number; revenue?: number; operatingIncome?: number }[] = [];
  const reversedIncome = [...incomeStatements].reverse();

  for (const s of reversedIncome) {
    if (
      s &&
      s.date &&
      typeof s.revenue === "number" &&
      s.revenue > 0 &&
      typeof s.operatingIncome === "number" &&
      !isNaN(s.operatingIncome)
    ) {
      const year = new Date(s.date).getFullYear().toString();
      const margin = (s.operatingIncome / s.revenue) * 100;
      if (isFinite(margin)) {
        result.push({
          label: year,
          value: Number(margin.toFixed(2)),
          revenue: s.revenue,
          operatingIncome: s.operatingIncome,
        });
      }
    }
  }

  return result;
}

/**
 * Financial Strength Metric: Net Debt / Normalized FCF
 * Measures financial flexibility by comparing net debt against normalized free cash flow.
 * Net Debt = Total Debt - Cash & Cash Equivalents
 * Normalized FCF = Average annual Free Cash Flow over up to 5 most recent fiscal years (minimum 3 years required).
 * Ratio = Net Debt / Normalized FCF
 */
export function calculateNetDebtToFCF(
  balanceSheets: FinancialStatement[] | null | undefined,
  cashFlowStatements: FinancialStatement[] | null | undefined,
): number | null {
  if (!balanceSheets || !cashFlowStatements || balanceSheets.length === 0 || cashFlowStatements.length === 0) {
    return null;
  }

  const sortedBalance = [...balanceSheets]
    .filter((s) => s && s.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedBalance.length === 0) {
    return null;
  }

  const latestBalance = sortedBalance[0];
  const totalDebt = typeof latestBalance.totalDebt === "number" ? latestBalance.totalDebt : 0;
  const cash = typeof latestBalance.cashAndCashEquivalents === "number"
    ? latestBalance.cashAndCashEquivalents
    : typeof (latestBalance as any).cashAndShortTermInvestments === "number"
    ? (latestBalance as any).cashAndShortTermInvestments
    : 0;

  const netDebt = totalDebt - cash;

  // Extract FCF for all available fiscal years
  const fcfByYear = new Map<string, number>();
  for (const c of cashFlowStatements) {
    if (c && c.date && typeof c.operatingCashFlow === "number" && typeof c.capitalExpenditure === "number") {
      const fcf = calculateFCF(c.operatingCashFlow, c.capitalExpenditure);
      if (fcf !== null && !isNaN(fcf) && isFinite(fcf)) {
        const year = new Date(c.date).getFullYear().toString();
        fcfByYear.set(year, fcf);
      }
    }
  }

  // Sort fiscal years descending (most recent first)
  const availableYears = Array.from(fcfByYear.keys()).sort((a, b) => b.localeCompare(a));

  // Minimum requirement: require at least 3 years of historical FCF data before calculating
  if (availableYears.length < 3) {
    return null;
  }

  // Use up to 5 most recent available fiscal years
  const targetYears = availableYears.slice(0, 5);
  let fcfSum = 0;
  for (const year of targetYears) {
    fcfSum += fcfByYear.get(year)!;
  }

  const normalizedFCF = fcfSum / targetYears.length;

  if (normalizedFCF <= 0) {
    if (netDebt <= 0) return Number((netDebt / Math.abs(normalizedFCF || 1)).toFixed(2));
    return 99.0;
  }

  return Number((netDebt / normalizedFCF).toFixed(2));
}

/**
 * Historical Net Debt / FCF History Generator:
 * Computes annual Net Debt / FCF ratios for trend visualization.
 */
export function calculateNetDebtToFCFHistory(
  balanceSheets: FinancialStatement[] | null | undefined,
  cashFlowStatements: FinancialStatement[] | null | undefined,
): { label: string; value: number }[] {
  if (!balanceSheets || !cashFlowStatements || balanceSheets.length === 0 || cashFlowStatements.length === 0) {
    return [];
  }

  const result: { label: string; value: number }[] = [];
  const reversedBalance = [...balanceSheets]
    .filter((s) => s && s.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const b of reversedBalance) {
    const year = new Date(b.date).getFullYear().toString();
    const matchCF = cashFlowStatements.find((c) => c && c.date && new Date(c.date).getFullYear().toString() === year);

    if (matchCF && typeof matchCF.operatingCashFlow === "number" && typeof matchCF.capitalExpenditure === "number") {
      const totalDebt = typeof b.totalDebt === "number" ? b.totalDebt : 0;
      const cash = typeof b.cashAndCashEquivalents === "number" ? b.cashAndCashEquivalents : 0;
      const netDebt = totalDebt - cash;
      const fcf = calculateFCF(matchCF.operatingCashFlow, matchCF.capitalExpenditure);

      if (fcf !== null) {
        const ratio = fcf > 0 ? netDebt / fcf : netDebt <= 0 ? netDebt / Math.abs(fcf || 1) : 99.0;
        if (isFinite(ratio)) {
          result.push({ label: year, value: Number(ratio.toFixed(2)) });
        }
      }
    }
  }

  return result;
}

/**
 * Shareholder Value Metric: Share Dilution
 * Measures whether management creates or reduces shareholder ownership value over time.
 * Calculates percentage change in shares outstanding over historical measurement period:
/**
 * Helper to extract historical weighted average shares from a financial statement.
 * Data Source: Financial Modeling Prep (FMP) /income-statement endpoint.
 * - Primary field: Diluted Weighted Average Shares Outstanding (`weightedAverageShsOutDil` or `weightedAverageSharesDiluted`)
 * - Fallback field: Basic Weighted Average Shares Outstanding (`weightedAverageShsOut` or `weightedAverageSharesOutstanding` or `commonStockSharesOutstanding`)
 */
export function extractSharesFromStatement(s: FinancialStatement): { shares: number; fieldUsed: "diluted" | "basic" } | null {
  if (!s) return null;

  // 1. Primary: Diluted Weighted Average Shares Outstanding
  const dilutedCandidates = [
    s.weightedAverageShsOutDil,
    (s as any).weightedAverageSharesDiluted,
  ];
  for (const c of dilutedCandidates) {
    if (typeof c === "number" && c > 0 && isFinite(c)) {
      return { shares: c, fieldUsed: "diluted" };
    }
  }

  // 2. Fallback: Basic Weighted Average Shares Outstanding
  const basicCandidates = [
    s.weightedAverageShsOut,
    (s as any).weightedAverageSharesOutstanding,
    (s as any).commonStockSharesOutstanding,
    (s as any).sharesOutstanding,
    s.shares,
  ];
  for (const c of basicCandidates) {
    if (typeof c === "number" && c > 0 && isFinite(c)) {
      return { shares: c, fieldUsed: "basic" };
    }
  }

  return null;
}

/**
 * Calculate Share Dilution (Annual Share Count Change CAGR %) over historical period.
 * Data Source: FMP Income Statements (weightedAverageShsOutDil preferred, weightedAverageShsOut fallback).
 * Formula: ((Current Shares / Historical Shares) ^ (1 / Number of Years) - 1) * 100
 * Interpretation:
 * - Negative CAGR (%) = Share count reduced (Buybacks / Accretive to equity)
 * - Positive CAGR (%) = Share count increased (Dilution / Equity issuance)
 * Returns null (N/A) when data is insufficient or invalid.
 */
export function calculateShareDilution(
  incomeStatements: FinancialStatement[] | null | undefined,
  balanceSheets?: FinancialStatement[] | null | undefined,
): number | null {
  if ((!incomeStatements || incomeStatements.length === 0) && (!balanceSheets || balanceSheets.length === 0)) {
    return null;
  }

  const combined = [...(incomeStatements || []), ...(balanceSheets || [])]
    .filter((s) => s && s.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (combined.length < 2) return null;

  const yearlyMap = new Map<string, { shares: number; fieldUsed: "diluted" | "basic" }>();
  for (const s of combined) {
    const year = new Date(s.date).getFullYear().toString();
    const extracted = extractSharesFromStatement(s);
    if (extracted !== null) {
      const existing = yearlyMap.get(year);
      if (!existing || (existing.fieldUsed === "basic" && extracted.fieldUsed === "diluted")) {
        yearlyMap.set(year, extracted);
      }
    }
  }

  const sortedYears = Array.from(yearlyMap.keys()).sort();
  if (sortedYears.length < 2) return null;

  const initialShares = yearlyMap.get(sortedYears[0])!.shares;
  const latestShares = yearlyMap.get(sortedYears[sortedYears.length - 1])!.shares;

  if (initialShares <= 0 || latestShares <= 0) return null;

  const startYear = parseInt(sortedYears[0], 10);
  const endYear = parseInt(sortedYears[sortedYears.length - 1], 10);
  const yearDiff = endYear - startYear;
  const numYears = yearDiff > 0 ? yearDiff : sortedYears.length - 1;

  if (numYears <= 0) return null;

  const cagr = (Math.pow(latestShares / initialShares, 1 / numYears) - 1) * 100;
  if (isNaN(cagr) || !isFinite(cagr)) return null;

  return Number(cagr.toFixed(2));
}

/**
 * Historical Share Count Generator:
 * Generates annual shares outstanding ({ label: year, value: shares }) for visual trend chart.
 */
export function calculateShareDilutionHistory(
  incomeStatements: FinancialStatement[] | null | undefined,
  balanceSheets?: FinancialStatement[] | null | undefined,
): { label: string; value: number; yoyChange?: number | null }[] {
  if ((!incomeStatements || incomeStatements.length === 0) && (!balanceSheets || balanceSheets.length === 0)) {
    return [];
  }

  const yearlyMap = new Map<string, number>();
  const combined = [...(incomeStatements || []), ...(balanceSheets || [])]
    .filter((s) => s && s.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const s of combined) {
    const year = new Date(s.date).getFullYear().toString();
    const extracted = extractSharesFromStatement(s);
    if (extracted !== null) {
      yearlyMap.set(year, extracted.shares);
    }
  }

  const sortedYears = Array.from(yearlyMap.keys()).sort();
  const result: { label: string; value: number; yoyChange?: number | null }[] = [];

  for (let i = 0; i < sortedYears.length; i++) {
    const year = sortedYears[i];
    const val = yearlyMap.get(year)!;
    let yoyChange: number | null = null;
    if (i > 0) {
      const prevVal = yearlyMap.get(sortedYears[i - 1])!;
      if (prevVal > 0) {
        yoyChange = Number((((val - prevVal) / prevVal) * 100).toFixed(2));
      }
    }
    result.push({ label: year, value: val, yoyChange });
  }

  return result;
}

/**
 * Calculate all financial metrics
 */
export function calculateAllMetrics(
  incomeStatements: FinancialStatement[],
  balanceSheets: FinancialStatement[],
  cashFlowStatements: FinancialStatement[],
  dividendMetrics: DividendMetrics,
): FinancialMetrics {
  const sortedBalance = [...balanceSheets].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const epsTrendData = calculateEPSTrend(incomeStatements);
  const fcfTrendData = calculateFCFTrend(cashFlowStatements);
  const roicDetail = calculateROICAnalysis(incomeStatements, balanceSheets);

  return {
    revenueCAGR: calculateRevenueCAGR(incomeStatements),
    epsGrowth: calculateEPSGrowth(incomeStatements),
    epsTrend: epsTrendData.trend,
    epsTrendScore: epsTrendData.score,
    epsChangePct: epsTrendData.changePct,
    fcfGrowth: calculateFCFGrowth(cashFlowStatements),
    fcfTrend: fcfTrendData.trend,
    fcfTrendScore: fcfTrendData.score,
    fcfBurnChangePct: fcfTrendData.burnChangePct,
    fcfMargin: calculateFCFMargin(incomeStatements, cashFlowStatements),
    fcfConsistency: calculateFCFConsistency(cashFlowStatements),
    fcfConversion: calculateFCFConversion(incomeStatements, cashFlowStatements),
    marginStability: calculateMarginStability(incomeStatements),
    netDebtToFCF: calculateNetDebtToFCF(balanceSheets, cashFlowStatements),
    shareDilution: calculateShareDilution(incomeStatements, balanceSheets),
    roic: calculateAverageROIC(incomeStatements, balanceSheets),
    roic10Y: roicDetail.roic10Y,
    roic5Y: roicDetail.roic5Y,
    roic3Y: roicDetail.roic3Y,
    roicTrend: roicDetail.trend,
    roicTrendScorePoints: roicDetail.trendScorePoints,
    roicConsistency: roicDetail.consistency,
    roicConsistencyScorePoints: roicDetail.consistencyScorePoints,
    roicStdDev: roicDetail.stdDev,
    roicLevelScorePoints: roicDetail.levelScorePoints,
    roicTotalPoints: roicDetail.totalROICPoints,
    roicDetail,
    debtToEquity: calculateDebtToEquity(
      sortedBalance[0]?.totalDebt,
      sortedBalance[0]?.totalEquity,
    ),
    dividendYield: dividendMetrics.dividendYield,
    dividendPayoutRatio: dividendMetrics.dividendPayoutRatio,
    ...calculateAverageMargins(incomeStatements),
  };
}
