import { describe, it, expect } from "vitest";
import {
  calculateROICAnalysis,
  calculateROICAverageForPeriod,
} from "./financialCalculations";
import { scoreROIC } from "./scoring";
import { FinancialStatement } from "../types";

function mockFinancialStatements(roicList: number[]): {
  incomeStatements: FinancialStatement[];
  balanceSheets: FinancialStatement[];
} {
  const baseYear = 2025;
  const incomeStatements: FinancialStatement[] = [];
  const balanceSheets: FinancialStatement[] = [];

  roicList.forEach((roic, i) => {
    const year = (baseYear - i).toString();
    const date = `${year}-12-31`;
    const opInc = roic / 0.79;

    incomeStatements.push({
      date,
      operatingIncome: opInc,
      netIncome: opInc * 0.79,
    });

    balanceSheets.push({
      date,
      totalEquity: 60,
      totalDebt: 40,
    });
  });

  return { incomeStatements, balanceSheets };
}

describe("ROIC Period-Selector Quality & Scoring System", () => {
  it("1. Responds to Period Selector (10Y / 5Y / 3Y)", () => {
    // 5 years of historical ROIC: 25%, 22%, 20%, 18%, 15%
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      25, 22, 20, 18, 15,
    ]);

    const res10Y = calculateROICAnalysis(incomeStatements, balanceSheets, "10Y");
    const res5Y = calculateROICAnalysis(incomeStatements, balanceSheets, "5Y");
    const res3Y = calculateROICAnalysis(incomeStatements, balanceSheets, "3Y");

    expect(res10Y.periodLabel).toBe("10-Year Average");
    expect(res5Y.periodLabel).toBe("5-Year Average");
    expect(res3Y.periodLabel).toBe("3-Year Average");

    expect(res3Y.averageROIC).toBeCloseTo(22.33, 1); // (25 + 22 + 20)/3
    expect(res5Y.averageROIC).toBeCloseTo(20.0, 1);  // (25 + 22 + 20 + 18 + 15)/5
  });

  it("2. Consistently High ROIC Company: receives top score approaching 20 points", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      20, 21, 19, 22, 20,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets, "10Y");

    expect(analysis.consistency).toBe("Highly Consistent");
    expect(analysis.averageROIC).toBeCloseTo(20.4, 1);
    expect(analysis.totalROICPoints).toBeGreaterThanOrEqual(16.0);
    expect(analysis.totalROICPoints).toBeLessThanOrEqual(20.0);
  });

  it("3. Volatile ROIC Company: penalized for inconsistency despite high average", () => {
    const consistent = mockFinancialStatements([20, 21, 19, 22, 20]);
    const analysisA = calculateROICAnalysis(consistent.incomeStatements, consistent.balanceSheets, "5Y");

    const volatile = mockFinancialStatements([5, 40, 8, 35, 12]);
    const analysisB = calculateROICAnalysis(volatile.incomeStatements, volatile.balanceSheets, "5Y");

    expect(analysisB.consistency).toBe("Inconsistent");
    expect(analysisB.consistencyScorePoints).toBeLessThan(analysisA.consistencyScorePoints);
    expect(analysisB.totalROICPoints).toBeLessThan(analysisA.totalROICPoints);
  });

  it("4. Improving ROIC Company over selected period: receives high trend score", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      25, 21, 17, 14, 12,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets, "5Y");

    expect(analysis.trend).toBe("Improving");
    expect(analysis.trendScorePoints).toBeGreaterThanOrEqual(3.5);
  });

  it("5. Deteriorating ROIC Company over selected period: receives low trend score", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      12, 14, 17, 21, 25,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets, "5Y");

    expect(analysis.trend).toBe("Declining");
    expect(analysis.trendScorePoints).toBeLessThan(2.0);
  });

  it("6. Insufficient Data Fallback: returns null when years are below minRequired", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([18.5]);

    const r3Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "3Y");
    const r5Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "5Y");
    const r10Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "10Y");

    expect(r3Y).toBeNull();
    expect(r5Y).toBeNull();
    expect(r10Y).toBeNull();
  });

  it("7. Score Bounds: total ROIC points never exceed 20 points", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      35, 38, 36, 40, 42, 45, 43, 40, 39, 41,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets, "10Y");
    expect(analysis.totalROICPoints).toBeLessThanOrEqual(20.0);

    const score100 = scoreROIC(analysis.averageROIC, incomeStatements, balanceSheets);
    expect(score100).toBeLessThanOrEqual(100);
  });
});
