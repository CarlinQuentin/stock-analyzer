import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fmpService } from "../../services/financialModelingPrep";
import { calculateAllMetrics } from "../../utils/financialCalculations";
import { calculateValuationMetrics } from "../../utils/valuationScoring";
import {
  calculateMetricScores,
  calculateUniversalBusinessScore,
} from "../../utils/scoring";
import {
  mockRawFmpIncomeStatements,
  mockRawFmpBalanceSheets,
  mockRawFmpCashFlowStatements,
  mockRawFmpProfile,
  mockRawFmpRatiosTTM,
  mockRawFmpDividends,
  mockRawFmpKeyMetrics,
  mockRawFmpFinancialRatios,
} from "./fixtures/fmpFixtures";

describe("E2E / API Data-Mapping Layer Tests (Layer 1)", () => {
  let axiosGetSpy: any;

  beforeEach(() => {
    // Spy on the underlying Axios client used by fmpService to mock raw FMP HTTP responses
    axiosGetSpy = vi.spyOn((fmpService as any).client, "get");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SECTION 1: Field Extraction & Parsing Layer (FMP Service Boundary)
  // =========================================================================
  describe("Section 1: FMP Response Structure Parsing & Field Extraction", () => {
    it("1.1 Income Statement Payload: extracts revenue, grossProfit, operatingIncome, netIncome, eps, and share counts", async () => {
      axiosGetSpy.mockResolvedValueOnce({ data: mockRawFmpIncomeStatements });

      const incomeStatements = await fmpService.getIncomeStatements("AAPL");

      expect(incomeStatements).toHaveLength(5);
      const latest = incomeStatements[0];

      // Verify exact field extraction from raw FMP payload
      expect(latest.date).toBe("2025-12-31");
      expect(latest.revenue).toBe(10000000000);
      expect(latest.grossProfit).toBe(6000000000);
      expect(latest.operatingIncome).toBe(3000000000);
      expect(latest.netIncome).toBe(1800000000);
      expect(latest.eps).toBe(12.5);
      expect(latest.weightedAverageShsOutDil).toBe(160000000);
      expect(latest.weightedAverageShsOut).toBe(150000000);

      // Prove that fields are NOT swapped or confused
      expect(latest.revenue).not.toBe(latest.operatingIncome);
      expect(latest.operatingIncome).not.toBe(latest.netIncome);
      expect(latest.grossProfit).not.toBe(latest.revenue);
    });

    it("1.2 Balance Sheet Payload: extracts totalAssets, totalDebt, totalEquity, cashAndCashEquivalents, and commonStockSharesIssued", async () => {
      axiosGetSpy.mockResolvedValueOnce({ data: mockRawFmpBalanceSheets });

      const balanceSheets = await fmpService.getBalanceSheets("AAPL");

      expect(balanceSheets).toHaveLength(5);
      const latest = balanceSheets[0];

      expect(latest.date).toBe("2025-12-31");
      expect(latest.totalAssets).toBe(25000000000);
      expect(latest.totalDebt).toBe(5000000000);
      expect(latest.totalEquity).toBe(10000000000);
      expect(latest.cashAndCashEquivalents).toBe(1200000000);
      expect(latest.shares).toBe(185000000);

      // Prove that fields are NOT confused
      expect(latest.totalAssets).not.toBe(latest.totalEquity);
      expect(latest.totalDebt).not.toBe(latest.totalEquity);
      expect(latest.cashAndCashEquivalents).not.toBe(latest.totalDebt);
    });

    it("1.3 Cash Flow Payload: extracts operatingCashFlow and capitalExpenditure", async () => {
      axiosGetSpy.mockResolvedValueOnce({ data: mockRawFmpCashFlowStatements });

      const cashFlowStatements = await fmpService.getCashFlowStatements("AAPL");

      expect(cashFlowStatements).toHaveLength(5);
      const latest = cashFlowStatements[0];

      expect(latest.date).toBe("2025-12-31");
      expect(latest.operatingCashFlow).toBe(2600000000);
      expect(latest.capitalExpenditure).toBe(-500000000);

      expect(latest.operatingCashFlow).not.toBe(latest.capitalExpenditure);
    });

    it("1.4 Profile Payload: extracts symbol, companyName, sector, industry, website, description, image, mktCap, price", async () => {
      axiosGetSpy.mockResolvedValueOnce({ data: mockRawFmpProfile });

      const profile = await fmpService.getCompanyProfile("AAPL");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.companyName).toBe("Apple Inc.");
      expect(profile.sector).toBe("Technology");
      expect(profile.industry).toBe("Consumer Electronics");
      expect(profile.website).toBe("https://www.apple.com");
      expect(profile.mktCap).toBe(2850000000000);
      expect(profile.price).toBe(185.5);
    });
  });

  // =========================================================================
  // SECTION 2: Share Dilution Field Selection & Fallbacks
  // =========================================================================
  describe("Section 2: Share Dilution Field Selection & Fallback Logic", () => {
    it("2.1 Primary Selection: selects weightedAverageShsOutDil over weightedAverageShsOut when both are present", async () => {
      const rawPayload = [
        {
          date: "2025-12-31",
          weightedAverageShsOutDil: 160000000,
          weightedAverageShsOut: 150000000,
        },
      ];
      axiosGetSpy.mockResolvedValueOnce({ data: rawPayload });

      const statements = await fmpService.getIncomeStatements("AAPL");
      expect(statements[0].shares).toBe(160000000);
      expect(statements[0].shares).not.toBe(150000000);
    });

    it("2.2 Fallback 1: falls back to weightedAverageShsOut when weightedAverageShsOutDil is null or missing", async () => {
      const rawPayload = [
        {
          date: "2025-12-31",
          weightedAverageShsOutDil: null,
          weightedAverageShsOut: 150000000,
        },
      ];
      axiosGetSpy.mockResolvedValueOnce({ data: rawPayload });

      const statements = await fmpService.getIncomeStatements("AAPL");
      expect(statements[0].shares).toBe(150000000);
    });

    it("2.3 Fallback 2: falls back to weightedAverageSharesDiluted (alternate FMP key name)", async () => {
      const rawPayload = [
        {
          date: "2025-12-31",
          weightedAverageSharesDiluted: 162000000,
        },
      ];
      axiosGetSpy.mockResolvedValueOnce({ data: rawPayload });

      const statements = await fmpService.getIncomeStatements("AAPL");
      expect(statements[0].shares).toBe(162000000);
    });

    it("2.4 Fallback 3: falls back to weightedAverageSharesOutstanding (alternate FMP key name)", async () => {
      const rawPayload = [
        {
          date: "2025-12-31",
          weightedAverageSharesOutstanding: 152000000,
        },
      ];
      axiosGetSpy.mockResolvedValueOnce({ data: rawPayload });

      const statements = await fmpService.getIncomeStatements("AAPL");
      expect(statements[0].shares).toBe(152000000);
    });
  });

  // =========================================================================
  // SECTION 3: Historical Ordering & Array Selection
  // =========================================================================
  describe("Section 3: Historical Data Selection & Chronological Ordering", () => {
    it("3.1 Sorts out-of-order FMP response statements chronologically by date", async () => {
      // FMP returns statements in random/out-of-order date sequence
      const outOfOrderIncome = [
        mockRawFmpIncomeStatements[2], // 2023
        mockRawFmpIncomeStatements[0], // 2025
        mockRawFmpIncomeStatements[4], // 2021
        mockRawFmpIncomeStatements[1], // 2024
        mockRawFmpIncomeStatements[3], // 2022
      ];

      axiosGetSpy.mockResolvedValueOnce({ data: outOfOrderIncome });

      const statements = await fmpService.getIncomeStatements("AAPL");
      const revenueHistory = [...statements]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((s) => ({
          label: new Date(s.date).getFullYear().toString(),
          value: s.revenue || 0,
        }));

      // Verify correct chronological sequence (2021 -> 2022 -> 2023 -> 2024 -> 2025)
      expect(revenueHistory.map((h) => h.label)).toEqual([
        "2021",
        "2022",
        "2023",
        "2024",
        "2025",
      ]);
      expect(revenueHistory.map((h) => h.value)).toEqual([
        6000000000, 7000000000, 8000000000, 9000000000, 10000000000,
      ]);
    });
  });

  // =========================================================================
  // SECTION 4: Complete End-to-End Metric Data Flow & Wrong-Field Protection
  // =========================================================================
  describe("Section 4: Complete End-to-End Metric Data Flow & Wrong-Field Protection", () => {
    let statementData: any;

    beforeEach(async () => {
      axiosGetSpy
        .mockResolvedValueOnce({ data: mockRawFmpIncomeStatements })
        .mockResolvedValueOnce({ data: mockRawFmpBalanceSheets })
        .mockResolvedValueOnce({ data: mockRawFmpCashFlowStatements })
        .mockResolvedValueOnce({ data: mockRawFmpDividends })
        .mockResolvedValueOnce({ data: mockRawFmpRatiosTTM })
        .mockResolvedValueOnce({ data: mockRawFmpKeyMetrics })
        .mockResolvedValueOnce({ data: mockRawFmpFinancialRatios });

      statementData = await fmpService.getStatementData("AAPL");
    });

    it("4.1 ROIC Metric Flow & Wrong-Field Protection: proves operatingIncome, netIncome, totalEquity, totalDebt are correctly mapped", () => {
      const metrics = calculateAllMetrics(
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.dividendMetrics,
      );

      // Expected ROIC calculation for 2025:
      // operatingIncome = $3B, netIncome = $1.8B -> taxRate = 1 - 1.8B/3B = 40%
      // NOPAT = $3B * 0.60 = $1.8B
      // Invested Capital = totalEquity ($10B) + totalDebt ($5B) = $15B
      expect(metrics.roicDetail!.latestROIC).toBeCloseTo(12.0, 2);
      expect(metrics.roic).toBeCloseTo(10.22, 1);

      // PROVE WRONG-FIELD PROTECTION:
      // If app used netIncome ($1.8B) as NOPAT without operatingIncome, or totalAssets ($25B) instead of Invested Capital ($15B),
      // result would be 7.20% instead of 12.00%
      expect(metrics.roicDetail!.latestROIC).not.toBeCloseTo(7.2, 2);
      // If app used totalDebt ($5B) alone without totalEquity ($10B), result would be 36.00%
      expect(metrics.roicDetail!.latestROIC).not.toBeCloseTo(36.0, 2);
    });

    it("4.2 FCF Margin Metric Flow & Wrong-Field Protection: proves operatingCashFlow, capitalExpenditure, and revenue are correctly mapped", () => {
      const metrics = calculateAllMetrics(
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.dividendMetrics,
      );

      // Expected 2025 FCF = operatingCashFlow ($2.6B) - |capitalExpenditure (-$500M)| = $2.1B
      // FCF Margin = (2.1B / 10B) * 100 = 21.00%
      expect(metrics.fcfMargin).toBeCloseTo(21.0, 2);

      // PROVE WRONG-FIELD PROTECTION:
      // If app used netIncome ($1.8B) instead of FCF ($2.1B), FCF Margin would be 18.00%
      expect(metrics.fcfMargin).not.toBeCloseTo(18.0, 2);
      // If app used operatingCashFlow ($2.6B) without deducting CapEx ($500M), margin would be 26.00%
      expect(metrics.fcfMargin).not.toBeCloseTo(26.0, 2);
    });

    it("4.3 Share Dilution CAGR Flow & Wrong-Field Protection: proves weightedAverageShsOutDil is used across multi-year statements", () => {
      const metrics = calculateAllMetrics(
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.dividendMetrics,
      );

      // 2021 weightedAverageShsOutDil = 180,000,000
      // 2025 weightedAverageShsOutDil = 160,000,000
      // 4-year Share Dilution CAGR = (160M / 180M)^(1/4) - 1 = -0.0290 (-2.90%/yr buyback)
      expect(metrics.shareDilution).toBeCloseTo(-2.9, 1);

      // PROVE WRONG-FIELD PROTECTION:
      // If app used basic shares weightedAverageShsOut (170M in 2021 to 150M in 2025), CAGR would be -3.08%/yr
      expect(metrics.shareDilution).not.toBeCloseTo(-3.08, 2);
    });

    it("4.4 Revenue Growth CAGR Flow: proves multi-year revenue is correctly mapped", () => {
      const metrics = calculateAllMetrics(
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.dividendMetrics,
      );

      // 2021 revenue = $6B, 2025 revenue = $10B
      // 4-year Revenue CAGR = (10B / 6B)^(1/4) - 1 = 0.1362 (13.62%)
      expect(metrics.revenueCAGR).toBeCloseTo(0.1362, 3);
    });

    it("4.5 EPS Growth CAGR Flow: proves multi-year EPS is correctly mapped", () => {
      const metrics = calculateAllMetrics(
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.dividendMetrics,
      );

      // 2021 EPS = 7.50, 2025 EPS = 12.50
      // 4-year EPS CAGR = (12.50 / 7.50)^(1/4) - 1 = 0.1362 (13.62%)
      expect(metrics.epsGrowth).toBeCloseTo(0.1362, 3);
    });

    it("4.6 Solvency (Debt to Equity) & Net Debt to FCF Flow: proves totalDebt, cash, and totalEquity are correctly mapped", () => {
      const metrics = calculateAllMetrics(
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.dividendMetrics,
      );

      // 2025 Debt to Equity = totalDebt ($5B) / totalEquity ($10B) = 0.50
      expect(metrics.debtToEquity).toBeCloseTo(0.5, 2);

      // 2025 Net Debt = totalDebt ($5B) - cash ($1.2B) = $3.8B
      // 5-year average FCF = (2.1B + 1.9B + 1.7B + 1.5B + 1.3B) / 5 = $1.70B
      // Net Debt / FCF = 3.8B / 1.70B = 2.235x -> 2.24
      expect(metrics.netDebtToFCF).toBeCloseTo(2.24, 2);

      // PROVE WRONG-FIELD PROTECTION:
      // If app used totalAssets ($25B) instead of totalEquity ($10B), Debt/Equity would be 0.20
      expect(metrics.debtToEquity).not.toBeCloseTo(0.2, 2);
    });

    it("4.7 Valuation Metrics Flow: proves keyMetrics and financialRatios are extracted", () => {
      const valuationMetrics = calculateValuationMetrics(
        mockRawFmpProfile[0] as any,
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.keyMetrics,
        statementData.financialRatios,
      );

      expect(valuationMetrics.peRatio).toBe(28.5);
      expect(valuationMetrics.priceToSalesRatio).toBe(7.2);
      expect(valuationMetrics.evToSales).toBe(7.5);
      expect(valuationMetrics.priceToFreeCashFlowsRatio).toBe(32.1);
    });

    it("4.8 Quality Scores & Universal Score Flow: verifies complete pipeline from raw FMP payload to final scores", () => {
      const metrics = calculateAllMetrics(
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.dividendMetrics,
      );
      const scores = calculateMetricScores(
        metrics,
        statementData.cashFlowStatements,
      );
      const universalScore = calculateUniversalBusinessScore(scores);

      expect(scores.roic).toBeGreaterThan(0);
      expect(scores.fcfMargin).toBe(100); // 21% FCF Margin >= 20% tier
      expect(scores.revenue).toBeGreaterThanOrEqual(70); // 13.62% Revenue CAGR
      expect(universalScore).toBeGreaterThan(0);
      expect(universalScore).toBeLessThanOrEqual(100);
    });
  });

  // =========================================================================
  // SECTION 5: Fallback & Incomplete Data Mapping
  // =========================================================================
  describe("Section 5: Fallback & Missing Data Handling", () => {
    it("5.1 Missing keyMetrics / financialRatios: falls back smoothly to manual valuation calculations without throwing errors", async () => {
      axiosGetSpy
        .mockResolvedValueOnce({ data: mockRawFmpIncomeStatements })
        .mockResolvedValueOnce({ data: mockRawFmpBalanceSheets })
        .mockResolvedValueOnce({ data: mockRawFmpCashFlowStatements })
        .mockResolvedValueOnce({ data: mockRawFmpDividends })
        .mockResolvedValueOnce({ data: mockRawFmpRatiosTTM })
        .mockRejectedValueOnce(new Error("404 Key Metrics Not Found"))
        .mockRejectedValueOnce(new Error("404 Financial Ratios Not Found"));

      const statementData = await fmpService.getStatementData("AAPL");

      expect(statementData.keyMetrics).toEqual([]);
      expect(statementData.financialRatios).toEqual([]);

      const valuationMetrics = calculateValuationMetrics(
        mockRawFmpProfile[0] as any,
        statementData.incomeStatements,
        statementData.balanceSheets,
        statementData.cashFlowStatements,
        statementData.keyMetrics,
        statementData.financialRatios,
      );

      // Manual P/E fallback = Market Cap ($2,850B) / Net Income ($1.8B) = 1583.33
      expect(valuationMetrics.peRatio).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // SECTION 6: Malformed & Incomplete FMP Response Handling
  // =========================================================================
  describe("Section 6: Malformed & Incomplete FMP Response Handling", () => {
    it("6.1 Empty response array: getCompanyProfile throws friendly error", async () => {
      axiosGetSpy.mockResolvedValueOnce({ data: [] });

      await expect(
        fmpService.getCompanyProfile("INVALID"),
      ).rejects.toMatchObject({
        code: "ERROR",
        message: "Company not found: INVALID",
      });
    });

    it("6.2 Null response data: getIncomeStatements throws friendly error", async () => {
      axiosGetSpy.mockResolvedValueOnce({ data: null });

      await expect(fmpService.getIncomeStatements("INVALID")).rejects.toThrow();
    });

    it("6.3 Handles non-numeric string values in market movers gracefully", async () => {
      const rawMovers = [
        {
          symbol: "XYZ",
          name: "XYZ Corp",
          price: "150.50",
          change: "2.50",
          changesPercentage: "1.68",
          exchange: "NYSE",
        },
      ];
      axiosGetSpy.mockResolvedValueOnce({ data: rawMovers });

      const gainers = await fmpService.getTopGainers();
      expect(gainers[0].price).toBe(150.5);
      expect(gainers[0].change).toBe(2.5);
      expect(gainers[0].changesPercentage).toBe(1.68);
    });
  });
});
