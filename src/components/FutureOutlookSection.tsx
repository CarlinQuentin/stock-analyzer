import React, { useMemo } from "react";
import { FutureOutlookData } from "../types";
import {
  processAnalystAction,
  getAnalystActionSummary,
} from "../utils/analystActions";

interface FutureOutlookSectionProps {
  data: FutureOutlookData | null;
  loading?: boolean;
}

export const FutureOutlookSection: React.FC<FutureOutlookSectionProps> = ({
  data,
  loading = false,
}) => {
  const processedGrades = useMemo(() => {
    if (!data?.recentGrades) return [];
    return data.recentGrades.map(processAnalystAction);
  }, [data?.recentGrades]);

  const analystActionsSummary = useMemo(() => {
    return getAnalystActionSummary(processedGrades);
  }, [processedGrades]);
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-700 text-center animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mx-auto mb-4"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mx-auto mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!data || (!data.estimates.length && !data.priceTarget)) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-700 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
          Future Outlook Data Unavailable
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Consensus analyst estimates and price targets are currently unavailable for this ticker or subscription tier.
        </p>
      </div>
    );
  }

  const formatCurrency = (val: number | null) => {
    if (val === null || isNaN(val)) return "N/A";
    if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatEps = (val: number | null) => {
    if (val === null || isNaN(val)) return "N/A";
    return `$${val.toFixed(2)}`;
  };

  const formatPct = (val: number | null, includePlus = true) => {
    if (val === null || isNaN(val)) return "N/A";
    const prefix = includePlus && val > 0 ? "+" : "";
    return `${prefix}${val.toFixed(1)}%`;
  };

  const renderTrendBadge = (status: "Accelerating" | "Stable" | "Decelerating" | "N/A") => {
    if (status === "Accelerating") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Accelerating Growth
        </span>
      );
    }
    if (status === "Decelerating") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
          </svg>
          Decelerating Growth
        </span>
      );
    }
    if (status === "Stable") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
          </svg>
          Stable Growth
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        N/A
      </span>
    );
  };

  const priceTarget = data.priceTarget;
  const currentPrice = priceTarget?.currentPrice ?? null;
  const consensusTarget = priceTarget?.targetConsensus ?? null;
  const lowTarget = priceTarget?.targetLow ?? null;
  const highTarget = priceTarget?.targetHigh ?? null;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Future Outlook
              </h2>
            </div>
            <span className="px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/20 border border-blue-400/30 text-blue-200">
              Informational Forecasts & Market Expectations
            </span>
          </div>
          <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
            Forward-looking consensus analyst expectations for earnings, revenue, profitability, price targets, and market sentiment.
          </p>
        </div>
      </div>

      {/* SECTION 1 — Growth Outlook Cards */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-600 rounded-full inline-block"></span>
          Forward Growth Outlook
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Expected EPS Growth */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-md transition-all hover:shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expected EPS Growth
              </span>
              {renderTrendBadge(data.epsTrendStatus)}
            </div>

            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
              {formatPct(data.forwardEpsGrowthPct)}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 border-t border-slate-100 dark:border-slate-700/50 pt-3">
              <div className="flex justify-between">
                <span>Historical EPS CAGR:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatPct(data.historicalEpsCagr !== null ? data.historicalEpsCagr * 100 : null, false)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Expectation Type:</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Consensus Analyst</span>
              </div>
            </div>
          </div>

          {/* Expected Revenue Growth */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-md transition-all hover:shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expected Revenue Growth
              </span>
              {renderTrendBadge(data.revenueTrendStatus)}
            </div>

            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
              {formatPct(data.forwardRevenueGrowthPct)}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 border-t border-slate-100 dark:border-slate-700/50 pt-3">
              <div className="flex justify-between">
                <span>Historical Revenue CAGR:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatPct(data.historicalRevenueCagr !== null ? data.historicalRevenueCagr * 100 : null, false)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Expectation Type:</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Consensus Analyst</span>
              </div>
            </div>
          </div>

          {/* Expected EBITDA Growth */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-md transition-all hover:shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expected EBITDA Growth
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                Forward EBITDA
              </span>
            </div>

            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
              {formatPct(data.forwardEbitdaGrowthPct)}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 border-t border-slate-100 dark:border-slate-700/50 pt-3">
              <div className="flex justify-between">
                <span>Metric Focus:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Operating Cash Profit</span>
              </div>
              <div className="flex justify-between">
                <span>Data Period:</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Next Fiscal Year</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — Analyst Estimates Breakdown */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-indigo-600 rounded-full inline-block"></span>
          Consensus Fiscal Year Estimates
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700/60 overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Analyst Financial Forecast Breakdown by Fiscal Year
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fiscal Period</th>
                  <th className="px-4 py-3 font-semibold text-right">EPS (Low / Consensus / High)</th>
                  <th className="px-4 py-3 font-semibold text-right">Revenue (Consensus)</th>
                  <th className="px-4 py-3 font-semibold text-right">EBITDA (Consensus)</th>
                  <th className="px-4 py-3 font-semibold text-center">Analysts</th>
                  <th className="px-4 py-3 font-semibold text-right">YoY EPS Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.estimates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                      No fiscal year estimate data available.
                    </td>
                  </tr>
                ) : (
                  data.estimates.map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                        {e.fiscalYear}
                        <div className="text-xs font-normal text-slate-400">{e.date}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium">
                        <span className="text-slate-500 text-xs">{formatEps(e.epsLow)}</span>
                        <span className="mx-1 font-bold text-slate-900 dark:text-slate-100">{formatEps(e.epsAvg)}</span>
                        <span className="text-slate-500 text-xs">{formatEps(e.epsHigh)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(e.revenueAvg)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(e.ebitdaAvg)}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-600 dark:text-slate-400">
                        {e.numAnalystsEps ?? e.numAnalystsRevenue ?? "N/A"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        <span className={e.epsYoYGrowthPct && e.epsYoYGrowthPct > 0 ? "text-emerald-600 dark:text-emerald-400" : e.epsYoYGrowthPct && e.epsYoYGrowthPct < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600"}>
                          {formatPct(e.epsYoYGrowthPct ?? null)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 3 — Analyst Price Targets */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-emerald-600 rounded-full inline-block"></span>
          Analyst Price Targets
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700/60">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Implied Upside Highlight */}
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Implied Target Upside / Downside
              </span>
              <div className={`text-4xl font-extrabold mb-2 ${priceTarget?.impliedUpsidePct && priceTarget.impliedUpsidePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatPct(priceTarget?.impliedUpsidePct ?? null)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Current Price: <span className="font-semibold text-slate-800 dark:text-slate-200">{formatEps(currentPrice)}</span>
              </div>
            </div>

            {/* Price Target Range Visual */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>Low Target: {formatEps(lowTarget)}</span>
                <span>Consensus: {formatEps(consensusTarget)}</span>
                <span>High Target: {formatEps(highTarget)}</span>
              </div>

              {/* Range Bar */}
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative overflow-hidden">
                <div className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" style={{ left: "10%", right: "10%" }}></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Current Price</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatEps(currentPrice)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Consensus Target</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">{formatEps(consensusTarget)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Median Target</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatEps(priceTarget?.targetMedian ?? null)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Analyst Coverage</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{priceTarget?.analystCount ? `${priceTarget.analystCount} Analysts` : "N/A"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4 — Estimate Revisions & Recent Analyst Actions */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-purple-600 rounded-full inline-block"></span>
          Estimate Revisions & Analyst Actions
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Target Revisions Over Time */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700/60">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-4">
              Consensus Target Changes Over Time
            </h4>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-600 dark:text-slate-400">Last 30 Days Avg Target</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatEps(priceTarget?.lastMonthAvgPriceTarget ?? null)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-600 dark:text-slate-400">Last Quarter (90 Days) Avg Target</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatEps(priceTarget?.lastQuarterAvgPriceTarget ?? null)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-600 dark:text-slate-400">Last Year (365 Days) Avg Target</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatEps(priceTarget?.lastYearAvgPriceTarget ?? null)}</span>
              </div>
            </div>
          </div>

          {/* Recent Analyst Actions Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700/60 flex flex-col h-full">
            <div className="mb-4">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Recent Analyst Actions
              </h4>
              {analystActionsSummary ? (
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  {analystActionsSummary}
                </div>
              ) : null}
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto scrollbar-thin pr-1 flex-1">
              {processedGrades.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
                  No recent analyst actions available.
                </div>
              ) : (
                processedGrades.map((g, idx) => {
                  let badgeStyle =
                    "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700";
                  if (g.actionType === "UPGRADED") {
                    badgeStyle =
                      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/80 font-bold";
                  } else if (g.actionType === "DOWNGRADED") {
                    badgeStyle =
                      "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/80 dark:border-rose-700/80 font-bold";
                  } else if (g.actionType === "INITIATED") {
                    badgeStyle =
                      "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300/80 dark:border-sky-700/80 font-bold";
                  }

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-700/50 text-xs transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-900/80"
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {g.gradingCompany}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                            {g.formattedDate}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${badgeStyle}`}
                        >
                          {g.actionType}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {g.displayText}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
