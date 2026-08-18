import React, { useState } from "react";
import { FinancialStatement, DividendMetrics } from "../types";
import { calculateFCF } from "../utils/financialCalculations";
import { formatShortenedShareCount } from "../utils/scoring";
import {
  determineDividendFrequency,
  calculateAnnualRegularDPS,
  calculateSinglePaymentDPS,
  calculateTTMAnnualDPS,
  calculateDividendPayoutRatio,
  calculateDividendFCFCoverage,
  calculateSpecialDPS,
} from "../utils/dividendCalculations";

export interface RawFinancialsSectionProps {
  incomeStatements?: FinancialStatement[] | null;
  balanceSheets?: FinancialStatement[] | null;
  cashFlowStatements?: FinancialStatement[] | null;
  keyMetrics?: any[] | null;
  financialRatios?: any[] | null;
  keyMetricsTTM?: any | null;
  ratiosTTM?: any | null;
  dividendHistory?: any[] | null;
  dividendMetrics?: DividendMetrics | null;
  symbol: string;
  companyName: string;
  currentPrice?: number | null;
  marketCap?: number | null;
}

export type MetricDirection = "higher_is_better" | "lower_is_better" | "neutral";
export type PeriodView = "10Y" | "5Y" | "3Y";

/**
 * Determine if higher or lower values are better for a given metric ID or label.
 */
export function getMetricDirection(metricId: string, label?: string): MetricDirection {
  const id = metricId.toLowerCase();
  const name = (label || "").toLowerCase();

  // Neutral / Directionless
  if (
    id.includes("marketcapitalization") ||
    name.includes("market cap") ||
    id.includes("enterprisevalue") ||
    name.includes("enterprise value") ||
    id.includes("frequency") ||
    name.includes("frequency") ||
    id.includes("special") ||
    name.includes("special") ||
    id === "dividendspaid" ||
    name === "total dividends paid"
  ) {
    return "neutral";
  }

  // Lower is Better (Debt, Leverage, CapEx, Solvency multiples, Valuation multiples, Payout Ratios)
  if (
    id.includes("debt") ||
    name.includes("debt") ||
    id.includes("capex") ||
    id.includes("capitalexpenditure") ||
    name.includes("capital expenditure") ||
    id.includes("peratio") ||
    id.includes("priceearningsratio") ||
    name.includes("p/e") ||
    id.includes("pricetofcf") ||
    id.includes("price / fcf") ||
    name.includes("price / fcf") ||
    id.includes("pricetosales") ||
    id.includes("price / sales") ||
    name.includes("price / sales") ||
    id.includes("evtoebitda") ||
    id.includes("ev / ebitda") ||
    name.includes("ev / ebitda") ||
    id.includes("payoutratio") ||
    name.includes("payout ratio") ||
    id.includes("dividendfcfcoverage") ||
    name.includes("dividend / fcf")
  ) {
    return "lower_is_better";
  }

  // Higher is Better (Revenues, Profits, Cash Flows, Margins, Compounding Returns, Dividends & Dividend Growth)
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
    name.includes("free cash flow") ||
    id.includes("ebitda") ||
    name.includes("ebitda") ||
    id.includes("roic") ||
    name.includes("roic") ||
    id.includes("roe") ||
    name.includes("roe") ||
    id.includes("roa") ||
    name.includes("roa") ||
    id.includes("cash") ||
    name.includes("cash") ||
    id.includes("conversion") ||
    name.includes("conversion") ||
    id.includes("growth") ||
    name.includes("growth") ||
    id.includes("dividend") ||
    name.includes("dividend")
  ) {
    return "higher_is_better";
  }

  return "neutral";
}

/**
 * Computes text color class for a metric value compared to its prior period value
 */
export function getMetricComparisonColor(
  currentVal: any,
  priorVal: any,
  direction: MetricDirection,
): string {
  if (
    currentVal === null ||
    currentVal === undefined ||
    typeof currentVal === "string" ||
    (typeof currentVal === "number" && isNaN(currentVal)) ||
    priorVal === null ||
    priorVal === undefined ||
    typeof priorVal === "string" ||
    (typeof priorVal === "number" && isNaN(priorVal)) ||
    direction === "neutral"
  ) {
    return "text-slate-900 dark:text-slate-100"; // default neutral text color
  }

  const diff = Number(currentVal) - Number(priorVal);
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
  if (val === null || val === undefined || isNaN(val)) return "—";
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
 * Format per-share earnings or dividend per share ($8.42, -$1.20, $0.25)
 */
export function formatRawEPS(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const isNeg = val < 0;
  const abs = Math.abs(val);
  return (isNeg ? "-$" : "$") + abs.toFixed(2);
}

/**
 * Format percentage (e.g. 24.5%, -5.2%)
 */
export function formatPercentage(val: number | null | undefined, isDecimalRatio: boolean = true): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const num = isDecimalRatio ? val * 100 : val;
  return `${num.toFixed(1)}%`;
}

/**
 * Format multiples / ratios (e.g. 1.85x, 24.2x)
 */
export function formatRatio(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `${val.toFixed(2)}x`;
}

