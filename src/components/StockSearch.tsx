import React, { useState } from "react";
import { MarketMovers } from "./MarketMovers";

interface StockSearchProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
}

export const StockSearch: React.FC<StockSearchProps> = ({
  onSearch,
  isLoading = false,
}) => {
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTicker = ticker.trim().toUpperCase();

    if (!trimmedTicker) {
      setError("Please enter a stock ticker");
      return;
    }

    if (trimmedTicker.length > 5) {
      setError("Ticker symbol should be 1-5 characters");
      return;
    }

    if (!/^[A-Z0-9]+$/.test(trimmedTicker)) {
      setError("Please enter a valid ticker (letters and numbers only)");
      return;
    }

    setError("");
    onSearch(trimmedTicker);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center justify-start p-4 md:p-8 transition-colors duration-300">
      <div className="w-full max-w-6xl mx-auto py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">
            Stock Quality Analyzer
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Evaluate long-term investment quality based on fundamental business
            metrics
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-10">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-700/60 transition-colors duration-300"
          >
            <div className="mb-4">
              <label
                htmlFor="ticker"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Enter Stock Ticker Symbol
              </label>
              <div className="flex gap-2">
                <input
                  id="ticker"
                  type="text"
                  value={ticker}
                  onChange={(e) => {
                    setTicker(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g., AAPL, MSFT, GOOGL"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-lg font-semibold uppercase text-slate-900 dark:text-white transition-colors duration-300"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-lg transition-all transform active:scale-95"
                >
                  {isLoading ? "Analyzing..." : "Analyze"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
              )}
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-slate-200/60 dark:border-slate-700/50 transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span>📊</span> Comprehensive Metrics
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Analyze revenue growth, EPS, free cash flow, profitability, and more.
            </p>
          </div>
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-slate-200/60 dark:border-slate-700/50 transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span>🎯</span> Quality Score
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Get a 0-100 score based on weighted financial fundamentals.
            </p>
          </div>
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-slate-200/60 dark:border-slate-700/50 transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span>📈</span> Valuation & Price History
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Compare valuation metrics against historical price action.
            </p>
          </div>
        </div>

        {/* Market Movers Section: Top 10 Losers (Left) & Top 10 Gainers (Right) */}
        <MarketMovers onSelectStock={onSearch} />
      </div>
    </div>
  );
};
