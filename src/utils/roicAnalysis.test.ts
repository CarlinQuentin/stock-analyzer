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

    // Invested Capital = 100, NOPAT = roic
    // OpInc = roic / (1 - 0.21)
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

describe("ROIC Multi-Year Quality & Scoring System", () => {
  it("1. Consistently High ROIC Company: receives excellent score approaching 20 points", () => {
    // 5 years: 20%, 21%, 19%, 22%, 20%
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      20, 21, 19, 22, 20,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets);

    expect(analysis.consistency).toBe("Highly Consistent");
    expect(analysis.roic3Y).toBeCloseTo(20.0, 1);
    expect(analysis.roic5Y).toBeCloseTo(20.4, 1);
    expect(analysis.totalROICPoints).toBeGreaterThanOrEqual(16.5);
    expect(analysis.totalROICPoints).toBeLessThanOrEqual(20.0);
  });

  it("2. Low but Stable ROIC Company: receives low level score but high consistency", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      4.0, 4.2, 3.9, 4.1, 4.0,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets);

    expect(analysis.consistency).toBe("Highly Consistent");
    expect(analysis.roic3Y).toBeCloseTo(4.03, 1);
    expect(analysis.levelScorePoints).toBeLessThan(5.0);
    expect(analysis.totalROICPoints).toBeLessThan(12.0);
  });

  it("3. Volatile ROIC Company: penalized for inconsistency despite high average", () => {
    // Company A: 20%, 21%, 19%, 22%, 20% (Consistent)
    const consistent = mockFinancialStatements([20, 21, 19, 22, 20]);
    const analysisA = calculateROICAnalysis(
      consistent.incomeStatements,
      consistent.balanceSheets
    );

    // Company B: 5%, 40%, 8%, 35%, 12% (Volatile, similar ~20% avg)
    const volatile = mockFinancialStatements([5, 40, 8, 35, 12]);
    const analysisB = calculateROICAnalysis(
      volatile.incomeStatements,
      volatile.balanceSheets
    );

    expect(analysisB.consistency).toBe("Inconsistent");
    expect(analysisB.consistencyScorePoints).toBeLessThan(
      analysisA.consistencyScorePoints
    );
    expect(analysisB.totalROICPoints).toBeLessThan(analysisA.totalROICPoints);
  });

  it("4. Improving ROIC Company: classified as Improving with high trend score", () => {
    // 3Y: 21%, 5Y: 16%, 10Y: 12% (Reverse chronological: 21, 18, 16, 14, 12)
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      21, 19, 17, 14, 12,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets);

    expect(analysis.trend).toBe("Improving");
    expect(analysis.trendScorePoints).toBeGreaterThanOrEqual(4.5);
  });

  it("5. Deteriorating ROIC Company: classified as Declining with low trend score", () => {
    // Reverse chronological: 13, 16, 19, 22, 25
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      13, 16, 19, 22, 25,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets);

    expect(analysis.trend).toBe("Declining");
    expect(analysis.trendScorePoints).toBeLessThan(2.0);
  });

  it("6. Insufficient Historical Data: handles missing years gracefully without fabricating results", () => {
    // Only 1 year of statements available
    const { incomeStatements, balanceSheets } = mockFinancialStatements([18.5]);

    const r3Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "3Y");
    const r5Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "5Y");
    const r10Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "10Y");

    expect(r3Y).toBeNull();
    expect(r5Y).toBeNull();
    expect(r10Y).toBeNull();

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets);
    expect(analysis.latestROIC).toBeCloseTo(18.5, 1);
  });

  it("7. Score Bounds: total ROIC points never exceed 20 points", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      35, 38, 36, 40, 42, 45, 43, 40, 39, 41,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets);
    expect(analysis.totalROICPoints).toBeLessThanOrEqual(20.0);

    const score100 = scoreROIC(
      analysis.latestROIC,
      incomeStatements,
      balanceSheets
    );
    expect(score100).toBeLessThanOrEqual(100);
  });
});
