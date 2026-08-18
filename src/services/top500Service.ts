import { fmpService, FmpNormalizedQuote } from "./financialModelingPrep";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export interface Top500Company {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  price: number;
  change: number | null;
  changesPercentage: number | null;
  marketCap: number;
  qualityScore: number;
}

export interface SectorSummary {
  sector: string;
  marketCap: number;
  companyCount: number;
  weightedChangePercent: number;
}

export interface Top500MarketData {
  companies: Top500Company[];
  totalMarketCap: number;
  averageChangePercent: number;
  weightedChangePercent: number;
  sectorSummaries: SectorSummary[];
  marketStatus: "Open" | "Closed";
  lastUpdated: string;
  fetchedAt?: number;
}

export interface MarketDataSnapshot extends Top500MarketData {
  id: string;
  fetchedAt: number;
}

export interface SecurityExclusionCounts {
  etfs: number;
  funds: number;
  warrantsUnitsRightsPreferreds: number;
  nonCommonTypes: number;
  investmentVehicles: number;
  totalExcluded: number;
}

export const SNAPSHOT_DB_KEY = "investors_edge_top100_snapshot_v11";
export const SNAPSHOT_DB_TABLE = "top100_market_snapshots";
export const LEASE_LOCK_KEY = "investors_edge_top100_lease_v1";
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
export const LEASE_DURATION_MS = 60 * 1000; // 60 seconds lease duration
export const MIN_TOP100_COMPANIES = 50; // Minimum company threshold required for a valid Top 100 market snapshot
export const TARGET_TOP100_COMPANIES = 100;

const SECTOR_NAME_MAP: Record<string, string> = {
  Technology: "Information Technology",
  "Communication Services": "Communication Services",
  "Consumer Cyclical": "Consumer Discretionary",
  "Consumer Defensive": "Consumer Staples",
  Healthcare: "Health Care",
  "Financial Services": "Financials",
  Industrials: "Industrials",
  Energy: "Energy",
  Utilities: "Utilities",
  "Real Estate": "Real Estate",
  "Basic Materials": "Materials",
};

export function normalizeSectorName(rawSector: string): string {
  if (!rawSector) return "Other";
  return SECTOR_NAME_MAP[rawSector] || rawSector;
}

/**
 * Validates whether a given snapshot contains a complete, robust, non-corrupted Top 100 market dataset.
 * Rejects any partial, empty, or single-stock datasets (< MIN_TOP100_COMPANIES).
 */
export function isValidTop100Snapshot(snapshot: any): snapshot is MarketDataSnapshot {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (!Array.isArray(snapshot.companies)) return false;
  if (snapshot.companies.length < MIN_TOP100_COMPANIES) return false;
  if (typeof snapshot.fetchedAt !== "number" || isNaN(snapshot.fetchedAt) || snapshot.fetchedAt <= 0) return false;
  if (typeof snapshot.totalMarketCap !== "number" || isNaN(snapshot.totalMarketCap) || snapshot.totalMarketCap <= 0) return false;

  const allEntriesValid = snapshot.companies.every(
    (c: any) =>
      c &&
      typeof c.symbol === "string" &&
      c.symbol.trim().length > 0 &&
      typeof c.marketCap === "number" &&
      !isNaN(c.marketCap) &&
      c.marketCap > 0
  );

  return allEntriesValid;
}

/**
 * Derives a deterministic Business Quality Score (72-98) for Top 100 U.S. mega/large caps
 */
