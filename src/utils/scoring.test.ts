import { describe, it, expect } from "vitest";
import {
  SCORE_WEIGHTS,
  SCORE_RANGES,
  formatPercentageMetric,
  scoreRevenueGrowth,
  scoreEPSGrowth,
  scoreFCFGrowth,
  scoreFCFMargin,
  scoreROIC,
  scoreDebtToEquity,
  scoreProfitability,
  calculateMetricScores,
  calculateOverallScore,
  getUnavailableMetrics,
  calculateDataConfidenceScore,
  getScoreCategory,
  getScoreColorClass,
  getScoreBgColorClass,
  getMetricAnalysis,
} from "./scoring";
import { FinancialMetrics, MetricScores, FinancialStatement } from "../types";

describe("Scoring Utilities - Individual Metric Scores", () => {
  describe("formatPercentageMetric & Revenue CAGR Display Formatting", () => {
    it("1. CAGR result of 158% (1.58) displays as 158.00%", () => {
      expect(formatPercentageMetric(1.58)).toBe("158.00%");
    });

    it("2. CAGR result of 12.5% (0.125) displays as 12.50%", () => {
      expect(formatPercentageMetric(0.125)).toBe("12.50%");
    });

    it("3. Negative CAGR values (-0.1525) display correctly as -15.25%", () => {
      expect(formatPercentageMetric(-0.1525)).toBe("-15.25%");
    });

    it("4. Zero CAGR (0) displays correctly as 0.00%", () => {
      expect(formatPercentageMetric(0)).toBe("0.00%");
    });

    it("5. Null/undefined/NaN displays as N/A", () => {
      expect(formatPercentageMetric(null)).toBe("N/A");
      expect(formatPercentageMetric(undefined)).toBe("N/A");
      expect(formatPercentageMetric(NaN)).toBe("N/A");
    });

    it("6. Verifies Quality Score calculation remains unchanged for 158% CAGR", () => {
      // High CAGR (> 15%) awards max score 100
      expect(scoreRevenueGrowth(1.58)).toBe(100);
      expect(scoreRevenueGrowth(0.125)).toBeGreaterThanOrEqual(70);
      expect(scoreRevenueGrowth(-0.1525)).toBe(0);
      expect(scoreRevenueGrowth(0)).toBe(30);
    });

    it("7. ROIC = 25 displays as 25.00%", () => {
      expect(formatPercentageMetric(25, true)).toBe("25.00%");
    });

    it("8. ROIC = -166.45 displays as -166.45%", () => {
      expect(formatPercentageMetric(-166.45, true)).toBe("-166.45%");
    });

    it("9. ROIC = 0 displays as 0.00%", () => {
      expect(formatPercentageMetric(0, true)).toBe("0.00%");
    });

    it("10. Net Profitability = -4982.30 displays as -4982.30%", () => {
      expect(formatPercentageMetric(-4982.30, true)).toBe("-4982.30%");
    });

    it("11. Net Profitability = 25 displays as 25.00%", () => {
      expect(formatPercentageMetric(25, true)).toBe("25.00%");
    });

    it("12. Net Profitability = 0 displays as 0.00%", () => {
      expect(formatPercentageMetric(0, true)).toBe("0.00%");
    });

    it("13. Net Profitability = 158 displays as 158.00%", () => {
      expect(formatPercentageMetric(158, true)).toBe("158.00%");
    });

    it("14. Metric value -4982.3042 renders -4982.30%", () => {
      expect(formatPercentageMetric(-4982.3042, true)).toBe("-4982.30%");
    });
  });

  describe("scoreRevenueGrowth Stock Scoring Integration", () => {
    it("should score positive CAGR as expected", () => {
      expect(scoreRevenueGrowth(0.20)).toBeGreaterThanOrEqual(85); // Excellent
      expect(scoreRevenueGrowth(0.10)).toBeGreaterThanOrEqual(70); // Good
      expect(scoreRevenueGrowth(0.06)).toBeGreaterThanOrEqual(50); // Average
    });

    it("should score negative CAGR as expected", () => {
      expect(scoreRevenueGrowth(-0.10)).toBe(0);
      expect(scoreRevenueGrowth(-0.05)).toBeLessThan(30);
    });

    it("should score zero CAGR as expected", () => {
      expect(scoreRevenueGrowth(0)).toBe(30);
    });

    it("should return a score of 0 for invalid/missing CAGR instead of null, undefined, or N/A", () => {
      expect(scoreRevenueGrowth(null)).toBe(0);
      expect(scoreRevenueGrowth(undefined)).toBe(0);
      expect(scoreRevenueGrowth(NaN)).toBe(0);
    });

    it("should cap extremely high CAGR values at max score 100", () => {
      expect(scoreRevenueGrowth(2.0)).toBe(100);
      expect(scoreRevenueGrowth(5.0)).toBe(100);
    });
  });

  describe("scoreEPSGrowth Stock Scoring Integration", () => {
    it("Test 1: EPS CAGR = 20% (0.20) -> Rating = Excellent, Score >= 85", () => {
      const score = scoreEPSGrowth(0.20);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(85);
      const cat = SCORE_RANGES.excellent;
      expect(score!).toBeGreaterThanOrEqual(cat.min);
      expect(score!).toBeLessThanOrEqual(cat.max);
    });

    it("Test 2: EPS CAGR = 10% (0.10) -> Rating = Good (70 - 84)", () => {
      const score = scoreEPSGrowth(0.10);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(SCORE_RANGES.good.min);
      expect(score!).toBeLessThanOrEqual(SCORE_RANGES.good.max);
    });

    it("Test 3: EPS CAGR = 6.30% (0.063) -> Rating = Average (50 - 69)", () => {
      const score = scoreEPSGrowth(0.063);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(SCORE_RANGES.average.min);
      expect(score!).toBeLessThanOrEqual(SCORE_RANGES.average.max);
      expect(score!).toBe(58);
    });

    it("Test 4: EPS CAGR = 3% (0.03) -> Rating = Poor (0 - 49)", () => {
      const score = scoreEPSGrowth(0.03);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(SCORE_RANGES.poor.min);
      expect(score!).toBeLessThanOrEqual(SCORE_RANGES.poor.max);
    });

    it("Test 5: EPS CAGR = null -> returns null (No EPS CAGR score awarded)", () => {
      expect(scoreEPSGrowth(null)).toBeNull();
      expect(scoreEPSGrowth(undefined)).toBeNull();
      expect(scoreEPSGrowth(NaN)).toBeNull();
    });

    it("should cap extremely high EPS CAGR values at max score 100", () => {
      expect(scoreEPSGrowth(2.0)).toBe(100);
      expect(scoreEPSGrowth(5.0)).toBe(100);
    });
  });

  it("scoreFCFGrowth should score FCF growth tiers correctly", () => {
    expect(scoreFCFGrowth(null)).toBeNull();
    expect(scoreFCFGrowth(0.20)).toBeGreaterThanOrEqual(85);
    expect(scoreFCFGrowth(0.10)).toBeGreaterThanOrEqual(70);
  });

  describe("scoreFCFGrowth deterioration vs N/A cases", () => {
    it("1. Positive -> Positive: should score normal CAGR", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: 100, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 200, capitalExpenditure: 0 },
      ];
      expect(scoreFCFGrowth(0.0718, statements)).toBeGreaterThanOrEqual(50);
    });

    it("2. Positive -> Negative: should assign score 0 when ending FCF <= 0 and prior FCF was positive", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: 1800000000, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -188000000, capitalExpenditure: 0 },
      ];
      expect(scoreFCFGrowth(null, statements)).toBe(0);
    });

    it("3. Negative -> Positive: should reward turnaround with score 75", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -100000000, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 200000000, capitalExpenditure: 0 },
      ];
      expect(scoreFCFGrowth(null, statements)).toBe(75);
    });

    it("4. Negative -> Negative: should give partial credit (e.g. 35) when cash burn is shrinking", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -100000000, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -50000000, capitalExpenditure: 0 },
      ];
      expect(scoreFCFGrowth(null, statements)).toBe(35);
    });
  });

  it("scoreROIC should score ROIC tiers correctly", () => {
    expect(scoreROIC(null)).toBeNull();
    expect(scoreROIC(20)).toBeGreaterThanOrEqual(85);
    expect(scoreROIC(12)).toBeGreaterThanOrEqual(70);
    expect(scoreROIC(8)).toBeGreaterThanOrEqual(50);
    expect(scoreROIC(3)).toBeLessThan(50);
  });

  it("scoreDebtToEquity should score debt-to-equity ratio correctly (lower is better)", () => {
    expect(scoreDebtToEquity(null)).toBe(0);
    expect(scoreDebtToEquity(-1)).toBe(0);
    expect(scoreDebtToEquity(0.2)).toBeGreaterThanOrEqual(85); // Excellent
    expect(scoreDebtToEquity(1.0)).toBeGreaterThanOrEqual(70); // Good
    expect(scoreDebtToEquity(2.0)).toBeGreaterThanOrEqual(50); // Average
    expect(scoreDebtToEquity(6.0)).toBe(0); // Poor
  });

  it("scoreProfitability should return average score across net, operating, and gross margins", () => {
    expect(scoreProfitability(null, null, null)).toBeNull();
    // High margins (Net 20%, Op 25%, Gross 50%) -> Excellent score >= 85
    const highScore = scoreProfitability(20, 25, 50);
    expect(highScore).toBeGreaterThanOrEqual(85);
  });

  describe("scoreFCFMargin", () => {
    it("1. Company with excellent FCF Margin (>20%) receives 100 score", () => {
      expect(scoreFCFMargin(25)).toBe(100);
      expect(scoreFCFMargin(20)).toBe(100);
    });

    it("2. Company with strong FCF Margin (15%-20%) receives 85-100 score", () => {
      expect(scoreFCFMargin(15)).toBe(85);
      expect(scoreFCFMargin(17.5)).toBe(93);
    });

    it("3. Company with average FCF Margin (5%-15%) receives 50-75 score", () => {
      expect(scoreFCFMargin(10)).toBe(75);
      expect(scoreFCFMargin(5)).toBe(50);
      expect(scoreFCFMargin(7.5)).toBe(63);
    });

    it("4. Company with weak FCF Margin (0%-5%) receives 25-50 score", () => {
      expect(scoreFCFMargin(0)).toBe(25);
      expect(scoreFCFMargin(2.5)).toBe(38);
    });

    it("5. Negative FCF Margin (<0%) receives 0 score", () => {
      expect(scoreFCFMargin(-5)).toBe(0);
      expect(scoreFCFMargin(-0.1)).toBe(0);
    });

    it("6. Missing Revenue or FCF data returns null", () => {
      expect(scoreFCFMargin(null)).toBeNull();
      expect(scoreFCFMargin(undefined as any)).toBeNull();
      expect(scoreFCFMargin(NaN)).toBeNull();
    });
  });
});

