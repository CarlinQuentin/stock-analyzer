import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fmpService } from "./financialModelingPrep";
import {
  mockRawFmpAnalystEstimates,
  mockRawFmpPriceTargetConsensus,
  mockRawFmpPriceTargetSummary,
  mockRawFmpPriceTargetNews,
  mockRawFmpGrades,
} from "../tests/e2e/fixtures/fmpFixtures";

describe("futureOutlookService / fmpService Future Outlook Integration", () => {
  let axiosGetSpy: any;

  beforeEach(() => {
    axiosGetSpy = vi.spyOn((fmpService as any).client, "get");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. getAnalystEstimates: parses EPS, Revenue, and EBITDA estimates with YoY growth calculations", async () => {
    axiosGetSpy.mockResolvedValueOnce({ data: mockRawFmpAnalystEstimates });

    const estimates = await fmpService.getAnalystEstimates("AAPL");

    expect(estimates).toHaveLength(2);
    expect(estimates[0].fiscalYear).toBe("FY 2026");
    expect(estimates[0].epsAvg).toBe(8.8);
    expect(estimates[0].revenueAvg).toBe(477480180873);
    expect(estimates[0].numAnalystsEps).toBe(29);

    expect(estimates[1].fiscalYear).toBe("FY 2027");
    expect(estimates[1].epsAvg).toBe(9.6);
    expect(estimates[1].epsYoYGrowthPct).toBe(9.1); // (9.6 - 8.8) / 8.8 = +9.1%
  });

  it("2. getPriceTargetConsensus: maps price targets, current price, and implied upside %", async () => {
    axiosGetSpy
      .mockResolvedValueOnce({ data: mockRawFmpPriceTargetConsensus })
      .mockResolvedValueOnce({ data: mockRawFmpPriceTargetSummary });

    const target = await fmpService.getPriceTargetConsensus("AAPL", 185.5);

    expect(target).not.toBeNull();
    expect(target?.targetConsensus).toBe(337.43);
    expect(target?.targetHigh).toBe(400);
    expect(target?.targetLow).toBe(245);
    expect(target?.currentPrice).toBe(185.5);
    expect(target?.impliedUpsidePct).toBe(81.9); // (337.43 - 185.5) / 185.5 = +81.9%
  });

  it("3. getFutureOutlookData: aggregates complete datasets and evaluates growth trend statuses", async () => {
    axiosGetSpy
      .mockResolvedValueOnce({ data: mockRawFmpAnalystEstimates })
      .mockResolvedValueOnce({ data: mockRawFmpPriceTargetConsensus })
      .mockResolvedValueOnce({ data: mockRawFmpPriceTargetSummary })
      .mockResolvedValueOnce({ data: mockRawFmpPriceTargetNews })
      .mockResolvedValueOnce({ data: mockRawFmpGrades });

    // Historical EPS CAGR = 0.05 (5.0%), Expected Forward EPS Growth = 9.1% -> Accelerating (> 2.0% diff)
    const futureData = await fmpService.getFutureOutlookData("AAPL", 185.5, 0.05, 0.05);

    expect(futureData.symbol).toBe("AAPL");
    expect(futureData.estimates).toHaveLength(2);
    expect(futureData.priceTarget?.targetConsensus).toBe(337.43);
    expect(futureData.recentPriceTargetNews).toHaveLength(1);
    expect(futureData.recentGrades).toHaveLength(1);
    expect(futureData.epsTrendStatus).toBe("Accelerating");
  });

  it("4. Graceful Fallback: handles missing analyst coverage or empty endpoints cleanly without throwing", async () => {
    axiosGetSpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    const futureData = await fmpService.getFutureOutlookData("UNKNOWN_TICKER", 100);

    expect(futureData.symbol).toBe("UNKNOWN_TICKER");
    expect(futureData.estimates).toEqual([]);
    expect(futureData.priceTarget).toBeNull();
    expect(futureData.recentPriceTargetNews).toEqual([]);
    expect(futureData.recentGrades).toEqual([]);
    expect(futureData.epsTrendStatus).toBe("N/A");
  });
});