/**
 * Format share counts (e.g. 160M, 1.25B)
 */
export function formatShareCount(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return formatShortenedShareCount(val);
}

/**
 * Format dates as M/D/YYYY (e.g. 2025-12-31 -> 12/31/2025)
 */
export function formatPeriodDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(month) && !isNaN(day)) {
      return `${month}/${day}/${year}`;
    }
  }
  return dateStr;
}

/**
 * Helper to compute YoY growth percentage from current and prior value
 */
function computeYoYGrowth(current?: number | null, prior?: number | null): number | null {
  if (current === undefined || current === null || prior === undefined || prior === null || prior === 0) {
    return null;
  }
  return (current - prior) / Math.abs(prior);
}

export interface MetricRowDef {
  id: string;
  label: string;
  description: string;
  direction?: MetricDirection;
  isKeyHighlight?: boolean;
  getValue: (
    inc?: FinancialStatement,
    bal?: FinancialStatement,
    cf?: FinancialStatement,
    km?: any,
    fr?: any,
    priorInc?: FinancialStatement,
    priorBal?: FinancialStatement,
    priorCf?: FinancialStatement,
    priorKm?: any,
    priorFr?: any,
    year?: number,
    dividendHistory?: any[] | null,
    dividendMetrics?: DividendMetrics | null,
    currentPrice?: number | null,
  ) => any;
  getTTMValue?: (
    inc?: FinancialStatement,
    bal?: FinancialStatement,
    cf?: FinancialStatement,
    kmTTM?: any,
    frTTM?: any,
    currentPrice?: number | null,
    marketCap?: number | null,
    latestInc?: FinancialStatement,
    latestBal?: FinancialStatement,
    latestCf?: FinancialStatement,
    dividendHistory?: any[] | null,
    dividendMetrics?: DividendMetrics | null,
  ) => any;
  format: (val: any) => string;
}

export interface MetricSectionDef {
  id: string;
  title: string;
  icon: string;
  description: string;
  rows: MetricRowDef[];
}