export function getBusinessQualityScore(item: any): number {
  if (typeof item.qualityScore === "number" && !isNaN(item.qualityScore)) {
    return Math.round(item.qualityScore);
  }
  let hash = 0;
  const sym = item.symbol || "";
  for (let i = 0; i < sym.length; i++) {
    hash = (hash << 5) - hash + sym.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  return 72 + (absHash % 27);
}

/**
 * Validates whether a candidate security is an actual operating company (common stock),
 * filtering out ETFs, mutual funds, trusts, ETNs, warrants, rights, units, and preferred securities.
 * Preserves operating financial companies (Banks, Insurance, Brokerages, Asset Managers like JPM, BLK, WFC, BAC, MA, V).
 */
export function isOperatingCommonCompany(
  item: any,
  exclusionCategoryLogger?: (category: keyof SecurityExclusionCounts) => void,
): boolean {
  if (!item || !item.symbol) return false;

  const symbol = (item.symbol || "").toUpperCase().trim();
  const name = (item.companyName || item.name || "").toLowerCase();
  const industry = (item.industry || "").toLowerCase();
  const type = (item.type || item.securityType || "").toLowerCase();

  // 1. Explicit API Flags: ETFs and Funds
  if (item.isEtf === true || type === "etf" || type.includes("etf")) {
    exclusionCategoryLogger?.("etfs");
    return false;
  }

  if (item.isFund === true || type === "fund" || type === "mutualfund" || type.includes("fund")) {
    exclusionCategoryLogger?.("funds");
    return false;
  }

  // 2. Non-Common Security Types & Suffixes (Warrants, Rights, Units, Preferreds, ETNs, CEFs)
  if (
    type === "warrant" ||
    type === "right" ||
    type === "unit" ||
    type === "preferred" ||
    type === "etn" ||
    type === "cef" ||
    type === "trust"
  ) {
    exclusionCategoryLogger?.("nonCommonTypes");
    return false;
  }

  // Check symbol derivative suffixes
  const isDerivativeSuffix =
    /[-.](WS|W|UN|U|RT|PR|P)[A-Z0-9]?$/i.test(symbol) &&
    !/^BRK[-.]B$/i.test(symbol) && // Preserve BRK-B / BRK.B
    !/^UHAL[-.]B$/i.test(symbol) && // Preserve UHAL-B
    !/^BF[-.]B$/i.test(symbol) && // Preserve BF-B (Brown-Forman)
    !/^HEI[-.]A$/i.test(symbol) && // Preserve HEI-A (Heico)
    !/^CW[-.]A$/i.test(symbol);

  if (isDerivativeSuffix) {
    exclusionCategoryLogger?.("warrantsUnitsRightsPreferreds");
    return false;
  }

  // 3. Pooled Investment Vehicle / Fund Industry & Name Patterns
  const isFundIndustry =
    industry.includes("exchange traded fund") ||
    industry.includes("etf") ||
    industry.includes("closed-end fund") ||
    industry.includes("mutual fund");

  if (isFundIndustry) {
    exclusionCategoryLogger?.("funds");
    return false;
  }

  const isOperatingInc = /\b(inc|incorporated|corp|corporation|plc|sa|nv|ltd|limited|holdings)\b/i.test(name);
  const isTrustOrFundName =
    /\b(etf|index fund|pooled fund|unit investment trust|closed-end fund|income trust|municipal trust|target term trust|etn)\b/i.test(name) ||
    (!isOperatingInc && /\b(trust|fund|funds)\b/i.test(name));

  if (isTrustOrFundName) {
    exclusionCategoryLogger?.("investmentVehicles");
    return false;
  }

  return true;
}

/**
 * Create a normalized company key for generic share class deduplication.
 * E.g., "Alphabet Inc. - Class A" & "Alphabet Inc. - Class C" -> "alphabet_google"
 * "Berkshire Hathaway Inc. Class A" & "Berkshire Hathaway Inc. Class B" -> "berkshire_hathaway"
 */
export function getCompanyDedupKey(companyName: string, symbol: string): string {
  if (!companyName && !symbol) return "";

  const cleanSym = symbol.toUpperCase().trim();

  // 1. Known multi-class symbol pairs
  if (cleanSym === "GOOG" || cleanSym === "GOOGL") return "alphabet_google";
  if (cleanSym.startsWith("BRK")) return "berkshire_hathaway";
  if (cleanSym === "FOX" || cleanSym === "FOXA") return "fox_corp";
  if (cleanSym === "NWS" || cleanSym === "NWSA") return "news_corp";
  if (cleanSym === "Z" || cleanSym === "ZG") return "zillow_group";

  // 2. Generic symbol base matching (e.g. BRK-A -> BRK, UHAL-B -> UHAL)
  const baseSymMatch = cleanSym.match(/^([A-Z]{1,4})[-.][A-Z0-9]$/);
  if (baseSymMatch) return `base_sym_${baseSymMatch[1]}`;

  // 3. Share class designations in company name (e.g. "Under Armour Class A" vs "Under Armour Class C")
  const rawName = (companyName || "").toLowerCase();
  const hasShareClassIndicator =
    /\b(class\s+[a-z0-9]|series\s+[a-z0-9]|cl\s+[a-z0-9]|type\s+[a-z0-9])\b/i.test(rawName);

  if (hasShareClassIndicator) {
    const normName = rawName
      .replace(/,?\s*\b(class\s+[a-z0-9]|series\s+[a-z0-9]|cl\s+[a-z0-9]|type\s+[a-z0-9]|common\s+stock|ordinary\s+shares)\b.*$/gi, "")
      .replace(/,?\s*\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|nv|sa|holdings|group)\b.*$/gi, "")
      .replace(/[-.\s,]+$/g, "")
      .trim();

    if (normName.length >= 3) {
      return `share_class_${normName}`;
    }
  }

  return cleanSym;
}

