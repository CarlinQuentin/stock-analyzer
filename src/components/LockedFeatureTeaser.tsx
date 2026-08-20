import React from "react";

interface LockedFeatureTeaserProps {
  title?: string;
  description: string;
  badge?: string;
  icon?: string;
  ctaText?: string;
  onUnlock: () => void;
}

export const LockedFeatureTeaser: React.FC<LockedFeatureTeaserProps> = ({
  title = "Member-Only Feature",
  description,
  badge = "Free Account",
  icon = "🔒",
  ctaText = "Sign In / Create Account",
  onUnlock,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-700 shadow-md max-w-2xl mx-auto my-8 transition-all">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 text-3xl mb-5 shadow-inner">
        {icon}
      </div>
      <div className="block mb-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          <span>🔒</span>
          <span>{badge}</span>
        </span>
      </div>
      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-6 max-w-lg mx-auto leading-relaxed">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onUnlock}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
        >
          <span>{ctaText}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
