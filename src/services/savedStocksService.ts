import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { SavedStock } from "../types";

const LEGACY_STORAGE_KEY = "stock_analyzer_saved_stocks";

const getStorage = (): Storage | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

export const savedStocksService = {
  getStorageKey(userId?: string | null): string {
    if (userId) {
      return `stock_analyzer_saved_stocks_${userId}`;
    }
    return `stock_analyzer_saved_stocks_guest`;
  },

  async getSavedStocks(userId?: string | null): Promise<SavedStock[]> {
    this.migrateLegacyStocks(userId);

    if (
      isSupabaseConfigured &&
      userId &&
      !userId.startsWith("local-") &&
      !userId.startsWith("demo-")
    ) {
      try {
        const { data, error } = await supabase
          .from("saved_stocks")
          .select("*")
          .eq("user_id", userId)
          .order("last_analyzed", { ascending: false });

        if (!error && data) {
          const mapped: SavedStock[] = data.map((row) => ({
            ticker: row.ticker,
            companyName: row.company_name,
            score: Number(row.score),
            lastAnalyzed: row.last_analyzed || new Date().toISOString(),
            sector: row.sector || undefined,
            industry: row.industry || undefined,
            image: row.image || undefined,
          }));
          this.saveToLocalStorage(userId, mapped);
          return mapped;
        }
      } catch (e) {
        console.warn("Supabase fetch saved_stocks warning:", e);
      }
    }

    return this.getFromLocalStorage(userId);
  },

  isStockSaved(ticker: string, currentStocks: SavedStock[]): boolean {
    if (!ticker || !currentStocks) return false;
    return currentStocks.some(
      (s) => s.ticker.toUpperCase() === ticker.toUpperCase(),
    );
  },

  async saveStock(stock: SavedStock, userId?: string | null): Promise<SavedStock[]> {
    if (!userId || !stock || !stock.ticker) return [];
    const cleanTicker = stock.ticker.toUpperCase();
    const now = new Date().toISOString();

    const currentStocks = await this.getSavedStocks(userId);
    const existingIndex = currentStocks.findIndex(
      (s) => s.ticker.toUpperCase() === cleanTicker,
    );

    let updated: SavedStock[];
    if (existingIndex >= 0) {
      updated = [...currentStocks];
      updated[existingIndex] = {
        ...currentStocks[existingIndex],
        ...stock,
        ticker: cleanTicker,
        lastAnalyzed: now,
      };
    } else {
      updated = [{ ...stock, ticker: cleanTicker, lastAnalyzed: now }, ...currentStocks];
    }

    this.saveToLocalStorage(userId, updated);

    if (
      isSupabaseConfigured &&
      userId &&
      !userId.startsWith("local-") &&
      !userId.startsWith("demo-")
    ) {
      try {
        await supabase.from("saved_stocks").upsert(
          {
            user_id: userId,
            ticker: cleanTicker,
            company_name: stock.companyName,
            score: stock.score,
            last_analyzed: now,
            sector: stock.sector || null,
            industry: stock.industry || null,
            image: stock.image || null,
          },
          { onConflict: "user_id,ticker" },
        );
      } catch (e) {
        console.warn("Supabase save stock warning:", e);
      }
    }

    return updated;
  },

  async removeStock(ticker: string, userId?: string | null): Promise<SavedStock[]> {
    if (!userId || !ticker) return [];
    const cleanTicker = ticker.toUpperCase();

    const currentStocks = await this.getSavedStocks(userId);
    const updated = currentStocks.filter(
      (s) => s.ticker.toUpperCase() !== cleanTicker,
    );

    this.saveToLocalStorage(userId, updated);

    if (
      isSupabaseConfigured &&
      userId &&
      !userId.startsWith("local-") &&
      !userId.startsWith("demo-")
    ) {
      try {
        await supabase
          .from("saved_stocks")
          .delete()
          .eq("user_id", userId)
          .eq("ticker", cleanTicker);
      } catch (e) {
        console.warn("Supabase delete stock warning:", e);
      }
    }

    return updated;
  },

  async toggleSaveStock(
    stock: SavedStock,
    userId?: string | null,
  ): Promise<{ isSaved: boolean; stocks: SavedStock[] }> {
    const currentStocks = await this.getSavedStocks(userId);
    if (this.isStockSaved(stock.ticker, currentStocks)) {
      const stocks = await this.removeStock(stock.ticker, userId);
      return { isSaved: false, stocks };
    } else {
      const stocks = await this.saveStock(stock, userId);
      return { isSaved: true, stocks };
    }
  },

  migrateLegacyStocks(userId?: string | null) {
    try {
      const storage = getStorage();
      if (!storage) return;
      const legacyData = storage.getItem(LEGACY_STORAGE_KEY);
      if (legacyData) {
        const legacyStocks: SavedStock[] = JSON.parse(legacyData);
        if (Array.isArray(legacyStocks) && legacyStocks.length > 0) {
          const userKey = this.getStorageKey(userId);
          const existingUserStocks = this.getFromLocalStorage(userId);
          const merged = [...existingUserStocks];
          for (const item of legacyStocks) {
            if (!merged.some((m) => m.ticker.toUpperCase() === item.ticker.toUpperCase())) {
              merged.push(item);
            }
          }
          storage.setItem(userKey, JSON.stringify(merged));
        }
        storage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Legacy migration warning:", e);
    }
  },

  getFromLocalStorage(userId?: string | null): SavedStock[] {
    try {
      const storage = getStorage();
      if (!storage) return [];
      const key = this.getStorageKey(userId);
      const data = storage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveToLocalStorage(userId: string | null | undefined, stocks: SavedStock[]) {
    try {
      const storage = getStorage();
      if (!storage) return;
      const key = this.getStorageKey(userId);
      storage.setItem(key, JSON.stringify(stocks));
    } catch (e) {
      console.error("Failed to save to user-scoped localStorage:", e);
    }
  },
};