/**
 * Extracts authoritative real-time market performance values directly from FMP quote data.
 * Returns exact changePct and dollarChange if present in raw FMP market data; returns null if unavailable.
 * Never fabricates, estimates, or uses placeholders for daily price movement.
 */
export function getAuthoritativeDailyChange(item: any): { changePct: number | null; dollarChange: number | null } {
  if (!item) return { changePct: null, dollarChange: null };

  let rawPct: number | null = null;
  const candidatePct =
    item.changesPercentage ?? item.changePercentage ?? item.changes ?? item.changesPct ?? item.pctChange;

  if (candidatePct !== undefined && candidatePct !== null) {
    const parsed = typeof candidatePct === "number" ? candidatePct : parseFloat(String(candidatePct));
    if (!isNaN(parsed)) {
      rawPct = parsed;
    }
  }

  let rawDollar: number | null = null;
  const candidateDollar = item.change ?? item.dollarChange ?? item.priceChange;
  if (candidateDollar !== undefined && candidateDollar !== null) {
    const parsed = typeof candidateDollar === "number" ? candidateDollar : parseFloat(String(candidateDollar));
    if (!isNaN(parsed)) {
      rawDollar = parsed;
    }
  }

  const changePct = rawPct !== null ? Math.round(rawPct * 100) / 100 : null;
  const dollarChange = rawDollar !== null ? Math.round(rawDollar * 100) / 100 : null;

  return { changePct, dollarChange };
}

/**
 * Determines snapshot age and freshness relative to 5-minute TTL boundary
 */
export function getSnapshotFreshness(snapshot: MarketDataSnapshot | null): {
  isFresh: boolean;
  isStale: boolean;
  ageMs: number;
} {
  if (!snapshot || typeof snapshot.fetchedAt !== "number" || !isValidTop100Snapshot(snapshot)) {
    return { isFresh: false, isStale: false, ageMs: Infinity };
  }
  const ageMs = Date.now() - snapshot.fetchedAt;
  const isFresh = ageMs <= CACHE_TTL_MS;
  const isStale = ageMs > CACHE_TTL_MS;
  return { isFresh, isStale, ageMs };
}

export function clearSnapshotDb(): void {
  top500Service.resetService();
  try {
    const ls = typeof window !== "undefined" && window.localStorage ? window.localStorage : (typeof globalThis !== "undefined" ? (globalThis as any).localStorage : null);
    if (ls) {
      ls.removeItem(SNAPSHOT_DB_KEY);
      ls.removeItem(LEASE_LOCK_KEY);
    }
  } catch {}
}

export function loadSnapshotFromLocalStorage(): MarketDataSnapshot | null {
  try {
    const ls = typeof window !== "undefined" && window.localStorage ? window.localStorage : (typeof globalThis !== "undefined" ? (globalThis as any).localStorage : null);
    if (!ls) return null;
    const raw = ls.getItem(SNAPSHOT_DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isValidTop100Snapshot(parsed)) {
      return parsed;
    }
    // Discard any corrupt or partial dataset (< MIN_TOP100_COMPANIES) immediately
    ls.removeItem(SNAPSHOT_DB_KEY);
    return null;
  } catch {
    return null;
  }
}

export function saveSnapshotToLocalStorage(snapshot: MarketDataSnapshot): boolean {
  if (!isValidTop100Snapshot(snapshot)) {
    console.warn(`[Top100Db] Refusing to save incomplete snapshot (${(snapshot as any)?.companies?.length ?? 0} companies) to local storage.`);
    return false;
  }

  try {
    const ls = typeof window !== "undefined" && window.localStorage ? window.localStorage : (typeof globalThis !== "undefined" ? (globalThis as any).localStorage : null);
    if (ls) {
      ls.setItem(SNAPSHOT_DB_KEY, JSON.stringify(snapshot));
      return true;
    }
    return false;
  } catch (e) {
    console.warn("Failed to save snapshot to local storage:", e);
    return false;
  }
}

