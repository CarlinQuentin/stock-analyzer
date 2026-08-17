import React, { useEffect, useState, useRef } from "react";

export type ThemeMode = "light" | "dark" | "gold" | "oak";

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  subtitle: string;
  icon: string;
  preview: {
    bg: string;
    card: string;
    accent: string;
  };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "light",
    name: "Light",
    subtitle: "Soft neutral slate mode",
    icon: "☀️",
    preview: {
      bg: "#f1f5f9",
      card: "#ffffff",
      accent: "#2563eb",
    },
  },
  {
    id: "dark",
    name: "Dark",
    subtitle: "Sleek dark slate mode",
    icon: "🌙",
    preview: {
      bg: "#0f172a",
      card: "#1e293b",
      accent: "#3b82f6",
    },
  },
  {
    id: "gold",
    name: "Sunset Gold",
    subtitle: "Warm amber, gold & sunset glow",
    icon: "🌅",
    preview: {
      bg: "#fef5e7",
      card: "#fffdf8",
      accent: "#d97706",
    },
  },
  {
    id: "oak",
    name: "Oak Reserve",
    subtitle: "Aged oak & warm amber lounge",
    icon: "🥃",
    preview: {
      bg: "#18110c",
      card: "#241911",
      accent: "#f59e0b",
    },
  },
];

export const ThemeToggle: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      // Handle legacy migration
      if (stored === "whisky") return "oak";
      if (stored === "developer") return "dark";

      if (
        stored === "light" ||
        stored === "dark" ||
        stored === "gold" ||
        stored === "oak"
      ) {
        return stored as ThemeMode;
      }

      const systemPreference = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      return systemPreference ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Reset all theme classes
    root.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-gold",
      "theme-oak",
      "theme-developer",
      "theme-whisky",
      "dark",
    );

    if (theme === "light") {
      root.classList.add("theme-light");
    } else if (theme === "dark") {
      root.classList.add("dark", "theme-dark");
    } else if (theme === "gold") {
      root.classList.add("theme-gold");
    } else if (theme === "oak") {
      root.classList.add("dark", "theme-oak");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const activeOption =
    THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <div className="fixed top-4 right-4 z-50 text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 select-none"
        aria-label="Select Color Theme"
        aria-expanded={isOpen}
        title="Select Color Theme"
      >
        <span className="text-base">{activeOption.icon}</span>
        <span className="hidden sm:inline font-bold">{activeOption.name}</span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Theme Options Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xl p-2.5 z-50 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 mb-1 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Color Theme
            </span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              4 Themes
            </span>
          </div>

          <div className="space-y-1">
            {THEME_OPTIONS.map((option) => {
              const isSelected = theme === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setTheme(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-slate-700/80 border border-blue-200/80 dark:border-blue-500/40 shadow-sm"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/40 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{option.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {option.name}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {option.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Swatch Preview Dots */}
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2 p-1 rounded-md bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50">
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: option.preview.bg }}
                      title="Background"
                    />
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: option.preview.card }}
                      title="Surface"
                    />
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: option.preview.accent }}
                      title="Accent"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
