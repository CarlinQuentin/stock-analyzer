import React from "react";
import { FinancialStatement } from "../types";
import { calculateFCF } from "../utils/financialCalculations";
import { formatShortenedShareCount } from "../utils/scoring";

interface RawFinancialsSectionProps {
  incomeStatements?: FinancialStatement[] | null;
  balanceSheets?: FinancialStatement[] | null;
  cashFlowStatements?: FinancialStatement[] | null;
  symbol: string;
  companyName: string;
}

export type MetricDirection = "higher_is_better" | "lower_is_better" | "neutral";

/**
 * Determine if higher or lower values are better for a given metric ID or label.
 */
export function getMetricDirection(metricId: string, label?: string): MetricDirection {
  const id = metricId.toLowerCase();
  const name = (label || "").toLowerCase();

  // Lower is Better
  if (
    id.includes("debt") ||
    name.includes("debt") ||
    id.includes("interestexpense") ||
    name.includes("interest expense") ||
    id.includes("operatingexpenses") ||
    name.includes("operating expenses") ||
    id.includes("sga") ||
    name.includes("sg&a") ||
    id.includes("costofrevenue") ||
    name.includes("cost of revenue") ||
    id.includes("taxrate") ||
    name.includes("tax rate") ||
    id.includes("sharesoutstanding") ||
    name.includes("shares outstanding") ||
    id.includes("weightedaverageshsout") ||
    name.includes("weighted average shares") ||
    id.includes("capex") ||
    id.includes("capitalexpenditure") ||
    name.includes("capital expenditure")
  ) {
    return "lower_is_better";
  }

  // Higher is Better
  if (
    id.includes("revenue") ||
    name.includes("revenue") ||
    id.includes("profit") ||
    name.includes("profit") ||
    id.includes("income") ||
    name.includes("income") ||
    id.includes("margin") ||
    name.includes("margin") ||
    id.includes("eps") ||
    name.includes("eps") ||
    id.includes("cashflow") ||
    name.includes("cash flow") ||
    id.includes("fcf") ||
    id.includes("roic") ||
    id.includes("roe") ||
    id.includes("cash") ||
    name.includes("cash") ||
    id.includes("dividend") ||
    name.includes("dividend") ||
    id.includes("bookvalue") ||
    name.includes("book value") ||
    id.includes("assets") ||
    name.includes("assets")
  ) {
    return "higher_is_better";
  }

  return "neutral";
}

/**
 * Computes text color class for a metric value compared to its prior year value
 */
export function getMetricComparisonColor(
  currentVal: number | null | undefined,
  priorVal: number | null | undefined,
  direction: MetricDirection,
): string {
  if (
    currentVal === null ||
    currentVal === undefined ||
    isNaN(currentVal) ||
    priorVal === null ||
    priorVal === undefined ||
    isNaN(priorVal) ||
    direction === "neutral"
  ) {
    return "text-slate-900 dark:text-slate-100"; // default neutral text color
  }

  const diff = currentVal - priorVal;
  if (diff === 0) {
    return "text-slate-900 dark:text-slate-100"; // no change
  }

  const isIncrease = diff > 0;

  if (direction === "higher_is_better") {
    return isIncrease
      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
      : "text-rose-600 dark:text-rose-400 font-semibold";
  }

  if (direction === "lower_is_better") {
    return isIncrease
      ? "text-rose-600 dark:text-rose-400 font-semibold"
      : "text-emerald-600 dark:text-emerald-400 font-semibold";
  }

  return "text-slate-900 dark:text-slate-100";
}

/**
 * Format large currency figures cleanly ($18.2B, $850M, $1.2T, $0, -$500M)
 */
export function formatRawCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  const isNeg = val < 0;
  const abs = Math.abs(val);

  if (abs === 0) return "$0";

  let formattedNum = "";
  if (abs >= 1e12) {
    const valT = abs / 1e12;
    formattedNum = `${valT % 1 === 0 ? valT.toFixed(0) : parseFloat(valT.toFixed(2)).toString()}T`;
  } else if (abs >= 1e9) {
    const valB = abs / 1e9;
    formattedNum = `${valB % 1 === 0 ? valB.toFixed(0) : parseFloat(valB.toFixed(2)).toString()}B`;
  } else if (abs >= 1e6) {
    const valM = abs / 1e6;
    formattedNum = `${valM % 1 === 0 ? valM.toFixed(0) : parseFloat(valM.toFixed(2)).toString()}M`;
  } else if (abs >= 1e3) {
    const valK = abs / 1e3;
    formattedNum = `${valK % 1 === 0 ? valK.toFixed(0) : parseFloat(valK.toFixed(2)).toString()}K`;
  } else {
    formattedNum = abs.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  return (isNeg ? "-$" : "$") + formattedNum;
}

/**
 * Format per-share earnings ($8.42, -$1.20)
 */
export function formatRawEPS(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  const isNeg = val < 0;
  const abs = Math.abs(val);
  return (isNeg ? "-$" : "$") + abs.toFixed(2);
}

interface MetricRowDef {
  id: string;
  label: string;
  description: string;
  direction?: MetricDirection;
  getValue: (
    inc?: FinancialStatement,
    bal?: FinancialStatement,
    cf?: FinancialStatement,
  ) => number | null | undefined;
  format: (val: number | null | undefined) => string;
}

