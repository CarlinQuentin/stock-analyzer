import { CompanyProfile } from "../types";
import { formatMarketCap } from "../utils/scoring";

interface CompanyHeaderProps {
  profile: CompanyProfile;
  isSaved?: boolean;
  isAuthenticated?: boolean;
  onToggleSave?: () => void;
  onRequireAuth?: () => void;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  profile,
  isSaved = false,
  isAuthenticated = false,
  onToggleSave,
  onRequireAuth,
}) => {
  const effectiveIsSaved = isAuthenticated && isSaved;

  const handleSaveClick = () => {
    if (!isAuthenticated) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    if (onToggleSave) onToggleSave();
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 h-full flex flex-col justify-between border border-transparent dark:border-slate-700/50 transition-colors duration-300">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
              {profile.companyName}
            </h1>
            <span className="text-xl sm:text-2xl font-bold text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/50 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded border border-transparent dark:border-blue-800/40">
              {profile.symbol}
            </span>
            {(onToggleSave || onRequireAuth) && (
              <button
                onClick={handleSaveClick}
                title={
                  !isAuthenticated
                    ? "Sign in to save stocks to your account"
                    : effectiveIsSaved
                      ? "Remove from saved stocks"
                      : "Save stock for quick access"
                }
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 shadow-sm transform hover:scale-105 active:scale-95 ${
                  effectiveIsSaved
                    ? "bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 shadow-amber-500/20"
                    : "bg-slate-100 hover:bg-amber-50 dark:bg-slate-700 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
                }`}
              >
                <span className="text-sm">{effectiveIsSaved ? "⭐" : "☆"}</span>
                <span>{effectiveIsSaved ? "Saved" : "Save Stock"}</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {profile.sector && <span>{profile.sector}</span>}
            {profile.sector && profile.industry && <span> • </span>}
            {profile.industry && <span>{profile.industry}</span>}
          </p>
        </div>
        {profile.image && (
          <img
            src={profile.image}
            alt={profile.companyName}
            className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg object-contain ml-2 sm:ml-4 bg-white p-1 flex-shrink-0"
          />
        )}
      </div>

      {profile.description && (
        <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm mb-4 line-clamp-3 leading-relaxed">
          {profile.description}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium truncate"
          >
            Website
          </a>
        )}
        {profile.mktCap && (
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">Market Cap</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {formatMarketCap(profile.mktCap)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
