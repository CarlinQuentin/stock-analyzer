import React from "react";
import { FinancialMetrics, MetricScores } from "../types";
import { getMetricAnalysis, formatPercentageMetric } from "../utils/scoring";

interface AnalysisTableProps {
  metrics: FinancialMetrics;
  scores: MetricScores;
  revenueYears?: number;
  epsYears?: number;
  fcfYears?: number;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({
  metrics,
  scores,
  revenueYears,
  epsYears,
  fcfYears,
}) => {
  const formatValue = (value: number | null): string => {
    if (value === null) return "N/A";
    if (typeof value === "number") {
      if (Math.abs(value) >= 100) return value.toFixed(1);
      if (Math.abs(value) >= 1) return value.toFixed(2);
      return value.toFixed(4);
    }
    return String(value);
  };

  const formatPercentage = (value: number | null, isAlreadyPercentage: boolean = false): string => {
    return formatPercentageMetric(value, isAlreadyPercentage);
  };

  const renderPerformanceBadge = (score: number | null) => {
    if (score === null) {
      return (
        <span className="inline-block bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-3 py-1 rounded-full text-sm font-medium">
          N/A
        </span>
      );
    }
    const analysis = getMetricAnalysis(score);
    let colorClasses = "";

    if (score >= 85) {
      colorClasses = "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300";
    } else if (score >= 70) {
      colorClasses = "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
    } else if (score >= 50) {
      colorClasses = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    } else {
      colorClasses = "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
    }

    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClasses}`}>
        {analysis}
      </span>
    );
  };

  const getScoreBadgeClasses = (score: number | null) => {
    if (score === null) return "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    if (score >= 85) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/50";
    if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50";
    if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50";
    return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50";
  };

  return (
    <div className="space-y-8">
      {/* Universal Business Quality Score Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-transparent dark:border-slate-700/50 overflow-hidden transition-colors duration-300">
        <div className="bg-blue-50/70 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>⭐</span>
              <span>Universal Business Quality Score Metrics</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Metrics that apply broadly across industries and contribute directly to the Business Quality Score.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Metric
                </th>
                <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Value
                </th>
                <th className="text-center px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Performance
                </th>
                <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {/* ROIC */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>Return on Invested Capital (ROIC)</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Capital efficiency metric</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.roic, true)}
                </td>
                <td className="text-center px-6 py-4">
                  {metrics.roic !== null ? (
                    renderPerformanceBadge(scores.roic)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">N/A</span>
                  )}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.roic)}`}>
                    {scores.roic !== null ? scores.roic : "N/A"}
                  </span>
                </td>
              </tr>

