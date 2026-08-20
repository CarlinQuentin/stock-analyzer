import { describe, it, expect } from "vitest";
import {
  calculateValuationMetrics,
  calculateValuationPremium,
  scorePERatio,
  scorePSRatio,
  scoreEVSales,
  scorePFCFRatio,
  scoreHistoricalValuation,
  calculateValuationScores,
  calculateOverallValuationScore,
  calculateValuationConfidenceScore,
  getUnavailableValuationMetrics,
  getValuationAnalysis,
} from "./valuationScoring";
import { CompanyProfile, FinancialStatement, ValuationScores } from "../types";
import { getMetricAnalysis, getScoreCategory } from "./scoring";

describe("calculateValuationPremium", () => {
  it("should calculate premium when Current Multiple is greater than Historical Average Multiple", () => {
    // Current P/FCF = 20x, Historical Avg P/FCF = 15x -> (20 - 15) / 15 = +33.33%
    const premium = calculateValuationPremium(20, 15);
    expect(premium).not.toBeNull();
    expect(premium!).toBeCloseTo(0.333333, 4);
  });

  it("should calculate discount when Current Multiple is less than Historical Average Multiple", () => {
    // Current P/E = 12x, Historical Avg P/E = 15x -> (12 - 15) / 15 = -20%
    const discount = calculateValuationPremium(12, 15);
    expect(discount).not.toBeNull();
    expect(discount!).toBeCloseTo(-0.2, 4);
  });

  it("should calculate zero premium/discount when Current Multiple equals Historical Average Multiple", () => {
    // Current P/S = 15x, Historical Avg P/S = 15x -> (15 - 15) / 15 = 0%
    const equal = calculateValuationPremium(15, 15);
    expect(equal).not.toBeNull();
    expect(equal!).toBe(0);
  });

  it("should return null if any input is null, zero, or negative", () => {
    expect(calculateValuationPremium(null, 15)).toBeNull();
    expect(calculateValuationPremium(20, null)).toBeNull();
    expect(calculateValuationPremium(0, 15)).toBeNull();
    expect(calculateValuationPremium(20, 0)).toBeNull();
    expect(calculateValuationPremium(-10, 15)).toBeNull();
    expect(calculateValuationPremium(20, -15)).toBeNull();
  });
});

