import { CompanyProfile } from "../types";
import { formatMarketCap } from "../utils/scoring";

interface ProfileOnlyPageProps {
  profile: CompanyProfile;
  message: string;
  onBack: () => void;
}

export function ProfileOnlyPage({
  profile,
  message,
  onBack,
}: ProfileOnlyPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-100/90 to-slate-200/70 dark:from-slate-900 dark:to-slate-950 py-8 px-4 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Search
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="bg-slate-900 dark:bg-slate-950 px-8 py-8 text-white">
            <div className="inline-flex items-center rounded-full bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-100 mb-4">
              Profile access only
            </div>
            <h1 className="text-3xl font-bold">{profile.companyName}</h1>
            <p className="mt-3 text-slate-300 dark:text-slate-400 max-w-3xl">{message}</p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ticker</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {profile.symbol}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sector</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {profile.sector || "Not available"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Industry</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {profile.industry || "Not available"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Market Cap</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {profile.mktCap ? formatMarketCap(profile.mktCap) : "Not available"}
                </p>
              </div>
            </div>

            {profile.description && (
              <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-5">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">About</h2>
                <p className="mt-2 text-slate-650 dark:text-slate-300">{profile.description}</p>
              </div>
            )}

            {profile.website && (
              <div className="mt-6">
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Visit website
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8"
                    />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
