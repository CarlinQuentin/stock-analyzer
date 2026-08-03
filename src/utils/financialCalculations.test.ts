import { describe, it, expect } from "vitest";
import {
  calculateCAGR,
  calculateRevenueCAGR,
  calculateEPSGrowth,
  calculateEPSTrend,
  calculateEPSQualityScore,
  calculateFCF,
  calculateFCFGrowth,
  calculateFCFTrend,
  getFCFFormula,
  calculateDividendCAGR,
  calculateROIC,
  calculateAverageROIC,
  calculateDebtToEquity,
  calculateMargins,
  calculateAverageMargins,
  calculateAllMetrics,
} from "./financialCalculations";
import { FinancialStatement, DividendMetrics } from "../types";

describe("calculateCAGR", () => {
  it("should calculate positive growth correctly", () => {
    // $8B -> $96B over 5 years
    const cagr = calculateCAGR(8000000000, 96000000000, 5);
    expect(cagr).toBeCloseTo(0.6438, 4); // ~64.4%
  });

  it("should calculate declining growth correctly", () => {
    // $8.34B -> $3.846B over 5 years
    const cagr = calculateCAGR(8340000000, 3846000000, 5);
    expect(cagr).toBeCloseTo(-0.1434, 4); // ~-14.3% / -14.4%
  });

  it("should calculate declining CAGR correctly for Beginning FCF = 924 and Ending FCF = 501.5 over 10 years", () => {
    const cagr = calculateCAGR(924, 501.5, 10);
    expect(cagr).toBeCloseTo(-0.0593, 4); // -5.93%
  });

  it("should return 0 when starting, ending, or years is invalid", () => {
    expect(calculateCAGR(-100, 500, 5)).toBe(0);
    expect(calculateCAGR(100, -500, 5)).toBe(0);
    expect(calculateCAGR(100, 500, 0)).toBe(0);
    expect(calculateCAGR(100, 500, -1)).toBe(0);
  });

  it("should calculate 0% growth CAGR when starting and ending value is same", () => {
    const cagr = calculateCAGR(100, 100, 5);
    expect(cagr).toBe(0);
  });
});

