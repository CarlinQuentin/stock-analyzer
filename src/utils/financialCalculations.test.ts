import { describe, it, expect } from "vitest";
import { calculateFCFGrowth, calculateCAGR } from "./financialCalculations";
import { FinancialStatement } from "../types";

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

describe("calculateFCFGrowth", () => {
  it("should calculate positive growth CAGR over 5 years (6 data points)", () => {
    // $8B -> $96B over 5 years
    const statements: FinancialStatement[] = [
      {
        date: "2020-12-31",
        operatingCashFlow: 8000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2021-12-31",
        operatingCashFlow: 15000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2022-12-31",
        operatingCashFlow: 30000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2023-12-31",
        operatingCashFlow: 50000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2024-12-31",
        operatingCashFlow: 70000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2025-12-31",
        operatingCashFlow: 96000000000,
        capitalExpenditure: 0,
      },
    ];
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).toBeCloseTo(0.6438, 4);
  });

  it("should calculate declining growth CAGR over 5 years", () => {
    // $8.34B -> $3.846B over 5 years
    const statements: FinancialStatement[] = [
      {
        date: "2020-12-31",
        operatingCashFlow: 8340000000,
        capitalExpenditure: 0,
      },
      {
        date: "2021-12-31",
        operatingCashFlow: 7000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2022-12-31",
        operatingCashFlow: 6000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2023-12-31",
        operatingCashFlow: 5000000000,
        capitalExpenditure: 0,
      },
      {
        date: "2024-12-31",
        operatingCashFlow: 4500000000,
        capitalExpenditure: 0,
      },
      {
        date: "2025-12-31",
        operatingCashFlow: 3846000000,
        capitalExpenditure: 0,
      },
    ];
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).toBeCloseTo(-0.1434, 4);
  });

  it("should handle negative starting FCF safely by filtering it out or returning null", () => {
    // If starting value is negative (-$496.3M) and ending value is positive ($597.3M)
    // Scenario A: No other positive years. Returns null.
    const statementsA: FinancialStatement[] = [
      {
        date: "2020-12-31",
        operatingCashFlow: -496300000,
        capitalExpenditure: 0,
      },
      {
        date: "2021-12-31",
        operatingCashFlow: -300000000,
        capitalExpenditure: 0,
      },
      {
        date: "2022-12-31",
        operatingCashFlow: -200000000,
        capitalExpenditure: 0,
      },
      {
        date: "2023-12-31",
        operatingCashFlow: -100000000,
        capitalExpenditure: 0,
      },
      {
        date: "2024-12-31",
        operatingCashFlow: 597300000,
        capitalExpenditure: 0,
      },
    ];
    expect(calculateFCFGrowth(statementsA)).toBeNull();

    // Scenario B: Has some positive years. Filters out negative years and calculates CAGR over positive subset.
    const statementsB: FinancialStatement[] = [
      {
        date: "2020-12-31",
        operatingCashFlow: -496300000,
        capitalExpenditure: 0,
      },
      {
        date: "2021-12-31",
        operatingCashFlow: 100000000,
        capitalExpenditure: 0,
      }, // First positive year: $100M
      {
        date: "2022-12-31",
        operatingCashFlow: 200000000,
        capitalExpenditure: 0,
      },
      {
        date: "2023-12-31",
        operatingCashFlow: 400000000,
        capitalExpenditure: 0,
      },
      {
        date: "2024-12-31",
        operatingCashFlow: 597300000,
        capitalExpenditure: 0,
      }, // Last positive year: $597.3M (4 data points, 3 years)
    ];
    const cagr = calculateFCFGrowth(statementsB);
    expect(cagr).toBeCloseTo(0.8144, 4); // ((597.3 / 100) ^ (1/3)) - 1 = 5.973^0.333 - 1 ≈ 81.44%
  });

  it("should calculate 0% growth CAGR when values are constant", () => {
    const statements: FinancialStatement[] = [
      { date: "2020-12-31", operatingCashFlow: 5000000, capitalExpenditure: 0 },
      { date: "2021-12-31", operatingCashFlow: 5000000, capitalExpenditure: 0 },
      { date: "2022-12-31", operatingCashFlow: 5000000, capitalExpenditure: 0 },
      { date: "2023-12-31", operatingCashFlow: 5000000, capitalExpenditure: 0 },
      { date: "2024-12-31", operatingCashFlow: 5000000, capitalExpenditure: 0 },
    ];
    const cagr = calculateFCFGrowth(statements);
    expect(cagr).toBe(0);
  });

  it("should handle invalid data and insufficient history safely", () => {
    // Empty statements
    expect(calculateFCFGrowth([])).toBeNull();

    // Insufficient statements (only 1)
    expect(
      calculateFCFGrowth([
        {
          date: "2024-12-31",
          operatingCashFlow: 5000000,
          capitalExpenditure: 0,
        },
      ]),
    ).toBeNull();

    // Statements with missing / undefined values
    expect(
      calculateFCFGrowth([
        {
          date: "2023-12-31",
          operatingCashFlow: undefined,
          capitalExpenditure: 0,
        },
        {
          date: "2024-12-31",
          operatingCashFlow: 5000000,
          capitalExpenditure: undefined,
        },
      ]),
    ).toBeNull();
  });
});
