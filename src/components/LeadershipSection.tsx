import React, { useState } from "react";
import { LeadershipProfile, ExecutiveProfile } from "../types";
import { ExecutiveCareerModal } from "./ExecutiveCareerModal";

interface LeadershipSectionProps {
  leadership: LeadershipProfile | null;
  isLoading?: boolean;
  symbol: string;
}

export const LeadershipSection: React.FC<LeadershipSectionProps> = ({
  leadership,
  isLoading = false,
  symbol,
}) => {
  const [selectedExecutive, setSelectedExecutive] = useState<ExecutiveProfile | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse text-center">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4" />
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mx-auto" />
      </div>
    );
  }

  if (!leadership || !leadership.executives || leadership.executives.length === 0) {
    return (
      <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
        <span className="text-4xl mb-3 block">👔</span>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Leadership Information Unavailable
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Executive leadership data for {symbol} is currently pending provider updates. Check back shortly for updated corporate officer profiles.
        </p>
      </div>
    );
  }

  const keyOfficers = leadership.executives.filter((e) => e.isKeyOfficer);
  const otherOfficers = leadership.executives.filter((e) => !e.isKeyOfficer);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Leadership Overview Header Card */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50/80 via-slate-50 to-emerald-50/60 dark:from-slate-900/90 dark:via-slate-900 dark:to-emerald-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-800/40 shadow-sm transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-blue-100 dark:border-blue-900/40">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <span className="text-2xl">👔</span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Executive Leadership & Governance
              </h2>
              <span className="px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 rounded-full border border-blue-200 dark:border-blue-700/50">
                {leadership.executives.length} Officers
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Senior executive team, titles, corporate backgrounds, and career histories for {leadership.companyName} ({leadership.symbol}). Click any officer to explore their career timeline.
            </p>
          </div>
        </div>

        {/* Executive Career Summary Insights */}
        {leadership.careerSummary && (
          <div className="bg-white/80 dark:bg-slate-800/70 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <span>💡</span>
              <span>Leadership Summary & Governance Insights</span>
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {leadership.careerSummary}
            </p>

            {leadership.strengths && leadership.strengths.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-2">
                {leadership.strengths.map((str, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900/80 rounded-md border border-slate-200 dark:border-slate-700/60"
                  >
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{str}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Key Officers Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span>⭐</span>
            <span>Key Executive Officers</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {keyOfficers.length} Key Leaders • Click to View Career
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {keyOfficers.map((exec) => (
            <ExecutiveCard
              key={exec.id}
              executive={exec}
              onSelect={() => setSelectedExecutive(exec)}
            />
          ))}
        </div>
      </div>

      {/* Additional Executives Section */}
      {otherOfficers.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>👥</span>
              <span>Senior Management & Officers</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {otherOfficers.length} Officers • Click to View Career
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {otherOfficers.map((exec) => (
              <ExecutiveCard
                key={exec.id}
                executive={exec}
                onSelect={() => setSelectedExecutive(exec)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Executive Career History Modal */}
      <ExecutiveCareerModal
        executive={selectedExecutive}
        companyName={leadership.companyName}
        symbol={leadership.symbol}
        isOpen={Boolean(selectedExecutive)}
        onClose={() => setSelectedExecutive(null)}
      />
    </div>
  );
};

interface ExecutiveCardProps {
  executive: ExecutiveProfile;
  onSelect?: () => void;
}

const ExecutiveCard: React.FC<ExecutiveCardProps> = ({ executive, onSelect }) => {
  const formatPay = (pay?: number, currency = "USD"): string | null => {
    if (!pay || pay <= 0) return null;
    if (pay >= 1e6) {
      return `$${(pay / 1e6).toFixed(2)}M ${currency}`;
    }
    if (pay >= 1e3) {
      return `$${(pay / 1e3).toFixed(0)}K ${currency}`;
    }
    return `$${pay.toLocaleString()} ${currency}`;
  };

  const getInitials = (name: string): string => {
    if (!name) return "EX";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const payFormatted = formatPay(executive.pay, executive.currencyPay);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-label={`View career history for ${executive.name}, ${executive.title}`}
      className="p-4 sm:p-5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/80 transition-all duration-200 flex flex-col justify-between group cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
    >
      <div>
        {/* Executive Header info */}
        <div className="flex items-start gap-3.5 mb-3.5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-800 flex items-center justify-center text-white font-extrabold text-sm uppercase shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
            {getInitials(executive.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {executive.name}
              </h4>
              {executive.isKeyOfficer && (
                <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 rounded-full border border-amber-200 dark:border-amber-700/50 flex-shrink-0">
                  Key Officer
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate mt-0.5">
              {executive.title}
            </p>
          </div>
        </div>

        {/* Tenure & Compensation Meta */}
        {(executive.tenureStartYear || payFormatted) && (
          <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
            {executive.tenureStartYear && (
              <div className="flex items-center gap-1 font-medium">
                <span>📅</span>
                <span>Role Since {executive.tenureStartYear}</span>
              </div>
            )}
            {executive.tenureStartYear && payFormatted && <span>•</span>}
            {payFormatted && (
              <div className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <span>💰</span>
                <span>Comp: {payFormatted}</span>
              </div>
            )}
          </div>
        )}

        {/* Short Biography */}
        {executive.bio && (
          <div className="mb-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 font-normal">
              {executive.bio}
            </p>
          </div>
        )}
      </div>

      {/* Footer / Career Call to Action */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 mt-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
          <span>View Career History</span>
          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          Executive Profile
        </span>
      </div>
    </div>
  );
};

