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
 * Calculate Revenue CAGR from income statements
 */
export function calculateRevenueCAGR(
  statements: FinancialStatement[],
): number | null {
  if (!statements || statements.length < 2) {
    return null;
  }

  const sortedByDate = [...statements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const firstRevenue = sortedByDate[0].revenue;
  const lastRevenue = sortedByDate[sortedByDate.length - 1].revenue;

  if (!firstRevenue || !lastRevenue || firstRevenue <= 0) {
    return null;
  }

  const years = sortedByDate.length - 1;
  return calculateCAGR(firstRevenue, lastRevenue, years);
}

/**
 * Calculate EPS Growth from income statements
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

  const firstEPS = sortedByDate[0].eps;
  const lastEPS = sortedByDate[sortedByDate.length - 1].eps;

  if (!firstEPS || !lastEPS || firstEPS <= 0 || lastEPS <= 0) {
    return null;
  }

  const years = sortedByDate.length - 1;
  return calculateCAGR(firstEPS, lastEPS, years);
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
  return operatingCashFlow - (capitalExpenditure || 0);
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

  const fcfValues: number[] = [];

  for (const statement of sortedByDate) {
    const fcf = calculateFCF(
      statement.operatingCashFlow,
      statement.capitalExpenditure,
    );
    if (fcf !== null && fcf > 0) {
      fcfValues.push(fcf);
    }
  }

  if (fcfValues.length < 2) {
    return null;
  }

  const years = fcfValues.length - 1;
  return calculateCAGR(fcfValues[0], fcfValues[fcfValues.length - 1], years);
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
  if (!incomeStatements || !balanceSheets) {
    return null;
  }

  const sortedIncome = [...incomeStatements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const sortedBalance = [...balanceSheets].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (sortedIncome.length === 0 || sortedBalance.length === 0) {
    return null;
  }

  const latestIncome = sortedIncome[0];
  const latestBalance = sortedBalance[0];

  if (
    !latestIncome.operatingIncome ||
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
 * Calculate average margins from recent statements
 */
export function calculateAverageMargins(statements: FinancialStatement[]): {
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
} {
  if (!statements || statements.length === 0) {
    return { grossMargin: null, operatingMargin: null, netMargin: null };
  }

  // Use last 3 years
  const recentStatements = statements.slice(0, 3);

  let totalGross = 0,
    totalOp = 0,
    totalNet = 0;
  let grossCount = 0,
    opCount = 0,
    netCount = 0;

  for (const statement of recentStatements) {
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
 * Analyze shareholder dilution from shares outstanding
 */
export function analyzeShareDilution(
  balanceSheets: FinancialStatement[],
): string {
  if (!balanceSheets || balanceSheets.length < 2) {
    return "Insufficient data";
  }

  const sortedByDate = [...balanceSheets].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const firstShares = sortedByDate[0].shares;
  const lastShares = sortedByDate[sortedByDate.length - 1].shares;

  if (!firstShares || !lastShares) {
    return "Data not available";
  }

  const change = ((lastShares - firstShares) / firstShares) * 100;

  if (change < -2) {
    return "Share buyback - positive";
  } else if (change < 2) {
    return "Stable shares - neutral";
  } else {
    return "Share dilution - negative";
  }
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
    sharesDilution: analyzeShareDilution(balanceSheets),
  };
}
