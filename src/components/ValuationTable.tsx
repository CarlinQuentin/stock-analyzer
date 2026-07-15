import React from "react";
import { ValuationMetrics, ValuationScores } from "../types";

interface ValuationTableProps {
  valuationMetrics: ValuationMetrics;
  valuationScores: ValuationScores;
}

export const ValuationTable: React.FC<ValuationTableProps> = ({
  valuationMetrics,
  valuationScores,
}) => {
  const formatRatio = (value: number | null) => {
    if (value === null || isNaN(value)) return "N/A";
    return value.toFixed(2);
  };

  const formatPremium = (value: number | null) => {
    if (value === null || isNaN(value)) return "N/A";
    const percentage = value * 100;
    return `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
  };

  const renderPerformanceBadge = (score: number | null) => {
    if (score === null) {
      return (
        <span className="inline-block bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-3 py-1 rounded-full text-sm font-medium">
          N/A
        </span>
      );
    }

    let colorClasses = "";

    if (score >= 80) {
      colorClasses = "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300";
    } else if (score >= 60) {
      colorClasses = "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
    } else if (score >= 40) {
      colorClasses = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    } else {
      colorClasses = "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
    }

    // Map labels to short versions
    let label = "Expensive";
    if (score >= 80) label = "Undervalued";
    else if (score >= 60) label = "Fair Value";
    else if (score >= 40) label = "Premium";

    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClasses}`}>
        {label}
      </span>
    );
  };

  const getScoreBadgeClasses = (score: number | null) => {
    if (score === null) return "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    if (score >= 80) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/50";
    if (score >= 60) return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50";
    if (score >= 40) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50";
    return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50";
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-transparent dark:border-slate-700/50 overflow-hidden transition-colors duration-300">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                Valuation Metric
              </th>
              <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                Current Value
              </th>
              <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                5-Yr Avg
              </th>
              <th className="text-center px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                Valuation Rating
              </th>
              <th className="text-right px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Price-to-Earnings (P/E) Ratio</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Price relative to EPS (annualized)
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                {formatRatio(valuationMetrics.peRatio)}
              </td>
              <td className="text-right px-6 py-4 text-slate-500 dark:text-slate-400">
                {formatRatio(valuationMetrics.historicalPeAverage)}
              </td>
              <td className="text-center px-6 py-4">
                {renderPerformanceBadge(valuationScores.pe)}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(valuationScores.pe)}`}>
                  {valuationScores.pe !== null ? valuationScores.pe : "N/A"}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Price-to-Sales (P/S) Ratio</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Market capitalization relative to revenue
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                {formatRatio(valuationMetrics.priceToSalesRatio)}
              </td>
              <td className="text-right px-6 py-4 text-slate-500 dark:text-slate-400">
                {formatRatio(valuationMetrics.historicalPsAverage)}
              </td>
              <td className="text-center px-6 py-4">
                {renderPerformanceBadge(valuationScores.ps)}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(valuationScores.ps)}`}>
                  {valuationScores.ps !== null ? valuationScores.ps : "N/A"}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Enterprise Value-to-Sales (EV/Sales)</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Total enterprise valuation relative to revenue
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                {formatRatio(valuationMetrics.evToSales)}
              </td>
              <td className="text-right px-6 py-4 text-slate-500 dark:text-slate-400">
                {formatRatio(valuationMetrics.historicalEvsAverage)}
              </td>
              <td className="text-center px-6 py-4">
                {renderPerformanceBadge(valuationScores.evs)}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(valuationScores.evs)}`}>
                  {valuationScores.evs !== null ? valuationScores.evs : "N/A"}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Price-to-Free-Cash-Flow (P/FCF)</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Price relative to annualized free cash flow
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold">
                {formatRatio(valuationMetrics.priceToFreeCashFlowsRatio)}
              </td>
              <td className="text-right px-6 py-4 text-slate-500 dark:text-slate-400">
                {formatRatio(valuationMetrics.historicalPfcfAverage)}
              </td>
              <td className="text-center px-6 py-4">
                {renderPerformanceBadge(valuationScores.pfcf)}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(valuationScores.pfcf)}`}>
                  {valuationScores.pfcf !== null ? valuationScores.pfcf : "N/A"}
                </span>
              </td>
            </tr>

            <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div>Historical Valuation Premium/Discount</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Avg. valuation premium/discount vs. 5-year averages
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900 dark:text-slate-200 font-semibold" colSpan={2}>
                {formatPremium(valuationMetrics.averagePremium)}
              </td>
              <td className="text-center px-6 py-4">
                {renderPerformanceBadge(valuationScores.historical)}
              </td>
              <td className="text-right px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded font-bold border ${getScoreBadgeClasses(valuationScores.historical)}`}>
                  {valuationScores.historical !== null ? valuationScores.historical : "N/A"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
