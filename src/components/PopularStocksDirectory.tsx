import React from "react";
import { buildStockUrl } from "../utils/navigation";

interface PopularStocksDirectoryProps {
  onSelectStock: (ticker: string) => void;
}

export const POPULAR_DIRECTORY_STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "Nvidia" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "BRK.B", name: "Berkshire Hathaway" },
  { symbol: "JPM", name: "JPMorgan" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "STLD", name: "Steel Dynamics" },
];

export const PopularStocksDirectory: React.FC<PopularStocksDirectoryProps> = ({
  onSelectStock,
}) => {
  return (
    <nav
      aria-label="Popular Stock Analysis Directory"
      className="mt-8 pt-8 border-t border-slate-200/80 dark:border-slate-800 text-center"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
        Popular Stock Analyses
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
        {POPULAR_DIRECTORY_STOCKS.map((stock) => (
          <a
            key={stock.symbol}
            href={buildStockUrl(stock.symbol)}
            onClick={(e) => {
              e.preventDefault();
              onSelectStock(stock.symbol);
            }}
            title={`${stock.name} (${stock.symbol}) Fundamental Analysis`}
            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 rounded-lg text-xs font-semibold border border-slate-200/80 dark:border-slate-700 transition-colors shadow-xs no-underline"
          >
            <span className="font-extrabold">{stock.symbol}</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal ml-1 hidden sm:inline">
              ({stock.name})
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
};