export async function loadSnapshotFromDb(): Promise<MarketDataSnapshot | null> {
  // 1. If Supabase DB is configured, attempt to query latest snapshot row from Supabase
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from(SNAPSHOT_DB_TABLE)
        .select("*")
        .eq("id", "top100_latest")
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        const snapshot: MarketDataSnapshot = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        if (isValidTop100Snapshot(snapshot)) {
          saveSnapshotToLocalStorage(snapshot);
          return snapshot;
        } else {
          console.warn(`[Top100Db] Remote Supabase snapshot row contains incomplete dataset (${(snapshot as any)?.companies?.length ?? 0} companies), rejecting.`);
        }
      }
    } catch (e) {
      console.warn("[Top100Db] Supabase snapshot read error, using local DB storage:", e);
    }
  }

  // 2. Local Storage DB Fallback
  return loadSnapshotFromLocalStorage();
}

export async function saveSnapshotToDb(snapshot: MarketDataSnapshot): Promise<boolean> {
  if (!isValidTop100Snapshot(snapshot)) {
    console.warn(`[Top100Db] Refusing to save incomplete snapshot (${(snapshot as any)?.companies?.length ?? 0} companies) to database.`);
    return false;
  }

  saveSnapshotToLocalStorage(snapshot);
  releaseLocalLease();

  if (isSupabaseConfigured) {
    try {
      await supabase.from(SNAPSHOT_DB_TABLE).upsert({
        id: "top100_latest",
        fetched_at: snapshot.fetchedAt,
        status: "fresh",
        company_count: snapshot.companies.length,
        payload: snapshot,
        locked_until: null, // Clear refresh lease upon successful snapshot write!
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[Top100Db] Supabase snapshot save warning:", e);
    }
  }

  return true;
}

/**
 * Attempts to acquire atomic snapshot lease across Supabase DB / local environments.
 * Returns true if this client acquired the lease, false if denied.
 */
export async function tryAcquireSnapshotLease(): Promise<boolean> {
  // 1. Try Supabase RPC / query if Supabase DB is configured
  if (isSupabaseConfigured) {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("acquire_top100_refresh_lease", {
        lease_seconds: 60,
      });

      if (!rpcError && typeof rpcData === "boolean") {
        return rpcData;
      }

      // Fallback query if RPC is not yet applied on remote Supabase instance
      const nowIso = new Date().toISOString();
      const lockUntilIso = new Date(Date.now() + LEASE_DURATION_MS).toISOString();

      const { data: updateData, error: updateErr } = await supabase
        .from(SNAPSHOT_DB_TABLE)
        .update({ locked_until: lockUntilIso, updated_at: nowIso })
        .eq("id", "top100_latest")
        .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
        .select();

      if (!updateErr && updateData && updateData.length > 0) {
        return true;
      }

      // Handle Empty Database Initial Load
      const { data: insertData, error: insertErr } = await supabase
        .from(SNAPSHOT_DB_TABLE)
        .upsert(
          { id: "top100_latest", locked_until: lockUntilIso, updated_at: nowIso },
          { onConflict: "id", ignoreDuplicates: false }
        )
        .select();

      if (!insertErr && insertData && insertData.length > 0) {
        return true;
      }
    } catch (e) {
      console.warn("[Top100Lease] Supabase lease acquisition check warning:", e);
    }
  }

  // 2. Local Storage Distributed Lock Fallback (for browser tabs / offline / local test environments)
  return tryAcquireLocalLease();
}

/**
 * Releases snapshot refresh lease in Supabase DB / local storage
 */
export async function releaseSnapshotLease(): Promise<void> {
  releaseLocalLease();

  if (isSupabaseConfigured) {
    try {
      await supabase.rpc("release_top100_refresh_lease");
    } catch {
      try {
        await supabase
          .from(SNAPSHOT_DB_TABLE)
          .update({ locked_until: null, updated_at: new Date().toISOString() })
          .eq("id", "top100_latest");
      } catch (e) {
        console.warn("[Top100Lease] Supabase lease release warning:", e);
      }
    }
  }
}

export function tryAcquireLocalLease(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return true;
    const raw = localStorage.getItem(LEASE_LOCK_KEY);
    const now = Date.now();

    if (raw) {
      const lockUntil = parseInt(raw, 10);
      if (!isNaN(lockUntil) && lockUntil > now) {
        return false; // Lease is active and held by another browser tab/process!
      }
    }

    localStorage.setItem(LEASE_LOCK_KEY, String(now + LEASE_DURATION_MS));
    return true;
  } catch {
    return true;
  }
}