describe("calculateRevenueCAGR", () => {
  describe("Happy Path Tests", () => {
    it("should calculate CAGR correctly with exactly 6 years of revenue data (5-year CAGR)", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: 120 },
        { date: "2022-12-31", revenue: 140 },
        { date: "2023-12-31", revenue: 160 },
        { date: "2024-12-31", revenue: 180 },
        { date: "2025-12-31", revenue: 200 },
      ];
      // 100 -> 200 over 5 years: (200/100)^(1/5) - 1 = 2^0.2 - 1 ≈ 14.87%
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should calculate CAGR correctly across all available historical years (e.g. 2018 to 2025 = 7 periods)", () => {
      const statements: FinancialStatement[] = [
        { date: "2018-12-31", revenue: 50 },
        { date: "2019-12-31", revenue: 60 },
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: 120 },
        { date: "2022-12-31", revenue: 140 },
        { date: "2023-12-31", revenue: 160 },
        { date: "2024-12-31", revenue: 180 },
        { date: "2025-12-31", revenue: 200 },
      ];
      // 50 (2018) -> 200 (2025) over 7 periods: (200/50)^(1/7) - 1 ≈ 21.90%
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.2190, 4);
    });

    it("should calculate CAGR correctly when revenue increases every year", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: 110 },
        { date: "2022-12-31", revenue: 125 },
        { date: "2023-12-31", revenue: 140 },
        { date: "2024-12-31", revenue: 160 },
        { date: "2025-12-31", revenue: 180 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeGreaterThan(0);
      expect(cagr).toBeCloseTo(0.1247, 4);
    });

    it("should calculate CAGR correctly when revenue decreases every year", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 200 },
        { date: "2021-12-31", revenue: 180 },
        { date: "2022-12-31", revenue: 160 },
        { date: "2023-12-31", revenue: 140 },
        { date: "2024-12-31", revenue: 120 },
        { date: "2025-12-31", revenue: 100 },
      ];
      // 200 -> 100 over 5 years: (100/200)^(1/5) - 1 = 0.5^0.2 - 1 ≈ -12.94%
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeLessThan(0);
      expect(cagr).toBeCloseTo(-0.1294, 4);
    });

    it("should calculate CAGR correctly when revenue fluctuates year-over-year but overall CAGR is positive", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: 80 },
        { date: "2022-12-31", revenue: 120 },
        { date: "2023-12-31", revenue: 110 },
        { date: "2024-12-31", revenue: 150 },
        { date: "2025-12-31", revenue: 200 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeGreaterThan(0);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should calculate CAGR correctly when revenue fluctuates year-over-year but overall CAGR is negative", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 200 },
        { date: "2021-12-31", revenue: 250 },
        { date: "2022-12-31", revenue: 180 },
        { date: "2023-12-31", revenue: 190 },
        { date: "2024-12-31", revenue: 120 },
        { date: "2025-12-31", revenue: 100 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeLessThan(0);
      expect(cagr).toBeCloseTo(-0.1294, 4);
    });

    it("should verify 2019-2025 CAGR for the provided 7-year validation dataset (48.4M in 2019 to 601.8M in 2025 = 52.21%)", () => {
      const statements: FinancialStatement[] = [
        { date: "2019-12-31", revenue: 48400000 },
        { date: "2020-12-31", revenue: 35200000 },
        { date: "2021-12-31", revenue: 62200000 },
        { date: "2022-12-31", revenue: 211000000 },
        { date: "2023-12-31", revenue: 244600000 },
        { date: "2024-12-31", revenue: 436200000 },
        { date: "2025-12-31", revenue: 601800000 },
      ];
      // Beginning (2019): 48.4M, Ending (2025): 601.8M, Periods: 6
      // (601.8 / 48.4)^(1/6) - 1 = 0.5221 (52.21%)
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.5221, 4);
    });
  });

  describe("Zero Revenue Handling", () => {
    it("should return 0 when starting revenue is 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 0 },
        { date: "2025-12-31", revenue: 100 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should return 0 when ending revenue is 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2025-12-31", revenue: 0 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should return 0 when both starting and ending revenue are 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 0 },
        { date: "2025-12-31", revenue: 0 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should calculate CAGR correctly when intermediate years contain 0 revenue", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: 0 },
        { date: "2022-12-31", revenue: 120 },
        { date: "2023-12-31", revenue: 140 },
        { date: "2024-12-31", revenue: 160 },
        { date: "2025-12-31", revenue: 200 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });
  });

  describe("Negative Revenue Handling", () => {
    it("should return 0 when starting revenue is negative", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: -50 },
        { date: "2025-12-31", revenue: 100 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should return 0 when ending revenue is negative", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2025-12-31", revenue: -50 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should return 0 when both starting and ending revenue are negative", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: -100 },
        { date: "2025-12-31", revenue: -50 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should return 0 for transition from negative revenue to positive revenue", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: -20 },
        { date: "2021-12-31", revenue: -10 },
        { date: "2025-12-31", revenue: 100 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should return 0 for transition from positive revenue to negative revenue", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2024-12-31", revenue: 50 },
        { date: "2025-12-31", revenue: -20 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });
  });

  describe("Missing or Invalid Data", () => {
    it("should return 0 for empty revenue array", () => {
      expect(calculateRevenueCAGR([])).toBe(0);
    });

    it("should return 0 for null input", () => {
      expect(calculateRevenueCAGR(null as any)).toBe(0);
    });

    it("should return 0 for undefined input", () => {
      expect(calculateRevenueCAGR(undefined as any)).toBe(0);
    });

    it("should return 0 for fewer than required fiscal years (1 statement)", () => {
      expect(calculateRevenueCAGR([{ date: "2025-12-31", revenue: 100 }])).toBe(0);
    });

    it("should handle missing fiscal years in the middle of dataset", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2025-12-31", revenue: 200 },
      ];
      // 100 -> 200 over 5 years (2020 to 2025 = 5 years)
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should handle revenue values containing null gracefully", () => {
      const statements: any[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: null },
        { date: "2025-12-31", revenue: 200 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should handle revenue values containing undefined gracefully", () => {
      const statements: any[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: undefined },
        { date: "2025-12-31", revenue: 200 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should handle revenue values containing NaN gracefully", () => {
      const statements: any[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: NaN },
        { date: "2025-12-31", revenue: 200 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should sort fiscal years provided out of chronological order", () => {
      const statements: FinancialStatement[] = [
        { date: "2025-12-31", revenue: 200 },
        { date: "2020-12-31", revenue: 100 },
        { date: "2022-12-31", revenue: 140 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });
  });

  describe("Data Validation", () => {
    it("should calculate CAGR correctly with decimal revenue values", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100.5 },
        { date: "2025-12-31", revenue: 201.0 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should calculate CAGR correctly with very large revenue values", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100000000000 },
        { date: "2025-12-31", revenue: 200000000000 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should calculate CAGR correctly with very small positive revenue values", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 0.0001 },
        { date: "2025-12-31", revenue: 0.0002 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should handle duplicate fiscal years safely", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2020-12-31", revenue: 100 },
        { date: "2025-12-31", revenue: 200 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      expect(cagr).toBeCloseTo(0.1487, 4);
    });

    it("should not mutate the input array", () => {
      const statements: FinancialStatement[] = [
        { date: "2025-12-31", revenue: 200 },
        { date: "2020-12-31", revenue: 100 },
      ];
      const originalFirstDate = statements[0].date;
      calculateRevenueCAGR(statements);
      expect(statements[0].date).toBe(originalFirstDate);
    });
  });

  describe("Mathematical Accuracy", () => {
    it("should return 0% CAGR when beginning and ending revenue are equal", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2025-12-31", revenue: 100 },
      ];
      expect(calculateRevenueCAGR(statements)).toBe(0);
    });

    it("should verify correct number of periods is used (5 periods for 6 fiscal years)", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", revenue: 100 },
        { date: "2021-12-31", revenue: 120 },
        { date: "2022-12-31", revenue: 140 },
        { date: "2023-12-31", revenue: 160 },
        { date: "2024-12-31", revenue: 180 },
        { date: "2025-12-31", revenue: 200 },
      ];
      const cagr = calculateRevenueCAGR(statements);
      const expected = Math.pow(200 / 100, 1 / 5) - 1;
      expect(cagr).toBeCloseTo(expected, 6);
    });
  });
});

describe("calculateEPSGrowth", () => {
  describe("Happy Path & 10-Year CAGR Tests", () => {
    it("1. Uses 10-year CAGR when 10 years of valid positive data exists (11 statements, 2015 to 2025)", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", eps: 1.0 },
        { date: "2016-12-31", eps: 1.2 },
        { date: "2017-12-31", eps: 1.5 },
        { date: "2018-12-31", eps: 1.8 },
        { date: "2019-12-31", eps: 2.0 },
        { date: "2020-12-31", eps: 2.3 },
        { date: "2021-12-31", eps: 2.6 },
        { date: "2022-12-31", eps: 3.0 },
        { date: "2023-12-31", eps: 3.4 },
        { date: "2024-12-31", eps: 3.8 },
        { date: "2025-12-31", eps: 4.0 },
      ];
      // (4.0 / 1.0)^(1/10) - 1 = 4^0.1 - 1 ≈ 14.87%
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(0.1487, 4);
    });

    it("2. Uses available maximum period when fewer than 10 years exist (5 periods for 6 statements)", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 2.61 },
        { date: "2021-12-31", eps: 15.67 },
        { date: "2022-12-31", eps: 21.06 },
        { date: "2023-12-31", eps: 14.72 },
        { date: "2024-12-31", eps: 9.89 },
        { date: "2025-12-31", eps: 8.02 },
      ];
      // (8.02 / 2.61)^(1/5) - 1 ≈ 25.17%
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(0.2517, 4);
    });
  });

  describe("EPS CAGR Baseline Selection Tests", () => {
    it("1. Calculates CAGR from first positive EPS year (2020: 0.25 to 2025: 1.18 = ~36.4%)", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", eps: -0.46 },
        { date: "2016-12-31", eps: -0.31 },
        { date: "2017-12-31", eps: -0.79 },
        { date: "2018-12-31", eps: -0.38 },
        { date: "2019-12-31", eps: -0.33 },
        { date: "2020-12-31", eps: 0.25 },
        { date: "2021-12-31", eps: 1.87 },
        { date: "2022-12-31", eps: 4.02 },
        { date: "2023-12-31", eps: 4.73 },
        { date: "2024-12-31", eps: 2.23 },
        { date: "2025-12-31", eps: 1.18 },
      ];
      // First positive EPS year is 2020 (0.25). Ending year is 2025 (1.18).
      // Periods = 5. (1.18 / 0.25)^(1/5) - 1 = 4.72^0.2 - 1 ≈ 36.39% (36.4%)
      const growth = calculateEPSGrowth(statements);
      expect(growth).not.toBeNull();
      expect(growth).toBeCloseTo(0.3639, 3);
    });

    it("2. Negative EPS history followed by positive EPS uses first positive EPS year", () => {
      const statements: FinancialStatement[] = [
        { date: "2018-12-31", eps: -2.0 },
        { date: "2019-12-31", eps: -1.0 },
        { date: "2020-12-31", eps: 0.50 },
        { date: "2021-12-31", eps: 1.00 },
        { date: "2022-12-31", eps: 2.00 },
      ];
      // (2.0 / 0.5)^(1/2) - 1 = 4.0^0.5 - 1 = 2.0 - 1 = 1.0 (100%)
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(1.0, 4);
    });

    it("3. Multiple years of positive EPS uses earliest valid positive EPS year", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", eps: 1.0 },
        { date: "2016-12-31", eps: 1.2 },
        { date: "2017-12-31", eps: 1.5 },
        { date: "2018-12-31", eps: 1.8 },
        { date: "2019-12-31", eps: 2.0 },
        { date: "2020-12-31", eps: 2.3 },
        { date: "2021-12-31", eps: 2.6 },
        { date: "2022-12-31", eps: 3.0 },
        { date: "2023-12-31", eps: 3.4 },
        { date: "2024-12-31", eps: 3.8 },
        { date: "2025-12-31", eps: 4.0 },
      ];
      // 2015 (1.0) to 2025 (4.0) over 10 periods: ~14.87%
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(0.1487, 4);
    });

    it("4. No positive EPS exists: returns null", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: -0.5 },
        { date: "2021-12-31", eps: -0.4 },
        { date: "2022-12-31", eps: -0.3 },
        { date: "2023-12-31", eps: -0.2 },
        { date: "2024-12-31", eps: -0.1 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("5. Positive EPS exists but not enough years: returns null", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: -0.5 },
        { date: "2021-12-31", eps: -0.4 },
        { date: "2022-12-31", eps: -0.3 },
        { date: "2023-12-31", eps: -0.2 },
        { date: "2024-12-31", eps: 0.5 },
      ];
      // Only 1 positive year (2024), periods = 0 -> returns null
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("6. Ending EPS becomes negative again: returns null", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 0.5 },
        { date: "2021-12-31", eps: 1.0 },
        { date: "2022-12-31", eps: 0.8 },
        { date: "2023-12-31", eps: -0.2 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("7. Regression case: Negative history followed by only 1 year of positive EPS returns null CAGR and defers to EPS Trend", () => {
      const statements: FinancialStatement[] = [
        { date: "2024-12-31", eps: 0.30 },
        { date: "2025-12-31", eps: 2.19 },
      ];
      // Only 1 period of positive history (2024 to 2025: n=1 < 2) -> returns null
      expect(calculateEPSGrowth(statements)).toBeNull();

      const trend = calculateEPSTrend(statements);
      expect(trend.trend).toBe("Improving");
      expect(trend.isProfitable).toBe(true);
      expect(trend.score).toBe(100);
    });

    it("8. Regression case: Positive EPS history for 3+ years calculates CAGR normally", () => {
      const statements: FinancialStatement[] = [
        { date: "2022-12-31", eps: 0.50 },
        { date: "2023-12-31", eps: 1.00 },
        { date: "2024-12-31", eps: 1.50 },
        { date: "2025-12-31", eps: 2.00 },
      ];
      // (2.00 / 0.50)^(1/3) - 1 = 4.0^(1/3) - 1 ≈ 58.74%
      const growth = calculateEPSGrowth(statements);
      expect(growth).not.toBeNull();
      expect(growth).toBeCloseTo(0.5874, 4);
    });
  });

  describe("calculateEPSTrend Tests", () => {
    it("1. Positive EPS increasing: Trend = Improving, Score = 100", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 1.0 },
        { date: "2021-12-31", eps: 1.2 },
        { date: "2022-12-31", eps: 1.5 },
        { date: "2025-12-31", eps: 2.0 },
      ];
      const res = calculateEPSTrend(statements);
      expect(res.trend).toBe("Improving");
      expect(res.isProfitable).toBe(true);
      expect(res.score).toBe(100);
    });

    it("2. Positive EPS declining: Trend = Declining, Dynamic Score = 16", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 5.0 },
        { date: "2025-12-31", eps: 1.0 },
      ];
      const res = calculateEPSTrend(statements);
      expect(res.trend).toBe("Declining");
      expect(res.isProfitable).toBe(true);
      expect(res.score).toBe(16);
    });

    it("3. Negative EPS with shrinking losses: Trend = Improving, Dynamic Score = 43 (loss reduction capped under 50)", () => {
      const statements: FinancialStatement[] = [
        { date: "2021-12-31", eps: -2.0 },
        { date: "2022-12-31", eps: -1.5 },
        { date: "2023-12-31", eps: -0.75 },
        { date: "2024-12-31", eps: -0.25 },
      ];
      const res = calculateEPSTrend(statements);
      expect(res.trend).toBe("Improving");
      expect(res.isProfitable).toBe(false);
      expect(res.score).toBe(43);
    });

    it("4. Negative EPS with expanding losses: Trend = Declining, Score = 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2019-12-31", eps: -0.08 },
        { date: "2020-12-31", eps: -0.12 },
        { date: "2021-12-31", eps: -0.26 },
        { date: "2022-12-31", eps: -0.29 },
        { date: "2023-12-31", eps: -0.38 },
        { date: "2024-12-31", eps: -0.38 },
        { date: "2025-12-31", eps: -0.37 },
      ];
      const res = calculateEPSTrend(statements);
      expect(res.trend).toBe("Declining");
      expect(res.isProfitable).toBe(false);
      expect(res.score).toBe(0);
    });

    it("5. Negative EPS staying flat: Trend = Flat, Score = 25", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: -0.5 },
        { date: "2025-12-31", eps: -0.5 },
      ];
      const res = calculateEPSTrend(statements);
      expect(res.trend).toBe("Flat");
      expect(res.score).toBe(25);
    });

    it("6. Regression dataset verification: EPS CAGR = null, EPS TREND = Declining, EPS TREND Score = 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2019-12-31", eps: -0.08 },
        { date: "2020-12-31", eps: -0.12 },
        { date: "2021-12-31", eps: -0.26 },
        { date: "2022-12-31", eps: -0.29 },
        { date: "2023-12-31", eps: -0.38 },
        { date: "2024-12-31", eps: -0.38 },
        { date: "2025-12-31", eps: -0.37 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();

      const trendRes = calculateEPSTrend(statements);
      expect(trendRes.trend).toBe("Declining");
      expect(trendRes.score).toBe(0);
    });

    it("7. Negative EPS to Positive EPS turnaround: Trend = Improving, isProfitable = true, Dynamic Score = 79", () => {
      const statements: FinancialStatement[] = [
        { date: "2018-12-31", eps: -4.67 },
        { date: "2019-12-31", eps: -15.44 },
        { date: "2020-12-31", eps: -7.39 },
        { date: "2021-12-31", eps: -1.39 },
        { date: "2022-12-31", eps: -3.68 },
        { date: "2023-12-31", eps: -1.42 },
        { date: "2024-12-31", eps: 0.30 },
        { date: "2025-12-31", eps: 2.19 },
      ];
      // Only 1 period of positive history (2024 to 2025: n=1 < 2) -> returns null (N/A)
      expect(calculateEPSGrowth(statements)).toBeNull();

      const res = calculateEPSTrend(statements);
      expect(res.trend).toBe("Turnaround");
      expect(res.isProfitable).toBe(true);
      expect(res.score).toBe(79);
    });
  });

  describe("calculateEPSQualityScore Tests", () => {
    it("1. Unprofitable shrinking losses (-111.70 -> -11.81) is capped under 50 (score = 43)", () => {
      const score = calculateEPSQualityScore(-111.70, -11.81);
      expect(score).toBeLessThan(50);
      expect(score).toBe(43);
    });

    it("2. Profitable growing EPS (1.00 -> 2.00) achieves max tier score 100", () => {
      expect(calculateEPSQualityScore(1.00, 2.00)).toBe(100);
    });

    it("3. Profitable declining EPS (5.00 -> 1.00) gets penalized to 16", () => {
      expect(calculateEPSQualityScore(5.00, 1.00)).toBe(16);
    });

    it("4. Turnaround into profitability (-4.67 -> 2.19) gets good tier score 79", () => {
      expect(calculateEPSQualityScore(-4.67, 2.19)).toBe(79);
    });

    it("5. Unprofitable expanding losses (-0.08 -> -0.37) gets score 0", () => {
      expect(calculateEPSQualityScore(-0.08, -0.37)).toBe(0);
    });

    it("6. Unprofitable flat losses (-0.50 -> -0.50) gets capped score 25", () => {
      expect(calculateEPSQualityScore(-0.50, -0.50)).toBe(25);
    });
  });

  describe("Negative EPS Handling Tests", () => {
    it("1. Returns null when beginning EPS is negative", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: -1.0 },
        { date: "2025-12-31", eps: 5.0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("2. Returns null when ending EPS is negative", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 5.0 },
        { date: "2025-12-31", eps: -1.0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("3. Returns null when beginning and ending EPS are both negative", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: -5.0 },
        { date: "2025-12-31", eps: -1.0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("4. Returns null for negative EPS transition to positive EPS", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: -2.0 },
        { date: "2021-12-31", eps: -0.5 },
        { date: "2025-12-31", eps: 3.0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("5. Returns null for positive EPS transition to negative EPS", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 3.0 },
        { date: "2024-12-31", eps: 1.0 },
        { date: "2025-12-31", eps: -0.5 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });
  });

  describe("Zero EPS Handling Tests", () => {
    it("1. Returns null when beginning EPS = 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 0 },
        { date: "2025-12-31", eps: 5.0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("2. Returns null when ending EPS = 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 5.0 },
        { date: "2025-12-31", eps: 0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("3. Returns null when both beginning and ending EPS = 0", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 0 },
        { date: "2025-12-31", eps: 0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });
  });

  describe("Data Range Tests", () => {
    it("1. Uses up to 10 years of EPS history (11 statements, 2015 to 2025)", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", eps: 1.0 },
        { date: "2016-12-31", eps: 1.2 },
        { date: "2017-12-31", eps: 1.5 },
        { date: "2018-12-31", eps: 1.8 },
        { date: "2019-12-31", eps: 2.0 },
        { date: "2020-12-31", eps: 2.3 },
        { date: "2021-12-31", eps: 2.6 },
        { date: "2022-12-31", eps: 3.0 },
        { date: "2023-12-31", eps: 3.4 },
        { date: "2024-12-31", eps: 3.8 },
        { date: "2025-12-31", eps: 4.0 },
      ];
      // (4.0 / 1.0)^(1/10) - 1 ≈ 14.87%
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(0.1487, 4);
    });

    it("2. Uses earliest valid positive EPS year when older negative EPS years exist", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", eps: -5.0 },
        { date: "2016-12-31", eps: -2.0 },
        { date: "2020-12-31", eps: 2.61 },
        { date: "2021-12-31", eps: 3.5 },
        { date: "2022-12-31", eps: 4.5 },
        { date: "2023-12-31", eps: 5.5 },
        { date: "2024-12-31", eps: 6.5 },
        { date: "2025-12-31", eps: 8.02 },
      ];
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(0.2517, 4);
    });

    it("3. Correctly calculates growth periods (2020 -> 2025 equals 5 periods)", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 2.61 },
        { date: "2021-12-31", eps: 3.0 },
        { date: "2022-12-31", eps: 4.0 },
        { date: "2023-12-31", eps: 5.0 },
        { date: "2024-12-31", eps: 6.0 },
        { date: "2025-12-31", eps: 8.02 },
      ];
      const growth = calculateEPSGrowth(statements);
      const expected = Math.pow(8.02 / 2.61, 1 / 5) - 1;
      expect(growth).toBeCloseTo(expected, 6);
    });

    it("4. Returns null when there are insufficient years of data", () => {
      expect(calculateEPSGrowth([])).toBeNull();
      expect(calculateEPSGrowth([{ date: "2025-12-31", eps: 8.02 }])).toBeNull();
    });
  });

  describe("Invalid Data Tests", () => {
    it("should return null for null input", () => {
      expect(calculateEPSGrowth(null as any)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(calculateEPSGrowth(undefined as any)).toBeNull();
    });

    it("should return null for empty array input", () => {
      expect(calculateEPSGrowth([])).toBeNull();
    });

    it("should return null when eps value is null", () => {
      const statements: any[] = [
        { date: "2020-12-31", eps: null },
        { date: "2025-12-31", eps: 8.02 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("should return null when eps value is undefined", () => {
      const statements: any[] = [
        { date: "2020-12-31", eps: undefined },
        { date: "2025-12-31", eps: 8.02 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("should return null when eps value is NaN", () => {
      const statements: any[] = [
        { date: "2020-12-31", eps: NaN },
        { date: "2025-12-31", eps: 8.02 },
      ];
      expect(calculateEPSGrowth(statements)).toBeNull();
    });

    it("should handle fiscal years out of chronological order correctly", () => {
      const statements: FinancialStatement[] = [
        { date: "2025-12-31", eps: 8.02 },
        { date: "2020-12-31", eps: 2.61 },
      ];
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(0.2517, 4);
    });

    it("should handle duplicate fiscal years safely", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 2.61 },
        { date: "2020-12-31", eps: 2.61 },
        { date: "2025-12-31", eps: 8.02 },
      ];
      const growth = calculateEPSGrowth(statements);
      expect(growth).toBeCloseTo(0.2517, 4);
    });

    it("should not mutate the input array", () => {
      const statements: FinancialStatement[] = [
        { date: "2025-12-31", eps: 8.02 },
        { date: "2020-12-31", eps: 2.61 },
      ];
      const originalFirstDate = statements[0].date;
      calculateEPSGrowth(statements);
      expect(statements[0].date).toBe(originalFirstDate);
    });
  });

  describe("Mathematical Accuracy Tests", () => {
    it("should return 0% CAGR when beginning EPS equals ending EPS", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 5.0 },
        { date: "2025-12-31", eps: 5.0 },
      ];
      expect(calculateEPSGrowth(statements)).toBe(0);
    });

    it("should calculate CAGR correctly with decimal EPS values", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 2.61 },
        { date: "2025-12-31", eps: 8.02 },
      ];
      expect(calculateEPSGrowth(statements)).toBeCloseTo(0.2517, 4);
    });

    it("should calculate CAGR correctly with large EPS values", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 100.0 },
        { date: "2025-12-31", eps: 200.0 },
      ];
      expect(calculateEPSGrowth(statements)).toBeCloseTo(0.1487, 4);
    });

    it("should calculate CAGR correctly with very small positive EPS values", () => {
      const statements: FinancialStatement[] = [
        { date: "2020-12-31", eps: 0.01 },
        { date: "2025-12-31", eps: 0.02 },
      ];
      expect(calculateEPSGrowth(statements)).toBeCloseTo(0.1487, 4);
    });
  });
});