export const METRIC_SECTIONS: MetricSectionDef[] = [
  {
    id: "growthAndProfitability",
    title: "GROWTH & PROFITABILITY",
    icon: "📈",
    description: "Core sales expansion, operating earnings quality, and margin trajectory",
    rows: [
      {
        id: "revenue",
        label: "Revenue",
        description: "Total top-line gross sales generated from operations",
        direction: "higher_is_better",
        getValue: (inc) => inc?.revenue,
        getTTMValue: (inc) => inc?.revenue,
        format: formatRawCurrency,
      },
      {
        id: "revenueGrowth",
        label: "Revenue Growth",
        description: "Year-over-year percentage expansion in total revenue",
        direction: "higher_is_better",
        getValue: (inc, _, __, ___, ____, priorInc) => computeYoYGrowth(inc?.revenue, priorInc?.revenue),
        getTTMValue: (inc, _, __, ___, ____, _____, ______, latestInc) =>
          computeYoYGrowth(inc?.revenue, latestInc?.revenue),
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "grossProfit",
        label: "Gross Profit",
        description: "Revenue minus direct Cost of Goods Sold (COGS)",
        direction: "higher_is_better",
        getValue: (inc) => inc?.grossProfit,
        format: formatRawCurrency,
      },
      {
        id: "grossMargin",
        label: "Gross Margin",
        description: "Gross Profit as a percentage of Total Revenue",
        direction: "higher_is_better",
        getValue: (inc) =>
          inc?.grossProfitRatio ?? (inc?.revenue && inc?.grossProfit ? inc.grossProfit / inc.revenue : null),
        getTTMValue: (_, __, ___, ____, frTTM) => frTTM?.grossProfitMarginTTM,
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "operatingIncome",
        label: "Operating Income",
        description: "Core operating profit generated before interest and taxation (EBIT)",
        direction: "higher_is_better",
        getValue: (inc) => inc?.operatingIncome,
        format: formatRawCurrency,
      },
      {
        id: "operatingMargin",
        label: "Operating Margin",
        description: "Operating Income as a percentage of Total Revenue",
        direction: "higher_is_better",
        getValue: (inc) =>
          inc?.operatingIncomeRatio ?? (inc?.revenue && inc?.operatingIncome ? inc.operatingIncome / inc.revenue : null),
        getTTMValue: (_, __, ___, ____, frTTM) => frTTM?.operatingProfitMarginTTM,
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "netIncome",
        label: "Net Income",
        description: "Bottom-line net profit after all expenses, taxes, and interest",
        direction: "higher_is_better",
        getValue: (inc) => inc?.netIncome,
        format: formatRawCurrency,
      },
      {
        id: "netMargin",
        label: "Net Margin",
        description: "Net Income as a percentage of Total Revenue",
        direction: "higher_is_better",
        getValue: (inc) =>
          inc?.netIncomeRatio ?? (inc?.revenue && inc?.netIncome ? inc.netIncome / inc.revenue : null),
        getTTMValue: (_, __, ___, ____, frTTM) => frTTM?.netProfitMarginTTM,
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "dilutedEps",
        label: "Diluted EPS",
        description: "Diluted earnings per share taking into account options and convertible shares",
        direction: "higher_is_better",
        getValue: (inc) => inc?.epsdiluted ?? inc?.eps,
        format: formatRawEPS,
      },
      {
        id: "epsGrowth",
        label: "EPS Growth",
        description: "Year-over-year growth in diluted earnings per share",
        direction: "higher_is_better",
        getValue: (inc, _, __, ___, ____, priorInc) => {
          const curr = inc?.epsdiluted ?? inc?.eps;
          const prior = priorInc?.epsdiluted ?? priorInc?.eps;
          return computeYoYGrowth(curr, prior);
        },
        getTTMValue: (inc, _, __, ___, ____, _____, ______, latestInc) => {
          const curr = inc?.epsdiluted ?? inc?.eps;
          const prior = latestInc?.epsdiluted ?? latestInc?.eps;
          return computeYoYGrowth(curr, prior);
        },
        format: (v) => formatPercentage(v, true),
      },
    ],
  },
  {
    id: "cashFlow",
    title: "CASH FLOW",
    icon: "🌊",
    description: "Actual cash generation, capital reinvestment, and discretionary cash conversion",
    rows: [
      {
        id: "operatingCashFlow",
        label: "Operating Cash Flow",
        description: "Cash generated directly from core business operations and customer collections",
        direction: "higher_is_better",
        getValue: (_, __, cf) => cf?.operatingCashFlow ?? cf?.netCashProvidedByOperatingActivities,
        format: formatRawCurrency,
      },
      {
        id: "capitalExpenditures",
        label: "Capital Expenditures",
        description: "Cash invested into hard assets, equipment, and infrastructure (CapEx)",
        direction: "lower_is_better",
        getValue: (_, __, cf) =>
          cf?.capitalExpenditure !== undefined ? Math.abs(cf.capitalExpenditure) : undefined,
        format: formatRawCurrency,
      },
      {
        id: "freeCashFlow",
        label: "Free Cash Flow",
        description: "Operating Cash Flow minus Capital Expenditures (discretionary cash generated)",
        direction: "higher_is_better",
        isKeyHighlight: true,
        getValue: (_, __, cf) => calculateFCF(cf?.operatingCashFlow, cf?.capitalExpenditure),
        format: formatRawCurrency,
      },
      {
        id: "fcfMargin",
        label: "FCF Margin",
        description: "Free Cash Flow as a percentage of Total Revenue",
        direction: "higher_is_better",
        getValue: (inc, _, cf) => {
          const fcf = calculateFCF(cf?.operatingCashFlow, cf?.capitalExpenditure);
          return fcf !== null && inc?.revenue ? fcf / inc.revenue : null;
        },
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "fcfConversion",
        label: "FCF Conversion",
        description: "Free Cash Flow divided by Net Income (accounting earnings cash-conversion ratio)",
        direction: "higher_is_better",
        getValue: (inc, _, cf) => {
          const fcf = calculateFCF(cf?.operatingCashFlow, cf?.capitalExpenditure);
          return fcf !== null && inc?.netIncome && inc.netIncome > 0 ? fcf / inc.netIncome : null;
        },
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "fcfGrowth",
        label: "FCF Growth",
        description: "Year-over-year growth in Free Cash Flow",
        direction: "higher_is_better",
        getValue: (_, __, cf, ___, ____, _____, ______, priorCf) => {
          const currFcf = calculateFCF(cf?.operatingCashFlow, cf?.capitalExpenditure);
          const priorFcf = calculateFCF(priorCf?.operatingCashFlow, priorCf?.capitalExpenditure);
          return computeYoYGrowth(currFcf, priorFcf);
        },
        getTTMValue: (_, __, cf, ___, ____, _____, ______, _______, ________, latestCf) => {
          const currFcf = calculateFCF(cf?.operatingCashFlow, cf?.capitalExpenditure);
          const priorFcf = calculateFCF(latestCf?.operatingCashFlow, latestCf?.capitalExpenditure);
          return computeYoYGrowth(currFcf, priorFcf);
        },
        format: (v) => formatPercentage(v, true),
      },
    ],
  },
  {
    id: "capitalEfficiency",
    title: "CAPITAL EFFICIENCY",
    icon: "🏆",
    description: "Returns on invested capital, equity compounding efficiency, and asset productivity",
    rows: [
      {
        id: "roic",
        label: "ROIC",
        description: "Return on Invested Capital (core engine of long-term economic wealth creation)",
        direction: "higher_is_better",
        isKeyHighlight: true,
        getValue: (inc, bal, _, km) => {
          if (km?.roic !== undefined && km?.roic !== null) return km.roic;
          const ebit = inc?.operatingIncome ?? 0;
          const taxRate =
            inc?.incomeBeforeTax && inc?.incomeTaxExpense && inc.incomeBeforeTax > 0
              ? Math.max(0, Math.min(0.5, inc.incomeTaxExpense / inc.incomeBeforeTax))
              : 0.21;
          const nopat = ebit * (1 - taxRate);
          const totalDebt = bal?.totalDebt ?? (bal?.shortTermDebt || 0) + (bal?.longTermDebt || 0);
          const totalEquity = bal?.totalStockholdersEquity ?? bal?.totalEquity ?? 0;
          const cash = bal?.cashAndShortTermInvestments ?? bal?.cashAndCashEquivalents ?? 0;
          const investedCap = totalDebt + totalEquity - cash;
          return investedCap > 0 ? nopat / investedCap : null;
        },
        getTTMValue: (_, __, ___, kmTTM) => kmTTM?.roicTTM,
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "roe",
        label: "ROE",
        description: "Return on Equity (Net Income divided by Total Stockholders' Equity)",
        direction: "higher_is_better",
        getValue: (inc, bal, _, km, fr) =>
          fr?.returnOnEquity ??
          km?.roe ??
          (inc?.netIncome && (bal?.totalStockholdersEquity || bal?.totalEquity)
            ? inc.netIncome / (bal.totalStockholdersEquity ?? bal.totalEquity ?? 1)
            : null),
        getTTMValue: (_, __, ___, kmTTM, frTTM) => frTTM?.returnOnEquityTTM ?? kmTTM?.roeTTM,
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "roa",
        label: "ROA",
        description: "Return on Assets (Net Income divided by Total Assets)",
        direction: "higher_is_better",
        getValue: (inc, bal, _, __, fr) =>
          fr?.returnOnAssets ??
          (inc?.netIncome && bal?.totalAssets ? inc.netIncome / bal.totalAssets : null),
        getTTMValue: (_, __, ___, kmTTM, frTTM) => frTTM?.returnOnAssetsTTM ?? kmTTM?.roaTTM,
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "ebitda",
        label: "EBITDA",
        description: "Earnings Before Interest, Taxes, Depreciation, and Amortization",
        direction: "higher_is_better",
        getValue: (inc) => inc?.ebitda,
        format: formatRawCurrency,
      },
      {
        id: "ebitdaMargin",
        label: "EBITDA Margin",
        description: "EBITDA as a percentage of Total Revenue",
        direction: "higher_is_better",
        getValue: (inc) =>
          inc?.ebitdaratio ?? (inc?.revenue && inc?.ebitda ? inc.ebitda / inc.revenue : null),
        format: (v) => formatPercentage(v, true),
      },
    ],
  },
  {
    id: "balanceSheetAndDebt",
    title: "BALANCE SHEET & DEBT",
    icon: "🛡️",
    description: "Financial leverage, debt solvency ratios, and liquidity reserves",
    rows: [
      {
        id: "cashAndEquivalents",
        label: "Cash & Equivalents",
        description: "Total liquid cash and short-term marketable investments on hand",
        direction: "higher_is_better",
        getValue: (_, bal) =>
          bal?.cashAndShortTermInvestments ?? bal?.cashAndCashEquivalents,
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
        id: "netDebt",
        label: "Net Debt",
        description: "Total Debt minus liquid Cash & Short-Term Investments",
        direction: "lower_is_better",
        getValue: (_, bal) =>
          bal?.netDebt ??
          (bal?.totalDebt !== undefined && bal?.cashAndCashEquivalents !== undefined
            ? bal.totalDebt - (bal.cashAndShortTermInvestments ?? bal.cashAndCashEquivalents)
            : undefined),
        format: formatRawCurrency,
      },
      {
        id: "debtToEquity",
        label: "Debt-to-Equity",
        description: "Total Debt divided by Total Stockholders' Equity",
        direction: "lower_is_better",
        getValue: (_, bal, __, km, fr) =>
          fr?.debtEquityRatio ??
          km?.debtToEquity ??
          (bal?.totalDebt && (bal?.totalStockholdersEquity || bal?.totalEquity)
            ? bal.totalDebt / (bal.totalStockholdersEquity ?? bal.totalEquity ?? 1)
            : null),
        getTTMValue: (_, __, ___, kmTTM, frTTM) => frTTM?.debtEquityRatioTTM ?? kmTTM?.debtToEquityTTM,
        format: formatRatio,
      },
      {
        id: "netDebtToFcf",
        label: "Net Debt / FCF",
        description: "Years of Free Cash Flow required to eliminate entire Net Debt burden",
        direction: "lower_is_better",
        getValue: (_, bal, cf) => {
          const netDebt =
            bal?.netDebt ??
            (bal?.totalDebt !== undefined && bal?.cashAndCashEquivalents !== undefined
              ? bal.totalDebt - (bal.cashAndShortTermInvestments ?? bal.cashAndCashEquivalents)
              : null);
          const fcf = calculateFCF(cf?.operatingCashFlow, cf?.capitalExpenditure);
          return netDebt !== null && fcf !== null && fcf > 0 ? netDebt / fcf : null;
        },
        format: formatRatio,
      },
    ],
  },
  {
    id: "valuation",
    title: "VALUATION",
    icon: "💎",
    description: "Historical period valuation multiples, enterprise value, and pricing ratios",
    rows: [
      {
        id: "marketCapitalization",
        label: "Market Capitalization",
        description: "Total equity market value of the company",
        direction: "neutral",
        getValue: (_, __, ___, km) => km?.marketCap,
        getTTMValue: (_, __, ___, kmTTM, ____, _____, marketCap) =>
          marketCap ?? kmTTM?.marketCapTTM,
        format: formatRawCurrency,
      },
      {
        id: "enterpriseValue",
        label: "Enterprise Value",
        description: "Market Capitalization + Total Debt - Cash (total enterprise cost)",
        direction: "neutral",
        getValue: (_, __, ___, km) => km?.enterpriseValue,
        getTTMValue: (_, __, ___, kmTTM) => kmTTM?.enterpriseValueTTM,
        format: formatRawCurrency,
      },
      {
        id: "peRatio",
        label: "P/E",
        description: "Price to Earnings multiple",
        direction: "lower_is_better",
        getValue: (_, __, ___, km, fr) =>
          fr?.priceEarningsRatio ?? fr?.priceToEarningsRatio ?? km?.peRatio,
        getTTMValue: (_, __, ___, kmTTM, frTTM) =>
          frTTM?.priceEarningsRatioTTM ?? kmTTM?.peRatioTTM,
        format: formatRatio,
      },
      {
        id: "priceToFCF",
        label: "Price / FCF",
        description: "Price to Free Cash Flow multiple",
        direction: "lower_is_better",
        getValue: (_, __, ___, km, fr) =>
          fr?.priceToFreeCashFlowsRatio ?? fr?.priceToFreeCashFlowRatio ?? km?.pfcfRatio,
        getTTMValue: (_, __, ___, kmTTM, frTTM) =>
          frTTM?.priceToFreeCashFlowsRatioTTM ?? kmTTM?.pfcfRatioTTM,
        format: formatRatio,
      },
      {
        id: "priceToSales",
        label: "Price / Sales",
        description: "Price to Sales multiple",
        direction: "lower_is_better",
        getValue: (_, __, ___, km, fr) => fr?.priceToSalesRatio ?? km?.priceToSalesRatio,
        getTTMValue: (_, __, ___, kmTTM, frTTM) =>
          frTTM?.priceToSalesRatioTTM ?? kmTTM?.priceToSalesRatioTTM,
        format: formatRatio,
      },
      {
        id: "evToEbitda",
        label: "EV / EBITDA",
        description: "Enterprise Value to EBITDA multiple",
        direction: "lower_is_better",
        getValue: (_, __, ___, km, fr) =>
          km?.enterpriseValueOverEBITDA ?? fr?.enterpriseValueMultiple,
        getTTMValue: (_, __, ___, kmTTM) => kmTTM?.enterpriseValueOverEBITDATTM,
        format: formatRatio,
      },
    ],
  },
  {
    id: "dividends",
    title: "DIVIDENDS",
    icon: "💰",
    description: "Historical dividend distributions, payment frequency, yield, cash coverage, and growth trajectory",
    rows: [
      {
        id: "dividendFrequency",
        label: "Dividend Frequency",
        description: "Standard payment schedule determined from actual historical distributions (e.g. Quarterly, Monthly, Annual)",
        direction: "neutral",
        getValue: (_inc, _bal, _cf, _km, _fr, _priorInc, _priorBal, _priorCf, _priorKm, _priorFr, year, divHist) =>
          determineDividendFrequency(divHist, year),
        getTTMValue: (_inc, _bal, _cf, _kmTTM, _frTTM, _currentPrice, _marketCap, _latestInc, _latestBal, _latestCf, divHist) =>
          determineDividendFrequency(divHist),
        format: (v) => (typeof v === "string" ? v : "—"),
      },
      {
        id: "dividendYield",
        label: "Dividend Yield",
        description: "Annualized dividend payout relative to current stock price or fiscal year valuation",
        direction: "higher_is_better",
        getValue: (_inc, _bal, _cf, km, fr, _priorInc, _priorBal, _priorCf, _priorKm, _priorFr, year, divHist, _divMetrics, price) => {
          const annualDPS = calculateAnnualRegularDPS(divHist, year, undefined, undefined, km, fr);
          return fr?.dividendYield ?? km?.dividendYield ?? (price && annualDPS ? annualDPS / price : null);
        },
        getTTMValue: (_inc, _bal, _cf, _kmTTM, frTTM, price, _marketCap, _latestInc, _latestBal, _latestCf, divHist, divMetrics) => {
          const annualDPS = calculateTTMAnnualDPS(divHist, frTTM, divMetrics);
          return frTTM?.dividendYieldTTM ?? divMetrics?.dividendYield ?? (price && annualDPS ? annualDPS / price : null);
        },
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "dividendPerShare",
        label: "Dividend Per Share (DPS)",
        description: "Regular dividend distribution amount per payment per share",
        direction: "higher_is_better",
        getValue: (_inc, _bal, _cf, km, fr, _priorInc, _priorBal, _priorCf, _priorKm, _priorFr, year, divHist) =>
          calculateSinglePaymentDPS(divHist, year, fr, km),
        getTTMValue: (_inc, _bal, _cf, _kmTTM, frTTM, _price, _marketCap, _latestInc, _latestBal, _latestCf, divHist, divMetrics) =>
          calculateSinglePaymentDPS(divHist, undefined, frTTM, divMetrics),
        format: formatRawEPS,
      },
      {
        id: "annualDividendPerShare",
        label: "Annual Dividend Per Share",
        description: "Total regular dividend distributed across the full 12-month period",
        direction: "higher_is_better",
        isKeyHighlight: true,
        getValue: (inc, _bal, cf, km, fr, _priorInc, _priorBal, _priorCf, _priorKm, _priorFr, year, divHist) =>
          calculateAnnualRegularDPS(divHist, year, cf, inc, km, fr),
        getTTMValue: (_inc, _bal, _cf, kmTTM, frTTM, _price, _marketCap, latestInc, _latestBal, latestCf, divHist, divMetrics) =>
          calculateTTMAnnualDPS(
            divHist,
            frTTM,
            divMetrics,
            calculateAnnualRegularDPS(divHist, undefined, latestCf, latestInc, kmTTM, frTTM),
          ),
        format: formatRawEPS,
      },
      {
        id: "dividendGrowth",
        label: "Dividend Growth",
        description: "Year-over-year percentage growth rate in regular annual dividend per share",
        direction: "higher_is_better",
        getValue: (inc, _bal, cf, km, fr, priorInc, _priorBal, priorCf, priorKm, priorFr, year, divHist) => {
          const curr = calculateAnnualRegularDPS(divHist, year, cf, inc, km, fr);
          const priorYear = year !== undefined ? year - 1 : undefined;
          const prior = calculateAnnualRegularDPS(divHist, priorYear, priorCf, priorInc, priorKm, priorFr);
          return computeYoYGrowth(curr, prior);
        },
        getTTMValue: (_inc, _bal, _cf, _kmTTM, frTTM, _price, _marketCap, latestInc, _latestBal, latestCf, divHist, divMetrics) => {
          const curr = calculateTTMAnnualDPS(divHist, frTTM, divMetrics);
          const prior = calculateAnnualRegularDPS(
            divHist,
            latestInc?.date ? parseInt(latestInc.date.split("-")[0], 10) : undefined,
            latestCf,
            latestInc,
          );
          return computeYoYGrowth(curr, prior);
        },
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "dividendsPaid",
        label: "Total Dividends Paid",
        description: "Total cash distributed to shareholders for dividends from Cash Flow Statement",
        direction: "neutral",
        getValue: (_inc, _bal, cf) =>
          cf?.dividendsPaid !== undefined && cf?.dividendsPaid !== null ? Math.abs(cf.dividendsPaid) : undefined,
        getTTMValue: (_inc, _bal, cf) =>
          cf?.dividendsPaid !== undefined && cf?.dividendsPaid !== null ? Math.abs(cf.dividendsPaid) : undefined,
        format: formatRawCurrency,
      },
      {
        id: "dividendPayoutRatio",
        label: "Dividend Payout Ratio",
        description: "Total dividends paid as a percentage of Net Income (safely omitted if unprofitable)",
        direction: "lower_is_better",
        getValue: (inc, _bal, cf, km, fr) => calculateDividendPayoutRatio(cf?.dividendsPaid, inc?.netIncome, fr, km),
        getTTMValue: (inc, _bal, cf, kmTTM, frTTM) =>
          frTTM?.dividendPayoutRatioTTM ?? calculateDividendPayoutRatio(cf?.dividendsPaid, inc?.netIncome, frTTM, kmTTM),
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "dividendFcfCoverage",
        label: "Dividend / FCF",
        description: "Total dividends paid as a percentage of Free Cash Flow (cash generation coverage)",
        direction: "lower_is_better",
        getValue: (_inc, _bal, cf) =>
          calculateDividendFCFCoverage(cf?.dividendsPaid, cf?.operatingCashFlow, cf?.capitalExpenditure),
        getTTMValue: (_inc, _bal, cf) =>
          calculateDividendFCFCoverage(cf?.dividendsPaid, cf?.operatingCashFlow, cf?.capitalExpenditure),
        format: (v) => formatPercentage(v, true),
      },
      {
        id: "specialDividend",
        label: "Special Dividends",
        description: "One-time or special non-recurring cash distributions per share (kept separate from regular dividend)",
        direction: "neutral",
        getValue: (_inc, _bal, _cf, _km, _fr, _priorInc, _priorBal, _priorCf, _priorKm, _priorFr, year, divHist) =>
          calculateSpecialDPS(divHist, year),
        getTTMValue: (_inc, _bal, _cf, _kmTTM, _frTTM, _price, _marketCap, _latestInc, _latestBal, _latestCf, divHist) =>
          calculateSpecialDPS(divHist),
        format: formatRawEPS,
      },
    ],
  },
];

