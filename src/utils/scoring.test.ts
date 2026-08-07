import { describe, it, expect } from "vitest";
import {
  SCORE_WEIGHTS,
  DEFAULT_SCORING_CONFIG,
  formatPercentageMetric,
  formatShortenedShareCount,
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

    it("7. Formats Share Dilution percentage values correctly without double conversion", () => {
      expect(formatPercentageMetric(-4.77, true)).toBe("-4.77%");
      expect(formatPercentageMetric(-0.0477, true)).toBe("-4.77%");
      expect(formatPercentageMetric(0.0215, true)).toBe("2.15%");
      expect(formatPercentageMetric(2.15, true)).toBe("2.15%");
      expect(formatPercentageMetric(-10.0, true)).toBe("-10%");
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
      expect(scoreShareDilution(-8.0)).toBe(100); // <= -3.0% (Meaningful buyback)
      expect(scoreShareDilution(-1.5)).toBe(79);  // -3.0% to -1.0% (Strong)
      expect(scoreShareDilution(0.0)).toBe(65);   // -1.0% to +1.0% (Neutral)
      expect(scoreShareDilution(2.0)).toBe(45);   // +1.0% to +3.0% (Weak)
      expect(scoreShareDilution(5.0)).toBe(17);   // > +3.0% (Poor / Heavy dilution)
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
      roic: 100,           // 20%
      fcfMargin: 100,      // 10%
      fcfConsistency: 100, // 10%
      fcfConversion: 100,  // 10%
      marginStability: 100,// 15%
      netDebtToFCF: 100,   // 10%
      shareDilution: 100,  // 5%
      revenue: 100,        // 15%
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
      roic: 100,           // weight 0.20
      fcfMargin: 100,      // weight 0.10
      fcfConsistency: null,// missing
      fcfConversion: null, // missing
      marginStability: null,// missing
      netDebtToFCF: 100,   // weight 0.10
      shareDilution: 100,  // weight 0.05
      revenue: 100,        // weight 0.15
      eps: 100,            // weight 0.05
      debt: 50,
      profitability: 50,
      fcf: 50,
    };

    // Available weights: 0.20 + 0.10 + 0.10 + 0.05 + 0.15 + 0.05 = 0.65
    // Sum = (100*0.20) + (100*0.10) + (100*0.10) + (100*0.05) + (100*0.15) + (100*0.05) = 65 pts
    // Score = 65 / 0.65 = 100
    expect(calculateUniversalBusinessScore(partialUniversalScores)).toBe(100);
  });

  it("6. Verify updated weighting rewards high-ROIC compounders over cash-heavy low-return businesses", () => {
    // High-ROIC compounder profile (ROIC 100, Margin Stability 90, Revenue Growth 90, lower cash conversion 60)
    const compounderScores: MetricScores = {
      roic: 100,          // 20% -> 20 pts
      fcfMargin: 60,      // 10% -> 6 pts
      fcfConsistency: 60, // 10% -> 6 pts
      fcfConversion: 60,  // 10% -> 6 pts
      marginStability: 90,// 15% -> 13.5 pts
      netDebtToFCF: 90,   // 10% -> 9 pts
      shareDilution: 90,  // 5%  -> 4.5 pts
      revenue: 90,        // 15% -> 13.5 pts
      eps: 90,            // 5%  -> 4.5 pts
      fcf: null,
      debt: null,
      profitability: null,
    };
    // Sum = 20 + 6 + 6 + 6 + 13.5 + 9 + 4.5 + 13.5 + 4.5 = 83 pts
    const newCompounderScore = calculateUniversalBusinessScore(compounderScores);
    expect(newCompounderScore).toBe(83);

    // Cash-heavy low-ROIC profile (ROIC 40, Cash metrics 100, Growth 40)
    const cashHeavyScores: MetricScores = {
      roic: 40,           // 20% -> 8 pts
      fcfMargin: 100,     // 10% -> 10 pts
      fcfConsistency: 100,// 10% -> 10 pts
      fcfConversion: 100, // 10% -> 10 pts
      marginStability: 60,// 15% -> 9 pts
      netDebtToFCF: 80,   // 10% -> 8 pts
      shareDilution: 60,  // 5%  -> 3 pts
      revenue: 40,        // 15% -> 6 pts
      eps: 40,            // 5%  -> 2 pts
      fcf: null,
      debt: null,
      profitability: null,
    };
    // Sum = 8 + 10 + 10 + 10 + 9 + 8 + 3 + 6 + 2 = 66 pts
    const newCashHeavyScore = calculateUniversalBusinessScore(cashHeavyScores);
    expect(newCashHeavyScore).toBe(66);

    // Confirms compounder (high ROIC + stability + growth) outscores cash-heavy low-return profile
    expect(newCompounderScore).toBeGreaterThan(newCashHeavyScore);
  });

  it("7. Industry-specific metrics can be added later without refactoring", () => {
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

describe("Share Dilution Metric & Formatting Tests", () => {
  it("1. Scores share reduction (buybacks <= -3.0%) as Excellent (>= 90)", () => {
    // 10% share reduction over 5 years -> CAGR approx -2.08%/yr -> score >= 75
    // -4.0% annual buyback -> score >= 90
    expect(scoreShareDilution(-4.0)).toBeGreaterThanOrEqual(90);
    expect(scoreShareDilution(-3.0)).toBe(90);
  });

  it("2. Scores 10% share reduction over 5 years (CAGR -2.08%) as Strong (83)", () => {
    // ((0.90 / 1.0)^(1/5) - 1) * 100 = -2.085%
    const cagr = (Math.pow(0.9, 1 / 5) - 1) * 100; // -2.085%
    const score = scoreShareDilution(cagr);
    expect(score).toBeGreaterThanOrEqual(75);
    expect(score).toBeLessThanOrEqual(89);
  });

  it("3. Scores flat share count (0% CAGR) as Neutral (65)", () => {
    const score = scoreShareDilution(0);
    expect(score).toBe(65); // Neutral
  });

  it("4. Scores 5% annual dilution (+5.0% CAGR) as Poor (17)", () => {
    const score = scoreShareDilution(5.0);
    expect(score).toBeLessThan(35); // Poor rating for heavy dilution
  });

  it("5. Large raw share values are formatted as shortened numbers and NEVER appended with %", () => {
    expect(formatShortenedShareCount(22760000000)).toBe("22.76B");
    expect(formatShortenedShareCount(25960000000)).toBe("25.96B");
    expect(formatShortenedShareCount(450000000)).toBe("450.00M");
    expect(formatShortenedShareCount(12500)).toBe("12,500");

    expect(formatShortenedShareCount(22760000000)).not.toContain("%");
    expect(formatShortenedShareCount(25960000000)).not.toContain("%");
  });
});
