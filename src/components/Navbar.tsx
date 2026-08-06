import React from "react";
import { UserProfile } from "../services/authService";
import { UserHeader } from "./UserHeader";
import { ThemeToggle } from "./ThemeToggle";

interface NavbarProps {
  currentView: "analyze" | "saved";
  onViewChange: (view: "analyze" | "saved") => void;
  savedCount: number;
  user: UserProfile | null;
  onLogout: () => void;
  onLoginRequest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  savedCount,
  user,
  onLogout,
  onLoginRequest,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Title */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onViewChange("analyze")}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              📊
            </div>
            <div>
              <span className="text-base font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 bg-clip-text text-transparent">
                Stock Analyzer
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 ml-2 tracking-wider">
                Pro Quality
              </span>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
            <button
              onClick={() => onViewChange("analyze")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                currentView === "analyze"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>🔍</span>
              <span>Analyze Stock</span>
            </button>

            <button
              onClick={() => onViewChange("saved")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                currentView === "saved"
                  ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>⭐</span>
              <span>Saved Stocks</span>
              {savedCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                    currentView === "saved"
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {savedCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Right Side: User Profile & Theme Toggle */}
        <div className="flex items-center gap-3">
          <UserHeader
            user={user}
            onLogout={onLogout}
            onLoginRequest={onLoginRequest}
          />
          <div className="relative">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
