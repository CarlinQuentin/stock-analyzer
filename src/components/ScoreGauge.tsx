import { useState } from "react";
import { getScoreCategory, SCORE_WEIGHTS } from "../utils/scoring";
import { MetricScores, ValuationScores } from "../types";

interface ScoreGaugeProps {
  score: number;
  confidence?: number;
  unavailable?: string[];
  title?: string;
  description?: string;
  scores?: MetricScores;
  valuationScores?: ValuationScores;
}

export const ScoreGauge = ({
  score,
  confidence,
  unavailable,
  title = "Overall Quality Score",
  description,
  scores,
  valuationScores,
}: ScoreGaugeProps) => {
  const [showEquation, setShowEquation] = useState(false);
  const category = getScoreCategory(score);
  const colorMap: { [key: string]: string } = {
    green: "from-green-500 to-emerald-600",
    blue: "from-blue-500 to-blue-600",
    yellow: "from-amber-500 to-amber-600",
    red: "from-red-500 to-red-600",
  };

  const gradientClass = colorMap[category.color] || "from-gray-500 to-gray-600";

  const METRIC_LABELS: Record<string, string> = {
    roic: "ROIC",
    fcfMargin: "FCF Margin",
    fcfConsistency: "FCF Consistency",
    fcfConversion: "Avg FCF Conversion",
    marginStability: "Margin Stability",
    netDebtToFCF: "Net Debt / Normalized FCF",
    shareDilution: "Share Dilution",
    revenue: "Revenue Growth",
    eps: "EPS Growth",
  };

  // Business Quality Score Considerations - dynamically derived from SCORE_WEIGHTS configuration
  const businessQualityItems = scores
    ? (Object.keys(SCORE_WEIGHTS) as (keyof MetricScores)[]).map((key) => ({
        key,
        label: METRIC_LABELS[key] || key,
        weight: SCORE_WEIGHTS[key],
        score: scores[key],
      }))
    : [];

  // Stock Valuation Score Considerations
  const valuationItems = valuationScores
    ? [
        { key: "pe", label: "P/E Ratio", weight: 0.2, score: valuationScores.pe },
        { key: "ps", label: "P/S Ratio", weight: 0.2, score: valuationScores.ps },
        { key: "evs", label: "EV/Sales", weight: 0.2, score: valuationScores.evs },
        { key: "pfcf", label: "P/FCF Ratio", weight: 0.2, score: valuationScores.pfcf },
        { key: "historical", label: "Historical Premium", weight: 0.2, score: valuationScores.historical },
      ]
    : [];

  const items = scores ? businessQualityItems : valuationScores ? valuationItems : [];
  const isBusinessQuality = !!scores;

  let weightedSum = 0;
  let weightSum = 0;

  items.forEach((item) => {
    if (item.score !== null && item.score !== undefined) {
      weightedSum += item.score * item.weight;
      weightSum += item.weight;
    }
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 flex flex-col items-center border border-transparent dark:border-slate-700/50 transition-colors duration-300">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 text-center">
        {title}
      </h2>

      <div className="flex flex-col items-center">
        <div className="relative w-48 h-48 mb-6">
          {/* Gauge background */}
          <svg className="w-full h-full" viewBox="0 0 200 200">
            {/* Track */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Score fill */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              style={{
                strokeDasharray: `${(score / 100) * 251.2} 251.2`,
              }}
            />

            <defs>
              <linearGradient
                id="scoreGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-slate-900 dark:text-white">{score}</div>
            <div className="text-lg text-slate-600 dark:text-slate-400">/100</div>
          </div>
        </div>

        {/* Category badge */}
        <div
          className={`text-center py-2 px-6 rounded-full font-semibold text-white mb-4 bg-gradient-to-r ${gradientClass}`}
        >
          {category.label}
        </div>

        {/* Description */}
        <div className="text-center max-w-md mb-2">
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-3">
            {description ? description : (
              score >= 85
                ? "This company demonstrates excellent fundamentals with strong growth, profitability, and financial health."
                : score >= 70
                  ? "This company shows good fundamentals with solid growth and reasonable debt levels."
                  : score >= 50
                    ? "This company shows average fundamentals with mixed metrics across categories."
                    : "This company shows weak fundamentals with concerns across key metrics."
            )}
          </p>
        </div>

        {/* Data Confidence Indicator */}
        {confidence !== undefined && (
          <div className="flex flex-col items-center mt-2 mb-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-800 text-center max-w-md w-full transition-all">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Data Confidence
              </span>
              <span className={`text-sm font-bold ${
                confidence >= 80 ? "text-green-600 dark:text-green-400" :
                confidence >= 50 ? "text-amber-600 dark:text-amber-400" :
                "text-red-600 dark:text-red-400"
              }`}>
                {confidence}%
              </span>
            </div>

            {unavailable && unavailable.length > 0 ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Unavailable metrics: </span>
                <span className="italic">{unavailable.join(", ")}</span>
              </div>
            ) : (
              <div className="mt-1 text-xs text-green-650 dark:text-green-400 font-medium">
                ✓ All expected financial metrics present
              </div>
            )}
          </div>
        )}

        {/* View Equation & Considerations Toggle Button */}
        {items.length > 0 && (
          <button
            onClick={() => setShowEquation(!showEquation)}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800/50 rounded-lg transition-all"
          >
            <span>🧮</span>
            <span>{showEquation ? "Hide Score Equation" : "View Score Equation & Considerations"}</span>
          </button>
        )}
      </div>

      {/* Expandable Equation Breakdown Panel */}
      {showEquation && items.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-left transition-all animate-fadeIn">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span>🧮</span>
            <span>{isBusinessQuality ? "Business Quality Score Equation" : "Stock Valuation Score Equation"}</span>
          </h3>

          {/* Equation Formula Banner */}
          <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed">
            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1">
              {title} Formula:
            </div>
            <div>
              {title} = Round( Σ (Consideration Score × Weight) / Σ (Available Weights) )
            </div>
          </div>

          {/* Individual Considerations Breakdown Table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Individual Consideration</th>
                  <th className="py-2.5 px-3 text-center">Assigned Weight</th>
                  <th className="py-2.5 px-3 text-center">Metric Score</th>
                  <th className="py-2.5 px-3 text-right">Weighted Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const pts = item.score !== null && item.score !== undefined ? item.score * item.weight : null;
                  return (
                    <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {item.label}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">
                        {(item.weight * 100).toFixed(0)}% ({item.weight.toFixed(2)})
                      </td>
                      <td className="py-2 px-3 text-center font-bold">
                        {item.score !== null && item.score !== undefined ? (
                          <span className={item.score >= 80 ? "text-green-600 dark:text-green-400" : item.score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}>
                            {item.score} / 100
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">N/A</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {pts !== null ? `+${pts.toFixed(2)} pts` : "0.00 pts (N/A)"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-900/60 font-bold border-t border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                  <td className="py-2.5 px-3">TOTALS</td>
                  <td className="py-2.5 px-3 text-center">{(weightSum * 100).toFixed(0)}% ({(weightSum).toFixed(2)})</td>
                  <td className="py-2.5 px-3 text-center">—</td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                    {weightedSum.toFixed(2)} pts
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Exact Math Step-by-Step */}
          <div className="bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-950 dark:text-blue-200 space-y-1.5 font-mono">
            <div className="font-bold text-blue-800 dark:text-blue-300 font-sans mb-1">
              Step-by-Step Calculation:
            </div>
            <div>
              1. Weighted Sum = {items.map((i) => (i.score !== null ? `(${i.score} × ${i.weight})` : `[${i.label} N/A]`)).join(" + ")}
            </div>
            <div>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= {weightedSum.toFixed(2)} pts
            </div>
            <div>
              2. Weight Sum   = {weightSum.toFixed(2)} ({ (weightSum * 100).toFixed(0) }% of total metrics)
            </div>
            <div>
              3. Raw Score    = {weightedSum.toFixed(2)} / {weightSum.toFixed(2)} = {(weightedSum / (weightSum || 1)).toFixed(4)}
            </div>
            <div className="font-bold text-emerald-700 dark:text-emerald-300 font-sans pt-1">
              4. Final Score  = Round({(weightedSum / (weightSum || 1)).toFixed(4)}) = {score} / 100
            </div>
          </div>
        </div>
      )}

      {/* Scale reference */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-center">
          <div>
            <div className="text-red-600 dark:text-red-400">Poor</div>
            <div className="text-slate-400 dark:text-slate-500">0-50</div>
          </div>
          <div>
            <div className="text-amber-600 dark:text-amber-400">Average</div>
            <div className="text-slate-400 dark:text-slate-500">50-70</div>
          </div>
          <div>
            <div className="text-blue-600 dark:text-blue-400">Good</div>
            <div className="text-slate-400 dark:text-slate-500">70-85</div>
          </div>
          <div>
            <div className="text-green-600 dark:text-green-400">Excellent</div>
            <div className="text-slate-400 dark:text-slate-500">85-100</div>
          </div>
        </div>
      </div>
    </div>
  );
};
