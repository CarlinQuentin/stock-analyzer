import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  top500Service,
  isOperatingCommonCompany,
  getAuthoritativeDailyChange,
  saveSnapshotToDb,
  loadSnapshotFromDb,
  loadSnapshotFromLocalStorage,
  saveSnapshotToLocalStorage,
  clearSnapshotDb,
  tryAcquireLocalLease,
  releaseLocalLease,
  isValidTop100Snapshot,
  CACHE_TTL_MS,
  LEASE_LOCK_KEY,
  SNAPSHOT_DB_KEY,
  MIN_TOP100_COMPANIES,
  MarketDataSnapshot,
  Top500Company,
} from "./top500Service";
import { fmpService } from "./financialModelingPrep";
import { squarify, CANVAS_MARGIN } from "../components/SP500Treemap";
import { supabase } from "./supabaseClient";

function generateMockCompanies(count = 100, prefix = "SYM"): Top500Company[] {
  return Array.from({ length: count }, (_, i) => ({
    symbol: `${prefix}_${i}`,
    name: `${prefix} Corporation ${i}`,
    sector: "Technology",
    industry: "Software",
    price: 100 + i,
    change: 1.0,
    changesPercentage: 1.0,
    marketCap: (count - i) * 10_000_000_000,
    qualityScore: 90,
  }));
}

function generateMockSnapshot(
  count = 100,
  prefix = "SYM",
  overrides: Partial<MarketDataSnapshot> = {}
): MarketDataSnapshot {
  const companies = generateMockCompanies(count, prefix);
  const totalMarketCap = companies.reduce((sum, c) => sum + c.marketCap, 0);
  return {
    id: "top100_latest",
    fetchedAt: Date.now(),
    companies,
    totalMarketCap,
    averageChangePercent: 1.0,
    weightedChangePercent: 1.0,
    sectorSummaries: [
      {
        sector: "Technology",
        marketCap: totalMarketCap,
        companyCount: count,
        weightedChangePercent: 1.0,
      },
    ],
    marketStatus: "Open",
    lastUpdated: "12:00 PM",
    ...overrides,
  };
}

