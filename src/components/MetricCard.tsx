import React from "react";
import { getMetricAnalysis } from "../utils/scoring";

interface MetricCardProps {
  title: string;
  value: number | null;
  unit?: string;
  score: number;
  description?: string;
  icon?: string;
  tooltip?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit = "",
  score,
  description,
  icon,
  tooltip,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/50";
    if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50";
    if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50";
    return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50";
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return "bg-green-600 dark:bg-green-500";
    if (score >= 70) return "bg-blue-600 dark:bg-blue-500";
    if (score >= 50) return "bg-amber-600 dark:bg-amber-500";
    return "bg-red-600 dark:bg-red-500";
  };

  const displayValue =
    typeof value === "number" && unit === "%" && Math.abs(value) <= 1
      ? value * 100
      : value;

  const formattedValue =
    typeof displayValue === "number" && displayValue % 1 !== 0
      ? displayValue.toFixed(2)
      : displayValue;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {title}
            </h3>
            {tooltip && (
              <div className="relative group/tooltip inline-block">
                <span
                  aria-label={tooltip}
                  className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help transition-colors duration-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
                    <path d="M11 10h2v6h-2zm0-4h2v2h-2z" />
                  </svg>
                </span>
                
                {/* Premium Custom Tooltip */}
                <div className="absolute bottom-full left-0 md:left-1/2 md:-translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-sm text-xs text-slate-200 dark:text-slate-350 shadow-xl border border-slate-850/80 dark:border-slate-800/50 pointer-events-none opacity-0 scale-95 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-200 origin-bottom z-30 font-normal normal-case tracking-normal text-left">
                  <p className="leading-relaxed">{tooltip}</p>
                  {/* Caret */}
                  <div className="absolute top-full left-3 md:left-1/2 md:-translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-950/95"></div>
                </div>
              </div>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          )}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className="mb-4">
        {value !== null ? (
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {formattedValue}
            {unit && (
              <span className="text-xl text-slate-600 dark:text-slate-400 ml-1">{unit}</span>
            )}
          </p>
        ) : (
          <p className="text-lg text-slate-500 dark:text-slate-400 italic">Data not available</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {getMetricAnalysis(score)}
        </span>
        <div
          className={`px-3 py-1 rounded-full text-sm font-bold border ${getScoreColor(score)}`}
        >
          {score}
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-4 w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getScoreBg(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};
