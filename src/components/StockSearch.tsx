import React, { useState } from "react";
import { CompactMoversList } from "./MarketMovers";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center justify-start p-4 md:p-6 transition-colors duration-300">
      <div className="w-full max-w-7xl mx-auto py-4 md:py-6">
        {/* 3-Column Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDEBAR: Top 10 Worst Stocks (Losers) */}
          <div className="order-2 lg:order-1 lg:col-span-3">
            <CompactMoversList type="losers" onSelectStock={onSearch} />
          </div>

          {/* CENTER: Main Analyzer Input & Header */}
          <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col items-center text-center">
            <div className="mb-6">
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                Stock Quality Analyzer
              </h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                Evaluate long-term investment quality based on fundamental business
                metrics & historical valuation
              </p>
            </div>

            {/* Main Search Input Form Card */}
            <div className="w-full max-w-xl mb-6">
              <form
                onSubmit={handleSubmit}
                className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-700/60 transition-colors duration-300"
              >
                <div className="mb-2">
                  <label
                    htmlFor="ticker"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2"
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
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-lg font-bold uppercase text-slate-900 dark:text-white transition-colors duration-300"
                      disabled={isLoading}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-95 text-sm"
                    >
                      {isLoading ? "Analyzing..." : "Analyze"}
                    </button>
                  </div>
                  {error && (
                    <p className="mt-2 text-red-600 dark:text-red-400 text-xs font-semibold">{error}</p>
                  )}
                </div>
              </form>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/50 text-left">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-0.5 flex items-center gap-1.5">
                  <span>📊</span> Comprehensive
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight">
                  Revenue, EPS, FCF & ROIC fundamentals
                </p>
              </div>
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/50 text-left">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-0.5 flex items-center gap-1.5">
                  <span>🎯</span> Quality Score
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight">
                  Weighted 0-100 quality scoring system
                </p>
              </div>
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/50 text-left">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-0.5 flex items-center gap-1.5">
                  <span>📈</span> Price Chart
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight">
                  5+ years interactive price & volume history
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Top 10 Best Stocks (Gainers) */}
          <div className="order-3 lg:col-span-3">
            <CompactMoversList type="gainers" onSelectStock={onSearch} />
          </div>
        </div>
      </div>
    </div>
  );
};