describe("calculateFCF", () => {
  it("should calculate FCF = Operating Cash Flow - CapEx", () => {
    expect(calculateFCF(1000, 200)).toBe(800);
    expect(calculateFCF(1000, 0)).toBe(1000);
    expect(calculateFCF(1000, undefined)).toBeNull();
    expect(calculateFCF(undefined, 200)).toBeNull();
  });
});

describe("calculateFCFGrowth", () => {
  it("1. Positive growth: should calculate positive CAGR when FCF increases (e.g. 100 to 200 over 10 years)", () => {
    const statements: FinancialStatement[] = [
      { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
      { date: "2016-12-31", operatingCashFlow: 110, capitalExpenditure: 0 },
      { date: "2017-12-31", operatingCashFlow: 120, capitalExpenditure: 0 },
      { date: "2018-12-31", operatingCashFlow: 130, capitalExpenditure: 0 },
      { date: "2019-12-31", operatingCashFlow: 140, capitalExpenditure: 0 },
      { date: "2020-12-31", operatingCashFlow: 150, capitalExpenditure: 0 },
      { date: "2021-12-31", operatingCashFlow: 160, capitalExpenditure: 0 },
      { date: "2022-12-31", operatingCashFlow: 170, capitalExpenditure: 0 },
      { date: "2023-12-31", operatingCashFlow: 180, capitalExpenditure: 0 },
      { date: "2024-12-31", operatingCashFlow: 190, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: 200, capitalExpenditure: 0 },
    ];
    // 100 -> 200 over 10 years: (200/100)^(1/10) - 1 = 2^0.1 - 1 ≈ +7.18%
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBeGreaterThan(0);
    expect(cagr!).toBeCloseTo(0.07177, 3);
  });

  it("2. Declining FCF: should calculate negative CAGR approx -5.93% when FCF declines from 924.0 to 501.5 over 10 years", () => {
    const statements: FinancialStatement[] = [
      { date: "2015-12-31", operatingCashFlow: 924.0, capitalExpenditure: 0 },
      { date: "2016-12-31", operatingCashFlow: 850.0, capitalExpenditure: 0 },
      { date: "2017-12-31", operatingCashFlow: 800.0, capitalExpenditure: 0 },
      { date: "2018-12-31", operatingCashFlow: 750.0, capitalExpenditure: 0 },
      { date: "2019-12-31", operatingCashFlow: 700.0, capitalExpenditure: 0 },
      { date: "2020-12-31", operatingCashFlow: 650.0, capitalExpenditure: 0 },
      { date: "2021-12-31", operatingCashFlow: 600.0, capitalExpenditure: 0 },
      { date: "2022-12-31", operatingCashFlow: 580.0, capitalExpenditure: 0 },
      { date: "2023-12-31", operatingCashFlow: 550.0, capitalExpenditure: 0 },
      { date: "2024-12-31", operatingCashFlow: 520.0, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: 501.5, capitalExpenditure: 0 },
    ];
    // (501.5 / 924.0)^(1/10) - 1 = 0.940718 - 1 = -5.93%
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBeLessThan(0);
    expect(cagr!).toBeCloseTo(-0.05928, 3);
  });

  it("3. No change: should return 0% CAGR when beginning FCF equals ending FCF (100 to 100)", () => {
    const statements: FinancialStatement[] = [
      { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
    ];
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBe(0);
  });

  it("4. Invalid inputs: should return null when no positive beginning FCF exists or ending FCF is <= 0", () => {
    const zeroBeginning: FinancialStatement[] = [
      { date: "2015-12-31", operatingCashFlow: 0, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
    ];
    const negativeEnding: FinancialStatement[] = [
      { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: -50, capitalExpenditure: 0 },
    ];
    expect(calculateFCFGrowth([])).toBeNull();
    expect(calculateFCFGrowth(zeroBeginning)).toBeNull();
    expect(calculateFCFGrowth(negativeEnding)).toBeNull();
  });

  it("5. Baseline selection strategy: uses first positive FCF year (2020: 100M to 2025: 600M over 5 years = ~43.10%)", () => {
    const statements: FinancialStatement[] = [
      { date: "2019-12-31", operatingCashFlow: -500, capitalExpenditure: 0 },
      { date: "2020-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: 600, capitalExpenditure: 0 },
    ];
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBeCloseTo(0.43096, 4); // (600 / 100)^(1/5) - 1 = 43.10%
  });

  it("6. Insufficient positive FCF history (< 3 years): returns null", () => {
    const statements: FinancialStatement[] = [
      { date: "2023-12-31", operatingCashFlow: -500, capitalExpenditure: 0 },
      { date: "2024-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: 200, capitalExpenditure: 0 },
    ];
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).toBeNull(); // period is 2024 -> 2025 (1 year) < 3 years
  });

  describe("calculateFCFTrend & Fallback Handling", () => {
    it("Test 1: Positive FCF growth (100M -> 200M) uses CAGR and returns Improving trend", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 200, capitalExpenditure: 0 },
      ];
      expect(calculateFCFGrowth(statements)).not.toBeNull();
      const trendData = calculateFCFTrend(statements);
      expect(trendData.trend).toBe("Improving");
      expect(trendData.isPositive).toBe(true);
      expect(trendData.score).toBeGreaterThanOrEqual(80);
    });

    it("Test 2: Negative FCF worsening (-50M -> -200M) does not use CAGR and returns deteriorating burn trend", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -50, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -200, capitalExpenditure: 0 },
      ];
      expect(calculateFCFGrowth(statements)).toBeNull();
      const trendData = calculateFCFTrend(statements);
      expect(trendData.trend).toBe("Deteriorating");
      expect(trendData.isPositive).toBe(false);
      expect(trendData.score).toBe(0);
      expect(trendData.burnChangePct).toBeCloseTo(-300, 1);
    });

    it("Test 3: Negative FCF improving (-200M -> -50M) returns improving burn trend (+75%)", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -200, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -50, capitalExpenditure: 0 },
      ];
      expect(calculateFCFGrowth(statements)).toBeNull();
      const trendData = calculateFCFTrend(statements);
      expect(trendData.trend).toBe("Improving");
      expect(trendData.isPositive).toBe(false);
      expect(trendData.score).toBeGreaterThanOrEqual(25);
      expect(trendData.burnChangePct).toBeCloseTo(75, 1);
    });

    it("Test 4: Negative to positive FCF (-100M -> 50M) returns turnaround classification and +150% improvement", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -100, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 50, capitalExpenditure: 0 },
      ];
      expect(calculateFCFGrowth(statements)).toBeNull();
      const trendData = calculateFCFTrend(statements);
      expect(trendData.trend).toBe("Turnaround");
      expect(trendData.isPositive).toBe(true);
      expect(trendData.score).toBe(75);
      expect(trendData.burnChangePct).toBeCloseTo(150, 1);
    });

    it("Test 4b: Verifies prompt turnaround example (-2.2B -> +6.2B = +381.82% improvement)", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -2200000000, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 6200000000, capitalExpenditure: 0 },
      ];
      expect(calculateFCFGrowth(statements)).toBeNull();
      const trendData = calculateFCFTrend(statements);
      expect(trendData.trend).toBe("Turnaround");
      expect(trendData.isPositive).toBe(true);
      expect(trendData.burnChangePct).toBeCloseTo(381.82, 2);
    });

    it("Test 5: Positive to negative FCF (100M -> -50M) returns deterioration classification and -150% deterioration", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -50, capitalExpenditure: 0 },
      ];
      expect(calculateFCFGrowth(statements)).toBeNull();
      const trendData = calculateFCFTrend(statements);
      expect(trendData.trend).toBe("Deteriorating");
      expect(trendData.isPositive).toBe(false);
      expect(trendData.score).toBe(0);
      expect(trendData.burnChangePct).toBeCloseTo(-150, 1);
    });

    it("Verifies prompt example (-45.9M -> -321.8M = -601.09% cash burn deterioration)", () => {
      const statements: FinancialStatement[] = [
        { date: "2019-12-31", operatingCashFlow: -45.9, capitalExpenditure: 0 },
        { date: "2020-12-31", operatingCashFlow: -52.9, capitalExpenditure: 0 },
        { date: "2021-12-31", operatingCashFlow: -97.5, capitalExpenditure: 0 },
        { date: "2022-12-31", operatingCashFlow: -148.9, capitalExpenditure: 0 },
        { date: "2023-12-31", operatingCashFlow: -153.6, capitalExpenditure: 0 },
        { date: "2024-12-31", operatingCashFlow: -116.0, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -321.8, capitalExpenditure: 0 },
      ];
      expect(calculateFCFGrowth(statements)).toBeNull();
      const trendData = calculateFCFTrend(statements);
      expect(trendData.trend).toBe("Deteriorating");
      expect(trendData.score).toBe(0);
      expect(trendData.burnChangePct).toBeCloseTo(-601.09, 1);
    });

    it("Test 1 (Formula): Positive -> Positive FCF uses FCF CAGR formula", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 200, capitalExpenditure: 0 },
      ];
      const formula = getFCFFormula(statements, 0.0718);
      expect(formula).toBe("FCF CAGR = (Ending FCF / Beginning FCF) ^ (1 / n) - 1");
    });

    it("Test 2 (Formula): Negative -> Negative FCF uses Cash Burn Change % formula", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -50, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -200, capitalExpenditure: 0 },
      ];
      const formula = getFCFFormula(statements, null);
      expect(formula).toBe("Cash Burn Change % = ((ABS(Beginning FCF) - ABS(Ending FCF)) / ABS(Beginning FCF)) * 100");
    });

    it("Test 3 (Formula): Negative -> Positive FCF uses FCF Improvement % formula (-2.2B -> +6.2B = +381.82%)", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -2200000000, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 6200000000, capitalExpenditure: 0 },
      ];
      const formula = getFCFFormula(statements, null);
      expect(formula).toBe("FCF Improvement % = ((Ending FCF - Beginning FCF) / ABS(Beginning FCF)) * 100");
    });

    it("Test 4 (Formula): Positive -> Negative FCF uses FCF Deterioration % formula", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -50, capitalExpenditure: 0 },
      ];
      const formula = getFCFFormula(statements, null);
      expect(formula).toBe("FCF Deterioration % = ((Ending FCF - Beginning FCF) / Beginning FCF) * 100");
    });
  });
});

