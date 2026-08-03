import {
  FinancialStatement,
  FinancialMetrics,
  DividendMetrics,
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
  trend: "Improving" | "Declining" | "Flat";
  isProfitable: boolean;
  score: number;
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
 * 3. Categorize EPS Trend (Improving | Declining | Flat).
 * 4. Compute dynamic EPS Quality Score using calculateEPSQualityScore.
 */
export function calculateEPSTrend(
  statements: FinancialStatement[] | null | undefined,
): EPSTrendResult {
  if (!statements || !Array.isArray(statements) || statements.length === 0) {
    return { trend: "Flat", isProfitable: false, score: 25 };
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
    return { trend: "Flat", isProfitable: false, score: 25 };
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
    };
  }

  // 3. Determine EPS trend using transition rules
  const netChange = endingEPS - startingEPS;
  const isFlat = Math.abs(netChange) <= 0.02;

  let trend: "Improving" | "Declining" | "Flat" = "Flat";
  if (isFlat) {
    trend = "Flat";
  } else if (netChange > 0) {
    trend = "Improving";
  } else {
    trend = "Declining";
  }

  // 4. Calculate dynamic EPS Quality Score using helper function
  const score = calculateEPSQualityScore(startingEPS, endingEPS);

  return { trend, isProfitable, score };
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
 * Calculate FCF Growth from cash flow statements
 */
export function calculateFCFGrowth(
  cashFlowStatements: FinancialStatement[],
): number | null {
  if (!cashFlowStatements || cashFlowStatements.length < 2) {
    return null;
  }

  const sortedByDate = [...cashFlowStatements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const lastStatement = sortedByDate[sortedByDate.length - 1];
  const lastFCF = calculateFCF(
    lastStatement.operatingCashFlow,
    lastStatement.capitalExpenditure,
  );

  // Return null if ending FCF is missing or <= 0
  if (lastFCF === null || lastFCF <= 0) {
    return null;
  }

  const statementsWithFCF = sortedByDate.map((statement) => ({
    statement,
    fcf: calculateFCF(statement.operatingCashFlow, statement.capitalExpenditure),
  }));

  const firstPositiveIndex = statementsWithFCF.findIndex(
    (item) => item.fcf !== null && item.fcf > 0,
  );

  if (firstPositiveIndex === -1 || firstPositiveIndex === statementsWithFCF.length - 1) {
    return null;
  }

  const firstPositiveFCF = statementsWithFCF[firstPositiveIndex].fcf!;
  const years = statementsWithFCF.length - 1 - firstPositiveIndex;

  if (years <= 0) {
    return null;
  }

  return calculateCAGR(firstPositiveFCF, lastFCF, years);
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
  return {
    revenueCAGR: calculateRevenueCAGR(incomeStatements),
    epsGrowth: calculateEPSGrowth(incomeStatements),
    epsTrend: epsTrendData.trend,
    epsTrendScore: epsTrendData.score,
    fcfGrowth: calculateFCFGrowth(cashFlowStatements),
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
