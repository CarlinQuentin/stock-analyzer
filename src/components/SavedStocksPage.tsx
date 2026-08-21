import React from "react";
import { SavedStock } from "../types";
import { buildStockUrl } from "../utils/navigation";

interface SavedStocksPageProps {
  savedStocks: SavedStock[];
  onSelectStock: (ticker: string) => void;
  onRemoveStock: (ticker: string) => void;
  onReturnToAnalysis: () => void;
}

export const SavedStocksPage: React.FC<SavedStocksPageProps> = ({
  savedStocks,
  onSelectStock,
  onRemoveStock,
  onReturnToAnalysis,
}) => {
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
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

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
            Personal bookmark library for quick access to analyzed companies.
          </p>
        </div>

        <button
          onClick={onReturnToAnalysis}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-300 dark:border-slate-700 transition-all self-start sm:self-auto"
        >
          <span>←</span>
          <span>Back to Analysis</span>
        </button>
      </div>

      {/* Empty State */}
      {savedStocks.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-700/60 shadow-sm max-w-xl mx-auto my-12">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-200 dark:border-amber-800/40">
            ⭐
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No saved stocks yet.
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Save stocks from the analysis page to quickly access them here.
          </p>
          <button
            onClick={onReturnToAnalysis}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all transform hover:scale-105"
          >
            Return to Stock Analysis
          </button>
        </div>
      )}

      {/* Saved Stocks Grid / Cards */}
      {savedStocks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedStocks.map((stock) => (
            <a
              key={stock.ticker}
              href={buildStockUrl(stock.ticker)}
              onClick={(e) => {
                e.preventDefault();
                onSelectStock(stock.ticker);
              }}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/90 dark:border-slate-700/60 shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500/60 transition-all duration-300 cursor-pointer flex flex-col justify-between no-underline block"
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {stock.image ? (
                      <img
                        src={stock.image}
                        alt={`${stock.companyName || stock.ticker} logo`}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-slate-100 dark:border-slate-700 shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                        {stock.ticker.substring(0, 3)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {stock.companyName || stock.ticker}
                      </h3>
                      <span className="inline-block text-xs font-bold text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/50 mt-1">
                        {stock.ticker}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score Section */}
                {stock.score !== undefined && stock.score !== null ? (
                  <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Universal Score
                    </span>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-bold text-sm ${getScoreBadge(stock.score)}`}>
                      <span>{stock.score}/100</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider">
                        ({getScoreLabel(stock.score)})
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      Company Profile Saved
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Profile Only
                    </span>
                  </div>
                )}

                {/* Industry & Sector metadata */}
                {(stock.sector || stock.industry) && (
                  <div className="mb-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-1">
                    {stock.sector && (
                      <span className="bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                        {stock.sector}
                      </span>
                    )}
                    {stock.industry && (
                      <span className="bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded truncate max-w-[180px]">
                        {stock.industry}
                      </span>
                    )}
                  </div>
                )}

                {/* Last analyzed date */}
                <div className="text-[11px] text-slate-400 mb-2">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {stock.lastAnalyzed ? "Last Analyzed:" : "Saved On:"}
                  </span>{" "}
                  {formatDate(stock.lastAnalyzed || stock.created_at || "")}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span
                  className="px-4 py-2 bg-blue-50 group-hover:bg-blue-100 dark:bg-blue-950/50 dark:group-hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg transition-colors"
                >
                  View Analysis →
                </span>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveStock(stock.ticker);
                  }}
                  title="Remove stock from saved"
                  className="px-3 py-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg font-medium transition-colors flex items-center gap-1 z-10"
                >
                  <span>🗑️</span>
                  <span>Remove</span>
                </button>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Footer Trademark */}
      <div className="mt-12 pt-6 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        <p className="font-medium">
          © {new Date().getFullYear()} Investor's Edge<sup className="text-[9px] font-bold">™</sup>. All rights reserved.
        </p>
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          Investor's Edge™ is a trademark for fundamental stock analysis and financial intelligence tools.
        </p>
      </div>
    </div>
  );
};
