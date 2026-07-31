import React, { useState, useEffect } from "react";
import { fmpService } from "../services/financialModelingPrep";
import { MarketMover } from "../types";

interface CompactMoversListProps {
  type: "gainers" | "losers";
  onSelectStock: (ticker: string) => void;
}

export const CompactMoversList: React.FC<CompactMoversListProps> = ({
  type,
  onSelectStock,
}) => {
  const [items, setItems] = useState<MarketMover[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isGainers = type === "gainers";

  const fetchItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = isGainers
        ? await fmpService.getTopGainers(10)
        : await fmpService.getTopLosers(10);
      setItems(data);
    } catch (err) {
      console.warn(`Failed to fetch ${type}:`, err);
      setError(`Failed to load ${type}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [type]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: val < 1 ? 3 : 2,
      maximumFractionDigits: val < 1 ? 3 : 2,
    }).format(val);
  };

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300 w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="text-base">{isGainers ? "📈" : "📉"}</span>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
              {isGainers ? "Top 10 Gainers" : "Top 10 Losers"}
            </h3>
            <span
              className={`text-[10px] font-semibold ${
                isGainers
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {isGainers ? "Previous Day Leaders" : "Previous Day Laggards"}
            </span>
          </div>
        </div>
        <button
          onClick={fetchItems}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
          title="Refresh"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2 py-1 animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-9 bg-slate-100 dark:bg-slate-700/50 rounded-lg"></div>
          ))}
        </div>
      ) : error || items.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          {error || "No market data"}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div
              key={item.symbol || index}
              onClick={() => onSelectStock(item.symbol)}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer border ${
                isGainers
                  ? "bg-slate-50/70 hover:bg-emerald-50/70 dark:bg-slate-900/40 dark:hover:bg-emerald-950/40 border-slate-100 dark:border-slate-800/80 hover:border-emerald-300/60 dark:hover:border-emerald-800/50"
                  : "bg-slate-50/70 hover:bg-rose-50/70 dark:bg-slate-900/40 dark:hover:bg-rose-950/40 border-slate-100 dark:border-slate-800/80 hover:border-rose-300/60 dark:hover:border-rose-800/50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-3.5 text-right flex-shrink-0">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs font-extrabold transition-colors truncate ${
                        isGainers
                          ? "text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                          : "text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400"
                      }`}
                    >
                      {item.symbol}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[85px] leading-tight">
                    {item.name}
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {formatCurrency(item.price)}
                </div>
                <div
                  className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                    isGainers
                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/40"
                      : "text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/40"
                  }`}
                >
                  <span>{isGainers ? "▲" : "▼"}</span>
                  <span>
                    {isGainers ? "+" : ""}
                    {item.changesPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
