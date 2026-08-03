import { describe, it, expect } from "vitest";
import {
  SCORE_RANGES,
  scoreRevenueGrowth,
  scoreEPSGrowth,
  scoreFCFGrowth,
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

    it("3. Negative -> Positive: should return null (N/A) for potential turnaround", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -100000000, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: 200000000, capitalExpenditure: 0 },
      ];
      expect(scoreFCFGrowth(null, statements)).toBeNull();
    });

    it("4. Negative -> Negative: should return null (N/A) when all/ending FCF are <= 0 without prior positive", () => {
      const statements: FinancialStatement[] = [
        { date: "2015-12-31", operatingCashFlow: -100000000, capitalExpenditure: 0 },
        { date: "2025-12-31", operatingCashFlow: -50000000, capitalExpenditure: 0 },
      ];
      expect(scoreFCFGrowth(null, statements)).toBeNull();
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
});

describe("calculateMetricScores & calculateOverallScore", () => {
  const sampleMetrics: FinancialMetrics = {
    revenueCAGR: 0.15,
    epsGrowth: 0.12,
    fcfGrowth: 0.10,
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
    expect(scores.roic).not.toBeNull();
    expect(scores.debt).not.toBeNull();
    expect(scores.profitability).not.toBeNull();
  });

  it("calculateOverallScore should calculate weighted overall score", () => {
    const scores = calculateMetricScores(sampleMetrics);
    const overall = calculateOverallScore(scores);
    expect(overall).toBeGreaterThanOrEqual(80);
  });

  it("calculateOverallScore should calculate exact weighted Business Quality Score equation for all considerations", () => {
    const scores: MetricScores = {
      revenue: 80,       // 80 * 0.20 = 16.0
      eps: 90,           // 90 * 0.20 = 18.0
      fcf: 70,           // 70 * 0.15 = 10.5
      roic: 100,         // 100 * 0.15 = 15.0
      debt: 100,         // 100 * 0.10 = 10.0
      profitability: 85, // 85 * 0.20 = 17.0
    };
    // Sum = 16 + 18 + 10.5 + 15 + 10 + 17 = 86.5
    // Weight sum = 1.00
    // Round(86.5 / 1.00) = 87
    expect(calculateOverallScore(scores)).toBe(87);
  });

  it("calculateOverallScore should return 0 if all scores are null", () => {
    const emptyScores: MetricScores = {
      revenue: null,
      eps: null,
      fcf: null,
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
