import { describe, it, expect, vi, beforeEach } from "vitest";
import { competitorDiscoveryService } from "./competitorDiscoveryService";
import { fmpService } from "./financialModelingPrep";
import { CompanyProfile } from "../types";

describe("CompetitorDiscoveryService Unit Tests", () => {
  const mockStldProfile: CompanyProfile = {
    symbol: "STLD",
    companyName: "Steel Dynamics, Inc.",
    sector: "Basic Materials",
    industry: "Steel",
    mktCap: 22000000000,
    price: 135.0,
    description: "Steel Dynamics, Inc. operates as a steel producer and metal recycler in the United States. It manufactures hot-roll, cold-roll, and coated sheet steel products.",
  };

  beforeEach(() => {
    (competitorDiscoveryService as any).inMemoryCache.clear();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  describe("scoreCandidate", () => {
    it("1. Gives highest score to exact industry match + FMP peer signal", () => {
      const candidate = {
        symbol: "NUE",
        companyName: "Nucor Corporation",
        sector: "Basic Materials",
        industry: "Steel",
        mktCap: 38000000000,
        price: 165.0,
        description: "Nucor Corporation manufactures and sells steel and steel products.",
      };

      const scored = competitorDiscoveryService.scoreCandidate(mockStldProfile, candidate, true);

      expect(scored.totalScore).toBeGreaterThanOrEqual(70);
      expect(scored.factors.fmpPeerMatchScore).toBe(30);
      expect(scored.factors.industryScore).toBe(30);
      expect(scored.matchReasonText).toContain("Same Steel industry");
      expect(scored.matchReasonText).toContain("FMP verified market peer");
    });

    it("2. Gives lower score to candidates from different sectors", () => {
      const candidate = {
        symbol: "MSFT",
        companyName: "Microsoft Corporation",
        sector: "Technology",
        industry: "Software",
        mktCap: 3000000000000,
        price: 420.0,
        description: "Microsoft Corporation develops computer software, cloud infrastructure, and consumer electronics.",
      };

      const scored = competitorDiscoveryService.scoreCandidate(mockStldProfile, candidate, false);

      expect(scored.factors.fmpPeerMatchScore).toBe(0);
      expect(scored.factors.industryScore).toBe(0);
      expect(scored.totalScore).toBeLessThan(35);
    });
  });

  describe("discoverCompetitors Engine", () => {
    it("3. Dynamically ranks Steel Dynamics (STLD) peers (NUE, CMC, CLF, MT, X) over tech companies", async () => {
      vi.spyOn(fmpService, "getStockPeers").mockResolvedValue(["NUE", "CMC", "CLF"]);
      vi.spyOn(fmpService, "getIndustryPeers").mockResolvedValue([
        { symbol: "NUE", companyName: "Nucor Corp", industry: "Steel", sector: "Basic Materials" },
        { symbol: "CMC", companyName: "Commercial Metals Co", industry: "Steel", sector: "Basic Materials" },
        { symbol: "CLF", companyName: "Cleveland-Cliffs Inc", industry: "Steel", sector: "Basic Materials" },
        { symbol: "MT", companyName: "ArcelorMittal", industry: "Steel", sector: "Basic Materials" },
        { symbol: "MSFT", companyName: "Microsoft Corp", industry: "Software", sector: "Technology" },
      ]);

      vi.spyOn(fmpService, "getCompanyProfile").mockImplementation(async (sym) => {
        if (sym === "NUE") {
          return {
            symbol: "NUE",
            companyName: "Nucor Corporation",
            sector: "Basic Materials",
            industry: "Steel",
            mktCap: 38000000000,
            price: 165.0,
            description: "Nucor manufactures steel products, hot-rolled steel, and metal recycling.",
          };
        }
        if (sym === "CMC") {
          return {
            symbol: "CMC",
            companyName: "Commercial Metals Company",
            sector: "Basic Materials",
            industry: "Steel",
            mktCap: 6000000000,
            price: 52.0,
            description: "Commercial Metals Company manufactures and recycles steel and metal products.",
          };
        }
        if (sym === "CLF") {
          return {
            symbol: "CLF",
            companyName: "Cleveland-Cliffs Inc.",
            sector: "Basic Materials",
            industry: "Steel",
            mktCap: 9000000000,
            price: 18.0,
            description: "Cleveland-Cliffs is a major flat-rolled steel producer in North America.",
          };
        }
        if (sym === "MT") {
          return {
            symbol: "MT",
            companyName: "ArcelorMittal",
            sector: "Basic Materials",
            industry: "Steel",
            mktCap: 24000000000,
            price: 28.0,
            description: "ArcelorMittal is one of the world's leading steel and mining companies.",
          };
        }
        return {
          symbol: "MSFT",
          companyName: "Microsoft Corporation",
          sector: "Technology",
          industry: "Software",
          mktCap: 3000000000000,
          price: 420.0,
          description: "Microsoft produces operating systems and cloud services.",
        };
      });

      const compData = await competitorDiscoveryService.discoverCompetitors("STLD", mockStldProfile);

      expect(compData.targetSymbol).toBe("STLD");
      expect(compData.competitors.length).toBeGreaterThanOrEqual(4);

      // Top ranked competitors MUST be steel companies (NUE, MT, CLF, CMC)
      const topSymbols = compData.competitors.map((c) => c.symbol);
      expect(topSymbols).toContain("NUE");
      expect(topSymbols[0]).toBe("NUE"); // Highest market cap & exact peer match
      expect(topSymbols).not.toContain("MSFT"); // Tech company filtered out of top ranked competitors!
    });

    it("4. Caches competitor data locally for fast retrieval", async () => {
      vi.spyOn(fmpService, "getStockPeers").mockResolvedValue(["NUE"]);
      vi.spyOn(fmpService, "getCompanyProfile").mockResolvedValue({
        symbol: "NUE",
        companyName: "Nucor",
        sector: "Basic Materials",
        industry: "Steel",
        mktCap: 38000000000,
        price: 165.0,
        description: "Nucor steel.",
      });

      const firstCall = await competitorDiscoveryService.discoverCompetitors("STLD", mockStldProfile);
      expect(firstCall.competitors[0].symbol).toBe("NUE");

      // Reset mocks to ensure second call uses cache without calling fmpService
      vi.restoreAllMocks();
      const spyPeers = vi.spyOn(fmpService, "getStockPeers");

      const secondCall = await competitorDiscoveryService.discoverCompetitors("STLD", mockStldProfile);
      expect(secondCall.competitors[0].symbol).toBe("NUE");
      expect(spyPeers).not.toHaveBeenCalled(); // Served directly from 24h cache!
    });
  });
});
