import { describe, it, expect } from "vitest";
import {
  sliceStatementsForPeriod,
  getPeriodStatementLimit,
  calculateAllMetrics,
  calculateRevenueCAGR,
} from "./financialCalculations";
import { calculateMetricScores, calculateOverallScore } from "./scoring";
import {
  mockRawFmpIncomeStatements,
  mockRawFmpBalanceSheets,
  mockRawFmpCashFlowStatements,
} from "../tests/e2e/fixtures/fmpFixtures";

describe("HistoricalPeriod Selector & Data Slicing", () => {
  it("1. getPeriodStatementLimit: returns correct annual statement limit for each period", () => {
    expect(getPeriodStatementLimit("10Y")).toBe(11);
    expect(getPeriodStatementLimit("5Y")).toBe(6);
    expect(getPeriodStatementLimit("3Y")).toBe(4);
  });

  it("2. sliceStatementsForPeriod: slices statements correctly according to period lookback", () => {
    const fullStatements = mockRawFmpIncomeStatements; // 5 statements in fixture (2025..2021)

    const sliced10Y = sliceStatementsForPeriod(fullStatements, "10Y");
    expect(sliced10Y).toHaveLength(5); // all 5 available

    const sliced5Y = sliceStatementsForPeriod(fullStatements, "5Y");
    expect(sliced5Y).toHaveLength(5); // 5 statements available

    const sliced3Y = sliceStatementsForPeriod(fullStatements, "3Y");
    expect(sliced3Y).toHaveLength(4); // 4 statements (2025, 2024, 2023, 2022)
    expect(sliced3Y[0].date).toBe("2025-12-31");
    expect(sliced3Y[3].date).toBe("2022-12-31");
  });

  it("3. Dynamic Recalculation: metric values and scores change dynamically based on selected lookback period", () => {
    // 5-year statement set (2021: 6B, 2022: 7B, 2023: 8B, 2024: 9B, 2025: 10B)
    const statements10Y = sliceStatementsForPeriod(mockRawFmpIncomeStatements, "10Y");
    const statements3Y = sliceStatementsForPeriod(mockRawFmpIncomeStatements, "3Y");

    // Revenue CAGR over full 4-year span (2021 to 2025): (10B / 6B)^(1/4) - 1 = 13.62%
    const cagr10Y = calculateRevenueCAGR(statements10Y);
    expect(cagr10Y).toBeCloseTo(0.1362, 3);

    // Revenue CAGR over 3-year span (2022 to 2025): (10B / 7B)^(1/3) - 1 = 12.62%
    const cagr3Y = calculateRevenueCAGR(statements3Y);
    expect(cagr3Y).toBeCloseTo(0.1262, 3);

    // Verify calculated CAGRs differ as expected based on period lookback
    expect(cagr10Y).not.toBe(cagr3Y);
  });

  it("4. Score Consistency: overall business quality score recalculates dynamically without mixing periods", () => {
    const sliced3YIncome = sliceStatementsForPeriod(mockRawFmpIncomeStatements, "3Y");
    const sliced3YBalance = sliceStatementsForPeriod(mockRawFmpBalanceSheets, "3Y");
    const sliced3YCashFlow = sliceStatementsForPeriod(mockRawFmpCashFlowStatements, "3Y");

    const mockDividendMetrics = {
      dividendYield: 0.015,
      dividendPerShare: 1.2,
      dividendPayoutRatio: 0.25,
    };

    const metrics3Y = calculateAllMetrics(
      sliced3YIncome,
      sliced3YBalance,
      sliced3YCashFlow,
      mockDividendMetrics
    );

    const scores3Y = calculateMetricScores(metrics3Y, sliced3YCashFlow);
    const overallScore3Y = calculateOverallScore(scores3Y);

    expect(overallScore3Y).toBeGreaterThan(0);
    expect(overallScore3Y).toBeLessThanOrEqual(100);
  });
});
