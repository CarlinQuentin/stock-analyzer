import { describe, it, expect, beforeEach } from "vitest";
import { savedStocksService } from "./savedStocksService";
import { SavedStock } from "../types";

describe("savedStocksService", () => {
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

  it("should return empty array when no stocks are saved", () => {
    expect(savedStocksService.getSavedStocks()).toEqual([]);
  });

  it("should save a new stock successfully", () => {
    const stock: SavedStock = {
      ticker: "AAPL",
      companyName: "Apple Inc.",
      score: 85,
      lastAnalyzed: new Date().toISOString(),
      sector: "Technology",
    };

    const saved = savedStocksService.saveStock(stock);
    expect(saved.length).toBe(1);
    expect(saved[0].ticker).toBe("AAPL");
    expect(savedStocksService.isStockSaved("AAPL")).toBe(true);
    expect(savedStocksService.isStockSaved("aapl")).toBe(true);
  });

  it("should update an existing saved stock when saved again", () => {
    const stock1: SavedStock = {
      ticker: "MSFT",
      companyName: "Microsoft Corp.",
      score: 80,
      lastAnalyzed: "2026-01-01T00:00:00.000Z",
    };
    savedStocksService.saveStock(stock1);

    const stock2: SavedStock = {
      ticker: "MSFT",
      companyName: "Microsoft Corp.",
      score: 90,
      lastAnalyzed: "2026-08-06T00:00:00.000Z",
    };
    const updated = savedStocksService.saveStock(stock2);
    expect(updated.length).toBe(1);
    expect(updated[0].score).toBe(90);
  });

  it("should remove a stock successfully", () => {
    const stock: SavedStock = {
      ticker: "GOOGL",
      companyName: "Alphabet Inc.",
      score: 88,
      lastAnalyzed: new Date().toISOString(),
    };
    savedStocksService.saveStock(stock);
    expect(savedStocksService.isStockSaved("GOOGL")).toBe(true);

    const remaining = savedStocksService.removeStock("GOOGL");
    expect(remaining.length).toBe(0);
    expect(savedStocksService.isStockSaved("GOOGL")).toBe(false);
  });

  it("should toggle save status correctly", () => {
    const stock: SavedStock = {
      ticker: "NVDA",
      companyName: "NVIDIA Corp.",
      score: 92,
      lastAnalyzed: new Date().toISOString(),
    };

    // First toggle: saves stock
    const res1 = savedStocksService.toggleSaveStock(stock);
    expect(res1.isSaved).toBe(true);
    expect(res1.stocks.length).toBe(1);

    // Second toggle: removes stock
    const res2 = savedStocksService.toggleSaveStock(stock);
    expect(res2.isSaved).toBe(false);
    expect(res2.stocks.length).toBe(0);
  });
});
