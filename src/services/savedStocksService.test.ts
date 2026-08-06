import { describe, it, expect, beforeEach } from "vitest";
import { savedStocksService } from "./savedStocksService";
import { SavedStock } from "../types";

describe("savedStocksService (Account-Scoped)", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
      length: 0,
      key: () => null,
    };
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.localStorage = mockStorage;
  });

  it("should return empty array when no stocks are saved for a user", async () => {
    const stocks = await savedStocksService.getSavedStocks("user-123");
    expect(stocks).toEqual([]);
  });

  it("should save and retrieve stocks for a specific user ID", async () => {
    const stock: SavedStock = {
      ticker: "AAPL",
      companyName: "Apple Inc.",
      score: 85,
      lastAnalyzed: new Date().toISOString(),
      sector: "Technology",
    };

    const saved = await savedStocksService.saveStock(stock, "user-123");
    expect(saved.length).toBe(1);
    expect(saved[0].ticker).toBe("AAPL");

    const retrieved = await savedStocksService.getSavedStocks("user-123");
    expect(savedStocksService.isStockSaved("AAPL", retrieved)).toBe(true);
    expect(savedStocksService.isStockSaved("aapl", retrieved)).toBe(true);
  });

  it("should isolate saved stocks between different user accounts", async () => {
    const stockA1: SavedStock = {
      ticker: "AAPL",
      companyName: "Apple Inc.",
      score: 85,
      lastAnalyzed: new Date().toISOString(),
    };
    const stockA2: SavedStock = {
      ticker: "MSFT",
      companyName: "Microsoft Corp.",
      score: 90,
      lastAnalyzed: new Date().toISOString(),
    };

    // User A saves AAPL and MSFT
    await savedStocksService.saveStock(stockA1, "user-A");
    await savedStocksService.saveStock(stockA2, "user-A");

    // User B checks saved stocks -> empty
    let stocksB = await savedStocksService.getSavedStocks("user-B");
    expect(stocksB.length).toBe(0);

    // User B saves NVDA
    const stockB1: SavedStock = {
      ticker: "NVDA",
      companyName: "NVIDIA Corp.",
      score: 95,
      lastAnalyzed: new Date().toISOString(),
    };
    await savedStocksService.saveStock(stockB1, "user-B");

    // User A inspects their stocks -> AAPL & MSFT only
    const stocksA = await savedStocksService.getSavedStocks("user-A");
    expect(stocksA.length).toBe(2);
    expect(savedStocksService.isStockSaved("AAPL", stocksA)).toBe(true);
    expect(savedStocksService.isStockSaved("MSFT", stocksA)).toBe(true);
    expect(savedStocksService.isStockSaved("NVDA", stocksA)).toBe(false);

    // User B inspects their stocks -> NVDA only
    stocksB = await savedStocksService.getSavedStocks("user-B");
    expect(stocksB.length).toBe(1);
    expect(savedStocksService.isStockSaved("NVDA", stocksB)).toBe(true);
    expect(savedStocksService.isStockSaved("AAPL", stocksB)).toBe(false);
  });

  it("should migrate legacy global saved stocks into the user account and remove global key", async () => {
    // Simulate legacy global data
    const legacyStock: SavedStock = {
      ticker: "GOOGL",
      companyName: "Alphabet Inc.",
      score: 88,
      lastAnalyzed: new Date().toISOString(),
    };
    store["stock_analyzer_saved_stocks"] = JSON.stringify([legacyStock]);

    // Fetch for user -> legacy stock is migrated
    const stocks = await savedStocksService.getSavedStocks("user-migrated");
    expect(stocks.length).toBe(1);
    expect(stocks[0].ticker).toBe("GOOGL");

    // Legacy key is cleared
    expect(store["stock_analyzer_saved_stocks"]).toBeUndefined();
  });

  it("should prevent duplicate saved stock entries per user", async () => {
    const stock: SavedStock = {
      ticker: "AMZN",
      companyName: "Amazon.com Inc.",
      score: 82,
      lastAnalyzed: "2026-01-01T00:00:00.000Z",
    };

    await savedStocksService.saveStock(stock, "user-dup");
    await savedStocksService.saveStock({ ...stock, score: 87 }, "user-dup");

    const stocks = await savedStocksService.getSavedStocks("user-dup");
    expect(stocks.length).toBe(1);
    expect(stocks[0].score).toBe(87);
  });

  it("should toggle save status correctly per user", async () => {
    const stock: SavedStock = {
      ticker: "TSLA",
      companyName: "Tesla Inc.",
      score: 75,
      lastAnalyzed: new Date().toISOString(),
    };

    // First toggle: saves stock
    const res1 = await savedStocksService.toggleSaveStock(stock, "user-toggle");
    expect(res1.isSaved).toBe(true);
    expect(res1.stocks.length).toBe(1);

    // Second toggle: removes stock
    const res2 = await savedStocksService.toggleSaveStock(stock, "user-toggle");
    expect(res2.isSaved).toBe(false);
    expect(res2.stocks.length).toBe(0);
  });
});
