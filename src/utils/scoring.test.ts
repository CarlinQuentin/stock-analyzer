import { describe, it, expect } from "vitest";
import {
  SCORE_WEIGHTS,
  DEFAULT_SCORING_CONFIG,
  formatPercentageMetric,
  scoreRevenueGrowth,
  scoreEPSGrowth,
  scoreFCFConsistency,
  scoreFCFConversion,
  scoreMarginStability,
  scoreNetDebtToFCF,
  scoreShareDilution,
  calculateMetricScores,
  calculateUniversalBusinessScore,
  calculateIndustryScore,
  calculateOverallScore,
} from "./scoring";
import { FinancialMetrics, MetricScores } from "../types";

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
      expect(scoreRevenueGrowth(1.58)).toBe(100);
      expect(scoreRevenueGrowth(0.125)).toBeGreaterThanOrEqual(70);
      expect(scoreRevenueGrowth(-0.1525)).toBe(0);
      expect(scoreRevenueGrowth(0)).toBe(30);
    });

    it("7. ROIC = 25 displays as 25%", () => {
      expect(formatPercentageMetric(25, true)).toBe("25%");
    });

    it("8. ROIC = -166.45 displays as -166.45%", () => {
      expect(formatPercentageMetric(-166.45, true)).toBe("-166.45%");
    });

    it("9. FCF Consistency score formatting requirements", () => {
      // FCF Consistency score = 96 displays "96%"
      expect(formatPercentageMetric(96, true)).toBe("96%");
      // FCF Consistency score = 0.96 displays "96%"
      expect(formatPercentageMetric(0.96, true)).toBe("96%");
      // FCF Consistency score = 100 displays "100%"
      expect(formatPercentageMetric(100, true)).toBe("100%");
      // FCF Consistency score = 0 displays "0%"
      expect(formatPercentageMetric(0, true)).toBe("0%");
    });

    it("10. Other percentage-based metrics format consistently", () => {
      // FCF Conversion: 105 or 1.05 displays as "105%"
      expect(formatPercentageMetric(105, true)).toBe("105%");
      expect(formatPercentageMetric(1.05, true)).toBe("105%");
      // Margin Stability: 80 or 0.80 displays as "80%"
      expect(formatPercentageMetric(80, true)).toBe("80%");
      expect(formatPercentageMetric(0.80, true)).toBe("80%");
      // FCF Margin: 15.5 displays as "15.50%"
      expect(formatPercentageMetric(15.5, true)).toBe("15.50%");
    });
  });

  describe("scoreRevenueGrowth Stock Scoring Integration", () => {
    it("should score positive CAGR as expected", () => {
      expect(scoreRevenueGrowth(0.20)).toBeGreaterThanOrEqual(85);
      expect(scoreRevenueGrowth(0.10)).toBeGreaterThanOrEqual(70);
      expect(scoreRevenueGrowth(0.06)).toBeGreaterThanOrEqual(50);
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
  });

  describe("scoreEPSGrowth Stock Scoring Integration", () => {
    it("Test 1: EPS CAGR = 20% (0.20) -> Rating = Excellent, Score >= 85", () => {
      const score = scoreEPSGrowth(0.20);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(85);
    });

    it("Test 2: EPS CAGR = null -> returns null", () => {
      expect(scoreEPSGrowth(null)).toBeNull();
      expect(scoreEPSGrowth(undefined)).toBeNull();
      expect(scoreEPSGrowth(NaN)).toBeNull();
    });
  });

  describe("New Universal Metrics Scoring", () => {
    it("scoreFCFConsistency should return score clamped between 0 and 100", () => {
      expect(scoreFCFConsistency(85)).toBe(85);
      expect(scoreFCFConsistency(120)).toBe(100);
      expect(scoreFCFConsistency(-10)).toBe(0);
      expect(scoreFCFConsistency(null)).toBeNull();
    });

    it("scoreFCFConversion should score FCF / Net Income ratios accurately", () => {
      expect(scoreFCFConversion(125)).toBe(100); // >= 120%
      expect(scoreFCFConversion(100)).toBe(85);
      expect(scoreFCFConversion(80)).toBe(70);
      expect(scoreFCFConversion(50)).toBe(50);
      expect(scoreFCFConversion(0)).toBe(0);
      expect(scoreFCFConversion(-10)).toBe(0);
      expect(scoreFCFConversion(null)).toBeNull();
    });

    it("scoreMarginStability should return score clamped between 0 and 100", () => {
      expect(scoreMarginStability(90)).toBe(90);
      expect(scoreMarginStability(105)).toBe(100);
      expect(scoreMarginStability(null)).toBeNull();
    });

    it("scoreNetDebtToFCF should score solvency ratios accurately", () => {
      expect(scoreNetDebtToFCF(-1.5)).toBe(100); // Net cash position
      expect(scoreNetDebtToFCF(1.0)).toBe(95);   // < 2.0x (Excellent)
      expect(scoreNetDebtToFCF(3.0)).toBe(80);   // 2.0x - 4.0x (Good)
      expect(scoreNetDebtToFCF(5.0)).toBe(60);   // 4.0x - 6.0x (Moderate risk)
      expect(scoreNetDebtToFCF(7.0)).toBe(41);   // > 6.0x (High leverage)
      expect(scoreNetDebtToFCF(null)).toBeNull();
    });

    it("scoreShareDilution should score share dilution and buybacks accurately", () => {
      expect(scoreShareDilution(-8.0)).toBe(100); // <= -5% (Meaningful buyback)
      expect(scoreShareDilution(-1.5)).toBe(92);  // -5% to +2% (Strong)
      expect(scoreShareDilution(3.5)).toBe(72);   // 2% to 5% (Neutral)
      expect(scoreShareDilution(7.5)).toBe(50);   // 5% to 10% (Penalty)
      expect(scoreShareDilution(15.0)).toBe(24);  // > 10% (Significant dilution)
      expect(scoreShareDilution(null)).toBeNull();
    });
  });
});

