import React from "react";
import { FinancialMetrics, MetricScores } from "../types";

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
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left px-6 py-4 font-semibold text-slate-900">
                Metric
              </th>
              <th className="text-right px-6 py-4 font-semibold text-slate-900">
                Value
              </th>
              <th className="text-center px-6 py-4 font-semibold text-slate-900">
                Performance
              </th>
              <th className="text-right px-6 py-4 font-semibold text-slate-900">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">
                <div>5-Year Revenue CAGR</div>
                <div className="text-sm text-slate-500">
                  Compound annual growth rate
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900">
                {formatPercentage(metrics.revenueCAGR)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.revenueCAGR ? (
                  metrics.revenueCAGR > 0.15 ? (
                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Excellent
                    </span>
                  ) : metrics.revenueCAGR >= 0.08 ? (
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Good
                    </span>
                  ) : (
                    <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                      Fair
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className="inline-block bg-slate-100 px-3 py-1 rounded font-bold text-slate-900">
                  {scores.revenue}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">
                <div>5-Year EPS Growth</div>
                <div className="text-sm text-slate-500">
                  Earnings per share growth
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900">
                {formatPercentage(metrics.epsGrowth)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.epsGrowth ? (
                  metrics.epsGrowth > 0.15 ? (
                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Excellent
                    </span>
                  ) : metrics.epsGrowth >= 0.05 ? (
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Good
                    </span>
                  ) : (
                    <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                      Fair
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className="inline-block bg-slate-100 px-3 py-1 rounded font-bold text-slate-900">
                  {scores.eps}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">
                <div>5-Year FCF Growth</div>
                <div className="text-sm text-slate-500">
                  Free cash flow growth
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900">
                {formatPercentage(metrics.fcfGrowth)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.fcfGrowth ? (
                  metrics.fcfGrowth > 0.1 ? (
                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Excellent
                    </span>
                  ) : metrics.fcfGrowth >= 0.05 ? (
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Good
                    </span>
                  ) : (
                    <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                      Fair
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className="inline-block bg-slate-100 px-3 py-1 rounded font-bold text-slate-900">
                  {scores.fcf}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">
                <div>Return on Invested Capital</div>
                <div className="text-sm text-slate-500">
                  ROIC - capital efficiency
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900">
                {formatPercentage(metrics.roic ? metrics.roic / 100 : null)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.roic ? (
                  metrics.roic > 15 ? (
                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Excellent
                    </span>
                  ) : metrics.roic >= 10 ? (
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Good
                    </span>
                  ) : (
                    <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                      Fair
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className="inline-block bg-slate-100 px-3 py-1 rounded font-bold text-slate-900">
                  {scores.roic}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">
                <div>Debt-to-Equity Ratio</div>
                <div className="text-sm text-slate-500">Financial leverage</div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900">
                {formatValue(metrics.debtToEquity)}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.debtToEquity ? (
                  metrics.debtToEquity < 0.5 ? (
                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Excellent
                    </span>
                  ) : metrics.debtToEquity <= 1 ? (
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Good
                    </span>
                  ) : (
                    <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                      Fair
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className="inline-block bg-slate-100 px-3 py-1 rounded font-bold text-slate-900">
                  {scores.debt}
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">
                <div>Net Profit Margin</div>
                <div className="text-sm text-slate-500">
                  Overall profitability
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900">
                {formatPercentage(
                  metrics.netMargin ? metrics.netMargin / 100 : null,
                )}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.netMargin ? (
                  metrics.netMargin >= 20 ? (
                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Excellent
                    </span>
                  ) : metrics.netMargin >= 10 ? (
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Good
                    </span>
                  ) : (
                    <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                      Fair
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">N/A</span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className="inline-block bg-slate-100 px-3 py-1 rounded font-bold text-slate-900">
                  {scores.profitability}
                </span>
              </td>
            </tr>

            <tr className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium text-slate-900">
                <div>Share Dilution</div>
                <div className="text-sm text-slate-500">
                  Shareholder value impact
                </div>
              </td>
              <td className="text-right px-6 py-4 text-slate-900">
                {metrics.sharesDilution}
              </td>
              <td className="text-center px-6 py-4">
                {metrics.sharesDilution?.includes("buyback") ||
                metrics.sharesDilution?.includes("Stable") ? (
                  <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Positive
                  </span>
                ) : (
                  <span className="inline-block bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                    Watch
                  </span>
                )}
              </td>
              <td className="text-right px-6 py-4">
                <span className="inline-block bg-slate-100 px-3 py-1 rounded font-bold text-slate-900">
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
