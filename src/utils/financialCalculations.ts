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
 * Uses the most recent 6 fiscal years (5-year CAGR period) if more than 6 years are provided.
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

  // If more than 6 fiscal years are provided, use the 6 most recent fiscal years (5-year CAGR)
  const windowStatements =
    uniqueByDate.length > 6 ? uniqueByDate.slice(-6) : uniqueByDate;

  const firstRevenue = windowStatements[0].revenue!;
  const lastRevenue = windowStatements[windowStatements.length - 1].revenue!;

  // Business rule: return 0 if starting or ending revenue <= 0
  if (firstRevenue <= 0 || lastRevenue <= 0) {
    return 0;
  }

  const firstDate = new Date(windowStatements[0].date);
  const lastDate = new Date(windowStatements[windowStatements.length - 1].date);
  const yearDiff = lastDate.getFullYear() - firstDate.getFullYear();
  const years = yearDiff > 0 ? yearDiff : windowStatements.length - 1;

  if (years <= 0) {
    return 0;
  }

  return calculateCAGR(firstRevenue, lastRevenue, years);
}

/**
 * Calculate EPS Growth from income statements.
 * If the initial EPS is negative or zero, find the first fiscal year in the historical series
 * where EPS becomes positive (> 0), and calculate CAGR from that baseline to the latest EPS.
 */
export function calculateEPSGrowth(
  statements: FinancialStatement[],
): number | null {
  if (!statements || statements.length < 2) {
    return null;
  }

  const sortedByDate = [...statements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const lastStatement = sortedByDate[sortedByDate.length - 1];
  const lastEPS = lastStatement.eps;

  // Do not calculate CAGR if ending EPS is missing or <= 0
  if (lastEPS === undefined || lastEPS === null || lastEPS <= 0) {
    return null;
  }

  // Find the first statement in chronological order where eps > 0
  const firstPositiveIndex = sortedByDate.findIndex(
    (s) => s.eps !== undefined && s.eps !== null && s.eps > 0,
  );

  // Return null if no positive EPS exists, or if first positive EPS is the ending year itself
  if (firstPositiveIndex === -1 || firstPositiveIndex === sortedByDate.length - 1) {
    return null;
  }

  const firstPositiveEPS = sortedByDate[firstPositiveIndex].eps!;
  const years = sortedByDate.length - 1 - firstPositiveIndex;

  if (years <= 0) {
    return null;
  }

  return calculateCAGR(firstPositiveEPS, lastEPS, years);
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
  return {
    revenueCAGR: calculateRevenueCAGR(incomeStatements),
    epsGrowth: calculateEPSGrowth(incomeStatements),
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
