import React from "react";
import { getMetricAnalysis } from "../utils/scoring";

interface MetricCardProps {
  title: string;
  value: number | null;
  unit?: string;
  score: number;
  description?: string;
  icon?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit = "",
  score,
  description,
  icon,
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

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-slate-200 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className="mb-4">
        {value !== null ? (
          <p className="text-3xl font-bold text-slate-900">
            {typeof value === "number" && value % 1 !== 0
              ? value.toFixed(2)
              : value}
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
