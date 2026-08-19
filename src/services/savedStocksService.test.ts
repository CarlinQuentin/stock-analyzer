import { describe, it, expect, beforeEach, vi } from "vitest";
import { savedStocksService } from "./savedStocksService";
import { UserProfile } from "./authService";
import { supabase } from "./supabaseClient";

describe("savedStocksService (Persistent User Saved Stocks & Security)", () => {
  let currentUserSession: any = null;
  let mockDbRows: Array<{ id: string; user_id: string; ticker: string; created_at: string }> = [];

  const userA: UserProfile = {
    id: "user-uuid-111",
    email: "user_a@example.com",
    name: "User Alpha",
  };

  const userB: UserProfile = {
    id: "user-uuid-222",
    email: "user_b@example.com",
    name: "User Beta",
  };

  const anonymousUser: UserProfile = {
    id: "anon-uuid-999",
    email: "",
    name: "Guest",
  };

  beforeEach(() => {
    mockDbRows = [];
    currentUserSession = null;

    vi.spyOn(supabase.auth, "getUser").mockImplementation(async () => {
      if (!currentUserSession) {
        return { data: { user: null }, error: null } as any;
      }
      return { data: { user: currentUserSession }, error: null } as any;
    });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table !== "saved_stocks") {
        return {} as any;
      }

      return {
        select: (_columns: string) => ({
          eq: (column: string, value: any) => ({
            order: (_orderCol: string, _opts: any) => {
              const filtered = mockDbRows.filter((row) => (row as any)[column] === value);
              return Promise.resolve({ data: filtered, error: null });
            },
          }),
        }),
        upsert: (record: any, _opts: any) => {
          const cleanTicker = (record.ticker || "").trim().toUpperCase();
          const existingIndex = mockDbRows.findIndex(
            (r) => r.user_id === record.user_id && r.ticker === cleanTicker
          );
          if (existingIndex >= 0) {
            mockDbRows[existingIndex] = {
              ...mockDbRows[existingIndex],
              created_at: record.created_at || new Date().toISOString(),
            };
          } else {
            mockDbRows.unshift({
              id: `id-${Date.now()}-${Math.random()}`,
              user_id: record.user_id,
              ticker: cleanTicker,
              created_at: record.created_at || new Date().toISOString(),
            });
          }
          return Promise.resolve({ error: null });
        },
        delete: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              mockDbRows = mockDbRows.filter(
                (r) => !((r as any)[col1] === val1 && (r as any)[col2] === val2)
              );
              return Promise.resolve({ error: null });
            },
          }),
        }),
      } as any;
    });
  });

  describe("Anonymous / Unauthenticated Security Enforcement", () => {
    it("should return empty array when getSavedStocks is called with null or undefined user", async () => {
      const stocksNull = await savedStocksService.getSavedStocks(null);
      expect(stocksNull).toEqual([]);

      const stocksUndefined = await savedStocksService.getSavedStocks(undefined);
      expect(stocksUndefined).toEqual([]);
    });

    it("should return empty array when getSavedStocks is called for an anonymous user", async () => {
      const stocks = await savedStocksService.getSavedStocks(anonymousUser);
      expect(stocks).toEqual([]);
    });

    it("should reject saveStock when called with unauthenticated user (null/undefined)", async () => {
      await expect(savedStocksService.saveStock("AAPL", null)).rejects.toThrow(
        "Authentication required: Anonymous users cannot save stocks."
      );
    });

    it("should reject saveStock when called with an anonymous visitor profile", async () => {
      await expect(savedStocksService.saveStock("AAPL", anonymousUser)).rejects.toThrow(
        "Authentication required: Anonymous users cannot save stocks."
      );
    });

    it("should reject toggleSaveStock when called for an anonymous user", async () => {
      await expect(savedStocksService.toggleSaveStock("AAPL", null, [])).rejects.toThrow(
        "Authentication required: Anonymous users cannot save stocks."
      );
    });
  });

  describe("Authenticated User Save, Retrieve, and Unsave", () => {
    it("should save and retrieve stocks for an authenticated user", async () => {
      currentUserSession = { id: userA.id, email: userA.email, is_anonymous: false };

      const saved = await savedStocksService.saveStock("AAPL", userA);
      expect(saved.length).toBe(1);
      expect(saved[0].ticker).toBe("AAPL");

      const retrieved = await savedStocksService.getSavedStocks(userA);
      expect(retrieved.length).toBe(1);
      expect(savedStocksService.isStockSaved("AAPL", retrieved)).toBe(true);
      expect(savedStocksService.isStockSaved("aapl", retrieved)).toBe(true);
    });

    it("should remove saved stock correctly for an authenticated user", async () => {
      currentUserSession = { id: userA.id, email: userA.email, is_anonymous: false };

      await savedStocksService.saveStock("AAPL", userA);
      await savedStocksService.saveStock("MSFT", userA);

      let stocks = await savedStocksService.getSavedStocks(userA);
      expect(stocks.length).toBe(2);

      stocks = await savedStocksService.removeStock("AAPL", userA);
      expect(stocks.length).toBe(1);
      expect(savedStocksService.isStockSaved("AAPL", stocks)).toBe(false);
      expect(savedStocksService.isStockSaved("MSFT", stocks)).toBe(true);
    });

    it("should toggle save status correctly for an authenticated user", async () => {
      currentUserSession = { id: userA.id, email: userA.email, is_anonymous: false };

      // 1. First toggle: saves stock
      const res1 = await savedStocksService.toggleSaveStock("TSLA", userA, []);
      expect(res1.isSaved).toBe(true);
      expect(res1.stocks.length).toBe(1);
      expect(res1.stocks[0].ticker).toBe("TSLA");

      // 2. Second toggle: removes stock
      const res2 = await savedStocksService.toggleSaveStock("TSLA", userA, res1.stocks);
      expect(res2.isSaved).toBe(false);
      expect(res2.stocks.length).toBe(0);
    });
  });

  describe("User Isolation & Cross-Account Access Prevention", () => {
    it("should isolate saved stocks strictly between different user accounts", async () => {
      // User A signs in and saves AAPL and MSFT
      currentUserSession = { id: userA.id, email: userA.email, is_anonymous: false };
      await savedStocksService.saveStock("AAPL", userA);
      await savedStocksService.saveStock("MSFT", userA);

      // User B signs in -> initially has empty saved list
      currentUserSession = { id: userB.id, email: userB.email, is_anonymous: false };
      const stocksBInitial = await savedStocksService.getSavedStocks(userB);
      expect(stocksBInitial.length).toBe(0);

      // User B saves NVDA
      await savedStocksService.saveStock("NVDA", userB);

      // User A signs back in -> AAPL & MSFT only
      currentUserSession = { id: userA.id, email: userA.email, is_anonymous: false };
      const stocksA = await savedStocksService.getSavedStocks(userA);
      expect(stocksA.length).toBe(2);
      expect(savedStocksService.isStockSaved("AAPL", stocksA)).toBe(true);
      expect(savedStocksService.isStockSaved("MSFT", stocksA)).toBe(true);
      expect(savedStocksService.isStockSaved("NVDA", stocksA)).toBe(false);

      // User B signs in -> NVDA only
      currentUserSession = { id: userB.id, email: userB.email, is_anonymous: false };
      const stocksB = await savedStocksService.getSavedStocks(userB);
      expect(stocksB.length).toBe(1);
      expect(savedStocksService.isStockSaved("NVDA", stocksB)).toBe(true);
      expect(savedStocksService.isStockSaved("AAPL", stocksB)).toBe(false);
      expect(savedStocksService.isStockSaved("MSFT", stocksB)).toBe(false);
    });
  });

  describe("Duplicate Protection & Normalization", () => {
    it("should normalize lowercase and padded ticker symbols", async () => {
      currentUserSession = { id: userA.id, email: userA.email, is_anonymous: false };
      await savedStocksService.saveStock("  aapl  ", userA);
      const stocks = await savedStocksService.getSavedStocks(userA);
      expect(stocks.length).toBe(1);
      expect(stocks[0].ticker).toBe("AAPL");
    });

    it("should prevent duplicate saved stock records for the same user and ticker", async () => {
      currentUserSession = { id: userA.id, email: userA.email, is_anonymous: false };
      await savedStocksService.saveStock("GOOGL", userA);
      await savedStocksService.saveStock("googl", userA);
      await savedStocksService.saveStock("GOOGL", userA);

      const stocks = await savedStocksService.getSavedStocks(userA);
      expect(stocks.length).toBe(1);
      expect(stocks[0].ticker).toBe("GOOGL");
    });
  });

  describe("Storage Integrity & Isolation", () => {
    it("should return empty when querying local storage for null user id", () => {
      expect(savedStocksService.getFromLocalStorage(null)).toEqual([]);
      expect(savedStocksService.getFromLocalStorage(undefined)).toEqual([]);
    });
  });
});
