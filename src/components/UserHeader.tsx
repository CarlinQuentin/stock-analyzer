import React from "react";
import { UserProfile } from "../services/authService";

interface UserHeaderProps {
  user: UserProfile;
  onLogout: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({ user, onLogout }) => {
  return (
    <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-md">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm">
        {user.name ? user.name.charAt(0) : "U"}
      </div>
      <div className="text-left hidden sm:block">
        <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
          {user.name}
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
          {user.email}
        </div>
      </div>
      <button
        onClick={onLogout}
        className="ml-2 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1.5"
        title="Sign Out"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  );
};