describe("calculateMetricScores & calculateOverallScore", () => {
  const sampleMetrics: FinancialMetrics = {
    revenueCAGR: 0.15,
    epsGrowth: 0.12,
    fcfGrowth: 0.10,
    fcfMargin: 15,
    roic: 16,
    debtToEquity: 0.4,
    dividendYield: 0.02,
    dividendPayoutRatio: 0.3,
    grossMargin: 45,
    operatingMargin: 20,
    netMargin: 15,
  };

  it("calculateMetricScores should generate all metric scores", () => {
    const scores = calculateMetricScores(sampleMetrics);
    expect(scores.revenue).not.toBeNull();
    expect(scores.eps).not.toBeNull();
    expect(scores.fcf).not.toBeNull();
    expect(scores.fcfMargin).not.toBeNull();
    expect(scores.roic).not.toBeNull();
    expect(scores.debt).not.toBeNull();
    expect(scores.profitability).not.toBeNull();
  });

  it("calculateOverallScore should calculate weighted overall score", () => {
    const scores = calculateMetricScores(sampleMetrics);
    const overall = calculateOverallScore(scores);
    expect(overall).toBeGreaterThanOrEqual(80);
  });

  it("calculateOverallScore should calculate exact weighted Business Quality Score equation using new weights (15/15/10/10/20/10/20)", () => {
    const scores: MetricScores = {
      revenue: 80,       // 80 * 0.15 = 12.0
      eps: 90,           // 90 * 0.15 = 13.5
      fcf: 70,           // 70 * 0.10 = 7.0
      fcfMargin: 80,     // 80 * 0.10 = 8.0
      roic: 100,         // 100 * 0.20 = 20.0
      debt: 100,         // 100 * 0.10 = 10.0
      profitability: 85, // 85 * 0.20 = 17.0
    };
    // Sum = 12 + 13.5 + 7 + 8 + 20 + 10 + 17 = 87.5
    // Weight sum = 1.00
    // Round(87.5 / 1.00) = 88
    expect(calculateOverallScore(scores)).toBe(88);
  });

  it("SCORE_WEIGHTS total sum must equal exactly 1.00 (100%)", () => {
    const totalWeight = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("calculateOverallScore should calculate exact point contributions and total score matching prompt example", () => {
    const exampleScores: MetricScores = {
      revenue: 100,       // (100/100) * 15 = 15.00 pts
      eps: 100,           // (100/100) * 15 = 15.00 pts
      fcf: 100,           // (100/100) * 10 = 10.00 pts
      fcfMargin: 76,      // (76/100)  * 10 = 7.60 pts
      roic: 100,          // (100/100) * 20 = 20.00 pts
      debt: 98,           // (98/100)  * 10 = 9.80 pts
      profitability: 100, // (100/100) * 20 = 20.00 pts
    };
    // Sum = 15 + 15 + 10 + 7.6 + 20 + 9.8 + 20 = 97.40 pts
    expect(calculateOverallScore(exampleScores)).toBe(97);
  });

  it("calculateOverallScore should return 0 if all scores are null", () => {
    const emptyScores: MetricScores = {
      revenue: null,
      eps: null,
      fcf: null,
      fcfMargin: null,
      roic: null,
      debt: null,
      profitability: null,
    };
    expect(calculateOverallScore(emptyScores)).toBe(0);
  });
});

describe("Data Confidence & Unavailable Metrics", () => {
  it("calculateDataConfidenceScore should return 100% when all metrics are available", () => {
    const fullScores: MetricScores = {
      revenue: 80,
      eps: 80,
      fcf: 80,
      fcfMargin: 80,
      roic: 80,
      debt: 80,
      profitability: 80,
    };
    expect(calculateDataConfidenceScore(fullScores)).toBe(100);
    expect(getUnavailableMetrics(fullScores)).toHaveLength(0);
  });

  it("calculateDataConfidenceScore should calculate percentage for partial data", () => {
    const partialScores: MetricScores = {
      revenue: 80,
      eps: 80,
      fcf: null,
      fcfMargin: null,
      roic: null,
      debt: 80,
      profitability: 80,
    };
    // 4 out of 6 valid = ~67%
    expect(calculateDataConfidenceScore(partialScores)).toBe(67);
    const unavailable = getUnavailableMetrics(partialScores);
    expect(unavailable).toContain("FCF Growth");
    expect(unavailable).toContain("ROIC");
  });
});

describe("Category & Label Formatting Helpers", () => {
  it("getScoreCategory should classify score tiers", () => {
    expect(getScoreCategory(90).label).toBe("Excellent");
    expect(getScoreCategory(75).label).toBe("Good");
    expect(getScoreCategory(60).label).toBe("Average");
    expect(getScoreCategory(30).label).toBe("Poor");
  });

  it("getScoreColorClass & getScoreBgColorClass should return class strings", () => {
    expect(getScoreColorClass(90)).toBe("text-excellent");
    expect(getScoreBgColorClass(90)).toBe("bg-excellent");
  });

  it("getMetricAnalysis should classify performance", () => {
    expect(getMetricAnalysis(null)).toBe("N/A");
    expect(getMetricAnalysis(90)).toBe("Strong");
    expect(getMetricAnalysis(75)).toBe("Good");
    expect(getMetricAnalysis(60)).toBe("Fair");
    expect(getMetricAnalysis(30)).toBe("Weak");
  });
});