describe("Individual Valuation Multiplier Scoring", () => {
  it("scorePERatio should score P/E ratio according to documented tiers", () => {
    expect(scorePERatio(null)).toBeNull();
    expect(scorePERatio(undefined)).toBeNull();
    expect(scorePERatio(-5)).toBeNull();
    expect(scorePERatio(0)).toBeNull();

    // Tier 1: Excellent (< 10.0x): Score 85-100
    expect(scorePERatio(5.0)).toBe(100);
    expect(scorePERatio(8.0)).toBe(91);
    expect(scorePERatio(10.0)).toBe(85);

    // Tier 2: Good (10.0x - 20.0x): Score 70-84
    expect(scorePERatio(12.0)).toBe(81);
    expect(scorePERatio(15.0)).toBe(77);
    expect(scorePERatio(20.0)).toBe(70);

    // Tier 3: Average (20.0x - 35.0x): Score 50-69
    expect(scorePERatio(25.0)).toBe(63);
    expect(scorePERatio(30.0)).toBe(56);
    expect(scorePERatio(33.40)).toBe(52); // Visa
    expect(scorePERatio(35.0)).toBe(50);

    // Tier 4: Poor (> 35.0x): Score 0-49
    expect(scorePERatio(40.0)).toBe(41);
    expect(scorePERatio(50.0)).toBe(26);
    expect(scorePERatio(60.0)).toBe(10);
  });

  it("scorePSRatio should score P/S ratio according to documented tiers", () => {
    expect(scorePSRatio(null)).toBeNull();
    expect(scorePSRatio(undefined)).toBeNull();
    expect(scorePSRatio(-2)).toBeNull();
    expect(scorePSRatio(0)).toBeNull();

    // Tier 1: Excellent (< 1.5x): Score 85-100
    expect(scorePSRatio(0.5)).toBe(100);
    expect(scorePSRatio(1.0)).toBe(93);
    expect(scorePSRatio(1.5)).toBe(85);

    // Tier 2: Good (1.5x - 3.5x): Score 70-84
    expect(scorePSRatio(2.0)).toBe(81);
    expect(scorePSRatio(2.5)).toBe(77);
    expect(scorePSRatio(3.5)).toBe(70);

    // Tier 3: Average (3.5x - 6.0x): Score 50-69
    expect(scorePSRatio(4.0)).toBe(65);
    expect(scorePSRatio(5.0)).toBe(58);
    expect(scorePSRatio(6.0)).toBe(50);

    // Tier 4: Poor (> 6.0x): Score 0-49
    expect(scorePSRatio(8.0)).toBe(36);
    expect(scorePSRatio(12.0)).toBe(10);
    expect(scorePSRatio(16.57)).toBe(0); // Visa
  });

  it("scoreEVSales should score EV/Sales ratio according to documented tiers", () => {
    expect(scoreEVSales(null)).toBeNull();
    expect(scoreEVSales(undefined)).toBeNull();
    expect(scoreEVSales(-1)).toBeNull();
    expect(scoreEVSales(0)).toBeNull();

    // Tier 1: Excellent (< 1.5x): Score 85-100
    expect(scoreEVSales(0.5)).toBe(100);
    expect(scoreEVSales(1.0)).toBe(93);
    expect(scoreEVSales(1.5)).toBe(85);

    // Tier 2: Good (1.5x - 3.5x): Score 70-84
    expect(scoreEVSales(2.0)).toBe(81);
    expect(scoreEVSales(2.5)).toBe(77);
    expect(scoreEVSales(3.5)).toBe(70);

    // Tier 3: Average (3.5x - 6.0x): Score 50-69
    expect(scoreEVSales(4.0)).toBe(65);
    expect(scoreEVSales(5.0)).toBe(58);
    expect(scoreEVSales(6.0)).toBe(50);

    // Tier 4: Poor (> 6.0x): Score 0-49
    expect(scoreEVSales(8.0)).toBe(36);
    expect(scoreEVSales(12.0)).toBe(10);
    expect(scoreEVSales(16.70)).toBe(0); // Visa
  });

  it("scorePFCFRatio should score P/FCF ratio according to documented tiers", () => {
    expect(scorePFCFRatio(null)).toBeNull();
    expect(scorePFCFRatio(undefined)).toBeNull();
    expect(scorePFCFRatio(-10)).toBeNull();
    expect(scorePFCFRatio(0)).toBeNull();

    // Tier 1: Excellent (< 12.0x): Score 85-100
    expect(scorePFCFRatio(6.0)).toBe(100);
    expect(scorePFCFRatio(10.0)).toBe(90);
    expect(scorePFCFRatio(12.0)).toBe(85);

    // Tier 2: Good (12.0x - 20.0x): Score 70-84
    expect(scorePFCFRatio(15.0)).toBe(79);
    expect(scorePFCFRatio(18.0)).toBe(74);
    expect(scorePFCFRatio(20.0)).toBe(70);

    // Tier 3: Average (20.0x - 35.0x): Score 50-69
    expect(scorePFCFRatio(25.0)).toBe(63);
    expect(scorePFCFRatio(30.0)).toBe(56);
    expect(scorePFCFRatio(30.73)).toBe(55); // Visa
    expect(scorePFCFRatio(35.0)).toBe(50);

    // Tier 4: Poor (> 35.0x): Score 0-49
    expect(scorePFCFRatio(40.0)).toBe(41);
    expect(scorePFCFRatio(55.0)).toBe(18);
    expect(scorePFCFRatio(60.0)).toBe(10);
  });

  it("scoreHistoricalValuation should score discount or premium relative to history according to documented tiers", () => {
    expect(scoreHistoricalValuation(null)).toBeNull();
    expect(scoreHistoricalValuation(undefined)).toBeNull();
    expect(scoreHistoricalValuation(NaN)).toBeNull();

    // Tier 1: Excellent (< -15%): Score 85-100
    expect(scoreHistoricalValuation(-0.40)).toBe(100);
    expect(scoreHistoricalValuation(-0.30)).toBe(100);
    expect(scoreHistoricalValuation(-0.20)).toBe(90);
    expect(scoreHistoricalValuation(-0.15)).toBe(85);

    // Tier 2: Good (-15% to +10%): Score 70-84
    expect(scoreHistoricalValuation(-0.10)).toBe(81);
    expect(scoreHistoricalValuation(0.00)).toBe(76);
    expect(scoreHistoricalValuation(0.0395)).toBe(73); // Visa (+3.95%)
    expect(scoreHistoricalValuation(0.10)).toBe(70);

    // Tier 3: Average (+10% to +25%): Score 50-69
    expect(scoreHistoricalValuation(0.15)).toBe(63);
    expect(scoreHistoricalValuation(0.20)).toBe(56);
    expect(scoreHistoricalValuation(0.25)).toBe(50);

    // Tier 4: Poor (> +25%): Score 0-49
    expect(scoreHistoricalValuation(0.30)).toBe(41);
    expect(scoreHistoricalValuation(0.40)).toBe(26);
    expect(scoreHistoricalValuation(0.50)).toBe(10);
    expect(scoreHistoricalValuation(0.60)).toBe(0);
  });
});

