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

describe("ROIC Consistency & Period-Selector System (Mirroring FCF Consistency)", () => {
  it("1. High and stable ROIC: produces very high consistency percentage (100%)", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      18, 19, 18, 20, 19,
    ]);

    const consistencyPct = calculateROICConsistency(incomeStatements, balanceSheets, "5Y");
    expect(consistencyPct).toBe(100);
  });

  it("2. Low but stable ROIC: produces 100% consistency (proves level and consistency are separate)", () => {
    // Average ROIC is 2.86%, but consistency must be 100% because volatility is minimal
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      2.7, 2.9, 2.8, 3.0, 2.9,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets, "5Y");
    const consistencyPct = calculateROICConsistency(incomeStatements, balanceSheets, "5Y");

    expect(analysis.averageROIC).toBeCloseTo(2.86, 2);
    expect(consistencyPct).toBe(100);

    // Exact score split verification: Average ROIC ~2.4/14 pts + Consistency 6.0/6.0 pts = ~8.4/20 pts
    expect(analysis.levelScorePoints).toBeCloseTo(2.4, 1);
    expect(analysis.consistencyScorePoints).toBe(6.0);
    expect(analysis.totalROICPoints).toBeCloseTo(8.4, 1);
  });

  it("3. Highly volatile ROIC: produces substantially lower consistency percentage", () => {
    const stable = mockFinancialStatements([18, 19, 18, 20, 19]);
    const stablePct = calculateROICConsistency(stable.incomeStatements, stable.balanceSheets, "5Y");

    const volatile = mockFinancialStatements([-5, 30, 2, 25, 4]);
    const volatilePct = calculateROICConsistency(volatile.incomeStatements, volatile.balanceSheets, "5Y");

    expect(stablePct).toBe(100);
    expect(volatilePct).toBeLessThan(80);
  });

  it("4. Negative ROIC years: properly reflects positive year ratio and penalizes score", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      -5, -10, -2, 5, 8,
    ]);

    const consistencyPct = calculateROICConsistency(incomeStatements, balanceSheets, "5Y");
    expect(consistencyPct).toBe(43);
  });

  it("5. Missing historical data: returns null when years are below minRequired", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([18.5]);

    const r3Y = calculateROICAverageForPeriod(incomeStatements, balanceSheets, "3Y");
    const c3Y = calculateROICConsistency(incomeStatements, balanceSheets, "3Y");

    expect(r3Y).toBeNull();
    expect(c3Y).toBeNull();
  });

  it("6. Period Selector Switching (10Y / 5Y / 3Y): updates consistency according to selected period", () => {
    // 5 years: recent 3 years stable (20, 20, 20), earlier 2 years volatile (-10, 40)
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      20, 20, 20, -10, 40,
    ]);

    const c3Y = calculateROICConsistency(incomeStatements, balanceSheets, "3Y");
    const c5Y = calculateROICConsistency(incomeStatements, balanceSheets, "5Y");

    expect(c3Y).toBe(100);
    expect(c5Y).toBeLessThan(c3Y!);
  });

  it("7. Total ROIC Score Capping: total contribution never exceeds 20.0 points", () => {
    const { incomeStatements, balanceSheets } = mockFinancialStatements([
      35, 38, 36, 40, 42, 45, 43, 40, 39, 41,
    ]);

    const analysis = calculateROICAnalysis(incomeStatements, balanceSheets, "10Y");
    expect(analysis.totalROICPoints).toBeLessThanOrEqual(20.0);

    const score100 = scoreROIC(analysis.averageROIC, incomeStatements, balanceSheets, "10Y");
    expect(score100).toBeLessThanOrEqual(100);
  });
});
