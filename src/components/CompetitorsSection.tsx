import React, { useState } from "react";
import { CompetitorData, CompetitorProfile } from "../types";
import { formatMarketCap } from "../utils/scoring";
import { buildStockUrl } from "../utils/navigation";

interface CompetitorsSectionProps {
  competitorData: CompetitorData | null;
  isLoading?: boolean;
  targetSymbol: string;
  targetCompanyName: string;
  onSelectCompany?: (symbol: string) => void;
}

export const CompetitorsSection: React.FC<CompetitorsSectionProps> = ({
  competitorData,
  isLoading = false,
  targetSymbol,
  targetCompanyName,
  onSelectCompany,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse text-center">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4" />
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mx-auto" />
      </div>
    );
  }

  if (
    !competitorData ||
    !competitorData.competitors ||
    competitorData.competitors.length === 0
  ) {
    return (
      <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
        <span className="text-4xl mb-3 block">🥊</span>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Competitor Data Unavailable
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Market competitor information for {targetSymbol} is currently updating. Check back shortly for peer comparison data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-2xl">🥊</span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Biggest Competitors
            </h2>
            <span className="px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 rounded-full border border-blue-200 dark:border-blue-700/50">
              {competitorData.competitors.length} Market Peers
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Key industry rivals, direct market competitors, and peer comparison data for {targetCompanyName} ({targetSymbol}).
          </p>
        </div>
      </div>

      {/* Competitors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {competitorData.competitors.map((competitor) => (
          <CompetitorCard
            key={competitor.symbol}
            competitor={competitor}
            targetSymbol={targetSymbol}
            targetMarketCap={competitorData.targetMarketCap}
            onSelectCompany={onSelectCompany}
          />
        ))}
      </div>
    </div>
  );
};

interface CompetitorCardProps {
  competitor: CompetitorProfile;
  targetSymbol: string;
  targetMarketCap: number;
  onSelectCompany?: (symbol: string) => void;
}

const CompetitorCard: React.FC<CompetitorCardProps> = ({
  competitor,
  targetSymbol,
  targetMarketCap,
  onSelectCompany,
}) => {
  const [imageError, setImageError] = useState(false);

  const getBadgeColor = (badge: string): string => {
    switch (badge) {
      case "Primary Competitor":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/50";
      case "Direct Competitor":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
      case "Emerging Competitor":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50";
      case "Global Competitor":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const getRelativeMarketCapPill = (): string | null => {
    if (!competitor.marketCap || !targetMarketCap || targetMarketCap <= 0) return null;
    const ratio = competitor.marketCap / targetMarketCap;
    if (ratio >= 1.05) {
      return `${ratio.toFixed(1)}x larger cap than ${targetSymbol}`;
    }
    if (ratio <= 0.95) {
      return `${(ratio * 100).toFixed(0)}% cap of ${targetSymbol}`;
    }
    return `Similar market cap to ${targetSymbol}`;
  };

  const relativeCapText = getRelativeMarketCapPill();

  return (
    <div className="p-4 sm:p-5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Card Header: Logo, Name, Ticker, Badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {competitor.logo && !imageError ? (
              <img
                src={competitor.logo}
                alt={`${competitor.companyName} logo`}
                width={40}
                height={40}
                onError={() => setImageError(true)}
                className="w-10 h-10 rounded-xl object-contain p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/50 shadow-xs flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-xs shadow-xs flex-shrink-0">
                {competitor.symbol.slice(0, 3)}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[170px]">
                {competitor.companyName}
              </h3>
              <span className="inline-block text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/50 mt-0.5">
                ${competitor.symbol}
              </span>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 text-[10px] font-bold rounded-full border whitespace-nowrap flex-shrink-0 ${getBadgeColor(
              competitor.badge
            )}`}
          >
            {competitor.badge}
          </span>
        </div>

        {/* Meta Info: Industry, Headquarters & Employees */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/60 dark:border-slate-700/50 truncate max-w-[180px]">
            {competitor.industry}
          </span>
          {competitor.headquarters && (
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-0.5">
              <span>📍</span>
              <span>{competitor.headquarters}</span>
            </span>
          )}
          {competitor.employeeCount && (
            <span className="text-slate-400 dark:text-slate-500 font-medium">
              • {typeof competitor.employeeCount === "number" ? competitor.employeeCount.toLocaleString() : competitor.employeeCount} employees
            </span>
          )}
        </div>

        {/* Short Description */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mb-3">
          {competitor.description}
        </p>

        {/* Competitive Overlap & Score Breakdown Box */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-100 dark:border-slate-700/50 mb-3">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Dynamic Competitor Signal
            </span>
            <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
              Ranked Competitor
            </span>
          </div>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight font-medium">
            {competitor.reasonForCompetition}
          </p>
        </div>

        {/* Visual Metric Comparison Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50/50 dark:bg-slate-900/40 rounded-xl border border-blue-100/60 dark:border-blue-900/30 mb-4 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold">
              Market Cap
            </span>
            <span className="font-extrabold text-slate-900 dark:text-white">
              {formatMarketCap(competitor.marketCap)}
            </span>
          </div>
          {relativeCapText && (
            <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950/80 px-2 py-1 rounded-md border border-blue-200/60 dark:border-blue-800/40">
              {relativeCapText}
            </span>
          )}
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
        {onSelectCompany && (
          <a
            href={buildStockUrl(competitor.symbol)}
            onClick={(e) => {
              e.preventDefault();
              onSelectCompany(competitor.symbol);
            }}
            className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
          >
            <span>🔍</span>
            <span>View Company</span>
          </a>
        )}

        <button
          disabled
          title="Side-by-side peer comparison coming soon"
          className="py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-80 flex items-center gap-1"
        >
          <span>⚖️</span>
          <span className="hidden sm:inline">Compare</span>
        </button>

        {competitor.website && (
          <a
            href={competitor.website}
            target="_blank"
            rel="noopener noreferrer"
            title={`Visit ${competitor.companyName} official website`}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
          >
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
};
