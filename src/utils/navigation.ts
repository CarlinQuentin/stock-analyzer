/**
 * Navigation and URL-driven routing utility for Stock Analyzer.
 * 
 * Provides centralized routing, URL parsing, tab aliases, and history-aware
 * client-side navigation without external router dependencies.
 */

import { useState, useEffect, useCallback } from "react";

export type TabType =
  | "fundamentals"
  | "valuation"
  | "rawFinancials"
  | "futureOutlook"
  | "leadership";

export const DEFAULT_TAB: TabType = "fundamentals";

export const ALL_TABS: TabType[] = [
  "fundamentals",
  "valuation",
  "rawFinancials",
  "futureOutlook",
  "leadership",
];

export const TAB_TO_SLUG_MAP: Record<TabType, string> = {
  fundamentals: "fundamentals",
  valuation: "valuation",
  rawFinancials: "financials",
  futureOutlook: "futureOutlook",
  leadership: "leadership",
};

export const SLUG_TO_TAB_MAP: Record<string, TabType> = {
  // Fundamentals / Overview
  fundamentals: "fundamentals",
  overview: "fundamentals",
  quality: "fundamentals",
  business: "fundamentals",
  score: "fundamentals",

  // Valuation
  valuation: "valuation",
  price: "valuation",
  multiples: "valuation",

  // Raw Financials & Dividends
  financials: "rawFinancials",
  rawfinancials: "rawFinancials",
  "raw-financials": "rawFinancials",
  raw_financials: "rawFinancials",
  statements: "rawFinancials",
  dividends: "rawFinancials",
  dividend: "rawFinancials",

  // Future Outlook
  futureoutlook: "futureOutlook",
  future_outlook: "futureOutlook",
  "future-outlook": "futureOutlook",
  future: "futureOutlook",
  outlook: "futureOutlook",
  forecast: "futureOutlook",

  // Leadership
  leadership: "leadership",
  executives: "leadership",
  management: "leadership",
  "senior-leadership": "leadership",
};

export interface RouteState {
  view: "analyze" | "saved" | "search";
  ticker: string | null;
  tab: TabType;
}

/**
 * Normalizes and maps a tab query parameter value to a valid TabType.
 * Falls back to DEFAULT_TAB ('fundamentals') for missing or unrecognized values.
 */
export function parseTabParam(tabParam: string | null | undefined): TabType {
  if (!tabParam) return DEFAULT_TAB;
  const normalized = tabParam.trim().toLowerCase();
  return SLUG_TO_TAB_MAP[normalized] || DEFAULT_TAB;
}

/**
 * Parses pathname and search query string into structured RouteState.
 */
export function parseUrl(pathname: string, search: string): RouteState {
  const cleanPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const searchParams = new URLSearchParams(search || "");
  const tab = parseTabParam(searchParams.get("tab"));

  // Match /stock/:ticker
  const stockMatch = cleanPath.match(/^\/stock\/([^/]+)$/i);
  if (stockMatch) {
    const rawTicker = decodeURIComponent(stockMatch[1]).trim().toUpperCase();
    if (rawTicker) {
      return {
        view: "analyze",
        ticker: rawTicker,
        tab,
      };
    }
  }

  // Match /saved or ?view=saved
  if (cleanPath.toLowerCase() === "/saved" || searchParams.get("view") === "saved") {
    return {
      view: "saved",
      ticker: null,
      tab: DEFAULT_TAB,
    };
  }

  // Default: Search view
  return {
    view: "search",
    ticker: null,
    tab: DEFAULT_TAB,
  };
}

/**
 * Builds the canonical URL for a stock and optional tab.
 * When tab is the default overview tab, returns clean `/stock/:ticker`.
 */
export function buildStockUrl(ticker: string, tab?: TabType | string): string {
  const cleanTicker = encodeURIComponent(ticker.trim().toUpperCase());
  if (!tab) {
    return `/stock/${cleanTicker}`;
  }

  const resolvedTab: TabType = typeof tab === "string" ? parseTabParam(tab) : tab;
  if (resolvedTab === DEFAULT_TAB) {
    return `/stock/${cleanTicker}`;
  }

  const slug = TAB_TO_SLUG_MAP[resolvedTab] || "financials";
  return `/stock/${cleanTicker}?tab=${encodeURIComponent(slug)}`;
}

/**
 * Builds the canonical home / search URL.
 */
export function buildHomeUrl(): string {
  return "/";
}

/**
 * Builds the canonical saved stocks URL.
 */
export function buildSavedStocksUrl(): string {
  return "/saved";
}

export const NAVIGATE_EVENT = "stock-analyzer:navigate";

export function navigateTo(url: string, replace = false): void {
  if (typeof window === "undefined") return;

  if (replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }

  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { url } }));
}

/**
 * React hook for URL-driven navigation.
 * Keeps route state synchronized with window.location and browser history (popstate).
 */
export function useNavigation() {
  const [route, setRoute] = useState<RouteState>(() => {
    if (typeof window === "undefined") {
      return { view: "search", ticker: null, tab: DEFAULT_TAB };
    }
    return parseUrl(window.location.pathname, window.location.search);
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(parseUrl(window.location.pathname, window.location.search));
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener(NAVIGATE_EVENT, handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener(NAVIGATE_EVENT, handleLocationChange);
    };
  }, []);

  const navigateToStock = useCallback((ticker: string, tab?: TabType, replace = false) => {
    const url = buildStockUrl(ticker, tab);
    navigateTo(url, replace);
  }, []);

  const navigateToTab = useCallback(
    (tab: TabType, replace = false) => {
      if (route.ticker) {
        const url = buildStockUrl(route.ticker, tab);
        navigateTo(url, replace);
      }
    },
    [route.ticker],
  );

  const navigateToHome = useCallback((replace = false) => {
    navigateTo(buildHomeUrl(), replace);
  }, []);

  const navigateToSaved = useCallback((replace = false) => {
    navigateTo(buildSavedStocksUrl(), replace);
  }, []);

  return {
    route,
    currentTicker: route.ticker,
    currentTab: route.tab,
    currentView: route.view,
    navigateToStock,
    navigateToTab,
    navigateToHome,
    navigateToSaved,
  };
}
