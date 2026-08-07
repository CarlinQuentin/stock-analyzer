import { describe, it, expect, vi, beforeEach } from "vitest";
import { competitorService } from "./competitorService";
import { competitorDiscoveryService } from "./competitorDiscoveryService";
import { fmpService } from "./financialModelingPrep";
import { CompanyProfile } from "../types";

describe("CompetitorService Unit Tests", () => {
  const mockTargetProfile: CompanyProfile = {
    symbol: "AAPL",
    companyName: "Apple Inc.",
    sector: "Technology",
    industry: "Consumer Electronics",
    mktCap: 3000000000000,
    price: 195.5,
    description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.",
  };

  beforeEach(() => {
    (competitorDiscoveryService as any).inMemoryCache.clear();
    vi.restoreAllMocks();
  });

  it("1. Discovers competitors via FMP stock peers and normalizes company profiles", async () => {
    vi.spyOn(fmpService, "getStockPeers").mockResolvedValue(["MSFT", "GOOGL"]);
    vi.spyOn(fmpService, "getCompanyProfile").mockImplementation(async (sym) => {
      if (sym === "MSFT") {
        return {
          symbol: "MSFT",
          companyName: "Microsoft Corporation",
          sector: "Technology",
          industry: "Software—Infrastructure",
          mktCap: 3100000000000,
          price: 420.0,
          description: "Microsoft Corporation develops and supports software, services, devices, and solutions.",
          image: "https://financialmodelingprep.com/image-stock/MSFT.png",
          website: "https://www.microsoft.com",
        };
      }
      return {
        symbol: "GOOGL",
        companyName: "Alphabet Inc.",
        sector: "Technology",
        industry: "Internet Content & Information",
        mktCap: 2200000000000,
        price: 175.0,
        description: "Alphabet Inc. offers search, advertising, operating systems, and cloud infrastructure.",
        image: "https://financialmodelingprep.com/image-stock/GOOGL.png",
      };
    });

    const compData = await competitorService.fetchCompetitors("AAPL", mockTargetProfile);

    expect(compData.targetSymbol).toBe("AAPL");
    expect(compData.competitors.length).toBeGreaterThanOrEqual(2);

    const msft = compData.competitors.find((c) => c.symbol === "MSFT");
    expect(msft).toBeDefined();
    expect(msft?.companyName).toBe("Microsoft Corporation");
    expect(msft?.reasonForCompetition).toBeDefined();
    expect(msft?.marketCapComparisonRatio).toBeGreaterThan(0.9);
  });

  it("2. Falls back to curated peer map when API returns empty array", async () => {
    vi.spyOn(fmpService, "getStockPeers").mockResolvedValue([]);
    vi.spyOn(fmpService, "getCompanyProfile").mockImplementation(async (sym) => ({
      symbol: sym,
      companyName: `${sym} Corp`,
      sector: "Technology",
      industry: "Consumer Electronics",
      mktCap: 100000000000,
      price: 50.0,
      description: `${sym} is a major technology company.`,
    }));

    const compData = await competitorService.fetchCompetitors("AAPL", mockTargetProfile);

    expect(compData.competitors.length).toBeGreaterThan(0);
    expect(compData.competitors.some((c) => c.symbol === "MSFT" || c.symbol === "GOOGL")).toBe(true);
  });

  it("3. Formats concise descriptions to 1-2 sentences", async () => {
    const longBio = "First sentence about company. Second sentence detailing products. Third sentence with extra historical details. Fourth sentence.";
    vi.spyOn(fmpService, "getStockPeers").mockResolvedValue(["LONG", "MSFT", "GOOGL"]);
    vi.spyOn(fmpService, "getCompanyProfile").mockImplementation(async (sym) => ({
      symbol: sym,
      companyName: `${sym} Corp`,
      sector: "Technology",
      industry: "Software",
      mktCap: 50000000000,
      price: 10.0,
      description: sym === "LONG" ? longBio : `${sym} sentence description.`,
    }));

    const compData = await competitorService.fetchCompetitors("AAPL", mockTargetProfile);
    const longComp = compData.competitors.find((c) => c.symbol === "LONG");

    expect(longComp).toBeDefined();
    expect(longComp?.description).toContain("First sentence about company.");
    expect(longComp?.description).toContain("Second sentence detailing products.");
    expect(longComp?.description).not.toContain("Third sentence");
  });

  it("4. Handles competitor network failure gracefully", async () => {
    vi.spyOn(fmpService, "getStockPeers").mockRejectedValue(new Error("Network Timeout"));
    vi.spyOn(fmpService, "getCompanyProfile").mockRejectedValue(new Error("API failure"));

    const compData = await competitorService.fetchCompetitors("FAIL", mockTargetProfile);

    expect(compData.targetSymbol).toBe("FAIL");
    expect(compData.competitors).toEqual([]);
  });
});