describe("calculateValuationMetrics", () => {
  it("should calculate valuation metrics from company profile and statement data", () => {
    const profile: CompanyProfile = {
      symbol: "TEST",
      companyName: "Test Corp",
      sector: "Technology",
      industry: "Software",
      price: 100,
      mktCap: 1000000000,
    };
    const incomeStatements: FinancialStatement[] = [
      { date: "2024-12-31", eps: 5.0, revenue: 200000000, netIncome: 50000000 },
    ];
    const balanceSheets: FinancialStatement[] = [
      { date: "2024-12-31", totalDebt: 100000000, cashAndCashEquivalents: 50000000 },
    ];
    const cashFlowStatements: FinancialStatement[] = [
      { date: "2024-12-31", operatingCashFlow: 80000000, capitalExpenditure: 30000000 },
    ];

    const keyMetrics: any[] = [];
    const financialRatios: any[] = [];

    const metrics = calculateValuationMetrics(
      profile,
      incomeStatements,
      balanceSheets,
      cashFlowStatements,
      keyMetrics,
      financialRatios
    );

    // P/E = 100 / 5 = 20
    expect(metrics.peRatio).toBe(20);
    // P/S = 1B / 200M = 5
    expect(metrics.priceToSalesRatio).toBe(5);
    // FCF = 80M - 30M = 50M. P/FCF = 1B / 50M = 20
    expect(metrics.priceToFreeCashFlowsRatio).toBe(20);
  });
});

