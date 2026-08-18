import { describe, it, expect } from "vitest";
import {
  calculateRangeSelection,
  formatDuration,
  formatDateRange,
  parseDateString,
} from "./chartRangeSelection";
import { HistoricalPricePoint } from "../types";

describe("chartRangeSelection Utility", () => {
  const mockDailyData: HistoricalPricePoint[] = [
    { date: "2024-01-05", close: 42.0, high: 43.0, low: 41.5, volume: 1000000 },
    { date: "2024-01-15", close: 44.5, high: 45.0, low: 43.0, volume: 1200000 },
    { date: "2024-02-01", close: 46.0, high: 47.0, low: 45.5, volume: 1500000 },
    { date: "2024-02-18", close: 48.3, high: 49.0, low: 45.8, volume: 1800000 },
    { date: "2024-03-01", close: 40.0, high: 48.5, low: 39.5, volume: 2000000 },
  ];

  const mockIntradayData: HistoricalPricePoint[] = [
    { date: "2024-01-15 09:30:00", close: 100.0, high: 101.0, low: 99.5, volume: 50000 },
    { date: "2024-01-15 10:45:00", close: 103.5, high: 104.0, low: 100.0, volume: 80000 },
    { date: "2024-01-15 11:45:00", close: 106.3, high: 107.0, low: 103.0, volume: 60000 },
  ];

  describe("calculateRangeSelection — Daily Data", () => {
    it("1. Accurately calculates range selection for Google Finance example ($42.00 -> $48.30)", () => {
      // Index 0 (2024-01-05: 42.0) to Index 3 (2024-02-18: 48.3)
      const res = calculateRangeSelection(mockDailyData, 0, 3, false);

      expect(res).not.toBeNull();
      expect(res!.startPrice).toBe(42.0);
      expect(res!.endPrice).toBe(48.3);
      expect(res!.dollarChange).toBeCloseTo(6.3, 2);
      expect(res!.percentChange).toBeCloseTo(15.0, 1);
      expect(res!.isPositive).toBe(true);
      expect(res!.durationFormatted).toBe("44 days");
      expect(res!.dateRangeFormatted).toContain("Jan 5 – Feb 18, 2024");
      expect(res!.high).toBe(49.0);
      expect(res!.low).toBe(41.5);
      expect(res!.pointCount).toBe(4);
      expect(res!.totalVolume).toBe(5500000);
      expect(res!.avgVolume).toBe(1375000);
      expect(res!.summaryFormatted).toContain("+$6.30");
      expect(res!.summaryFormatted).toContain("+15.00%");
      expect(res!.summaryFormatted).toContain("44 days");
    });

    it("2. Normalizes selection correctly when user drags in reverse direction (right-to-left)", () => {
      // User dragged from index 3 to index 0
      const forwardRes = calculateRangeSelection(mockDailyData, 0, 3, false);
      const reverseRes = calculateRangeSelection(mockDailyData, 3, 0, false);

      expect(reverseRes).not.toBeNull();
      expect(reverseRes!.startIndex).toBe(0);
      expect(reverseRes!.endIndex).toBe(3);
      expect(reverseRes!.startPrice).toBe(forwardRes!.startPrice);
      expect(reverseRes!.endPrice).toBe(forwardRes!.endPrice);
      expect(reverseRes!.dollarChange).toBeCloseTo(forwardRes!.dollarChange, 2);
      expect(reverseRes!.percentChange).toBeCloseTo(forwardRes!.percentChange, 2);
      expect(reverseRes!.durationFormatted).toBe(forwardRes!.durationFormatted);
      expect(reverseRes!.totalVolume).toBe(forwardRes!.totalVolume);
    });

    it("3. Calculates negative price movements accurately for stock decline", () => {
      // Index 3 (48.3) to Index 4 (40.0) -> $48.3 -> $40.0 (-$8.30, -17.18%)
      const res = calculateRangeSelection(mockDailyData, 3, 4, false);

      expect(res).not.toBeNull();
      expect(res!.startPrice).toBe(48.3);
      expect(res!.endPrice).toBe(40.0);
      expect(res!.dollarChange).toBeCloseTo(-8.3, 2);
      expect(res!.percentChange).toBeCloseTo(-17.18, 1);
      expect(res!.isPositive).toBe(false);
      expect(res!.summaryFormatted).toContain("-$8.30");
      expect(res!.summaryFormatted).toContain("-17.18%");
    });

    it("4. Handles flat/zero price change correctly ($50 -> $50)", () => {
      const flatData: HistoricalPricePoint[] = [
        { date: "2024-01-01", close: 50.0, high: 52.0, low: 49.0, volume: 100 },
        { date: "2024-01-10", close: 50.0, high: 51.0, low: 48.0, volume: 200 },
      ];
      const res = calculateRangeSelection(flatData, 0, 1, false);
      expect(res).not.toBeNull();
      expect(res!.dollarChange).toBe(0);
      expect(res!.percentChange).toBe(0);
      expect(res!.isPositive).toBe(true);
    });

    it("5. Calculates range CAGR for multi-day periods >= 30 days", () => {
      // 44 days: 42.0 -> 48.3
      const res = calculateRangeSelection(mockDailyData, 0, 3, false);
      expect(res!.cagr).not.toBeNull();
      expect(res!.cagr!).toBeGreaterThan(0);
    });

    it("6. Does not calculate CAGR for short periods < 30 days", () => {
      // 10 days: index 0 to 1
      const res = calculateRangeSelection(mockDailyData, 0, 1, false);
      expect(res!.cagr).toBeNull();
    });

    it("7. Clamps out-of-bound indices gracefully", () => {
      const res = calculateRangeSelection(mockDailyData, -5, 100, false);
      expect(res).not.toBeNull();
      expect(res!.startIndex).toBe(0);
      expect(res!.endIndex).toBe(mockDailyData.length - 1);
    });

    it("8. Returns null when data is empty", () => {
      const res = calculateRangeSelection([], 0, 1, false);
      expect(res).toBeNull();
    });
  });

  describe("calculateRangeSelection — Intraday Data", () => {
    it("1. Calculates intraday range correctly with hour/minute duration", () => {
      // Index 0 (09:30: 100.0) to Index 2 (11:45: 106.3) -> 2 hrs 15 mins
      const res = calculateRangeSelection(mockIntradayData, 0, 2, true);

      expect(res).not.toBeNull();
      expect(res!.startPrice).toBe(100.0);
      expect(res!.endPrice).toBe(106.3);
      expect(res!.dollarChange).toBeCloseTo(6.3, 2);
      expect(res!.percentChange).toBeCloseTo(6.3, 1);
      expect(res!.durationFormatted).toBe("2 hrs 15 mins");
      expect(res!.dateRangeFormatted).toContain("9:30 AM – 11:45 AM");
      expect(res!.high).toBe(107.0);
      expect(res!.low).toBe(99.5);
    });
  });

  describe("formatDuration", () => {
    it("formats intraday minutes and hours properly", () => {
      const t0 = new Date("2024-01-15T09:30:00");
      const t1 = new Date("2024-01-15T10:15:00");
      const t2 = new Date("2024-01-15T11:30:00");

      expect(formatDuration(t0, t1, true)).toBe("45 mins");
      expect(formatDuration(t0, t2, true)).toBe("2 hrs");
    });

    it("formats multi-day intervals properly", () => {
      const d0 = new Date("2024-01-01");
      const d1 = new Date("2024-01-02");
      const d2 = new Date("2024-02-14");
      const d3 = new Date("2025-01-01");

      expect(formatDuration(d0, d1, false)).toBe("1 day");
      expect(formatDuration(d0, d2, false)).toBe("44 days");
      expect(formatDuration(d0, d3, false)).toContain("366 days");
    });
  });

  describe("formatDateRange", () => {
    it("formats same-year date ranges", () => {
      const d0 = new Date(2024, 0, 5);
      const d1 = new Date(2024, 1, 18);
      expect(formatDateRange(d0, d1, false)).toBe("Jan 5 – Feb 18, 2024");
    });

    it("formats different-year date ranges", () => {
      const d0 = new Date(2023, 10, 15);
      const d1 = new Date(2024, 2, 20);
      expect(formatDateRange(d0, d1, false)).toBe("Nov 15, 2023 – Mar 20, 2024");
    });
  });

  describe("parseDateString", () => {
    it("parses YYYY-MM-DD without UTC timezone offset shift", () => {
      const parsed = parseDateString("2024-01-05");
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(0); // January
      expect(parsed.getDate()).toBe(5);
    });

    it("parses timestamp with space", () => {
      const parsed = parseDateString("2024-01-15 09:30:00");
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(0);
      expect(parsed.getDate()).toBe(15);
    });
  });
});
