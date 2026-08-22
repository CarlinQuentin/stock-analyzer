import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseTabParam,
  parseUrl,
  buildStockUrl,
  buildHomeUrl,
  buildSavedStocksUrl,
  navigateTo,
  NAVIGATE_EVENT,
  DEFAULT_TAB,
  PROTECTED_TABS,
  isTabProtected,
} from "./navigation";

describe("Navigation & URL Routing Utility", () => {
  describe("parseTabParam", () => {
    it("returns default tab when param is null, undefined, or empty", () => {
      expect(parseTabParam(null)).toBe(DEFAULT_TAB);
      expect(parseTabParam(undefined)).toBe(DEFAULT_TAB);
      expect(parseTabParam("")).toBe(DEFAULT_TAB);
      expect(parseTabParam("   ")).toBe(DEFAULT_TAB);
    });

    it("parses canonical tab names correctly", () => {
      expect(parseTabParam("fundamentals")).toBe("fundamentals");
      expect(parseTabParam("valuation")).toBe("valuation");
      expect(parseTabParam("financials")).toBe("rawFinancials");
      expect(parseTabParam("rawFinancials")).toBe("rawFinancials");
      expect(parseTabParam("futureOutlook")).toBe("futureOutlook");
      expect(parseTabParam("leadership")).toBe("leadership");
    });

    it("handles tab aliases case-insensitively and gracefully", () => {
      // Raw Financials & Dividends aliases
      expect(parseTabParam("FINANCIALS")).toBe("rawFinancials");
      expect(parseTabParam("raw-financials")).toBe("rawFinancials");
      expect(parseTabParam("raw_financials")).toBe("rawFinancials");
      expect(parseTabParam("dividends")).toBe("rawFinancials");
      expect(parseTabParam("dividend")).toBe("rawFinancials");
      expect(parseTabParam("statements")).toBe("rawFinancials");

      // Future outlook aliases
      expect(parseTabParam("future-outlook")).toBe("futureOutlook");
      expect(parseTabParam("future_outlook")).toBe("futureOutlook");
      expect(parseTabParam("outlook")).toBe("futureOutlook");
      expect(parseTabParam("future")).toBe("futureOutlook");

      // Leadership aliases
      expect(parseTabParam("executives")).toBe("leadership");
      expect(parseTabParam("management")).toBe("leadership");
      expect(parseTabParam("senior-leadership")).toBe("leadership");

      // Fundamentals aliases
      expect(parseTabParam("overview")).toBe("fundamentals");
      expect(parseTabParam("quality")).toBe("fundamentals");
      expect(parseTabParam("business")).toBe("fundamentals");
    });

    it("falls back to DEFAULT_TAB for invalid/unknown tab parameters without error", () => {
      expect(parseTabParam("invalid")).toBe(DEFAULT_TAB);
      expect(parseTabParam("unknown_tab")).toBe(DEFAULT_TAB);
      expect(parseTabParam("12345")).toBe(DEFAULT_TAB);
    });
  });

  describe("parseUrl", () => {
    it("parses root URL as search view", () => {
      const result = parseUrl("/", "");
      expect(result).toEqual({
        view: "search",
        ticker: null,
        tab: "fundamentals",
      });
    });

    it("parses /stock/:ticker with default tab", () => {
      const result = parseUrl("/stock/AAPL", "");
      expect(result).toEqual({
        view: "analyze",
        ticker: "AAPL",
        tab: "fundamentals",
      });
    });

    it("normalizes lowercase tickers to uppercase", () => {
      const result = parseUrl("/stock/aapl", "");
      expect(result).toEqual({
        view: "analyze",
        ticker: "AAPL",
        tab: "fundamentals",
      });
    });

    it("handles tickers with dots or hyphens (e.g. BRK.B, BRK-B)", () => {
      expect(parseUrl("/stock/BRK.B", "")).toEqual({
        view: "analyze",
        ticker: "BRK.B",
        tab: "fundamentals",
      });
      expect(parseUrl("/stock/brk-b", "")).toEqual({
        view: "analyze",
        ticker: "BRK-B",
        tab: "fundamentals",
      });
    });

    it("parses /stock/:ticker with query tab parameter", () => {
      expect(parseUrl("/stock/AAPL", "?tab=valuation")).toEqual({
        view: "analyze",
        ticker: "AAPL",
        tab: "valuation",
      });

      expect(parseUrl("/stock/AAPL", "?tab=financials")).toEqual({
        view: "analyze",
        ticker: "AAPL",
        tab: "rawFinancials",
      });

      expect(parseUrl("/stock/AAPL", "?tab=dividends")).toEqual({
        view: "analyze",
        ticker: "AAPL",
        tab: "rawFinancials",
      });

      expect(parseUrl("/stock/STLD", "?tab=leadership")).toEqual({
        view: "analyze",
        ticker: "STLD",
        tab: "leadership",
      });

      expect(parseUrl("/stock/MSFT", "?tab=futureOutlook")).toEqual({
        view: "analyze",
        ticker: "MSFT",
        tab: "futureOutlook",
      });
    });

    it("handles invalid tab query parameter by falling back to fundamentals", () => {
      const result = parseUrl("/stock/AAPL", "?tab=invalid");
      expect(result).toEqual({
        view: "analyze",
        ticker: "AAPL",
        tab: "fundamentals",
      });
    });

    it("parses trailing slashes gracefully", () => {
      expect(parseUrl("/stock/AAPL/", "")).toEqual({
        view: "analyze",
        ticker: "AAPL",
        tab: "fundamentals",
      });
    });

    it("parses /saved route", () => {
      expect(parseUrl("/saved", "")).toEqual({
        view: "saved",
        ticker: null,
        tab: "fundamentals",
      });
    });
  });

  describe("buildStockUrl", () => {
    it("builds clean base stock URL for default tab", () => {
      expect(buildStockUrl("AAPL")).toBe("/stock/AAPL");
      expect(buildStockUrl("aapl")).toBe("/stock/AAPL");
      expect(buildStockUrl("AAPL", "fundamentals")).toBe("/stock/AAPL");
    });

    it("builds stock URL with canonical tab query parameters", () => {
      expect(buildStockUrl("AAPL", "valuation")).toBe("/stock/AAPL?tab=valuation");
      expect(buildStockUrl("AAPL", "rawFinancials")).toBe("/stock/AAPL?tab=financials");
      expect(buildStockUrl("AAPL", "futureOutlook")).toBe("/stock/AAPL?tab=futureOutlook");
      expect(buildStockUrl("AAPL", "leadership")).toBe("/stock/AAPL?tab=leadership");
    });

    it("normalizes string tab names in buildStockUrl", () => {
      expect(buildStockUrl("MSFT", "financials")).toBe("/stock/MSFT?tab=financials");
      expect(buildStockUrl("STLD", "dividends")).toBe("/stock/STLD?tab=financials");
      expect(buildStockUrl("GOOGL", "invalid")).toBe("/stock/GOOGL");
    });
  });

  describe("buildHomeUrl and buildSavedStocksUrl", () => {
    it("returns root path for home URL", () => {
      expect(buildHomeUrl()).toBe("/");
    });

    it("returns /saved for saved stocks URL", () => {
      expect(buildSavedStocksUrl()).toBe("/saved");
    });
  });

  describe("navigateTo", () => {
    let originalWindow: any;
    let pushStateMock: any;
    let replaceStateMock: any;
    let eventReceived: any = null;

    beforeEach(() => {
      pushStateMock = vi.fn();
      replaceStateMock = vi.fn();
      eventReceived = null;

      const listeners: Record<string, Function[]> = {};

      const mockWindow = {
        location: {
          pathname: "/",
          search: "",
        },
        history: {
          pushState: pushStateMock,
          replaceState: replaceStateMock,
        },
        addEventListener: (event: string, cb: Function) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        removeEventListener: (event: string, cb: Function) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((f) => f !== cb);
          }
        },
        dispatchEvent: (event: any) => {
          const cbs = listeners[event.type] || [];
          cbs.forEach((cb) => cb(event));
          return true;
        },
      };

      originalWindow = (globalThis as any).window;
      (globalThis as any).window = mockWindow;
      (globalThis as any).CustomEvent = class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, options?: any) {
          this.type = type;
          this.detail = options?.detail;
        }
      };

      mockWindow.addEventListener(NAVIGATE_EVENT, (e: any) => {
        eventReceived = e.detail;
      });
    });

    afterEach(() => {
      (globalThis as any).window = originalWindow;
    });

    it("calls window.history.pushState and dispatches custom event", () => {
      navigateTo("/stock/AAPL");
      expect(pushStateMock).toHaveBeenCalledWith({}, "", "/stock/AAPL");
      expect(eventReceived).toEqual({ url: "/stock/AAPL" });
    });

    it("calls window.history.replaceState when replace is true", () => {
      navigateTo("/stock/MSFT?tab=valuation", true);
      expect(replaceStateMock).toHaveBeenCalledWith({}, "", "/stock/MSFT?tab=valuation");
      expect(eventReceived).toEqual({ url: "/stock/MSFT?tab=valuation" });
    });
  });

  describe("Protected Tabs Configuration", () => {
    it("identifies protected tabs correctly", () => {
      expect(isTabProtected("futureOutlook")).toBe(true);
      expect(isTabProtected("leadership")).toBe(true);
      expect(PROTECTED_TABS).toContain("futureOutlook");
      expect(PROTECTED_TABS).toContain("leadership");
    });

    it("identifies public unrestricted tabs correctly", () => {
      expect(isTabProtected("fundamentals")).toBe(false);
      expect(isTabProtected("valuation")).toBe(false);
      expect(isTabProtected("rawFinancials")).toBe(false);
    });
  });
});
