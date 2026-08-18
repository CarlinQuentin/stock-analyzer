import { describe, it, expect } from "vitest";
import {
  determineDividendFrequency,
  calculateAnnualRegularDPS,
  calculateSinglePaymentDPS,
  calculateTTMAnnualDPS,
  calculateDividendPayoutRatio,
  calculateDividendFCFCoverage,
  calculateSpecialDPS,
  isSpecialDividend,
} from "./dividendCalculations";

describe("dividendCalculations Utility", () => {
  describe("determineDividendFrequency", () => {
    it("1. Detects Quarterly dividend payer (4 payments per year)", () => {
      const history = [
        { date: "2024-02-15", dividend: 0.25 },
        { date: "2024-05-15", dividend: 0.25 },
        { date: "2024-08-15", dividend: 0.25 },
        { date: "2024-11-15", dividend: 0.25 },
      ];
      expect(determineDividendFrequency(history)).toBe("Quarterly");
      expect(determineDividendFrequency(history, 2024)).toBe("Quarterly");
    });

    it("2. Detects Monthly dividend payer (12 payments per year)", () => {
      const history = Array.from({ length: 12 }, (_, i) => ({
        date: `2024-${String(i + 1).padStart(2, "0")}-15`,
        dividend: 0.26,
      }));
      expect(determineDividendFrequency(history)).toBe("Monthly");
      expect(determineDividendFrequency(history, 2024)).toBe("Monthly");
    });

    it("3. Detects Semi-Annual dividend payer (2 payments per year)", () => {
      const history = [
        { date: "2024-04-15", dividend: 1.20 },
        { date: "2024-10-15", dividend: 1.20 },
      ];
      expect(determineDividendFrequency(history)).toBe("Semi-Annual");
      expect(determineDividendFrequency(history, 2024)).toBe("Semi-Annual");
    });

    it("4. Detects Annual dividend payer (1 payment per year)", () => {
      const history = [
        { date: "2024-05-15", dividend: 3.50 },
        { date: "2023-05-15", dividend: 3.20 },
      ];
      expect(determineDividendFrequency(history)).toBe("Annual");
      expect(determineDividendFrequency(history, 2024)).toBe("Annual");
    });

    it("5. Returns 'None' for company with no dividend payments", () => {
      expect(determineDividendFrequency([])).toBe("None");
      expect(determineDividendFrequency(null)).toBe("None");
      expect(determineDividendFrequency(undefined)).toBe("None");
      expect(determineDividendFrequency([{ date: "2024-01-01", dividend: 0 }])).toBe("None");
    });
  });

  describe("calculateAnnualRegularDPS & calculateSinglePaymentDPS", () => {
    it("1. Calculates Annual DPS accurately when dividend increases during the year ($0.50 x 2 + $0.55 x 2 = $2.10)", () => {
      const history = [
        { date: "2024-02-15", dividend: 0.50 },
        { date: "2024-05-15", dividend: 0.50 },
        { date: "2024-08-15", dividend: 0.55 },
        { date: "2024-11-15", dividend: 0.55 },
      ];

      const annualDPS = calculateAnnualRegularDPS(history, 2024);
      expect(annualDPS).toBe(2.10);

      const latestDPS = calculateSinglePaymentDPS(history, 2024);
      expect(latestDPS).toBe(0.55);
    });

    it("2. Accurately handles dividend cuts (e.g. $1.50 -> $0.50)", () => {
      const history = [
        { date: "2023-02-15", dividend: 0.375 },
        { date: "2023-05-15", dividend: 0.375 },
        { date: "2023-08-15", dividend: 0.375 },
        { date: "2023-11-15", dividend: 0.375 },
        { date: "2024-02-15", dividend: 0.125 },
        { date: "2024-05-15", dividend: 0.125 },
        { date: "2024-08-15", dividend: 0.125 },
        { date: "2024-11-15", dividend: 0.125 },
      ];

      const dps2023 = calculateAnnualRegularDPS(history, 2023);
      const dps2024 = calculateAnnualRegularDPS(history, 2024);

      expect(dps2023).toBe(1.50);
      expect(dps2024).toBe(0.50);
    });

    it("3. Excludes Special Dividends from Annual Regular DPS", () => {
      const history = [
        { date: "2024-02-15", dividend: 1.02 },
        { date: "2024-05-15", dividend: 1.02 },
        { date: "2024-08-15", dividend: 1.02 },
        { date: "2024-11-15", dividend: 1.02 },
        { date: "2024-12-15", dividend: 15.0, label: "Special Cash Dividend" },
      ];

      const annualRegularDPS = calculateAnnualRegularDPS(history, 2024);
      expect(annualRegularDPS).toBe(4.08); // 4 * 1.02, without the $15 special dividend

      const specialDPS = calculateSpecialDPS(history, 2024);
      expect(specialDPS).toBe(15.0);
    });

    it("4. Calculates TTM Annual DPS from trailing 365 days of regular dividends", () => {
      const history = [
        { date: "2024-02-15", dividend: 0.25 },
        { date: "2024-05-15", dividend: 0.25 },
        { date: "2024-08-15", dividend: 0.25 },
        { date: "2024-11-15", dividend: 0.25 },
      ];
      expect(calculateTTMAnnualDPS(history)).toBe(1.00);
    });

    it("5. Falls back to Cash Flow and Statement data when dividendHistory is missing", () => {
      const cf = { date: "2024-12-31", dividendsPaid: -1000000000 };
      const inc = { date: "2024-12-31", weightedAverageShsOutDil: 500000000 };

      const annualDPS = calculateAnnualRegularDPS(null, 2024, cf as any, inc as any);
      expect(annualDPS).toBe(2.00);
    });
  });

  describe("calculateDividendPayoutRatio", () => {
    it("1. Computes valid payout ratio when earnings are positive", () => {
      // $1.5B dividends paid / $5B net income = 30.0%
      const ratio = calculateDividendPayoutRatio(-1500000000, 5000000000);
      expect(ratio).toBe(0.30);
    });

    it("2. Returns null when Net Income is negative (avoiding misleading negative payout ratio)", () => {
      const ratio = calculateDividendPayoutRatio(-500000000, -1000000000);
      expect(ratio).toBeNull();
    });

    it("3. Returns null when Net Income is zero", () => {
      const ratio = calculateDividendPayoutRatio(-500000000, 0);
      expect(ratio).toBeNull();
    });

    it("4. Returns 0 when dividends paid is 0", () => {
      const ratio = calculateDividendPayoutRatio(0, 5000000000);
      expect(ratio).toBe(0);
    });
  });

  describe("calculateDividendFCFCoverage", () => {
    it("1. Computes valid coverage when FCF is positive", () => {
      // $1.2B dividends / ($4B OCF - $1B CapEx = $3B FCF) = 40.0%
      const coverage = calculateDividendFCFCoverage(-1200000000, 4000000000, -1000000000);
      expect(coverage).toBe(0.40);
    });

    it("2. Returns null when Free Cash Flow is negative (unfunded by organic FCF)", () => {
      // $1.2B dividends / ($500M OCF - $1B CapEx = -$500M FCF)
      const coverage = calculateDividendFCFCoverage(-1200000000, 500000000, -1000000000);
      expect(coverage).toBeNull();
    });

    it("3. Returns 0 when dividends paid is 0", () => {
      const coverage = calculateDividendFCFCoverage(0, 4000000000, -1000000000);
      expect(coverage).toBe(0);
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