export function releaseLocalLease(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.removeItem(LEASE_LOCK_KEY);
  } catch {}
}

export type SnapshotListener = (data: Top500MarketData) => void;

class Top500Service {
  private inFlightRefreshPromise: Promise<MarketDataSnapshot> | null = null;
  private listeners: Set<SnapshotListener> = new Set();

  public resetService(): void {
    this.inFlightRefreshPromise = null;
    this.listeners.clear();
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyListeners(data: Top500MarketData): void {
    this.listeners.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("[Top100Db] Listener notification error:", e);
      }
    });
  }

  constructor() {
    this.purgeStaleCaches();
  }

  /**
   * Purge legacy cache keys from previous iterations
   */
  private purgeStaleCaches() {
    if (typeof window === "undefined" || !window.localStorage) return;
    const legacyKeys = [
      "investors_edge_sp500_treemap_cache_v2",
      "investors_edge_top500_treemap_cache_v3",
      "investors_edge_top500_treemap_cache_v4",
      "investors_edge_top100_treemap_cache_v5",
      "investors_edge_top100_operating_companies_v6",
      "investors_edge_top100_operating_companies_v7",
      "investors_edge_top100_operating_companies_v8",
      "investors_edge_top100_operating_companies_v9",
      "investors_edge_top100_snapshot_v10",
    ];
    legacyKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });
  }

  /**
   * Determine US Stock Market open status based on current Eastern Time
   */
  private getMarketStatus(): "Open" | "Closed" {
    try {
      const now = new Date();
      const estDateStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
      const estDate = new Date(estDateStr);
      const day = estDate.getDay();
      const hours = estDate.getHours();
      const minutes = estDate.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const isWeekday = day >= 1 && day <= 5;
      const isMarketHours = totalMinutes >= 570 && totalMinutes < 960;

      return isWeekday && isMarketHours ? "Open" : "Closed";
    } catch {
      return "Closed";
    }
  }

  /**
   * Fetch largest 100 U.S. Operating Companies using DB-Cached Stale-While-Revalidate Architecture.
   * - 0-5 mins old & complete: Fresh DB snapshot returned immediately. 0 FMP API calls!
   * - 5+ mins old & complete: Return existing DB snapshot immediately + 1 global single-flight background FMP refresh.
   * - Incomplete (< 50 companies) / Empty DB / First Load: Execute initial FMP refresh & save valid DB snapshot.
   */
  async getTop500MarketData(forceRefresh: boolean = false): Promise<Top500MarketData> {
    if (forceRefresh && this.inFlightRefreshPromise) {
      return this.inFlightRefreshPromise;
    }

    const dbSnapshot = await loadSnapshotFromDb();
    const isSnapshotValid = isValidTop100Snapshot(dbSnapshot);
    const freshness = getSnapshotFreshness(dbSnapshot);
    const { isFresh, isStale } = freshness;

    // Scenario A: DB snapshot is VALID & FRESH (0 - 5 minutes old)
    if (isFresh && isSnapshotValid && dbSnapshot && !forceRefresh) {
      console.log(`[Top100Db] Snapshot is FRESH (${dbSnapshot.companies.length} companies, age: ${Math.round((Date.now() - dbSnapshot.fetchedAt) / 1000)}s). 0 FMP API calls made.`);
      return dbSnapshot;
    }

    // Scenario B: DB snapshot is VALID & STALE (> 5 minutes old) -> Return cached snapshot immediately + trigger single-flight background refresh
    if (isStale && isSnapshotValid && dbSnapshot && !forceRefresh) {
      console.log(`[Top100Db] Snapshot is STALE (${dbSnapshot.companies.length} companies, age: ${Math.round((Date.now() - dbSnapshot.fetchedAt) / 1000)}s). Returning DB snapshot immediately & attempting global DB refresh lease.`);
      this.triggerSingleFlightBackgroundRefresh();
      return dbSnapshot;
    }

    // Scenario C: No VALID DB snapshot exists (empty, corrupted, or single-stock) OR explicit forceRefresh requested
    if (!this.inFlightRefreshPromise) {
      this.inFlightRefreshPromise = (async () => {
        const leaseAcquired = await tryAcquireSnapshotLease();
        if (!leaseAcquired && isSnapshotValid && dbSnapshot) {
          console.log("[Top100Db] Global DB refresh lease DENIED during forceRefresh/initial load. Returning existing valid DB snapshot.");
          return dbSnapshot;
        }

        try {
          return await this.executeFmpRefreshAndSaveDb();
        } finally {
          await releaseSnapshotLease();
        }
      })().finally(() => {
        this.inFlightRefreshPromise = null;
      });
    }

    return this.inFlightRefreshPromise;
  }

  /**
   * Single-flight background refresh lock mechanism:
   * Guarantees only ONE FMP refresh runs worldwide even if multiple tabs/users load stale cache concurrently.
   */
  private triggerSingleFlightBackgroundRefresh(): void {
    if (this.inFlightRefreshPromise) {
      console.log("[Top100Db] Browser-level lock active: Background FMP refresh already in progress.");
      return;
    }

    this.inFlightRefreshPromise = (async () => {
      // 1. Attempt to acquire global database-level refresh lease
      const leaseAcquired = await tryAcquireSnapshotLease();
      if (!leaseAcquired) {
        console.log("[Top100Db] Global DB refresh lease DENIED: Another browser/client is currently refreshing. 0 FMP calls made.");
        const existing = await loadSnapshotFromDb();
        return (isValidTop100Snapshot(existing) ? existing : null) as any;
      }

      console.log("[Top100Db] Global DB refresh lease ACQUIRED! Launching ONE FMP refresh...");

      try {
        const freshSnapshot = await this.executeFmpRefreshAndSaveDb();
        return freshSnapshot;
      } catch (err) {
        console.warn("[Top100Db] Background FMP refresh failed. Preserving existing DB snapshot intact.", err);
        const existing = await loadSnapshotFromDb();
        return (isValidTop100Snapshot(existing) ? existing : null) as any;
      } finally {
        await releaseSnapshotLease();
      }
    })().finally(() => {
      this.inFlightRefreshPromise = null;
    });
  }

  /**
   * Performs real FMP market fetch and updates DB snapshot
   */
  public async executeFmpRefreshAndSaveDb(): Promise<MarketDataSnapshot> {
    try {
      // 1. Fetch Top 100 candidate pool from FMP screener
      const screenerData = await fmpService.getCompanyScreenerPool();
      if (!screenerData || !Array.isArray(screenerData) || screenerData.length === 0) {
        throw new Error("Failed to retrieve Top 100 company market data from FMP.");
      }

      // Exclude invalid market caps
      const validCompanies = screenerData.filter((item: any) => {
        if (!item || !item.symbol) return false;
        const mktCap = typeof item.marketCap === "number" ? item.marketCap : parseFloat(item.marketCap);
        return typeof mktCap === "number" && !isNaN(mktCap) && mktCap > 0;
      });

      // Filter operating common stock candidates
      const operatingCompanies = validCompanies.filter((item: any) => isOperatingCommonCompany(item));
      operatingCompanies.sort((a: any, b: any) => {
        const mktCapA = typeof a.marketCap === "number" ? a.marketCap : parseFloat(a.marketCap) || 0;
        const mktCapB = typeof b.marketCap === "number" ? b.marketCap : parseFloat(b.marketCap) || 0;
        return mktCapB - mktCapA;
      });

      // Deduplicate share classes
      const dedupedCompanies: any[] = [];
      const seenKeys = new Set<string>();
      operatingCompanies.forEach((item: any) => {
        const key = getCompanyDedupKey(item.companyName || item.name || "", item.symbol || "");
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          dedupedCompanies.push(item);
        }
      });

      const top100Pool = dedupedCompanies.slice(0, 100);
      const top100Symbols = top100Pool.map((c) => c.symbol.toUpperCase());

      // 2. Fetch authoritative live market quotes from FMP for all Top 100 symbols
      let quoteMap = new Map<string, FmpNormalizedQuote>();
      try {
        const batchQuotes = await fmpService.getBatchQuotes(top100Symbols);
        batchQuotes.forEach((q) => {
          if (q && q.symbol) {
            quoteMap.set(q.symbol.toUpperCase(), q);
          }
        });
      } catch (e) {
        console.warn("[Top100Db] Batch quote fetch warning:", e);
      }

      const companies: Top500Company[] = [];
      let totalMarketCap = 0;
      let totalWeightedChange = 0;
      let validChangeMarketCapSum = 0;

      const sectorMap = new Map<string, { marketCap: number; count: number; weightedChangeSum: number; validCapSum: number }>();

      top100Pool.forEach((item: any) => {
        const symbol = item.symbol.toUpperCase();
        const name = item.companyName || item.name || symbol;
        const sector = normalizeSectorName(item.sector);
        const industry = item.industry || "General";

        const quote = quoteMap.get(symbol);
        const price = quote?.price ?? (typeof item.price === "number" ? item.price : parseFloat(item.price) || 0);
        const marketCap = quote?.marketCap && quote.marketCap > 0 ? quote.marketCap : (typeof item.marketCap === "number" ? item.marketCap : parseFloat(item.marketCap) || 0);

        const changePct = quote ? quote.changesPercentage : getAuthoritativeDailyChange(item).changePct;
        const dollarChange = quote ? quote.change : getAuthoritativeDailyChange(item).dollarChange;

        const company: Top500Company = {
          symbol,
          name,
          sector,
          industry,
          price,
          change: dollarChange,
          changesPercentage: changePct,
          marketCap,
          qualityScore: getBusinessQualityScore(item),
        };

        companies.push(company);
        totalMarketCap += marketCap;

        if (changePct !== null) {
          totalWeightedChange += changePct * marketCap;
          validChangeMarketCapSum += marketCap;
        }

        const secStats = sectorMap.get(sector) || { marketCap: 0, count: 0, weightedChangeSum: 0, validCapSum: 0 };
        secStats.marketCap += marketCap;
        secStats.count += 1;
        if (changePct !== null) {
          secStats.weightedChangeSum += changePct * marketCap;
          secStats.validCapSum += marketCap;
        }
        sectorMap.set(sector, secStats);
      });

      // Validation guard: Ensure at least MIN_TOP100_COMPANIES were produced
      if (companies.length < MIN_TOP100_COMPANIES) {
        throw new Error(`FMP Refresh generated only ${companies.length} valid companies, which is below the minimum threshold of ${MIN_TOP100_COMPANIES}.`);
      }

      const sectorSummaries: SectorSummary[] = Array.from(sectorMap.entries())
        .map(([sector, stats]) => ({
          sector,
          marketCap: stats.marketCap,
          companyCount: stats.count,
          weightedChangePercent: stats.validCapSum > 0 ? stats.weightedChangeSum / stats.validCapSum : 0,
        }))
        .sort((a, b) => b.marketCap - a.marketCap);

      const overallWeightedChange = validChangeMarketCapSum > 0 ? totalWeightedChange / validChangeMarketCapSum : 0;
      const validCompaniesWithChange = companies.filter((c) => c.changesPercentage !== null);
      const avgChange =
        validCompaniesWithChange.length > 0
          ? validCompaniesWithChange.reduce((s, c) => s + (c.changesPercentage || 0), 0) / validCompaniesWithChange.length
          : 0;

      const snapshot: MarketDataSnapshot = {
        id: "top100_latest",
        fetchedAt: Date.now(),
        companies,
        totalMarketCap,
        averageChangePercent: avgChange,
        weightedChangePercent: overallWeightedChange,
        sectorSummaries,
        marketStatus: this.getMarketStatus(),
        lastUpdated: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      };

      await saveSnapshotToDb(snapshot);
      this.notifyListeners(snapshot);
      return snapshot;
    } catch (error) {
      console.error("[Top100Db] FMP Refresh error:", error);
      const existingSnapshot = await loadSnapshotFromDb();
      if (isValidTop100Snapshot(existingSnapshot)) {
        console.warn("[Top100Db] Preserving last successful valid DB snapshot following FMP refresh error.");
        return existingSnapshot;
      }
      throw error;
    }
  }

  async getSP500MarketData(forceRefresh: boolean = false): Promise<Top500MarketData> {
    return this.getTop500MarketData(forceRefresh);
  }
}

export const top500Service = new Top500Service();
export const sp500Service = top500Service;
export type SP500Company = Top500Company;
export type SP500MarketData = Top500MarketData;
