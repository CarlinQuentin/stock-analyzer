import { describe, it, expect, vi, beforeEach } from "vitest";
import { sp500Service } from "./sp500Service";
import { fmpService } from "./financialModelingPrep";

describe("SP500Service Unit Tests", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
      },
    });
    vi.stubGlobal("localStorage", window.localStorage);
    vi.restoreAllMocks();
  });

  it("1. Uses EXACTLY 1 API call to get S&P 500 market data and normalizes sectors", async () => {
    const spy = vi.spyOn(fmpService, "getSP500Constituents").mockResolvedValue([
      { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", price: 220, marketCap: 3300000000000 },
      { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", price: 420, marketCap: 3100000000000 },
      { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financial Services", price: 210, marketCap: 600000000000 },
    ]);

    const data = await sp500Service.getSP500MarketData(true);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(data).toBeDefined();
    expect(data.companies.length).toBe(3);
    expect(data.totalMarketCap).toBe(7000000000000);
    expect(data.sectorSummaries.length).toBe(2);

    const techSector = data.sectorSummaries.find((s) => s.sector === "Information Technology");
    expect(techSector).toBeDefined();
    expect(techSector?.companyCount).toBe(2);
    expect(techSector?.marketCap).toBe(6400000000000);
  });

  it("2. Deduplicates concurrent in-flight requests and reuses localStorage cache", async () => {
    const mockConstituents = vi.spyOn(fmpService, "getSP500Constituents").mockResolvedValue([
      { symbol: "NVDA", name: "NVIDIA Corp", sector: "Technology", price: 125, marketCap: 3000000000000 },
    ]);

    // Concurrent calls share the same in-flight Promise
    const [res1, res2] = await Promise.all([
      sp500Service.getSP500MarketData(true),
      sp500Service.getSP500MarketData(true),
    ]);

    expect(res1.companies[0].symbol).toBe("NVDA");
    expect(res2.companies[0].symbol).toBe("NVDA");
    expect(mockConstituents).toHaveBeenCalledTimes(1); // EXACTLY 1 API call made!

    // Subsequent call uses valid cache
    const cachedData = await sp500Service.getSP500MarketData(false);
    expect(cachedData.companies[0].symbol).toBe("NVDA");
    expect(mockConstituents).toHaveBeenCalledTimes(1); // Still 1 API call!
  });
});
