import React, { useState, useEffect, useCallback } from "react";
import { NewsItem } from "../types";
import { newsService } from "../services/newsService";

export interface StockNewsProps {
  ticker: string;
  companyName?: string;
}

/**
 * Formats ISO or raw date strings into human-friendly relative time
 */
export function formatRelativeNewsTime(rawDateStr?: string): string {
  if (!rawDateStr) return "Recent";
  try {
    const date = new Date(rawDateStr);
    if (isNaN(date.getTime())) return "Recent";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 5) return "Just now";
    if (diffHours < 1) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Recent";
  }
}

export const StockNews: React.FC<StockNewsProps> = ({ ticker, companyName }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const articles = await newsService.getStockNews(ticker, companyName, forceRefresh);
        if (articles && articles.length > 0) {
          setNews(articles.slice(0, 5));
        } else {
          setNews([]);
        }
      } catch (err) {
        console.warn("[StockNews] Failed to load news:", err);
        setError("Unable to load latest news");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [ticker, companyName],
  );

  useEffect(() => {
    fetchNews(false);
  }, [fetchNews]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-transparent dark:border-slate-700/50 transition-colors duration-300 flex flex-col justify-between h-full min-h-[220px]">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="text-xl">📰</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Latest News & Headlines
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Live market updates for {ticker}
              </span>
            </div>
          </div>
          <button
            onClick={() => fetchNews(true)}
            disabled={isRefreshing || isLoading}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            title="Refresh news"
            aria-label="Refresh stock news"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600 dark:text-blue-400" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="hidden sm:inline">{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3 py-2 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700/50 rounded-lg"></div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-6 text-xs text-slate-400">
            {error}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No recent news stories found for {ticker}.
          </div>
        ) : (
          <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1">
            {news.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-2.5 rounded-xl bg-slate-50/70 hover:bg-blue-50/60 dark:bg-slate-900/40 dark:hover:bg-blue-950/30 border border-slate-100 dark:border-slate-800/80 hover:border-blue-300/60 dark:hover:border-blue-800/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex-shrink-0 ml-1">
                    {formatRelativeNewsTime(item.publishedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/40 truncate max-w-[140px]">
                    {item.source}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors">
                    Read Story ↗
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