describe("calculateDividendCAGR", () => {
  it("should return null for empty or single year dividend data", () => {
    expect(calculateDividendCAGR([])).toBeNull();
    expect(
      calculateDividendCAGR([{ date: "2024-03-15", dividend: 0.5 }]),
    ).toBeNull();
  });

  it("should sum annual dividends and calculate CAGR", () => {
    const dividends: FinancialStatement[] = [
      { date: "2022-03-15", dividend: 0.5 },
      { date: "2022-09-15", dividend: 0.5 }, // 2022 total: 1.0
      { date: "2023-03-15", dividend: 0.75 },
      { date: "2023-09-15", dividend: 0.75 }, // 2023 total: 1.5
      { date: "2024-03-15", dividend: 1.0 },
      { date: "2024-09-15", dividend: 1.0 }, // 2024 total: 2.0
    ];
    // 1.0 -> 2.0 over 2 years: (2.0/1.0)^(1/2) - 1 = sqrt(2) - 1 ≈ 41.42%
    const cagr = calculateDividendCAGR(dividends);
    expect(cagr).toBeCloseTo(0.4142, 4);
  });
});

describe("calculateROIC & calculateAverageROIC", () => {
  it("should calculate ROIC correctly with tax rate estimation", () => {
    // OpIncome: 1000, NetIncome: 750 (Tax rate = 25%), Invested Capital: 5000
    // NOPAT = 1000 * 0.75 = 750. ROIC = (750 / 5000) * 100 = 15%
    const roic = calculateROIC(1000, 750, 5000);
    expect(roic).toBe(15);
  });

  it("should return null if invested capital <= 0 or operating income missing", () => {
    expect(calculateROIC(undefined, 750, 5000)).toBeNull();
    expect(calculateROIC(1000, 750, 0)).toBeNull();
    expect(calculateROIC(1000, 750, -500)).toBeNull();
  });

  it("should calculate average ROIC from latest income & balance statements", () => {
    const income: FinancialStatement[] = [
      { date: "2024-12-31", operatingIncome: 1000, netIncome: 750 },
    ];
    const balance: FinancialStatement[] = [
      { date: "2024-12-31", totalEquity: 3000, totalDebt: 2000 },
    ];
    // Invested capital = 5000. ROIC = 15%
    const avgRoic = calculateAverageROIC(income, balance);
    expect(avgRoic).toBe(15);
  });
});