const RAW_METRIC_ROWS: MetricRowDef[] = [
  {
    id: "revenue",
    label: "Revenue",
    description: "Total top-line sales generated from business operations",
    direction: "higher_is_better",
    getValue: (inc) => inc?.revenue,
    format: formatRawCurrency,
  },
  {
    id: "operatingIncome",
    label: "Operating Income",
    description: "Profit earned from core business operations (EBIT)",
    direction: "higher_is_better",
    getValue: (inc) => inc?.operatingIncome,
    format: formatRawCurrency,
  },
  {
    id: "netIncome",
    label: "Net Income",
    description: "Bottom-line accounting net profit after all expenses & taxes",
    direction: "higher_is_better",
    getValue: (inc) => inc?.netIncome,
    format: formatRawCurrency,
  },
  {
    id: "eps",
    label: "EPS",
    description: "Diluted earnings per share",
    direction: "higher_is_better",
    getValue: (inc) => inc?.eps,
    format: formatRawEPS,
  },
  {
    id: "freeCashFlow",
    label: "Free Cash Flow",
    description: "Operating Cash Flow minus Capital Expenditures (CapEx)",
    direction: "higher_is_better",
    getValue: (_, __, cf) => calculateFCF(cf?.operatingCashFlow, cf?.capitalExpenditure),
    format: formatRawCurrency,
  },
  {
    id: "totalDebt",
    label: "Total Debt",
    description: "Total short-term and long-term interest-bearing debt obligations",
    direction: "lower_is_better",
    getValue: (_, bal) => bal?.totalDebt,
    format: formatRawCurrency,
  },
  {
    id: "cashAndEquivalents",
    label: "Cash & Cash Equivalents",
    description: "Cash, marketable securities, and short-term liquid investments",
    direction: "higher_is_better",
    getValue: (_, bal) =>
      bal?.cashAndCashEquivalents ?? (bal as any)?.cashAndShortTermInvestments,
    format: formatRawCurrency,
  },
  {
    id: "sharesOutstanding",
    label: "Shares Outstanding",
    description: "Diluted average shares outstanding used for per-share metrics",
    direction: "lower_is_better",
    getValue: (inc) =>
      inc?.weightedAverageShsOutDil ?? inc?.weightedAverageShsOut ?? inc?.shares,
    format: formatShortenedShareCount,
  },
];

export const RawFinancialsSection: React.FC<RawFinancialsSectionProps> = ({
  incomeStatements,
  balanceSheets,
  cashFlowStatements,
  symbol,
  companyName,
}) => {
  // Extract all unique historical fiscal years across statement sources
  const yearSet = new Set<number>();

  const extractYear = (s?: FinancialStatement) => {
    if (!s || !s.date) return null;
    const yearStr = s.date.split("-")[0];
    const yearNum = parseInt(yearStr, 10);
    return isNaN(yearNum) ? null : yearNum;
  };

  incomeStatements?.forEach((s) => {
    const y = extractYear(s);
    if (y) yearSet.add(y);
  });
  cashFlowStatements?.forEach((s) => {
    const y = extractYear(s);
    if (y) yearSet.add(y);
  });
  balanceSheets?.forEach((s) => {
    const y = extractYear(s);
    if (y) yearSet.add(y);
  });

  // Sort descending (most recent fiscal year first, up to 10 fiscal years)
  const years = Array.from(yearSet)
    .sort((a, b) => b - a)
    .slice(0, 10);

  // Helper lookup functions for each year
  const getIncomeForYear = (yr: number) =>
    incomeStatements?.find((s) => extractYear(s) === yr);
  const getBalanceForYear = (yr: number) =>
    balanceSheets?.find((s) => extractYear(s) === yr);
  const getCashFlowForYear = (yr: number) =>
    cashFlowStatements?.find((s) => extractYear(s) === yr);

  if (years.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          No historical raw financial statement data is available for {symbol}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">📋</span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Raw Financial Inputs (10-Year History)
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                Source of Truth
              </span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
              Transparent, calculation-free display of the underlying annual financial statement inputs used to compute {companyName}&apos;s ({symbol}) quality metrics, conversion ratios, and growth rates.
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 whitespace-nowrap self-start md:self-auto">
            {years.length} Fiscal Years ({years[years.length - 1]} – {years[0]})
          </div>
        </div>
      </div>

      {/* Raw Financials Table Container */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-700/80">
                <th className="py-3.5 px-4 sm:px-6 font-bold text-slate-900 dark:text-white sticky left-0 bg-slate-50 dark:bg-slate-900/90 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10 min-w-[200px] sm:min-w-[240px]">
                  Metric
                </th>
                {years.map((yr) => (
                  <th
                    key={yr}
                    className="py-3.5 px-4 font-extrabold font-mono text-center text-slate-900 dark:text-slate-100 min-w-[100px] sm:min-w-[110px]"
                  >
                    {yr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {RAW_METRIC_ROWS.map((row) => {
                const direction = row.direction || getMetricDirection(row.id, row.label);

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6 sticky left-0 bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        {row.description}
                      </div>
                    </td>
                    {years.map((yr, idx) => {
                      const inc = getIncomeForYear(yr);
                      const bal = getBalanceForYear(yr);
                      const cf = getCashFlowForYear(yr);
                      const rawVal = row.getValue(inc, bal, cf);
                      const formattedVal = row.format(rawVal);
                      const isNA = formattedVal === "N/A";

                      // Prior year is the next element in years array (since years is sorted descending)
                      const priorYr = years[idx + 1];
                      const priorInc = priorYr ? getIncomeForYear(priorYr) : undefined;
                      const priorBal = priorYr ? getBalanceForYear(priorYr) : undefined;
                      const priorCf = priorYr ? getCashFlowForYear(priorYr) : undefined;
                      const priorVal = priorYr ? row.getValue(priorInc, priorBal, priorCf) : undefined;

                      const colorClass = isNA
                        ? "text-slate-400 dark:text-slate-500"
                        : getMetricComparisonColor(rawVal, priorVal, direction);

                      return (
                        <td
                          key={yr}
                          className={`py-3.5 px-4 text-center font-mono font-medium ${colorClass}`}
                        >
                          {formattedVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
