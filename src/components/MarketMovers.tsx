import React, { useState, useEffect } from "react";
import { fmpService } from "../services/financialModelingPrep";
import { MarketMover } from "../types";

interface MarketMoversProps {
  onSelectStock: (ticker: string) => void;
}

export const MarketMovers: React.FC<MarketMoversProps> = ({ onSelectStock }) => {
  const [gainers, setGainers] = useState<MarketMover[]>([]);
  const [losers, setLosers] = useState<MarketMover[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMovers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [topGainers, topLosers] = await Promise.all([
        fmpService.getTopGainers(10),
        fmpService.getTopLosers(10),
      ]);
      setGainers(topGainers);
      setLosers(topLosers);
    } catch (err: any) {
      console.warn("Failed to load market movers:", err);
      setError("Unable to load top market movers.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovers();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: val < 1 ? 3 : 2,
      maximumFractionDigits: val < 1 ? 3 : 2,
    }).format(val);
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-10">
      {[0, 1].map((col) => (
        <div
          key={col}
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-700/60 animate-pulse"
        >
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded-xl"
              ></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    return renderSkeleton();
  }

  return (
    <div className="w-full mt-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Previous Day Market Movers</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Click on any stock to view detailed fundamental analysis & valuation
          </p>
        </div>
        <button
          onClick={fetchMovers}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5"
          title="Refresh market movers"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* LEFT: Top 10 Losers */}
          <div className="bg-white dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg">
                  📉
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Top 10 Biggest Losers
                  </h3>
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                    Largest percentage declines
                  </span>
                </div>
              </div>
            </div>

            {losers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                No loser data available.
              </div>
            ) : (
              <div className="space-y-2">
                {losers.map((item, index) => (
                  <div
                    key={item.symbol || index}
                    onClick={() => onSelectStock(item.symbol)}
                    className="group flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-rose-50/60 dark:bg-slate-900/40 dark:hover:bg-rose-950/30 border border-slate-100 dark:border-slate-800/70 hover:border-rose-300/60 dark:hover:border-rose-800/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 text-right flex-shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                            {item.symbol}
                          </span>
                          {item.exchange && (
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {item.exchange}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px] sm:max-w-[200px]">
                          {item.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.price)}
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/50">
                        <span>▼</span>
                        <span>{item.changesPercentage.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Top 10 Gainers */}
          <div className="bg-white dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                  📈
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Top 10 Biggest Gainers
                  </h3>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    Largest percentage gains
                  </span>
                </div>
              </div>
            </div>

            {gainers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                No gainer data available.
              </div>
            ) : (
              <div className="space-y-2">
                {gainers.map((item, index) => (
                  <div
                    key={item.symbol || index}
                    onClick={() => onSelectStock(item.symbol)}
                    className="group flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-emerald-50/60 dark:bg-slate-900/40 dark:hover:bg-emerald-950/30 border border-slate-100 dark:border-slate-800/70 hover:border-emerald-300/60 dark:hover:border-emerald-800/50 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 text-right flex-shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.symbol}
                          </span>
                          {item.exchange && (
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {item.exchange}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px] sm:max-w-[200px]">
                          {item.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.price)}
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50">
                        <span>▲</span>
                        <span>+{item.changesPercentage.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
