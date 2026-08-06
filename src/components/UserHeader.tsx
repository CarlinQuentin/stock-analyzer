import React, { useState, useRef, useEffect } from "react";
import { UserProfile } from "../services/authService";

interface UserHeaderProps {
  user: UserProfile | null;
  savedCount?: number;
  onLogout: () => void;
  onLoginRequest?: () => void;
  onOpenSavedStocks?: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  user,
  savedCount = 0,
  onLogout,
  onLoginRequest,
  onOpenSavedStocks,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Profile Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 rounded-full shadow-sm hover:shadow-md transition-all duration-200 select-none text-slate-800 dark:text-slate-100 font-medium text-xs"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm flex-shrink-0">
          {user?.name ? user.name.charAt(0) : "👤"}
        </div>
        <span className="font-semibold max-w-[120px] truncate">
          {user?.name || "My Account"}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-xl py-2 z-50 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {user?.name || "Guest Account"}
            </p>
            {user?.email && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {user.email}
              </p>
            )}
          </div>

          {/* Profile Menu Items */}
          <div className="py-1">
            {/* Saved Stocks Option */}
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenSavedStocks) onOpenSavedStocks();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">⭐</span>
                <span>Saved Stocks</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                {savedCount}
              </span>
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />

            {/* Logout / Sign In Option */}
            {user ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onLoginRequest) onLoginRequest();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              >
                <span>👤</span>
                <span>Sign In / Create Account</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
