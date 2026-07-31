import React, { useState, useEffect, useRef } from "react";
import { MarketMovers } from "./MarketMovers";
import { fmpService } from "../services/financialModelingPrep";
import { CompanySearchResult } from "../types";

interface StockSearchProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
}

export const StockSearch: React.FC<StockSearchProps> = ({
  onSearch,
  isLoading = false,
}) => {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [suggestions, setSuggestions] = useState<CompanySearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced company autocomplete search as user types
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await fmpService.searchCompany(trimmed);
        setSuggestions(results.slice(0, 6));
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = (symbol: string) => {
    setShowDropdown(false);
    setQuery(symbol);
    setError("");
    onSearch(symbol.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    const trimmedInput = query.trim();

    if (!trimmedInput) {
      setError("Please enter a stock ticker or company name");
      return;
    }

    setError("");
    setIsResolving(true);

    try {
      // Resolve company name or ticker to official stock symbol
      const resolvedTicker = await fmpService.resolveTicker(trimmedInput);
      if (!resolvedTicker) {
        setError(`Could not find a stock symbol matching "${trimmedInput}"`);
        setIsResolving(false);
        return;
      }

      onSearch(resolvedTicker);
    } catch {
      setError(`Unable to resolve stock ticker for "${trimmedInput}"`);
    } finally {
      setIsResolving(false);
    }
  };

  const isBusy = isLoading || isResolving;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center justify-start p-4 md:p-8 transition-colors duration-300">
      <div className="w-full max-w-6xl mx-auto py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">
            Investor's Edge
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Evaluate long-term investment quality based on fundamental business
            metrics & valuation
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-10 relative" ref={dropdownRef}>
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-700/60 transition-colors duration-300"
          >
            <div className="mb-2">
              <label
                htmlFor="search"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
              >
                Enter Stock Ticker or Company Name
              </label>
              <div className="flex gap-2 relative">
                <input
                  id="search"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setError("");
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                  }}
                  placeholder="e.g., Apple, Steel Dynamics, AAPL, MSFT"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-base md:text-lg font-semibold text-slate-900 dark:text-white transition-colors duration-300"
                  disabled={isBusy}
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-95 text-sm md:text-base flex-shrink-0"
                >
                  {isBusy ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </span>
                  ) : (
                    "Analyze"
                  )}
                </button>
              </div>

              {error && (
                <p className="mt-2.5 text-red-600 dark:text-red-400 text-sm font-semibold flex items-center gap-1.5">
                  <span>⚠️</span> {error}
                </p>
              )}
            </div>
          </form>

          {/* Company Autocomplete Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in duration-150">
              <div className="p-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/60 px-3">
                Company Search Suggestions
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-64 overflow-y-auto">
                {suggestions.map((item, idx) => (
                  <div
                    key={item.symbol || idx}
                    onClick={() => handleSelectResult(item.symbol)}
                    className="p-3 hover:bg-blue-50/70 dark:hover:bg-slate-700/60 cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200/80 dark:border-blue-800/50 text-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                        {item.symbol}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.name}
                        </div>
                        {item.exchange && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">
                            {item.exchange}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
                      Analyze ➔
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-slate-200/60 dark:border-slate-700/50 transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span>🔍</span> Search Ticker or Name
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Search by company name (e.g., Apple, Steel Dynamics) or ticker symbol.
            </p>
          </div>
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-slate-200/60 dark:border-slate-700/50 transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span>🎯</span> Quality & Valuation
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Weighted 0-100 quality scoring and historical valuation multiple analysis.
            </p>
          </div>
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-slate-200/60 dark:border-slate-700/50 transition-colors">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span>📈</span> Interactive Price Chart
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              5+ years price history, crosshair inspection, and timeframe filters.
            </p>
          </div>
        </div>

        {/* Previous Day Market Movers */}
        <MarketMovers onSelectStock={onSearch} />
      </div>
    </div>
  );
};
