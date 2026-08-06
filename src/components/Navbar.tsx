import React from "react";
import { UserProfile } from "../services/authService";
import { UserHeader } from "./UserHeader";
import { ThemeToggle } from "./ThemeToggle";

interface NavbarProps {
  onViewChange: (view: "analyze" | "saved") => void;
  savedCount: number;
  user: UserProfile | null;
  onLogout: () => void;
  onLoginRequest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
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
        <div className="flex items-center gap-3">
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
        </div>

        {/* Right Side: User Profile Dropdown & Theme Toggle */}
        <div className="flex items-center gap-3">
          <UserHeader
            user={user}
            savedCount={savedCount}
            onLogout={onLogout}
            onLoginRequest={onLoginRequest}
            onOpenSavedStocks={() => onViewChange("saved")}
          />
          <div className="relative">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
