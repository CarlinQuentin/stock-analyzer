import React from "react";
import { FinancialMetrics, MetricScores } from "../types";
import { getMetricAnalysis } from "../utils/scoring";

interface AnalysisTableProps {
  metrics: FinancialMetrics;
  scores: MetricScores;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({
  metrics,
  scores,
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

  const formatPercentage = (value: number | null): string => {
    if (value === null) return "N/A";
    const normalized = Math.abs(value) <= 1 ? value * 100 : value;
    return `${normalized.toFixed(2)}%`;
  };

  const renderPerformanceBadge = (score: number) => {
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

  const getScoreBadgeClasses = (score: number) => {
    if (score >= 85) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/50";
    if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50";
    if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50";
    return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50";
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-transparent dark:border-slate-700/50 overflow-hidden transition-colors duration-300">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
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
            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>5-Year Revenue CAGR</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Compound annual growth rate
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200">
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
                  {scores.revenue}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>5-Year EPS Growth</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Earnings per share growth
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200">
                {formatPercentage(metrics.epsGrowth)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.epsGrowth !== null ? (
                  renderPerformanceBadge(scores.eps)
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.eps)}`}>
                  {scores.eps}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>5-Year FCF Growth</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Free cash flow growth
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200">
                {formatPercentage(metrics.fcfGrowth)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.fcfGrowth !== null ? (
                  renderPerformanceBadge(scores.fcf)
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.fcf)}`}>
                  {scores.fcf}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Return on Invested Capital</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  ROIC - capital efficiency
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200">
                {formatPercentage(metrics.roic)}
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
                  {scores.roic}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Debt-to-Equity Ratio</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Financial leverage</div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200">
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
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.debt)}`}>
                  {scores.debt}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Net Profit Margin</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Overall profitability
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200">
                {formatPercentage(metrics.netMargin)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.netMargin !== null ? (
                  renderPerformanceBadge(scores.profitability)
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.profitability)}`}>
                  {scores.profitability}
                </span>
              </td>
            </tr>

            <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Share Dilution</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Shareholder value impact
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200">
                {metrics.sharesDilution}
              </td>
              <td className="text-center px-6 py-4">
                {renderPerformanceBadge(scores.dilution)}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(scores.dilution)}`}>
                  {scores.dilution}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
