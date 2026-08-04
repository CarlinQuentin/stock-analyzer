import {
  FinancialStatement,
  FinancialMetrics,
  DividendMetrics,
  FCFTrendResult,
} from "../types";

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
 * Calculate average ROIC from latest financial statements
 */
export function calculateAverageROIC(
  incomeStatements: FinancialStatement[],
  balanceSheets: FinancialStatement[],
): number | null {
  if (
    !incomeStatements ||
    !balanceSheets ||
    incomeStatements.length === 0 ||
    balanceSheets.length === 0
  ) {
    return null;
  }

  const sortedIncome = [...incomeStatements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const latestIncome = sortedIncome[0];
  const latestYear = latestIncome.date
    ? new Date(latestIncome.date).getFullYear()
    : null;

  // Pair latest income statement with matching balance sheet year
  const latestBalance =
    balanceSheets.find(
      (b) => b.date && new Date(b.date).getFullYear() === latestYear,
    ) || balanceSheets[0];

  if (
    !latestIncome.operatingIncome ||
    !latestBalance ||
    !latestBalance.totalEquity ||
    !latestBalance.totalDebt
  ) {
    return null;
  }

  const investedCapital = latestBalance.totalEquity + latestBalance.totalDebt;

  return calculateROIC(
    latestIncome.operatingIncome,
    latestIncome.netIncome,
    investedCapital,
  );
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
 * Calculate FCF Conversion = (Free Cash Flow / Net Income) * 100
 * Handles negative net income, missing values, and invalid calculations.
 */
export function calculateFCFConversion(
  incomeStatements: FinancialStatement[] | null | undefined,
  cashFlowStatements: FinancialStatement[] | null | undefined,
): number | null {
  if (!incomeStatements || !cashFlowStatements || incomeStatements.length === 0 || cashFlowStatements.length === 0) {
    return null;
  }

  const sortedIncome = [...incomeStatements]
    .filter((s) => s && s.date && typeof s.netIncome === "number" && !isNaN(s.netIncome) && isFinite(s.netIncome))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sortedCashFlow = [...cashFlowStatements]
    .filter((s) => s && s.date && s.operatingCashFlow !== undefined && s.capitalExpenditure !== undefined)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedIncome.length === 0 || sortedCashFlow.length === 0) {
    return null;
  }

  const latestIncome = sortedIncome[0];
  const netIncome = latestIncome.netIncome;

  if (netIncome === undefined || netIncome === null || isNaN(netIncome) || netIncome <= 0) {
    return null;
  }

  const latestYear = new Date(latestIncome.date).getFullYear();
  let matchingCashFlow = sortedCashFlow.find(
    (c) => new Date(c.date).getFullYear() === latestYear,
  );

  if (!matchingCashFlow) {
    matchingCashFlow = sortedCashFlow[0];
  }

  const fcf = calculateFCF(matchingCashFlow.operatingCashFlow, matchingCashFlow.capitalExpenditure);
  if (fcf === null) {
    return null;
  }

  return (fcf / netIncome) * 100;
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
    roic: calculateAverageROIC(incomeStatements, balanceSheets),
    debtToEquity: calculateDebtToEquity(
      sortedBalance[0]?.totalDebt,
      sortedBalance[0]?.totalEquity,
    ),
    dividendYield: dividendMetrics.dividendYield,
    dividendPayoutRatio: dividendMetrics.dividendPayoutRatio,
    ...calculateAverageMargins(incomeStatements),
  };
}
