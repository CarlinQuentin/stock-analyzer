import { describe, it, expect, vi, beforeEach } from "vitest";
import { top500Service } from "./top500Service";
import { fmpService } from "./financialModelingPrep";
import { squarify, CANVAS_MARGIN, getTileContentConfig } from "../components/SP500Treemap";

describe("Top500Service Unit Tests", () => {
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

  it("1. Filters invalid/null/zero market caps, sorts descending by marketCap, and caps to top 100", async () => {
    const mockUnsortedCandidates = [
      { symbol: "SMALL", companyName: "Small Corp", sector: "Industrials", price: 10, marketCap: 50000000 },
      { symbol: "INVALID_ZERO", companyName: "Zero Cap", sector: "Technology", price: 5, marketCap: 0 },
      { symbol: "INVALID_NULL", companyName: "Null Cap", sector: "Technology", price: 5, marketCap: null },
      { symbol: "MEGA", companyName: "Mega Corp", sector: "Technology", price: 200, marketCap: 3000000000000 },
      { symbol: "LARGE", companyName: "Large Corp", sector: "Technology", price: 100, marketCap: 1000000000000 },
    ];

    const spy = vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue(mockUnsortedCandidates);

    const data = await top500Service.getTop500MarketData(true);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(data).toBeDefined();
    // Excluded INVALID_ZERO and INVALID_NULL
    expect(data.companies.length).toBe(3);

    // Explicit descending order verification
    expect(data.companies[0].symbol).toBe("MEGA");
    expect(data.companies[0].marketCap).toBe(3000000000000);
    expect(data.companies[1].symbol).toBe("LARGE");
    expect(data.companies[1].marketCap).toBe(1000000000000);
    expect(data.companies[2].symbol).toBe("SMALL");
    expect(data.companies[2].marketCap).toBe(50000000);
  });

  it("2. Deduplicates concurrent in-flight requests and reuses localStorage cache", async () => {
    const mockScreener = vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue([
      { symbol: "NVDA", companyName: "NVIDIA Corp", sector: "Technology", price: 125, marketCap: 3000000000000 },
    ]);

    // Concurrent calls share the same in-flight Promise
    const [res1, res2] = await Promise.all([
      top500Service.getTop500MarketData(true),
      top500Service.getTop500MarketData(true),
    ]);

    expect(res1.companies[0].symbol).toBe("NVDA");
    expect(res2.companies[0].symbol).toBe("NVDA");
    expect(mockScreener).toHaveBeenCalledTimes(1); // EXACTLY 1 API call made!

    // Subsequent call uses valid cache
    const cachedData = await top500Service.getTop500MarketData(false);
    expect(cachedData.companies[0].symbol).toBe("NVDA");
    expect(mockScreener).toHaveBeenCalledTimes(1); // Still 1 API call!
  });

  it("3. Deduplicates multiple share classes for the same company (e.g. GOOG / GOOGL)", async () => {
    const mockMultiShareCandidates = [
      { symbol: "AAPL", companyName: "Apple Inc.", sector: "Technology", price: 220, marketCap: 3300000000000 },
      { symbol: "GOOGL", companyName: "Alphabet Inc. Class A", sector: "Technology", price: 175, marketCap: 2200000000000 },
      { symbol: "GOOG", companyName: "Alphabet Inc. Class C", sector: "Technology", price: 174, marketCap: 2190000000000 },
      { symbol: "BRK-A", companyName: "Berkshire Hathaway Inc. Class A", sector: "Financials", price: 600000, marketCap: 900000000000 },
      { symbol: "BRK-B", companyName: "Berkshire Hathaway Inc. Class B", sector: "Financials", price: 400, marketCap: 890000000000 },
    ];

    vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue(mockMultiShareCandidates);

    const data = await top500Service.getTop500MarketData(true);

    expect(data.companies.length).toBe(3); // AAPL, GOOGL, BRK-A
    const symbols = data.companies.map((c) => c.symbol);

    expect(symbols).toContain("AAPL");
    expect(symbols.includes("GOOGL") || symbols.includes("GOOG")).toBe(true);
    expect(symbols.includes("GOOGL") && symbols.includes("GOOG")).toBe(false); // NO DUPLICATE!
    expect(symbols.includes("BRK-A") && symbols.includes("BRK-B")).toBe(false); // NO DUPLICATE!
  });

  it("4. Caps candidate pool to top 100 companies by market cap", async () => {
    const candidates = Array.from({ length: 150 }, (_, i) => ({
      symbol: `SYM${i}`,
      companyName: `Company ${i}`,
      sector: "Technology",
      price: 100,
      marketCap: (150 - i) * 1000000000,
    }));

    vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue(candidates);

    const data = await top500Service.getTop500MarketData(true);

    expect(data.companies.length).toBe(100);
    expect(data.companies[0].symbol).toBe("SYM0"); // Highest market cap
    expect(data.companies[99].symbol).toBe("SYM99");
  });

  it("5. Verifies layout squarify bounds stay 100% strictly inside CANVAS_MARGIN", () => {
    const width = 1200;
    const height = 680;
    const canvasBounds = {
      x: CANVAS_MARGIN,
      y: CANVAS_MARGIN,
      w: width - CANVAS_MARGIN * 2,
      h: height - CANVAS_MARGIN * 2,
    };

    const dummyItems = Array.from({ length: 100 }, (_, i) => ({
      data: { symbol: `SYM${i}` },
      value: (100 - i) * 1000,
    }));

    const nodes = squarify(dummyItems, canvasBounds);

    expect(nodes.length).toBe(100);

    nodes.forEach((n) => {
      expect(n.rect.x).toBeGreaterThanOrEqual(CANVAS_MARGIN);
      expect(n.rect.y).toBeGreaterThanOrEqual(CANVAS_MARGIN);
      expect(n.rect.x + n.rect.w).toBeLessThanOrEqual(width - CANVAS_MARGIN + 0.1);
      expect(n.rect.y + n.rect.h).toBeLessThanOrEqual(height - CANVAS_MARGIN + 0.1);
    });
  });

  it("6. Verifies getTileContentConfig scales typography and info visibility based strictly on tile dimensions", () => {
    // Large tile
    const large = getTileContentConfig(100, 60);
    expect(large.showName).toBe(true);
    expect(large.showChange).toBe(true);
    expect(large.tickerFontSize).toBeGreaterThanOrEqual(10);

    // Medium tile
    const medium = getTileContentConfig(45, 30);
    expect(medium.showName).toBe(false);
    expect(medium.showChange).toBe(true);

    // Small tile
    const small = getTileContentConfig(25, 18);
    expect(small.showName).toBe(false);
    expect(small.showChange).toBe(false);
    expect(small.tickerFontSize).toBeGreaterThanOrEqual(8);
  });
});
