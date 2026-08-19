import React, { useState, useEffect, useRef } from "react";
import { fmpService } from "../services/financialModelingPrep";
import { CompanySearchResult } from "../types";

interface StockSearchCompactProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
}

export const StockSearchCompact: React.FC<StockSearchCompactProps> = ({
  onSearch,
  isLoading = false,
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CompanySearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete search
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
    setQuery("");
    onSearch(symbol.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    const trimmedInput = query.trim();
    if (!trimmedInput) return;

    try {
      const resolvedTicker = await fmpService.resolveTicker(trimmedInput);
      setQuery("");
      if (resolvedTicker) {
        onSearch(resolvedTicker);
      } else {
        onSearch(trimmedInput.toUpperCase());
      }
    } catch {
      setQuery("");
      onSearch(trimmedInput.toUpperCase());
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3 text-slate-400 pointer-events-none">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search another stock (e.g. MSFT)..."
          disabled={isLoading}
          className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setShowDropdown(false);
            }}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
          >
            ✕
          </button>
        )}
      </form>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1">
          {suggestions.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => handleSelectResult(item.symbol)}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
            >
              <div className="min-w-0 pr-2">
                <span className="font-bold text-xs text-blue-600 dark:text-blue-400 mr-2">
                  {item.symbol}
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                  {item.name}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase flex-shrink-0">
                {item.exchange || item.currency}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
