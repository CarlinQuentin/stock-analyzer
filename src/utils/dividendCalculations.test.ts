import { describe, it, expect } from "vitest";
import {
  determineDividendFrequency,
  calculateSinglePaymentDPS,
  getAnnualMultiplierForFrequency,
  calculateRegularDividendYield,
  formatDividendAmount,
  isSpecialDividend,
} from "./dividendCalculations";

describe("dividendCalculations Utility (3 Core Metrics)", () => {
  describe("1. Dividend Frequency", () => {
    it("detects Quarterly dividend payer (4 payments per year)", () => {
      const history = [
        { date: "2024-02-15", dividend: 0.25 },
        { date: "2024-05-15", dividend: 0.25 },
        { date: "2024-08-15", dividend: 0.25 },
        { date: "2024-11-15", dividend: 0.25 },
      ];
      expect(determineDividendFrequency(history)).toBe("Quarterly");
      expect(determineDividendFrequency(history, 2024)).toBe("Quarterly");
    });

    it("detects Monthly dividend payer (12 payments per year)", () => {
      const history = Array.from({ length: 12 }, (_, i) => ({
        date: `2024-${String(i + 1).padStart(2, "0")}-15`,
        dividend: 0.26,
      }));
      expect(determineDividendFrequency(history)).toBe("Monthly");
      expect(determineDividendFrequency(history, 2024)).toBe("Monthly");
    });

    it("detects Semi-Annual dividend payer (2 payments per year)", () => {
      const history = [
        { date: "2024-04-15", dividend: 1.20 },
        { date: "2024-10-15", dividend: 1.20 },
      ];
      expect(determineDividendFrequency(history)).toBe("Semi-Annual");
      expect(determineDividendFrequency(history, 2024)).toBe("Semi-Annual");
    });

    it("detects Annual dividend payer (1 payment per year)", () => {
      const history = [
        { date: "2024-05-15", dividend: 3.50 },
        { date: "2023-05-15", dividend: 3.20 },
      ];
      expect(determineDividendFrequency(history)).toBe("Annual");
      expect(determineDividendFrequency(history, 2024)).toBe("Annual");
    });

    it("returns 'None' for non-dividend payers", () => {
      expect(determineDividendFrequency([])).toBe("None");
      expect(determineDividendFrequency(null)).toBe("None");
      expect(determineDividendFrequency(undefined)).toBe("None");
      expect(determineDividendFrequency([{ date: "2024-01-01", dividend: 0 }])).toBe("None");
    });
  });

  describe("2. Dividend Amount (Per Payment Per Share)", () => {
    it("returns latest single regular payment amount for quarterly payer", () => {
      const history = [
        { date: "2024-02-15", dividend: 0.50 },
        { date: "2024-05-15", dividend: 0.50 },
        { date: "2024-08-15", dividend: 0.52 },
        { date: "2024-11-15", dividend: 0.52 },
      ];
      expect(calculateSinglePaymentDPS(history)).toBe(0.52);
      expect(calculateSinglePaymentDPS(history, 2024)).toBe(0.52);
    });

    it("ignores special dividends and preserves regular per-payment dividend amount", () => {
      const history = [
        { date: "2024-02-15", dividend: 0.52 },
        { date: "2024-05-15", dividend: 0.52 },
        { date: "2024-08-15", dividend: 0.52 },
        { date: "2024-11-15", dividend: 0.52 },
        { date: "2024-12-15", dividend: 15.00, label: "Special Cash Dividend" },
      ];
      expect(calculateSinglePaymentDPS(history)).toBe(0.52);
      expect(calculateSinglePaymentDPS(history, 2024)).toBe(0.52);
    });

    it("formats per-payment dividend amounts cleanly", () => {
      expect(formatDividendAmount(0.52)).toBe("$0.52 / share");
      expect(formatDividendAmount(0.17)).toBe("$0.17 / share");
      expect(formatDividendAmount(2.00)).toBe("$2.00 / share");
      expect(formatDividendAmount(0)).toBe("$0.00 / share");
      expect(formatDividendAmount(null)).toBe("—");
      expect(formatDividendAmount(undefined)).toBe("—");
    });
  });

  describe("3. Dividend Yield (Annualized Regular Yield)", () => {
    it("annualizes quarterly dividend correctly (0.52 x 4 / $73.24 = ~2.84%)", () => {
      const multiplier = getAnnualMultiplierForFrequency("Quarterly");
      expect(multiplier).toBe(4);

      const yieldVal = calculateRegularDividendYield(0.52, "Quarterly", 73.24);
      expect(yieldVal).not.toBeNull();
      expect(yieldVal! * 100).toBeCloseTo(2.84, 1);
    });

    it("annualizes monthly dividend correctly (0.17 x 12 / $100.00 = 2.04%)", () => {
      const multiplier = getAnnualMultiplierForFrequency("Monthly");
      expect(multiplier).toBe(12);

      const yieldVal = calculateRegularDividendYield(0.17, "Monthly", 100.0);
      expect(yieldVal).toBeCloseTo(0.0204, 4);
    });

    it("annualizes semi-annual dividend correctly (1.50 x 2 / $75.00 = 4.00%)", () => {
      const multiplier = getAnnualMultiplierForFrequency("Semi-Annual");
      expect(multiplier).toBe(2);

      const yieldVal = calculateRegularDividendYield(1.50, "Semi-Annual", 75.0);
      expect(yieldVal).toBeCloseTo(0.04, 4);
    });

    it("handles annual dividend correctly (3.00 x 1 / $100.00 = 3.00%)", () => {
      const multiplier = getAnnualMultiplierForFrequency("Annual");
      expect(multiplier).toBe(1);

      const yieldVal = calculateRegularDividendYield(3.00, "Annual", 100.0);
      expect(yieldVal).toBeCloseTo(0.03, 4);
    });

    it("returns 0 for non-payers ('None' frequency or 0 dividend)", () => {
      expect(calculateRegularDividendYield(0, "Quarterly", 100.0)).toBe(0);
      expect(calculateRegularDividendYield(0.5, "None", 100.0)).toBe(0);
    });

    it("uses fallback yield when price is missing", () => {
      expect(calculateRegularDividendYield(0.52, "Quarterly", null, 0.0284)).toBe(0.0284);
    });
  });

  describe("isSpecialDividend", () => {
    it("identifies special dividend labels", () => {
      expect(isSpecialDividend({ label: "Special Cash Dividend" })).toBe(true);
      expect(isSpecialDividend({ description: "One-Time Bonus Distribution" })).toBe(true);
      expect(isSpecialDividend({ frequency: "Special" })).toBe(true);
      expect(isSpecialDividend({ label: "Regular Dividend" })).toBe(false);
      expect(isSpecialDividend(null)).toBe(false);
    });
  });
});
