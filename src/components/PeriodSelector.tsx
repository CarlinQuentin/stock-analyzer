import React from "react";
import { HistoricalPeriod } from "../types";

interface PeriodSelectorProps {
  selectedPeriod: HistoricalPeriod;
  onPeriodChange: (period: HistoricalPeriod) => void;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  className = "",
}) => {
  const periods: { key: HistoricalPeriod; label: string; shortLabel: string }[] = [
    { key: "10Y", label: "10 Years", shortLabel: "10Y" },
    { key: "5Y", label: "5 Years", shortLabel: "5Y" },
    { key: "3Y", label: "3 Years", shortLabel: "3Y" },
  ];

  return (
    <div
      className={`inline-flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-800/90 rounded-xl border border-slate-300/70 dark:border-slate-700/70 shadow-inner ${className}`}
    >
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 uppercase tracking-wider hidden sm:inline-block">
        Lookback Period:
      </span>
      <div className="flex items-center gap-1">
        {periods.map((p) => {
          const isActive = selectedPeriod === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPeriodChange(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 dark:bg-blue-500 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-700/50"
              }`}
              title={`View calculations using ${p.label} lookback period`}
            >
              <span className="hidden sm:inline">{p.label}</span>
              <span className="sm:hidden">{p.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