              {/* FCF Margin */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>FCF Margin</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Free cash flow efficiency</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.fcfMargin, true)}
                </td>
                <td className="text-center px-6 py-4">
                  {renderPerformanceBadge(scores.fcfMargin)}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.fcfMargin)}`}>
                    {scores.fcfMargin !== null ? scores.fcfMargin : "N/A"}
                  </span>
                </td>
              </tr>

              {/* FCF Consistency */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>FCF Consistency</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Reliability of free cash flow generation</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.fcfConsistency, true)}
                </td>
                <td className="text-center px-6 py-4">
                  {renderPerformanceBadge(scores.fcfConsistency)}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.fcfConsistency)}`}>
                    {scores.fcfConsistency !== null ? scores.fcfConsistency : "N/A"}
                  </span>
                </td>
              </tr>

              {/* FCF Conversion */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>FCF Conversion</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Free Cash Flow / Net Income ratio</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.fcfConversion, true)}
                </td>
                <td className="text-center px-6 py-4">
                  {renderPerformanceBadge(scores.fcfConversion)}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.fcfConversion)}`}>
                    {scores.fcfConversion !== null ? scores.fcfConversion : "N/A"}
                  </span>
                </td>
              </tr>

              {/* Margin Stability */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>Margin Stability</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Operating profitability stability over time</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.marginStability, true)}
                </td>
                <td className="text-center px-6 py-4">
                  {renderPerformanceBadge(scores.marginStability)}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.marginStability)}`}>
                    {scores.marginStability !== null ? scores.marginStability : "N/A"}
                  </span>
                </td>
              </tr>

              {/* Net Debt / FCF */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>Net Debt / FCF</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Solvency & debt coverage by free cash flow</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {metrics.netDebtToFCF !== null ? `${metrics.netDebtToFCF.toFixed(2)}x` : "N/A"}
                </td>
                <td className="text-center px-6 py-4">
                  {renderPerformanceBadge(scores.netDebtToFCF)}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.netDebtToFCF)}`}>
                    {scores.netDebtToFCF !== null ? scores.netDebtToFCF : "N/A"}
                  </span>
                </td>
              </tr>

              {/* Share Dilution */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>Share Dilution</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Shareholder ownership change over period</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.shareDilution, true)}
                </td>
                <td className="text-center px-6 py-4">
                  {renderPerformanceBadge(scores.shareDilution)}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.shareDilution)}`}>
                    {scores.shareDilution !== null ? scores.shareDilution : "N/A"}
                  </span>
                </td>
              </tr>

              {/* Revenue Growth */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>{revenueYears ? `${revenueYears}-Year` : "Historical"} Revenue CAGR</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Compound annual growth rate</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.revenueCAGR)}
                </td>
                <td className="text-center px-6 py-4">
                  {metrics.revenueCAGR !== null ? (
                    renderPerformanceBadge(scores.revenue)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">N/A</span>
                  )}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.revenue)}`}>
                    {scores.revenue !== null ? scores.revenue : "N/A"}
                  </span>
                </td>
              </tr>

              {/* EPS Growth */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>{epsYears ? `${epsYears}-Year` : "Historical"} EPS Growth</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {metrics.epsGrowth !== null
                      ? "Earnings per share growth"
                      : `EPS Trend: ${metrics.epsTrend || "N/A"}`}
                  </div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {metrics.epsGrowth !== null ? (
                    formatPercentage(metrics.epsGrowth)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 font-normal">
                      {metrics.epsTrend || "N/A"}
                    </span>
                  )}
                </td>
                <td className="text-center px-6 py-4">
                  {scores.eps !== null ? (
                    renderPerformanceBadge(scores.eps)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">N/A</span>
                  )}
                </td>
                <td className="text-right px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.eps)}`}>
                    {scores.eps !== null ? scores.eps : "N/A"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Informational Financial Metrics Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-transparent dark:border-slate-700/50 overflow-hidden transition-colors duration-300">
        <div className="bg-slate-100 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📊</span>
              <span>Financial Metrics</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Financial health and performance insights displayed for context. Metrics marked as informational are excluded from the main Business Quality Score.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Metric
                </th>
                <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Value
                </th>
                <th className="text-center px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Performance / Status
                </th>
                <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                  Scoring Contribution
                </th>
              </tr>
            </thead>
            <tbody>
              {/* FCF Growth (Informational) */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>{fcfYears ? `${fcfYears}-Year` : "Historical"} FCF Growth</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Free cash flow growth rate
                  </div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {metrics.fcfGrowth !== null ? (
                    formatPercentage(metrics.fcfGrowth)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 font-normal">
                      {metrics.fcfTrend || "N/A"}
                    </span>
                  )}
                </td>
                <td className="text-center px-6 py-4">
                  {metrics.fcfGrowth !== null ? (
                    renderPerformanceBadge(scores.fcf)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">N/A</span>
                  )}
                </td>
                <td className="text-right px-6 py-4">
                  <span className="inline-block bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded text-xs font-semibold border border-slate-200 dark:border-slate-700">
                    Informational Metric - Not included in Universal Score
                  </span>
                </td>
              </tr>

              {/* Debt-to-Equity (Informational) */}
              <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>Debt-to-Equity Ratio</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Financial leverage</div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatValue(metrics.debtToEquity)}
                </td>
                <td className="text-center px-6 py-4">
                  {metrics.debtToEquity !== null ? (
                    renderPerformanceBadge(scores.debt)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">N/A</span>
                  )}
                </td>
                <td className="text-right px-6 py-4">
                  <span className="inline-block bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded text-xs font-semibold border border-slate-200 dark:border-slate-700">
                    Informational Metric - Not included in Universal Score
                  </span>
                </td>
              </tr>

              {/* Profitability Margins (Informational) */}
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div>Profitability Margins</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Net Profit Margin ({formatPercentage(metrics.netMargin, true)})
                  </div>
                </td>
                <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPercentage(metrics.netMargin, true)}
                </td>
                <td className="text-center px-6 py-4">
                  {metrics.netMargin !== null ? (
                    renderPerformanceBadge(scores.profitability)
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">N/A</span>
                  )}
                </td>
                <td className="text-right px-6 py-4">
                  <span className="inline-block bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded text-xs font-semibold border border-slate-200 dark:border-slate-700">
                    Informational Metric - Not included in Universal Score
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