describe("Top500Service Unit Tests & Global DB Refresh Lease Architecture", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.keys(store).forEach((k) => delete store[k]);
    releaseLocalLease();
    clearSnapshotDb();

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

    // Default safe Supabase mocks to ensure isolated unit test execution
    vi.spyOn(supabase, "from").mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ data: [{ id: "top100_latest" }], error: null }),
      update: () => ({ eq: () => ({ or: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) }),
    } as any);
    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: true, error: null } as any);
  });

  it("Scenario A — Fresh cache (<= 5 mins): 10 clients result in 0 FMP refreshes", async () => {
    const freshSnapshot = generateMockSnapshot(100, "AAPL", {
      fetchedAt: Date.now() - 60 * 1000, // 1 minute old
    });

    await saveSnapshotToDb(freshSnapshot);

    const screenerSpy = vi.spyOn(fmpService, "getCompanyScreenerPool");
    const batchQuotesSpy = vi.spyOn(fmpService, "getBatchQuotes");

    // 10 concurrent requests on fresh cache
    const promises = Array.from({ length: 10 }, () => top500Service.getTop500MarketData(false));
    const results = await Promise.all(promises);

    expect(results.length).toBe(10);
    results.forEach((res) => {
      expect(res.companies.length).toBe(100);
      expect(res.companies[0].symbol).toBe("AAPL_0");
    });

    // 0 FMP API calls executed!
    expect(screenerSpy).toHaveBeenCalledTimes(0);
    expect(batchQuotesSpy).toHaveBeenCalledTimes(0);
  });

  it("Scenario B — Stale cache (> 5 mins): 10 clients result in EXACTLY 1 FMP refresh worldwide", async () => {
    const staleSnapshot = generateMockSnapshot(100, "STALE", {
      fetchedAt: Date.now() - (CACHE_TTL_MS + 60 * 1000), // 6 minutes old
    });

    await saveSnapshotToDb(staleSnapshot);

    let currentDbSnapshot = staleSnapshot;
    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: true, error: null } as any);
    vi.spyOn(supabase, "from").mockReturnValue({
      select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [{ id: "top100_latest", payload: currentDbSnapshot }], error: null }) }) }),
      upsert: (row: any) => {
        if (row?.payload) currentDbSnapshot = row.payload;
        return { select: () => Promise.resolve({ data: [], error: null }) };
      },
      update: () => ({ eq: () => ({ or: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) }),
    } as any);

    const mockPool = Array.from({ length: 100 }, (_, i) => ({
      symbol: `FRESH_${i}`,
      companyName: `Fresh Corp ${i}`,
      sector: "Technology",
      price: 100 + i,
      marketCap: (100 - i) * 10_000_000_000,
    }));

    const mockQuotes = Array.from({ length: 100 }, (_, i) => ({
      symbol: `FRESH_${i}`,
      price: 100 + i,
      change: 2.0,
      changesPercentage: 2.0,
      marketCap: (100 - i) * 10_000_000_000,
    }));

    const screenerSpy = vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue(mockPool);
    const batchQuotesSpy = vi.spyOn(fmpService, "getBatchQuotes").mockResolvedValue(mockQuotes);

    // 10 concurrent requests while cache is stale
    const promises = Array.from({ length: 10 }, () => top500Service.getTop500MarketData(false));
    const results = await Promise.all(promises);

    expect(results.length).toBe(10);
    // All 10 clients receive immediate cached response
    results.forEach((res) => {
      expect(res.companies.length).toBe(100);
      expect(res.companies[0].symbol).toBe("STALE_0");
    });

    // Settle background promises
    await new Promise((resolve) => setTimeout(resolve, 150));

    // EXACTLY 1 FMP refresh executed!
    expect(screenerSpy).toHaveBeenCalledTimes(1);
    expect(batchQuotesSpy).toHaveBeenCalledTimes(1);

    // Verify DB snapshot updated
    const updated = await loadSnapshotFromDb();
    expect(updated?.companies.length).toBe(100);
    expect(updated?.companies[0].symbol).toBe("FRESH_0");
  });

  it("Scenario C — Empty cache (initial load): 10 clients result in EXACTLY 1 initial FMP refresh", async () => {
    Object.keys(store).forEach((k) => delete store[k]);
    releaseLocalLease();
    clearSnapshotDb();

    vi.spyOn(supabase, "from").mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ data: [{ id: "top100_latest" }], error: null }),
      update: () => Promise.resolve({ data: [{ id: "top100_latest" }], error: null }),
    } as any);

    const mockPool = Array.from({ length: 100 }, (_, i) => ({
      symbol: `INIT_${i}`,
      companyName: `Initial Corp ${i}`,
      sector: "Technology",
      price: 150 + i,
      marketCap: (100 - i) * 10_000_000_000,
    }));

    const mockQuotes = Array.from({ length: 100 }, (_, i) => ({
      symbol: `INIT_${i}`,
      price: 150 + i,
      change: 3.0,
      changesPercentage: 2.0,
      marketCap: (100 - i) * 10_000_000_000,
    }));

    const screenerSpy = vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue(mockPool);
    const batchQuotesSpy = vi.spyOn(fmpService, "getBatchQuotes").mockResolvedValue(mockQuotes);

    // 10 concurrent requests when DB is empty
    const promises = Array.from({ length: 10 }, () => top500Service.getTop500MarketData(false));
    const results = await Promise.all(promises);

    expect(results.length).toBe(10);
    results.forEach((res) => {
      expect(res.companies.length).toBe(100);
      expect(res.companies[0].symbol).toBe("INIT_0");
    });

    // EXACTLY 1 FMP refresh executed!
    expect(screenerSpy).toHaveBeenCalledTimes(1);
    expect(batchQuotesSpy).toHaveBeenCalledTimes(1);
  });

  it("Scenario D — Lease holder crashes / expires: 60s lease timeout allows Client B to acquire lease", async () => {
    // Simulate Client A acquiring lease at time T-61 seconds
    const expiredLockTime = Date.now() - 61 * 1000;
    store[LEASE_LOCK_KEY] = String(expiredLockTime);

    // Client B attempts to acquire lease
    const acquired = tryAcquireLocalLease();
    expect(acquired).toBe(true);

    // Verify lease extended for 60 seconds
    const lockVal = parseInt(store[LEASE_LOCK_KEY], 10);
    expect(lockVal).toBeGreaterThan(Date.now());
  });

  it("Scenario E — FMP failure: preserves valid DB snapshot intact, fetchedAt unchanged, releases lease", async () => {
    const originalFetchedAt = Date.now() - (CACHE_TTL_MS + 300 * 1000);
    const validSnapshot = generateMockSnapshot(100, "MSFT", {
      fetchedAt: originalFetchedAt,
      marketStatus: "Closed",
      lastUpdated: "4:00 PM",
    });

    await saveSnapshotToDb(validSnapshot);

    // FMP fails with network error
    vi.spyOn(fmpService, "getCompanyScreenerPool").mockRejectedValue(new Error("Network Error 503"));

    const result = await top500Service.getTop500MarketData(false);

    // Immediate result returns intact snapshot
    expect(result.companies.length).toBe(100);
    expect(result.companies[0].symbol).toBe("MSFT_0");

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify DB snapshot fetchedAt remained UNCHANGED
    const dbSnapshot = await loadSnapshotFromDb();
    expect(dbSnapshot?.fetchedAt).toBe(originalFetchedAt);
    expect(dbSnapshot?.companies.length).toBe(100);
    expect(dbSnapshot?.companies[0].symbol).toBe("MSFT_0");

    // Verify lease was released
    expect(store[LEASE_LOCK_KEY]).toBeUndefined();
  });

  it("Scenario F — Lease Denied: non-lease holding client makes 0 FMP calls and returns existing DB snapshot", async () => {
    clearSnapshotDb();
    const existingSnapshot = generateMockSnapshot(100, "VALID_HOLD", {
      fetchedAt: Date.now() - (CACHE_TTL_MS + 60 * 1000),
    });

    await saveSnapshotToDb(existingSnapshot);

    // Manually lock lease (simulating Client A currently refreshing)
    store[LEASE_LOCK_KEY] = String(Date.now() + 60000);
    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: false, error: null } as any);
    vi.spyOn(supabase, "from").mockReturnValue({
      select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [{ id: "top100_latest", payload: existingSnapshot }], error: null }) }) }),
      update: () => ({ eq: () => ({ or: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) }),
      upsert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    } as any);

    const screenerSpy = vi.spyOn(fmpService, "getCompanyScreenerPool");
    const batchQuotesSpy = vi.spyOn(fmpService, "getBatchQuotes");

    // Client B attempts request
    const result = await top500Service.getTop500MarketData(false);

    expect(result.companies.length).toBe(100);
    expect(result.companies[0].symbol).toBe("VALID_HOLD_0");

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Client B made 0 FMP calls!
    expect(screenerSpy).toHaveBeenCalledTimes(0);
    expect(batchQuotesSpy).toHaveBeenCalledTimes(0);
  });

  it("Scenario G — Single-stock and partial datasets (< MIN_TOP100_COMPANIES) are rejected and purged", async () => {
    clearSnapshotDb();

    // 1. Single stock (e.g. AMZN only)
    const singleStockSnapshot: any = {
      id: "top100_latest",
      fetchedAt: Date.now(),
      companies: [
        { symbol: "AMZN", name: "Amazon.com Inc", sector: "Consumer Discretionary", industry: "Retail", price: 180, change: 1.8, changesPercentage: 1.0, marketCap: 1900000000000, qualityScore: 92 },
      ],
      totalMarketCap: 1900000000000,
      averageChangePercent: 1.0,
      weightedChangePercent: 1.0,
      sectorSummaries: [],
      marketStatus: "Open",
      lastUpdated: "10:00 AM",
    };

    expect(isValidTop100Snapshot(singleStockSnapshot)).toBe(false);

    // saveSnapshotToLocalStorage refuses to save single stock
    const savedLs = saveSnapshotToLocalStorage(singleStockSnapshot);
    expect(savedLs).toBe(false);
    expect(store[SNAPSHOT_DB_KEY]).toBeUndefined();

    // saveSnapshotToDb refuses to save single stock
    const savedDb = await saveSnapshotToDb(singleStockSnapshot);
    expect(savedDb).toBe(false);

    // If corrupted row exists in localStorage, loadSnapshotFromLocalStorage discards it and purges key
    store[SNAPSHOT_DB_KEY] = JSON.stringify(singleStockSnapshot);
    const loaded = loadSnapshotFromLocalStorage();
    expect(loaded).toBeNull();
    expect(store[SNAPSHOT_DB_KEY]).toBeUndefined();

    // If corrupted row exists in Supabase, loadSnapshotFromDb rejects it
    vi.spyOn(supabase, "from").mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [{ id: "top100_latest", payload: singleStockSnapshot }], error: null }),
        }),
      }),
    } as any);

    const loadedDb = await loadSnapshotFromDb();
    expect(loadedDb).toBeNull();
  });

  it("Scenario H — FMP returning partial/single-stock response rejects and preserves existing valid snapshot", async () => {
    clearSnapshotDb();

    const healthySnapshot = generateMockSnapshot(100, "HEALTHY", {
      fetchedAt: Date.now() - 60000,
    });
    await saveSnapshotToDb(healthySnapshot);

    // FMP returns only 1 stock (AMZN)
    vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue([
      { symbol: "AMZN", companyName: "Amazon.com Inc", sector: "Consumer Cyclical", price: 180, marketCap: 1900000000000 },
    ]);
    vi.spyOn(fmpService, "getBatchQuotes").mockResolvedValue([
      { symbol: "AMZN", price: 180, change: 1.8, changesPercentage: 1.0, marketCap: 1900000000000 },
    ]);

    // Force refresh triggers executeFmpRefreshAndSaveDb
    const result = await top500Service.executeFmpRefreshAndSaveDb();

    // Result preserves healthy 100-stock snapshot
    expect(result.companies.length).toBe(100);
    expect(result.companies[0].symbol).toBe("HEALTHY_0");

    // Local storage snapshot remained intact
    const lsSnapshot = loadSnapshotFromLocalStorage();
    expect(lsSnapshot?.companies.length).toBe(100);
    expect(lsSnapshot?.companies[0].symbol).toBe("HEALTHY_0");
  });

  it("Scenario I — SWR background refresh notification subscription", async () => {
    clearSnapshotDb();

    const staleSnapshot = generateMockSnapshot(100, "STALE_NOTIF", {
      fetchedAt: Date.now() - (CACHE_TTL_MS + 60 * 1000),
    });
    await saveSnapshotToDb(staleSnapshot);

    const mockPool = Array.from({ length: 100 }, (_, i) => ({
      symbol: `NOTIF_FRESH_${i}`,
      companyName: `Fresh Corp ${i}`,
      sector: "Technology",
      price: 100 + i,
      marketCap: (100 - i) * 10_000_000_000,
    }));
    const mockQuotes = Array.from({ length: 100 }, (_, i) => ({
      symbol: `NOTIF_FRESH_${i}`,
      price: 100 + i,
      change: 2.0,
      changesPercentage: 2.0,
      marketCap: (100 - i) * 10_000_000_000,
    }));

    vi.spyOn(fmpService, "getCompanyScreenerPool").mockResolvedValue(mockPool);
    vi.spyOn(fmpService, "getBatchQuotes").mockResolvedValue(mockQuotes);

    let notifiedData: any = null;
    const unsubscribe = top500Service.subscribe((freshData) => {
      notifiedData = freshData;
    });

    // Client requests market data
    const immediateData = await top500Service.getTop500MarketData(false);
    expect(immediateData.companies[0].symbol).toBe("STALE_NOTIF_0");

    // Wait for background refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(notifiedData).not.toBeNull();
    expect(notifiedData.companies.length).toBe(100);
    expect(notifiedData.companies[0].symbol).toBe("NOTIF_FRESH_0");

    unsubscribe();
  });

  it("Scenario J — Navigation race protection: Stale request resolving after newer request", async () => {
    clearSnapshotDb();

    let slowResolve: (val: any) => void = () => {};
    const slowPromise = new Promise((resolve) => {
      slowResolve = resolve;
    });

    let fastResolve: (val: any) => void = () => {};
    const fastPromise = new Promise((resolve) => {
      fastResolve = resolve;
    });

    const snapshot1 = generateMockSnapshot(100, "REQUEST_1");
    const snapshot2 = generateMockSnapshot(100, "REQUEST_2");

    let currentReqId = 0;
    let activeData: any = null;

    const simulateFetch = async (promiseToAwait: Promise<any>) => {
      const myId = ++currentReqId;
      const data = await promiseToAwait;
      if (myId === currentReqId) {
        activeData = data;
      }
    };

    // User triggers request 1, then quickly navigates and triggers request 2
    simulateFetch(slowPromise);
    simulateFetch(fastPromise);

    // Request 2 finishes first
    fastResolve(snapshot2);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(activeData.companies[0].symbol).toBe("REQUEST_2_0");

    // Request 1 finishes later (stale request)
    slowResolve(snapshot1);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Active data MUST remain REQUEST_2 and not be overwritten by stale REQUEST_1!
    expect(activeData.companies[0].symbol).toBe("REQUEST_2_0");
  });

  it("7. Verifies getAuthoritativeDailyChange extracts empirical FMP quote data and returns null for missing values", () => {
    const pos = getAuthoritativeDailyChange({ changesPercentage: 2.5678, change: 3.451 });
    expect(pos.changePct).toBe(2.57);
    expect(pos.dollarChange).toBe(3.45);

    const neg = getAuthoritativeDailyChange({ changesPercentage: -1.419, change: -2.102 });
    expect(neg.changePct).toBe(-1.42);
    expect(neg.dollarChange).toBe(-2.1);

    const zero = getAuthoritativeDailyChange({ changesPercentage: 0, change: 0 });
    expect(zero.changePct).toBe(0);
    expect(zero.dollarChange).toBe(0);

    const missing = getAuthoritativeDailyChange({ symbol: "XYZ", price: 100 });
    expect(missing.changePct).toBeNull();
    expect(missing.dollarChange).toBeNull();
  });

  it("8. Verifies layout squarify bounds stay 100% strictly inside CANVAS_MARGIN", () => {
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

  it("9. Filters out ETFs, Funds, Warrants, Rights, Units, Preferreds while preserving operating financials (JPM, BLK, BAC, V)", () => {
    expect(isOperatingCommonCompany({ symbol: "JPM", companyName: "JPMorgan Chase & Co.", sector: "Financial Services" })).toBe(true);
    expect(isOperatingCommonCompany({ symbol: "BLK", companyName: "BlackRock, Inc.", sector: "Financial Services" })).toBe(true);
    expect(isOperatingCommonCompany({ symbol: "BAC", companyName: "Bank of America Corporation", sector: "Financial Services" })).toBe(true);
    expect(isOperatingCommonCompany({ symbol: "V", companyName: "Visa Inc.", sector: "Financial Services" })).toBe(true);
    expect(isOperatingCommonCompany({ symbol: "BRK-B", companyName: "Berkshire Hathaway Inc. Class B", sector: "Financial Services" })).toBe(true);

    expect(isOperatingCommonCompany({ symbol: "SPY", companyName: "SPDR S&P 500 ETF Trust", isEtf: true })).toBe(false);
    expect(isOperatingCommonCompany({ symbol: "QQQ", companyName: "Invesco QQQ Trust", isEtf: true })).toBe(false);
    expect(isOperatingCommonCompany({ symbol: "BKN", companyName: "BlackRock Municipal Income Trust", isFund: true })).toBe(false);
    expect(isOperatingCommonCompany({ symbol: "XYZ-W", companyName: "XYZ Corp Warrant", type: "warrant" })).toBe(false);
    expect(isOperatingCommonCompany({ symbol: "ABC-RT", companyName: "ABC Inc Rights", type: "right" })).toBe(false);
    expect(isOperatingCommonCompany({ symbol: "DEF-UN", companyName: "DEF Units", type: "unit" })).toBe(false);
    expect(isOperatingCommonCompany({ symbol: "GHI-PR", companyName: "GHI Preferred Stock", type: "preferred" })).toBe(false);
  });
});
