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
    if (score >= 85) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return "bg-green-600";
    if (score >= 70) return "bg-blue-600";
    if (score >= 50) return "bg-amber-600";
    return "bg-red-600";
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
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-slate-200 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
              {title}
            </h3>
            {tooltip && (
              <span
                title={tooltip}
                aria-label={tooltip}
                className="text-slate-400 hover:text-slate-600 cursor-help"
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
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className="mb-4">
        {value !== null ? (
          <p className="text-3xl font-bold text-slate-900">
            {formattedValue}
            {unit && (
              <span className="text-xl text-slate-600 ml-1">{unit}</span>
            )}
          </p>
        ) : (
          <p className="text-lg text-slate-500 italic">Data not available</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">
          {getMetricAnalysis(score)}
        </span>
        <div
          className={`px-3 py-1 rounded-full text-sm font-bold border ${getScoreColor(score)}`}
        >
          {score}
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-4 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getScoreBg(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};