describe("calculateDebtToEquity", () => {
  it("should calculate debt to equity ratio", () => {
    expect(calculateDebtToEquity(500, 1000)).toBe(0.5);
    expect(calculateDebtToEquity(1000, 500)).toBe(2.0);
  });

  it("should return null if equity is missing, undefined or zero", () => {
    expect(calculateDebtToEquity(500, 0)).toBeNull();
    expect(calculateDebtToEquity(undefined, 1000)).toBeNull();
    expect(calculateDebtToEquity(500, undefined)).toBeNull();
  });
});

describe("calculateMargins & calculateAverageMargins", () => {
  it("should calculate gross, operating, and net margins for a statement", () => {
    const statement: FinancialStatement = {
      date: "2024-12-31",
      revenue: 1000,
      grossProfit: 400,
      operatingIncome: 200,
      netIncome: 150,
    };
    const margins = calculateMargins(statement);
    expect(margins.grossMargin).toBe(40);
    expect(margins.operatingMargin).toBe(20);
    expect(margins.netMargin).toBe(15);
  });

  it("should calculate average margins across all available statements", () => {
    const statements: FinancialStatement[] = [
      { date: "2024-12-31", revenue: 1000, grossProfit: 400, operatingIncome: 200, netIncome: 100 },
      { date: "2023-12-31", revenue: 1000, grossProfit: 500, operatingIncome: 300, netIncome: 200 },
    ];
    const avg = calculateAverageMargins(statements);
    expect(avg.grossMargin).toBe(45);
    expect(avg.operatingMargin).toBe(25);
    expect(avg.netMargin).toBe(15);
  });
});