describe("Universal Business Quality Score Architecture & Engine", () => {
  const sampleMetrics: FinancialMetrics = {
    revenueCAGR: 0.15,
    epsGrowth: 0.12,
    fcfGrowth: 0.10,
    fcfMargin: 15,
    fcfConsistency: 85,
    fcfConversion: 105,
    marginStability: 80,
    netDebtToFCF: 1.5,
    shareDilution: -5.0,
    roic: 16,
    debtToEquity: 0.4,
    dividendYield: 0.02,
    dividendPayoutRatio: 0.3,
    grossMargin: 45,
    operatingMargin: 20,
    netMargin: 15,
  };

  it("1. SCORE_WEIGHTS total weight sum must equal exactly 1.00 (100%)", () => {
    const weights = DEFAULT_SCORING_CONFIG.universalScoreMetrics;
    const totalWeight = Object.values(weights).reduce((sum, item) => sum + item.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);

    const exportTotalWeight = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(exportTotalWeight).toBeCloseTo(1.0, 5);
  });

  it("2. calculateMetricScores should calculate scores for both universal and informational metrics", () => {
    const scores = calculateMetricScores(sampleMetrics);
    expect(scores.roic).toBeGreaterThan(0);
    expect(scores.fcfMargin).toBeGreaterThan(0);
    expect(scores.fcfConsistency).toBe(85);
    expect(scores.fcfConversion).toBeGreaterThan(0);
    expect(scores.marginStability).toBe(80);
    expect(scores.revenue).toBeGreaterThan(0);
    expect(scores.eps).toBeGreaterThan(0);
  });

  it("2. Verifies universal scoring config contains exactly 9 universal metrics totaling 1.0 weight", () => {
    const configMetrics = DEFAULT_SCORING_CONFIG.universalScoreMetrics;
    const universalKeys = Object.keys(configMetrics);
    expect(universalKeys.length).toBe(9);
    expect(universalKeys).toContain("roic");
    expect(universalKeys).toContain("fcfMargin");
    expect(universalKeys).toContain("fcfConsistency");
    expect(universalKeys).toContain("fcfConversion");
    expect(universalKeys).toContain("marginStability");
    expect(universalKeys).toContain("netDebtToFCF");
    expect(universalKeys).toContain("shareDilution");
    expect(universalKeys).toContain("revenue");
    expect(universalKeys).toContain("eps");

    const totalConfigWeight = Object.values(configMetrics).reduce((sum, item) => sum + item.weight, 0);
    expect(Number(totalConfigWeight.toFixed(2))).toBe(1.0);
  });

  it("3. Calculates Universal Business Quality Score correctly across 9 universal metrics", () => {
    const baseScores: MetricScores = {
      roic: 100,           // 15%
      fcfMargin: 100,      // 15%
      fcfConsistency: 100, // 15%
      fcfConversion: 100,  // 10%
      marginStability: 100,// 10%
      netDebtToFCF: 100,   // 10%
      shareDilution: 100,  // 10%
      revenue: 100,        // 10%
      eps: 100,            // 5%
      fcf: 0,             // Informational (0%)
      debt: 0,            // Informational (0%)
      profitability: 0,   // Informational (0%)
    };

    // Total = 100 pts out of 100
    expect(calculateUniversalBusinessScore(baseScores)).toBe(100);

    // Changing informational metrics does NOT affect universal score
    const modifiedScores: MetricScores = {
      ...baseScores,
      fcf: 100,
      debt: 100,
      profitability: 100,
    };
    expect(calculateUniversalBusinessScore(modifiedScores)).toBe(100);
    expect(calculateOverallScore(modifiedScores)).toBe(100);
  });

  it("4. Informational metrics do not affect score calculation", () => {
    const scoresWithLowInformational: MetricScores = {
      roic: 80,
      fcfMargin: 80,
      fcfConsistency: 80,
      fcfConversion: 80,
      marginStability: 80,
      netDebtToFCF: 80,
      shareDilution: 80,
      revenue: 80,
      eps: 80,
      debt: 0,
      profitability: 0,
      fcf: 0,
    };

    const scoresWithHighInformational: MetricScores = {
      ...scoresWithLowInformational,
      debt: 100,
      profitability: 100,
      fcf: 100,
    };

    expect(calculateUniversalBusinessScore(scoresWithLowInformational)).toBe(80);
    expect(calculateUniversalBusinessScore(scoresWithHighInformational)).toBe(80);
  });

  it("5. Missing universal metrics do not break scoring and reweights dynamically", () => {
    const partialUniversalScores: MetricScores = {
      roic: 100,           // weight 0.15
      fcfMargin: 100,      // weight 0.15
      fcfConsistency: null,// missing
      fcfConversion: null, // missing
      marginStability: null,// missing
      netDebtToFCF: 100,   // weight 0.10
      shareDilution: 100,  // weight 0.10
      revenue: 100,        // weight 0.10
      eps: 100,            // weight 0.05
      debt: 50,
      profitability: 50,
      fcf: 50,
    };

    // Available weights: 0.15 + 0.15 + 0.10 + 0.10 + 0.10 + 0.05 = 0.65
    // Sum = (100*0.15) + (100*0.15) + (100*0.1) + (100*0.1) + (100*0.1) + (100*0.05) = 65 pts
    // Score = 65 / 0.65 = 100
    expect(calculateUniversalBusinessScore(partialUniversalScores)).toBe(100);
  });

  it("6. Industry-specific metrics can be added later without refactoring", () => {
    const scores: MetricScores = {
      roic: 80,
      fcfMargin: 80,
      fcfConsistency: 80,
      fcfConversion: 80,
      marginStability: 80,
      netDebtToFCF: 80,
      shareDilution: 80,
      revenue: 80,
      eps: 80,
      fcf: null,
      debt: 90,
      profitability: null,
      bankingTier1Capital: 95, // future industry metric
    };

    const bankingIndustryConfig = {
      bankingTier1Capital: { name: "Tier 1 Capital Ratio", weight: 0.50 },
      roic: { name: "ROIC", weight: 0.50 },
    };

    const industryScore = calculateIndustryScore(scores, bankingIndustryConfig);
    expect(industryScore).toBe(88);
  });
});
