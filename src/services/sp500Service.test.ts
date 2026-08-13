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

  it("1. Fetches constituents and batch quotes to compute market caps and sector summaries", async () => {
    vi.spyOn(fmpService, "getSP500Constituents").mockResolvedValue([
      { symbol: "AAPL", name: "Apple Inc.", sector: "Information Technology" },
      { symbol: "MSFT", name: "Microsoft Corp.", sector: "Information Technology" },
      { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
    ]);

    vi.spyOn(fmpService, "getBatchQuotes").mockResolvedValue([
      { symbol: "AAPL", name: "Apple Inc.", price: 220, change: 2.2, changesPercentage: 1.0, marketCap: 3300000000000 },
      { symbol: "MSFT", name: "Microsoft Corp.", price: 420, change: -4.2, changesPercentage: -1.0, marketCap: 3100000000000 },
      { symbol: "JPM", name: "JPMorgan Chase & Co.", price: 210, change: 1.05, changesPercentage: 0.5, marketCap: 600000000000 },
    ]);

    const data = await sp500Service.getSP500MarketData(true);

    expect(data).toBeDefined();
    expect(data.companies.length).toBe(3);
    expect(data.totalMarketCap).toBe(7000000000000);
    expect(data.sectorSummaries.length).toBe(2);

    const techSector = data.sectorSummaries.find((s) => s.sector === "Information Technology");
    expect(techSector).toBeDefined();
    expect(techSector?.companyCount).toBe(2);
    expect(techSector?.marketCap).toBe(6400000000000);
  });

  it("2. Caches S&P 500 market data in localStorage to prevent unnecessary API calls", async () => {
    const mockConstituents = vi.spyOn(fmpService, "getSP500Constituents").mockResolvedValue([
      { symbol: "NVDA", name: "NVIDIA Corp", sector: "Information Technology" },
    ]);
    vi.spyOn(fmpService, "getBatchQuotes").mockResolvedValue([
      { symbol: "NVDA", name: "NVIDIA Corp", price: 125, change: 2.5, changesPercentage: 2.0, marketCap: 3000000000000 },
    ]);

    // First call populates cache
    const firstCallData = await sp500Service.getSP500MarketData(true);
    expect(firstCallData.companies[0].symbol).toBe("NVDA");
    expect(mockConstituents).toHaveBeenCalledTimes(1);

    // Second call reuses cache
    const cachedData = await sp500Service.getSP500MarketData(false);
    expect(cachedData.companies[0].symbol).toBe("NVDA");
    expect(mockConstituents).toHaveBeenCalledTimes(1); // Not called again
  });
});