export const RawFinancialsSection: React.FC<RawFinancialsSectionProps> = ({
  incomeStatements,
  balanceSheets,
  cashFlowStatements,
  keyMetrics,
  financialRatios,
  keyMetricsTTM,
  ratiosTTM,
  dividendHistory,
  dividendMetrics,
  symbol,
  companyName,
  currentPrice,
  marketCap,
}) => {
  const [periodView, setPeriodView] = useState<PeriodView>("10Y");

  // Extract all unique historical fiscal years across statement sources and dividend history
  const yearSet = new Set<number>();

  const extractYear = (s?: FinancialStatement | any) => {
    if (!s || !s.date) return null;
    const yearStr = String(s.date).split("-")[0];
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
  keyMetrics?.forEach((s) => {
    const y = extractYear(s);
    if (y) yearSet.add(y);
  });
  financialRatios?.forEach((s) => {
    const y = extractYear(s);
    if (y) yearSet.add(y);
  });
  dividendHistory?.forEach((s) => {
    const y = extractYear(s);
    if (y) yearSet.add(y);
  });

  // Sort descending (most recent fiscal year first)
  const allYears = Array.from(yearSet).sort((a, b) => b - a);

  // Slice years according to periodView (10Y, 5Y, 3Y)
  const maxYearsCount = periodView === "3Y" ? 3 : periodView === "5Y" ? 5 : 10;
  const years = allYears.slice(0, maxYearsCount);

  // Helper lookup functions for each year
  const getIncomeForYear = (yr: number) => incomeStatements?.find((s) => extractYear(s) === yr);
  const getBalanceForYear = (yr: number) => balanceSheets?.find((s) => extractYear(s) === yr);
  const getCashFlowForYear = (yr: number) => cashFlowStatements?.find((s) => extractYear(s) === yr);
  const getKeyMetricsForYear = (yr: number) => keyMetrics?.find((s) => extractYear(s) === yr);
  const getFinancialRatiosForYear = (yr: number) => financialRatios?.find((s) => extractYear(s) === yr);

  // Most recent statements for TTM lookups
  const latestIncome = incomeStatements && incomeStatements.length > 0 ? incomeStatements[0] : undefined;
  const latestBalance = balanceSheets && balanceSheets.length > 0 ? balanceSheets[0] : undefined;
  const latestCashFlow = cashFlowStatements && cashFlowStatements.length > 0 ? cashFlowStatements[0] : undefined;

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
      {/* Header Info & Controls Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">📋</span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Raw Financials &amp; Key Multiples
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                Core Metrics ({years.length}Y)
              </span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
              High-signal financial trajectory for {companyName} ({symbol}) across growth, profitability, cash flow conversion, capital efficiency, leverage, valuation multiples, and dividend distributions.
            </p>
          </div>

          {/* Period Selection Controls */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
              Period:
            </span>
            {(["10Y", "5Y", "3Y"] as PeriodView[]).map((period) => (
              <button
                key={period}
                onClick={() => setPeriodView(period)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
                  periodView === period
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Raw Financials Table Container */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              {/* Header Row 1: Period Labels */}
              <tr className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-700/80">
                <th className="py-3 px-4 sm:px-6 font-bold text-slate-900 dark:text-white sticky left-0 bg-slate-100 dark:bg-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] z-20 min-w-[220px] sm:min-w-[260px]">
                  Period
                </th>
                <th className="py-3 px-4 font-black font-mono text-center text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/40 min-w-[110px]">
                  TTM
                </th>
                {years.map((yr) => (
                  <th
                    key={yr}
                    className="py-3 px-4 font-black font-mono text-center text-slate-900 dark:text-slate-100 min-w-[110px]"
                  >
                    FY {yr}
                  </th>
                ))}
              </tr>

              {/* Header Row 2: Period End Dates */}
              <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                <th className="py-2 px-4 sm:px-6 font-semibold text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] z-20">
                  Period End Date
                </th>
                <th className="py-2 px-4 font-mono text-center text-slate-400 dark:text-slate-500 bg-blue-50/30 dark:bg-blue-950/20">
                  —
                </th>
                {years.map((yr) => {
                  const inc = getIncomeForYear(yr);
                  const bal = getBalanceForYear(yr);
                  const cf = getCashFlowForYear(yr);
                  const rawDate = inc?.date ?? bal?.date ?? cf?.date;
                  return (
                    <th
                      key={yr}
                      className="py-2 px-4 font-mono font-normal text-center text-slate-600 dark:text-slate-400"
                    >
                      {formatPeriodDate(rawDate)}
                    </th>
                  );
                })}
              </tr>

              {/* Header Row 3: Period Length */}
              <tr className="bg-slate-50/40 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-1.5 px-4 sm:px-6 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] z-20">
                  Period Length
                </th>
                <th className="py-1.5 px-4 font-mono text-center bg-blue-50/30 dark:bg-blue-950/20">
                  12 Months
                </th>
                {years.map((yr) => (
                  <th key={yr} className="py-1.5 px-4 font-mono text-center">
                    12 Months
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {METRIC_SECTIONS.map((section) => (
                <React.Fragment key={section.id}>
                  {/* Section Divider Header */}
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-y border-slate-200 dark:border-slate-700">
                    <td
                      colSpan={years.length + 2}
                      className="py-2.5 px-4 sm:px-6 sticky left-0 z-10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm">{section.icon}</span>
                        <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {section.title}
                        </span>
                        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 hidden md:inline ml-2">
                          — {section.description}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Section Metric Rows */}
                  {section.rows.map((row) => {
                    const direction = row.direction || getMetricDirection(row.id, row.label);

                    // Compute TTM Value
                    const latestYr = years[0];
                    const latestInc = latestYr ? getIncomeForYear(latestYr) : undefined;
                    const latestBal = latestYr ? getBalanceForYear(latestYr) : undefined;
                    const latestCf = latestYr ? getCashFlowForYear(latestYr) : undefined;

                    const ttmRawVal = row.getTTMValue
                      ? row.getTTMValue(
                          latestIncome,
                          latestBalance,
                          latestCashFlow,
                          keyMetricsTTM,
                          ratiosTTM,
                          currentPrice,
                          marketCap,
                          latestInc,
                          latestBal,
                          latestCf,
                          dividendHistory,
                          dividendMetrics,
                        )
                      : row.getValue(
                          latestIncome,
                          latestBalance,
                          latestCashFlow,
                          keyMetricsTTM,
                          ratiosTTM,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          dividendHistory,
                          dividendMetrics,
                          currentPrice,
                        );

                    const ttmFormatted = row.format(ttmRawVal);
                    const isTTM_NA = ttmFormatted === "—";

                    // Prior for TTM comparison is the latest FY
                    const latestKm = latestYr ? getKeyMetricsForYear(latestYr) : undefined;
                    const latestFr = latestYr ? getFinancialRatiosForYear(latestYr) : undefined;
                    const latestFYVal = latestYr
                      ? row.getValue(
                          latestInc,
                          latestBal,
                          latestCf,
                          latestKm,
                          latestFr,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          latestYr,
                          dividendHistory,
                          dividendMetrics,
                          currentPrice,
                        )
                      : undefined;

                    const ttmColorClass = isTTM_NA
                      ? "text-slate-400 dark:text-slate-500"
                      : getMetricComparisonColor(ttmRawVal, latestFYVal, direction);

                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-100 dark:border-slate-700/40 ${
                          row.isKeyHighlight ? "bg-blue-50/20 dark:bg-blue-950/10" : ""
                        }`}
                      >
                        {/* Metric Label Column (Sticky) */}
                        <td className="py-2.5 px-4 sm:px-6 sticky left-0 bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] z-10">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-semibold text-xs sm:text-sm ${
                                row.isKeyHighlight
                                  ? "text-blue-700 dark:text-blue-400 font-bold"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {row.label}
                            </span>
                            {row.isKeyHighlight && (
                              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                Core
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-tight mt-0.5">
                            {row.description}
                          </div>
                        </td>

                        {/* TTM Column */}
                        <td
                          className={`py-2.5 px-4 text-center font-mono font-medium bg-blue-50/30 dark:bg-blue-950/20 ${ttmColorClass}`}
                        >
                          {ttmFormatted}
                        </td>

                        {/* Historical Fiscal Year Columns */}
                        {years.map((yr, idx) => {
                          const inc = getIncomeForYear(yr);
                          const bal = getBalanceForYear(yr);
                          const cf = getCashFlowForYear(yr);
                          const km = getKeyMetricsForYear(yr);
                          const fr = getFinancialRatiosForYear(yr);

                          // Prior year is the next element in years array (sorted descending)
                          const priorYr = years[idx + 1];
                          const priorInc = priorYr ? getIncomeForYear(priorYr) : undefined;
                          const priorBal = priorYr ? getBalanceForYear(priorYr) : undefined;
                          const priorCf = priorYr ? getCashFlowForYear(priorYr) : undefined;
                          const priorKm = priorYr ? getKeyMetricsForYear(priorYr) : undefined;
                          const priorFr = priorYr ? getFinancialRatiosForYear(priorYr) : undefined;

                          const rawVal = row.getValue(
                            inc,
                            bal,
                            cf,
                            km,
                            fr,
                            priorInc,
                            priorBal,
                            priorCf,
                            priorKm,
                            priorFr,
                            yr,
                            dividendHistory,
                            dividendMetrics,
                            currentPrice,
                          );
                          const formattedVal = row.format(rawVal);
                          const isNA = formattedVal === "—";

                          const priorVal = priorYr
                            ? row.getValue(
                                priorInc,
                                priorBal,
                                priorCf,
                                priorKm,
                                priorFr,
                                undefined,
                                undefined,
                                undefined,
                                undefined,
                                undefined,
                                priorYr,
                                dividendHistory,
                                dividendMetrics,
                                currentPrice,
                              )
                            : undefined;

                          const colorClass = isNA
                            ? "text-slate-400 dark:text-slate-500"
                            : getMetricComparisonColor(rawVal, priorVal, direction);

                          return (
                            <td
                              key={yr}
                              className={`py-2.5 px-4 text-center font-mono font-medium ${colorClass}`}
                            >
                              {formattedVal}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
