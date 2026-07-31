import { describe, it, expect } from "vitest";
import {
  calculateCAGR,
  calculateRevenueCAGR,
  calculateEPSGrowth,
  calculateFCF,
  calculateFCFGrowth,
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
  it("should return null for insufficient statement data", () => {
    expect(calculateRevenueCAGR([])).toBeNull();
    expect(calculateRevenueCAGR([{ date: "2024-12-31", revenue: 1000 }])).toBeNull();
  });

  it("should calculate revenue CAGR across chronological dates", () => {
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", revenue: 1000 },
      { date: "2021-12-31", revenue: 1200 },
      { date: "2022-12-31", revenue: 1400 },
      { date: "2023-12-31", revenue: 1600 },
      { date: "2024-12-31", revenue: 2000 },
    ];
    // 1000 -> 2000 over 4 years: (2000/1000)^(1/4) - 1 = 2^0.25 - 1 ≈ 18.92%
    const cagr = calculateRevenueCAGR(statements);
    expect(cagr).toBeCloseTo(0.1892, 4);
  });

  it("should return null if first or last revenue is <= 0 or missing", () => {
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", revenue: 0 },
      { date: "2024-12-31", revenue: 2000 },
    ];
    expect(calculateRevenueCAGR(statements)).toBeNull();
  });
});

describe("calculateEPSGrowth", () => {
  it("should calculate EPS growth CAGR correctly", () => {
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", eps: 1.0 },
      { date: "2021-12-31", eps: 1.2 },
      { date: "2022-12-31", eps: 1.4 },
      { date: "2023-12-31", eps: 1.6 },
      { date: "2024-12-31", eps: 2.0 },
    ];
    // 1.0 -> 2.0 over 4 years: ~18.92%
    const growth = calculateEPSGrowth(statements);
    expect(growth).toBeCloseTo(0.1892, 4);
  });

  it("should return null for negative starting EPS values", () => {
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", eps: -0.5 },
      { date: "2024-12-31", eps: 2.0 },
    ];
    expect(calculateEPSGrowth(statements)).toBeNull();
  });

  it("should return null for negative ending EPS values", () => {
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", eps: 2.0 },
      { date: "2024-12-31", eps: -0.5 },
    ];
    expect(calculateEPSGrowth(statements)).toBeNull();
  });

  it("should return null when both starting and ending EPS are negative", () => {
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", eps: -1.5 },
      { date: "2024-12-31", eps: -0.5 },
    ];
    expect(calculateEPSGrowth(statements)).toBeNull();
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
  it("should calculate positive growth CAGR over 5 years (6 data points)", () => {
    // $8B -> $96B over 5 years
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", operatingCashFlow: 8000000000, capitalExpenditure: 0 },
      { date: "2021-12-31", operatingCashFlow: 15000000000, capitalExpenditure: 0 },
      { date: "2022-12-31", operatingCashFlow: 30000000000, capitalExpenditure: 0 },
      { date: "2023-12-31", operatingCashFlow: 50000000000, capitalExpenditure: 0 },
      { date: "2024-12-31", operatingCashFlow: 70000000000, capitalExpenditure: 0 },
      { date: "2025-12-31", operatingCashFlow: 96000000000, capitalExpenditure: 0 },
    ];
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).toBeCloseTo(0.6438, 4);
  });

  it("should return null for empty or insufficient statement history", () => {
    expect(calculateFCFGrowth([])).toBeNull();
    expect(calculateFCFGrowth([{ date: "2024-12-31", operatingCashFlow: 100 }])).toBeNull();
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
