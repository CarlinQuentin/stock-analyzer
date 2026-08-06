import { SavedStock } from "../types";

const SAVED_STOCKS_KEY = "stock_analyzer_saved_stocks";

const getStorage = (): Storage | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

export const savedStocksService = {
  getSavedStocks(): SavedStock[] {
    try {
      const storage = getStorage();
      if (!storage) return [];
      const data = storage.getItem(SAVED_STOCKS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to read saved stocks from localStorage", e);
      return [];
    }
  },

  isStockSaved(ticker: string): boolean {
    if (!ticker) return false;
    const stocks = this.getSavedStocks();
    return stocks.some((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
  },

  saveStock(stock: SavedStock): SavedStock[] {
    if (!stock || !stock.ticker) return this.getSavedStocks();
    const stocks = this.getSavedStocks();
    const existingIndex = stocks.findIndex(
      (s) => s.ticker.toUpperCase() === stock.ticker.toUpperCase(),
    );

    const now = new Date().toISOString();
    let updated: SavedStock[];
    if (existingIndex >= 0) {
      updated = [...stocks];
      updated[existingIndex] = {
        ...stocks[existingIndex],
        ...stock,
        lastAnalyzed: now,
      };
    } else {
      updated = [{ ...stock, lastAnalyzed: now }, ...stocks];
    }

    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(SAVED_STOCKS_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error("Failed to save stock to localStorage", e);
    }
    return updated;
  },

  removeStock(ticker: string): SavedStock[] {
    if (!ticker) return this.getSavedStocks();
    const stocks = this.getSavedStocks();
    const updated = stocks.filter(
      (s) => s.ticker.toUpperCase() !== ticker.toUpperCase(),
    );
    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(SAVED_STOCKS_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.error("Failed to remove stock from localStorage", e);
    }
    return updated;
  },

  toggleSaveStock(stock: SavedStock): { isSaved: boolean; stocks: SavedStock[] } {
    if (this.isStockSaved(stock.ticker)) {
      const stocks = this.removeStock(stock.ticker);
      return { isSaved: false, stocks };
    } else {
      const stocks = this.saveStock(stock);
      return { isSaved: true, stocks };
    }
  },
};