describe("calculateAllMetrics", () => {
  it("should compile all financial metrics into an object", () => {
    const income: FinancialStatement[] = [
      { date: "2024-12-31", revenue: 2000, eps: 2.0, grossProfit: 800, operatingIncome: 400, netIncome: 300 },
      { date: "2020-12-31", revenue: 1000, eps: 1.0, grossProfit: 400, operatingIncome: 200, netIncome: 150 },
    ];
    const balance: FinancialStatement[] = [
      { date: "2024-12-31", totalEquity: 2000, totalDebt: 1000 },
    ];
    const cashFlow: FinancialStatement[] = [
      { date: "2024-12-31", operatingCashFlow: 500, capitalExpenditure: 100 },
      { date: "2020-12-31", operatingCashFlow: 250, capitalExpenditure: 50 },
    ];
    const dividendMetrics: DividendMetrics = {
      dividendYield: 0.02,
      dividendPerShare: 1.5,
      dividendPayoutRatio: 0.3,
    };

    const metrics = calculateAllMetrics(income, balance, cashFlow, dividendMetrics);

    expect(metrics.revenueCAGR).toBeGreaterThan(0);
    expect(metrics.epsGrowth).toBeGreaterThan(0);
    expect(metrics.fcfGrowth).toBeGreaterThan(0);
    expect(metrics.debtToEquity).toBe(0.5);
    expect(metrics.dividendYield).toBe(0.02);
  });
});