describe("Valuation Scoring Aggregations", () => {
  const sampleScores: ValuationScores = {
    pe: 80,
    ps: 70,
    evs: 60,
    pfcf: 90,
    historical: 75,
  };

  it("calculateValuationScores should generate scores from metrics", () => {
    const metrics = {
      peRatio: 15,
      priceToSalesRatio: 2.0,
      evToSales: 2.5,
      priceToFreeCashFlowsRatio: 12,
      historicalPeAverage: 20,
      historicalPsAverage: 3.0,
      historicalEvsAverage: 3.5,
      historicalPfcfAverage: 15,
      averagePremium: -0.2,
    };
    const scores = calculateValuationScores(metrics);
    expect(scores.pe).not.toBeNull();
    expect(scores.ps).not.toBeNull();
    expect(scores.historical).not.toBeNull();
  });

  it("calculateOverallValuationScore should average valid valuation scores", () => {
    const overall = calculateOverallValuationScore(sampleScores);
    expect(overall).toBe(75); // (80+70+60+90+75)/5 = 375/5 = 75
  });

  it("calculateValuationConfidenceScore & getUnavailableValuationMetrics should track missing metrics", () => {
    const partialScores: ValuationScores = {
      pe: 80,
      ps: 70,
      evs: null,
      pfcf: null,
      historical: 75,
    };
    // 3 out of 5 valid = 60%
    expect(calculateValuationConfidenceScore(partialScores)).toBe(60);
    const unavailable = getUnavailableValuationMetrics(partialScores);
    expect(unavailable).toContain("EV/Sales");
    expect(unavailable).toContain("P/FCF Ratio");
  });

  it("getValuationAnalysis should return appropriate evaluation text", () => {
    expect(getValuationAnalysis(85).label).toContain("Undervalued");
    expect(getValuationAnalysis(65).label).toContain("Fairly Valued");
    expect(getValuationAnalysis(45).label).toContain("Fully Valued");
    expect(getValuationAnalysis(20).label).toContain("Overvalued");
  });

  describe("Visa Specific Historical Valuation Premium & Quality Score", () => {
    it("calculates individual premiums and composite +4.0% premium accurately for Visa", () => {
      // Visa's exact multiples from detailed valuation analysis:
      // P/E: (33.40 - 32.66) / 32.66 = +2.27% (+2.3%)
      // P/S: (16.57 - 15.46) / 15.46 = +7.18% (+7.2%)
      // EV/Sales: (16.70 - 15.74) / 15.74 = +6.10% (+6.1%)
      // P/FCF: (30.73 - 30.65) / 30.65 = +0.26% (+0.3%)
      const pePrem = calculateValuationPremium(33.40, 32.66);
      const psPrem = calculateValuationPremium(16.57, 15.46);
      const evsPrem = calculateValuationPremium(16.70, 15.74);
      const pfcfPrem = calculateValuationPremium(30.73, 30.65);

      expect(pePrem).not.toBeNull();
      expect(psPrem).not.toBeNull();
      expect(evsPrem).not.toBeNull();
      expect(pfcfPrem).not.toBeNull();

      expect(pePrem! * 100).toBeCloseTo(2.266, 1);
      expect(psPrem! * 100).toBeCloseTo(7.180, 1);
      expect(evsPrem! * 100).toBeCloseTo(6.099, 1);
      expect(pfcfPrem! * 100).toBeCloseTo(0.261, 1);

      // Composite premium: average of the 4 individual decimal premiums
      const compositePrem = (pePrem! + psPrem! + evsPrem! + pfcfPrem!) / 4;
      expect(compositePrem).toBeCloseTo(0.0395, 3); // ~ +3.95% (+4.0%)

      // Verify quality score for Visa's ~+3.95% premium falls within Good tier (70-84)
      const qualityScore = scoreHistoricalValuation(compositePrem);
      expect(qualityScore).toBe(73); // Good tier (Score 70-84)
      expect(qualityScore).toBeGreaterThanOrEqual(70);
      expect(qualityScore).toBeLessThanOrEqual(84);

      // Verify label and color classification
      expect(getMetricAnalysis(qualityScore)).toBe("Good");
      expect(getScoreCategory(qualityScore!).label).toBe("Good");
      expect(getScoreCategory(qualityScore!).color).toBe("blue");

      // Regression: Verify averagePremium is a decimal fraction (0.0395), NOT pre-multiplied (3.95 or 395.41)
      expect(compositePrem).toBeLessThan(1.0);
      expect(compositePrem * 100).toBeCloseTo(3.95, 1);
    });
  });
});

