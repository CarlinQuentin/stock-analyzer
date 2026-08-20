import { describe, it, expect } from "vitest";
import {
  SCORE_WEIGHTS,
  DEFAULT_SCORING_CONFIG,
  formatPercentageMetric,
  formatMarketCap,
  formatShortenedShareCount,
  scoreRevenueGrowth,
  scoreEPSGrowth,
  scoreFCFConsistency,
  scoreFCFConversion,
  scoreMarginStability,
  scoreNetDebtToFCF,
  scoreShareDilution,
  scoreROIC,
  getMetricAnalysis,
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
      expect(formatPercentageMetric(2.15, true)).toBe("2.15%");
      expect(formatPercentageMetric(-10.0, true)).toBe("-10%");
    });

    it("8. ROIC values format accurately for small percentages and large percentages", () => {
      // Small ROIC values (already-scaled percentage scale, isAlreadyPercentage = true)
      expect(formatPercentageMetric(0.3443, true)).toBe("0.34%");
      expect(formatPercentageMetric(0.5, true)).toBe("0.50%");
      expect(formatPercentageMetric(0.99, true)).toBe("0.99%");
      expect(formatPercentageMetric(1.5, true)).toBe("1.50%");
      expect(formatPercentageMetric(45.2, true)).toBe("45.20%");
      expect(formatPercentageMetric(25, true)).toBe("25%");
      expect(formatPercentageMetric(-166.45, true)).toBe("-166.45%");

      // Verify already-scaled values are NOT accidentally multiplied by 100 again
      expect(formatPercentageMetric(0.3443, true)).not.toBe("34.43%");
      expect(formatPercentageMetric(0.5, true)).not.toBe("50.00%");
      expect(formatPercentageMetric(0.99, true)).not.toBe("99.00%");
    });

    it("9. Decimal ratios convert to percentages accurately (isAlreadyPercentage = false)", () => {
      expect(formatPercentageMetric(0.003443, false)).toBe("0.34%");
      expect(formatPercentageMetric(0.005, false)).toBe("0.50%");
      expect(formatPercentageMetric(0.0099, false)).toBe("0.99%");
      expect(formatPercentageMetric(0.01, false)).toBe("1.00%");
      expect(formatPercentageMetric(0.452, false)).toBe("45.20%");
    });

    it("10. FCF Consistency, Conversion, and Margin Stability score formatting requirements", () => {
      expect(formatPercentageMetric(96, true)).toBe("96%");
      expect(formatPercentageMetric(100, true)).toBe("100%");
      expect(formatPercentageMetric(0, true)).toBe("0%");
      expect(formatPercentageMetric(105, true)).toBe("105%");
      expect(formatPercentageMetric(80, true)).toBe("80%");
      expect(formatPercentageMetric(15.5, true)).toBe("15.50%");
    });

    it("11. Verifies ROIC Quality Score is preserved for AAL (0.3443% -> 22/100) and Case 2 (45.20% -> 100/100)", () => {
      expect(scoreROIC(0.3443)).toBe(22);
      expect(scoreROIC(45.2)).toBe(100);
    });

    it("11b. Verifies ROIC 10.84% scores in Good tier (70-84) and tests all ROIC tiers", () => {
      // 10.84% is in Good tier (10% - 15%)
      const score1084 = scoreROIC(10.84);
      expect(score1084).toBe(72);
      expect(score1084).toBeGreaterThanOrEqual(70);
      expect(score1084).toBeLessThanOrEqual(84);
      expect(getMetricAnalysis(score1084)).toBe("Good");

      // Tier 1: Excellent (>= 15%): Score 85-100
      expect(scoreROIC(25)).toBe(100);
      expect(scoreROIC(20)).toBe(93);
      expect(scoreROIC(16)).toBe(87);

      // Tier 2: Good (10% - 15%): Score 70-84
      expect(scoreROIC(15)).toBe(84);
      expect(scoreROIC(14)).toBe(81);
      expect(scoreROIC(12)).toBe(76);
      expect(scoreROIC(11)).toBe(73);

      // Tier 3: Average (6% - 10%): Score 50-69
      expect(scoreROIC(10)).toBe(69);
      expect(scoreROIC(8)).toBe(60);
      expect(scoreROIC(7)).toBe(55);

      // Tier 4: Poor (< 6%): Score 0-49
      expect(scoreROIC(6)).toBe(49);
      expect(scoreROIC(4)).toBe(39);
      expect(scoreROIC(2)).toBe(30);
      expect(scoreROIC(1)).toBe(25);
      expect(scoreROIC(0)).toBe(19);
      expect(scoreROIC(-5)).toBe(0);
    });

    it("12. Formats Historical Valuation decimal premium (0.0395) accurately as 3.95% (never 395.41%)", () => {
      const visaDecimalPremium = 0.039541;
      expect(formatPercentageMetric(visaDecimalPremium, false)).toBe("3.95%");
      expect(formatPercentageMetric(visaDecimalPremium, false)).not.toBe("395.41%");
      expect(formatPercentageMetric(-0.04, false)).toBe("-4.00%");
      expect(formatPercentageMetric(0.125, false)).toBe("12.50%");
    });
  });

  describe("formatMarketCap Display Formatting", () => {
    it("1. Formats 1,000B ($1T) as $1T", () => {
      expect(formatMarketCap(1000000000000)).toBe("$1T");
    });

    it("2. Formats 1,250B ($1.25T) as $1.25T", () => {
      expect(formatMarketCap(1250000000000)).toBe("$1.25T");
    });

    it("3. Formats 2,500B ($2.5T) as $2.5T", () => {
      expect(formatMarketCap(2500000000000)).toBe("$2.5T");
    });

    it("4. Formats 10,000B ($10T) as $10T", () => {
      expect(formatMarketCap(10000000000000)).toBe("$10T");
    });

    it("5. Formats 950B as $950B", () => {
      expect(formatMarketCap(950000000000)).toBe("$950B");
    });

    it("6. Formats 750B as $750B", () => {
      expect(formatMarketCap(750000000000)).toBe("$750B");
    });

    it("7. Handles exact $1T boundary correctly", () => {
      expect(formatMarketCap(1e12)).toBe("$1T");
      expect(formatMarketCap(0.9999e12)).toBe("$999.9B");
    });

    it("8. Handles null, undefined, zero, and negative values gracefully", () => {
      expect(formatMarketCap(null)).toBe("N/A");
      expect(formatMarketCap(undefined)).toBe("N/A");
      expect(formatMarketCap(0)).toBe("N/A");
      expect(formatMarketCap(-100)).toBe("N/A");
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

  it("5. Raw share values are formatted as human-readable shortened numbers with 1 decimal place and NO %", () => {
    expect(formatShortenedShareCount(242017000)).toBe("242.0M");
    expect(formatShortenedShareCount(148404000)).toBe("148.4M");
    expect(formatShortenedShareCount(2500000000)).toBe("2.5B");
    expect(formatShortenedShareCount(22760000000)).toBe("22.8B");
    expect(formatShortenedShareCount(12500)).toBe("12.5K");

    // Regression check: ensure raw numeric string is replaced by shortened M/B format
    expect(formatShortenedShareCount(242017000)).not.toBe("242017000");
    expect(formatShortenedShareCount(242017000)).not.toBe("242017000.00");
    expect(formatShortenedShareCount(148404000)).not.toBe("148404000");
    expect(formatShortenedShareCount(242017000)).not.toContain("%");
    expect(formatShortenedShareCount(148404000)).not.toContain("%");
  });

  it("6. STLD -4.77% annualized share count reduction scores approximately 99/100 Quality Score", () => {
    const stldScore = scoreShareDilution(-4.77);
    expect(stldScore).toBe(99);
  });
});
