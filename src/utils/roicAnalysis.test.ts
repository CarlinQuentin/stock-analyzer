import { describe, it, expect } from "vitest";
import {
  calculateROICAnalysis,
  calculateROICConsistency,
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

describe("ROIC Period-Selector driven Average ROIC & Consistency System", () => {
  it("1. Responds to Period Selector (10Y / 5Y / 3Y) for Average ROIC and Consistency", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      25, 22, 20, 18, 15,
    ]);

    const res10Y = calculateROICAnalysis(incomeStatements, balanceSheets, "10Y");
    const res5Y = calculateROICAnalysis(incomeStatements, balanceSheets, "5Y");
    const res3Y = calculateROICAnalysis(incomeStatements, balanceSheets, "3Y");

    expect(res10Y.periodLabel).toBe("10-Year Average");
    expect(res5Y.periodLabel).toBe("5-Year Average");
    expect(res3Y.periodLabel).toBe("3-Year Average");

    expect(res3Y.averageROIC).toBeCloseTo(22.33, 1);
    expect(res5Y.averageROIC).toBeCloseTo(20.0, 1);

    expect(typeof res5Y.consistencyPct).toBe("number");
    expect(res5Y.consistencyPct).toBeGreaterThanOrEqual(80);
  });

  it("2. ROIC Consistency percentage matches FCF Consistency methodology", () => {
    // Highly stable company: 20%, 20.5%, 19.8%, 20.2%, 20.1%
    const stable = mockFinancialStatements([20, 20.5, 19.8, 20.2, 20.1]);
    const stablePct = calculateROICConsistency(stable.incomeStatements, stable.balanceSheets, "5Y");

    // Highly volatile company: 5%, 40%, 8%, 35%, 12%
    const volatile = mockFinancialStatements([5, 40, 8, 35, 12]);
    const volatilePct = calculateROICConsistency(volatile.incomeStatements, volatile.balanceSheets, "5Y");

    expect(stablePct).toBeGreaterThanOrEqual(90);
    expect(volatilePct).toBeLessThan(stablePct!);
  });

  it("3. Score Allocation: Level (14 pts max) + Consistency (6 pts max) = 20 pts max", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      35, 38, 36, 40, 42, 45, 43, 40, 39, 41,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets, "10Y");
    expect(analysis.levelScorePoints).toBeLessThanOrEqual(14.0);
    expect(analysis.consistencyScorePoints).toBeLessThanOrEqual(6.0);
    expect(analysis.totalROICPoints).toBeLessThanOrEqual(20.0);

    const score100 = scoreROIC(analysis.averageROIC, incomeStatements, balanceSheets, "10Y");
    expect(score100).toBeLessThanOrEqual(100);
  });

  it("4. Insufficient Data Fallback: returns null when years are below minRequired", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([18.5]);

    const r3Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "3Y");
    const c3Y = calculateROICConsistency(incomeStatements, balanceSheets, "3Y");

    expect(r3Y).toBeNull();
    expect(c3Y).toBeNull();
  });
});
