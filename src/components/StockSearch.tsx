import React, { useState } from "react";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 mb-3">
            Stock Quality Analyzer
          </h1>
          <p className="text-xl text-slate-600">
            Evaluate long-term investment quality based on fundamental business
            metrics
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-xl p-8"
        >
          <div className="mb-6">
            <label
              htmlFor="ticker"
              className="block text-sm font-medium text-slate-700 mb-2"
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
                className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold uppercase"
                disabled={isLoading}
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors"
              >
                {isLoading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-red-600 text-sm font-medium">{error}</p>
            )}
          </div>

          <div className="text-sm text-slate-600 space-y-2">
            <p className="font-semibold text-slate-700">Data Source:</p>
            <p>
              Financial Modeling Prep API provides company profiles, income
              statements, balance sheets, cash flow statements, and financial
              ratios.
            </p>
            <p className="text-xs text-slate-500 mt-4">
              <strong>Note:</strong> Make sure you have set your
              VITE_FMP_API_KEY in the .env.local file. Get a free API key from{" "}
              <a
                href="https://financialmodelingprep.com/developer/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                financialmodelingprep.com
              </a>
            </p>
          </div>
        </form>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              📊 Comprehensive Metrics
            </h3>
            <p className="text-slate-600 text-sm">
              Analyze revenue growth, EPS, free cash flow, profitability, and
              more.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              🎯 Quality Score
            </h3>
            <p className="text-slate-600 text-sm">
              Get a 0-100 score based on weighted financial fundamentals.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              📈 Long-term Focus
            </h3>
            <p className="text-slate-600 text-sm">
              Evaluate business quality, not price movement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
