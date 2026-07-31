import React, { useState } from "react";
import { UserProfile } from "../services/authService";

interface UserHeaderProps {
  user: UserProfile;
  onLogout: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({ user, onLogout }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={() => setIsExpanded((prev) => !prev)}
      className={`group flex items-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer select-none ${
        isExpanded
          ? "px-4 py-2 rounded-2xl gap-3"
          : "px-2.5 py-1.5 rounded-full gap-2"
      }`}
    >
      {/* User Avatar Circle */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm flex-shrink-0">
        {user.name ? user.name.charAt(0) : "U"}
      </div>

      {/* User Name & Email - Expand on hover / click */}
      <div
        className={`text-left overflow-hidden transition-all duration-300 ${
          isExpanded
            ? "max-w-xs opacity-100 block"
            : "max-w-0 opacity-0 hidden"
        }`}
      >
        <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
          {user.name}
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate">
          {user.email}
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLogout();
        }}
        className={`rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-slate-700/60 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-semibold text-xs transition-all duration-300 flex items-center gap-1.5 ${
          isExpanded
            ? "px-3 py-1.5 rounded-xl ml-1"
            : "p-2 rounded-full"
        }`}
        title={`Sign Out (${user.name})`}
        aria-label="Sign Out"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span className={isExpanded ? "inline" : "hidden"}>Sign Out</span>
      </button>
    </div>
  );
};
