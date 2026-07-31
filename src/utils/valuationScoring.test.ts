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
  it("scorePERatio should score P/E ratio (lower is better)", () => {
    expect(scorePERatio(null)).toBeNull();
    expect(scorePERatio(-5)).toBeNull();
    expect(scorePERatio(8)).toBe(100); // <= 10 -> 100
    expect(scorePERatio(25)).toBe(66); // ~66
    expect(scorePERatio(60)).toBe(10); // >= 50 -> 10
  });

  it("scorePSRatio should score P/S ratio", () => {
    expect(scorePSRatio(null)).toBeNull();
    expect(scorePSRatio(0.4)).toBe(100); // <= 0.5 -> 100
    expect(scorePSRatio(4.0)).toBe(58);
    expect(scorePSRatio(10.0)).toBe(10); // >= 8.0 -> 10
  });

  it("scoreEVSales should score EV/Sales ratio", () => {
    expect(scoreEVSales(null)).toBeNull();
    expect(scoreEVSales(0.5)).toBe(100);
    expect(scoreEVSales(9.0)).toBe(10);
  });

  it("scorePFCFRatio should score P/FCF ratio", () => {
    expect(scorePFCFRatio(null)).toBeNull();
    expect(scorePFCFRatio(10)).toBe(100);
    expect(scorePFCFRatio(55)).toBe(10);
  });

  it("scoreHistoricalValuation should score discount or premium relative to history", () => {
    expect(scoreHistoricalValuation(null)).toBeNull();
    expect(scoreHistoricalValuation(-0.4)).toBe(100); // <= -30% discount -> 100
    expect(scoreHistoricalValuation(0.0)).toBe(55); // 0% premium -> ~55
    expect(scoreHistoricalValuation(0.4)).toBe(10); // >= +30% premium -> 10
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
});
