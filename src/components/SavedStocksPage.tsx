import React, { useState } from "react";
import { SavedStock } from "../types";

interface SavedStocksPageProps {
  savedStocks: SavedStock[];
  onSelectStock: (ticker: string) => void;
  onRemoveStock: (ticker: string) => void;
  onNewSearch: () => void;
}

export const SavedStocksPage: React.FC<SavedStocksPageProps> = ({
  savedStocks,
  onSelectStock,
  onRemoveStock,
  onNewSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "scoreDesc" | "scoreAsc" | "name">("date");

  const getScoreBadge = (score: number) => {
    if (score >= 85) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (score >= 70) {
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
    if (score >= 50) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Average";
    return "Poor";
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const filteredStocks = savedStocks.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.ticker.toLowerCase().includes(term) ||
      s.companyName.toLowerCase().includes(term) ||
      (s.sector && s.sector.toLowerCase().includes(term))
    );
  });

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (sortBy === "scoreDesc") return b.score - a.score;
    if (sortBy === "scoreAsc") return a.score - b.score;
    if (sortBy === "name") return a.companyName.localeCompare(b.companyName);
    // Default: date (newest first)
    return new Date(b.lastAnalyzed).getTime() - new Date(a.lastAnalyzed).getTime();
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Saved Stocks
            </h1>
            <span className="px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 rounded-full border border-amber-200 dark:border-amber-800/40">
              {savedStocks.length} {savedStocks.length === 1 ? "Stock" : "Stocks"} Saved
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Quickly access and re-evaluate fundamental ratings for your bookmarked companies.
          </p>
        </div>

        <button
          onClick={onNewSearch}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all transform hover:scale-105 active:scale-95 self-start sm:self-auto"
        >
          <span>🔍</span>
          <span>Analyze New Stock</span>
        </button>
      </div>

      {/* Filter & Search Bar (if saved stocks exist) */}
      {savedStocks.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Filter by ticker, company, or sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-sm"
            />
            <span className="absolute left-3.5 top-3 text-slate-400 text-sm">🔍</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="sort-select" className="font-medium">Sort by:</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="date">Recently Analyzed</option>
              <option value="scoreDesc">Score: High to Low</option>
              <option value="scoreAsc">Score: Low to High</option>
              <option value="name">Company Name A-Z</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty State */}
      {savedStocks.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-700/60 shadow-sm max-w-xl mx-auto my-12">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-200 dark:border-amber-800/40">
            ⭐
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No Saved Stocks Yet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            When analyzing a company, click the <strong className="text-amber-500">"Save Stock"</strong> button at the top to bookmark it here for quick access.
          </p>
          <button
            onClick={onNewSearch}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all transform hover:scale-105"
          >
            Start Analyzing Stocks
          </button>
        </div>
      )}

      {/* Filtered empty state */}
      {savedStocks.length > 0 && sortedStocks.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700 my-8">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            No saved stocks match "{searchTerm}".
          </p>
          <button
            onClick={() => setSearchTerm("")}
            className="mt-3 px-4 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-lg hover:underline"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Saved Stocks Grid / Cards */}
      {sortedStocks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedStocks.map((stock) => (
            <div
              key={stock.ticker}
              onClick={() => onSelectStock(stock.ticker)}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/90 dark:border-slate-700/60 shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500/60 transition-all duration-300 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {stock.image ? (
                      <img
                        src={stock.image}
                        alt={stock.companyName}
                        className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-slate-100 dark:border-slate-700 shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                        {stock.ticker.substring(0, 3)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {stock.ticker}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 line-clamp-1">
                        {stock.companyName}
                      </h3>
                    </div>
                  </div>

                  {/* Score Badge */}
                  <div
                    className={`flex flex-col items-end px-3 py-1.5 rounded-xl border font-bold text-right flex-shrink-0 ${getScoreBadge(
                      stock.score,
                    )}`}
                  >
                    <span className="text-xl leading-none">{stock.score}</span>
                    <span className="text-[10px] uppercase tracking-wider font-semibold opacity-90">
                      {getScoreLabel(stock.score)}
                    </span>
                  </div>
                </div>

                {/* Tags / Info */}
                {(stock.sector || stock.industry) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">
                    {stock.sector}
                    {stock.sector && stock.industry && " • "}
                    {stock.industry}
                  </p>
                )}
              </div>

              {/* Footer Row */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>📅</span>
                  <span>{formatDate(stock.lastAnalyzed)}</span>
                </span>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    View Analysis →
                  </span>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveStock(stock.ticker);
                    }}
                    title="Remove stock from saved"
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
