import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { SavedStock } from "../types";
import { UserProfile } from "./authService";

const LOCAL_STORAGE_PREFIX = "stock_analyzer_saved_stocks_";

export const savedStocksService = {
  /**
   * Helper to verify if the provided user profile represents a genuine authenticated user
   */
  isAuthenticatedUser(user?: UserProfile | null): boolean {
    if (!user) return false;
    if (!user.email || !user.email.includes("@")) return false;
    if (user.id?.startsWith("anon-") || user.id?.startsWith("guest-")) return false;
    return true;
  },

  /**
   * Helper to normalize ticker symbol
   */
  normalizeTicker(ticker: string): string {
    return (ticker || "").trim().toUpperCase();
  },

  /**
   * Check if a ticker is in the current saved stocks list
   */
  isStockSaved(ticker: string, currentStocks: SavedStock[]): boolean {
    if (!ticker || !Array.isArray(currentStocks)) return false;
    const clean = this.normalizeTicker(ticker);
    return currentStocks.some((s) => this.normalizeTicker(s.ticker) === clean);
  },

  /**
   * Retrieve saved stocks for the authenticated user from the database.
   * Anonymous or unauthenticated users always return an empty list.
   */
  async getSavedStocks(user?: UserProfile | null | string): Promise<SavedStock[]> {
    // Support either UserProfile object or userId string (if user profile)
    const userProfile: UserProfile | null =
      typeof user === "string"
        ? { id: user, email: user.includes("@") ? user : `${user}@local.dev`, name: user }
        : user || null;

    if (!this.isAuthenticatedUser(userProfile)) {
      return [];
    }

    if (isSupabaseConfigured) {
      // 1. Verify active Supabase session
      const { data: userData } = await supabase.auth.getUser();
      const currentAuthUser = userData?.user;

      if (!currentAuthUser || currentAuthUser.is_anonymous || !currentAuthUser.email) {
        return [];
      }

      // 2. Fetch from Supabase database (RLS ensures only current user's records are returned)
      const { data, error } = await supabase
        .from("saved_stocks")
        .select("id, user_id, ticker, created_at")
        .eq("user_id", currentAuthUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Database fetch saved_stocks error:", error.message);
        throw new Error(`Failed to load saved stocks from database: ${error.message}`);
      }

      const stocks: SavedStock[] = (data || []).map((row) => ({
        id: row.id,
        ticker: this.normalizeTicker(row.ticker),
        created_at: row.created_at,
        lastAnalyzed: row.created_at,
      }));

      return stocks;
    }

    // Local / Offline Fallback Mode for authenticated demo users
    return this.getFromLocalStorage(userProfile?.id);
  },

  /**
   * Save a stock for the authenticated user into the database.
   * Throws an error if the user is unauthenticated or anonymous.
   */
  async saveStock(
    stockOrTicker: SavedStock | string,
    user?: UserProfile | null | string
  ): Promise<SavedStock[]> {
    const userProfile: UserProfile | null =
      typeof user === "string"
        ? { id: user, email: user.includes("@") ? user : `${user}@local.dev`, name: user }
        : user || null;

    if (!userProfile || !this.isAuthenticatedUser(userProfile)) {
      throw new Error("Authentication required: Anonymous users cannot save stocks.");
    }

    const ticker = typeof stockOrTicker === "string" ? stockOrTicker : stockOrTicker.ticker;
    const cleanTicker = this.normalizeTicker(ticker);
    if (!cleanTicker) {
      throw new Error("Invalid ticker symbol.");
    }

    if (isSupabaseConfigured) {
      // 1. Verify active Supabase session
      const { data: userData } = await supabase.auth.getUser();
      const currentAuthUser = userData?.user;

      if (!currentAuthUser || currentAuthUser.is_anonymous || !currentAuthUser.email) {
        throw new Error("Authentication required: Please sign in to save stocks to your account.");
      }

      // 2. Insert into Supabase database with duplicate protection (onConflict user_id, ticker)
      const { error } = await supabase
        .from("saved_stocks")
        .upsert(
          {
            user_id: currentAuthUser.id,
            ticker: cleanTicker,
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id,ticker" }
        );

      if (error) {
        console.error("Database upsert saved_stocks error:", error.message);
        throw new Error(`Failed to save stock to database: ${error.message}`);
      }

      // 3. Return fresh list from database
      return await this.getSavedStocks(userProfile);
    }

    // Local / Offline Fallback Mode for authenticated demo users
    const current = this.getFromLocalStorage(userProfile.id);
    const existingIndex = current.findIndex(
      (s) => this.normalizeTicker(s.ticker) === cleanTicker
    );

    const metadata = typeof stockOrTicker === "object" ? stockOrTicker : {};
    const now = new Date().toISOString();

    let updated: SavedStock[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...metadata,
        ticker: cleanTicker,
        lastAnalyzed: now,
      };
    } else {
      updated = [
        {
          ticker: cleanTicker,
          created_at: now,
          lastAnalyzed: now,
          ...metadata,
        },
        ...current,
      ];
    }

    this.saveToLocalStorage(userProfile.id, updated);
    return updated;
  },

  /**
   * Remove a saved stock for the authenticated user from the database.
   */
  async removeStock(
    ticker: string,
    user?: UserProfile | null | string
  ): Promise<SavedStock[]> {
    const userProfile: UserProfile | null =
      typeof user === "string"
        ? { id: user, email: user.includes("@") ? user : `${user}@local.dev`, name: user }
        : user || null;

    if (!userProfile || !this.isAuthenticatedUser(userProfile)) {
      throw new Error("Authentication required to modify saved stocks.");
    }

    const cleanTicker = this.normalizeTicker(ticker);
    if (!cleanTicker) return this.getSavedStocks(userProfile);

    if (isSupabaseConfigured) {
      // 1. Verify active Supabase session
      const { data: userData } = await supabase.auth.getUser();
      const currentAuthUser = userData?.user;

      if (!currentAuthUser || currentAuthUser.is_anonymous || !currentAuthUser.email) {
        throw new Error("Authentication required: Please sign in to manage saved stocks.");
      }

      // 2. Delete from Supabase database
      const { error } = await supabase
        .from("saved_stocks")
        .delete()
        .eq("user_id", currentAuthUser.id)
        .eq("ticker", cleanTicker);

      if (error) {
        console.error("Database delete saved_stocks error:", error.message);
        throw new Error(`Failed to remove stock from database: ${error.message}`);
      }

      // 3. Return fresh list from database
      return await this.getSavedStocks(userProfile);
    }

    // Local / Offline Fallback Mode for authenticated demo users
    const current = this.getFromLocalStorage(userProfile.id);
    const updated = current.filter((s) => this.normalizeTicker(s.ticker) !== cleanTicker);
    this.saveToLocalStorage(userProfile.id, updated);
    return updated;
  },

  /**
   * Toggle save/unsave state for a stock
   */
  async toggleSaveStock(
    stockOrTicker: SavedStock | string,
    user?: UserProfile | null | string,
    currentStocks: SavedStock[] = []
  ): Promise<{ isSaved: boolean; stocks: SavedStock[] }> {
    const userProfile: UserProfile | null =
      typeof user === "string"
        ? { id: user, email: user.includes("@") ? user : `${user}@local.dev`, name: user }
        : user || null;

    if (!this.isAuthenticatedUser(userProfile)) {
      throw new Error("Authentication required: Anonymous users cannot save stocks.");
    }

    const ticker = typeof stockOrTicker === "string" ? stockOrTicker : stockOrTicker.ticker;
    const cleanTicker = this.normalizeTicker(ticker);

    if (this.isStockSaved(cleanTicker, currentStocks)) {
      const stocks = await this.removeStock(cleanTicker, userProfile);
      return { isSaved: false, stocks };
    } else {
      const stocks = await this.saveStock(stockOrTicker, userProfile);
      return { isSaved: true, stocks };
    }
  },

  // --- Local storage helpers (used strictly in offline demo mode for authenticated demo users) ---
  getFromLocalStorage(userId?: string | null): SavedStock[] {
    if (typeof window === "undefined" || !window.localStorage || !userId) return [];
    try {
      const data = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveToLocalStorage(userId: string | null | undefined, stocks: SavedStock[]) {
    if (typeof window === "undefined" || !window.localStorage || !userId) return;
    try {
      window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(stocks));
    } catch (e) {
      console.error("Failed to save to local storage:", e);
    }
  },
};
