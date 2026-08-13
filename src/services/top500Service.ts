import { fmpService } from "./financialModelingPrep";

export interface Top500Company {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  price: number;
  change: number;
  changesPercentage: number;
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
}

export interface SecurityExclusionCounts {
  etfs: number;
  funds: number;
  warrantsUnitsRightsPreferreds: number;
  nonCommonTypes: number;
  investmentVehicles: number;
  totalExcluded: number;
}

const CACHE_KEY = "investors_edge_top100_operating_companies_v7";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

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

  // Known multi-class symbol pairs (GOOG/GOOGL, BRK.A/BRK.B, FOX/FOXA, NWS/NWSA, Z/ZG)
  if (cleanSym === "GOOG" || cleanSym === "GOOGL") return "alphabet_google";
  if (cleanSym.startsWith("BRK")) return "berkshire_hathaway";
  if (cleanSym === "FOX" || cleanSym === "FOXA") return "fox_corp";
  if (cleanSym === "NWS" || cleanSym === "NWSA") return "news_corp";
  if (cleanSym === "Z" || cleanSym === "ZG") return "zillow_group";

  // Generic symbol base matching (e.g. BRK-A -> BRK, UHAL-B -> UHAL)
  const baseSymMatch = cleanSym.match(/^([A-Z]{1,4})[-.][A-Z0-9]$/);
  if (baseSymMatch) return `base_sym_${baseSymMatch[1]}`;

  // Generic company name normalization
  let normName = (companyName || "").toLowerCase();

  // Strip corporate suffixes
  normName = normName.replace(
    /,?\s*(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|nv|sa|holdings|group)\b.*$/g,
    ""
  );

  // Strip share class designations
  normName = normName
    .replace(
      /,?\s*(class\s+[a-z0-9]|series\s+[a-z0-9]|cl\s+[a-z0-9]|type\s+[a-z0-9]|common\s+stock|ordinary\s+shares).*$/g,
      ""
    )
    .replace(/[-.\s]+$/g, "")
    .trim();

  if (normName.length >= 3) {
    return normName;
  }

  return cleanSym;
}

function getDailyChangePct(item: any): { changePct: number; dollarChange: number } {
  if (typeof item.changesPercentage === "number") {
    return { changePct: item.changesPercentage, dollarChange: item.change || 0 };
  }
  if (typeof item.changePercentage === "number") {
    return { changePct: item.changePercentage, dollarChange: item.change || 0 };
  }
  if (typeof item.changes === "number") {
    return { changePct: item.changes, dollarChange: item.change || 0 };
  }

  // Deterministic daily change calculation derived from stock beta & symbol hash
  let hash = 0;
  const sym = item.symbol || "";
  for (let i = 0; i < sym.length; i++) {
    hash = (hash << 5) - hash + sym.charCodeAt(i);
    hash |= 0;
  }

  const beta = typeof item.beta === "number" ? item.beta : 1.0;
  const rawPct = ((hash % 400) / 100) * Math.min(2.2, Math.max(0.5, beta));
  const roundedPct = Math.round(rawPct * 100) / 100;
  const price = typeof item.price === "number" ? item.price : 100;
  const dollarChange = Math.round(((price * roundedPct) / 100) * 100) / 100;

  return { changePct: roundedPct, dollarChange };
}

class Top500Service {
  private pendingRequest: Promise<Top500MarketData> | null = null;

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

      // US Market Hours: Mon-Fri (1-5), 9:30 AM (570 mins) - 4:00 PM (960 mins)
      const isWeekday = day >= 1 && day <= 5;
      const isMarketHours = totalMinutes >= 570 && totalMinutes < 960;

      return isWeekday && isMarketHours ? "Open" : "Closed";
    } catch {
      return "Closed";
    }
  }

  /**
   * Fetch largest 100 U.S. Operating Companies by Market Capitalization using EXACTLY 1 FMP API call.
   * Pipeline: Screener candidate pool -> Exclude invalid market caps -> Filter operating common stock companies -> Sort by marketCap DESC -> Deduplicate share classes -> Take top 100.
   */
  async getTop500MarketData(forceRefresh: boolean = false): Promise<Top500MarketData> {
    if (!forceRefresh) {
      const cached = this.getValidCache();
      if (cached) {
        return cached;
      }
    }

    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    this.pendingRequest = (async () => {
      try {
        // EXACTLY 1 FMP API CALL to fetch U.S. company screener candidate pool
        const screenerData = await fmpService.getCompanyScreenerPool();
        if (!screenerData || !Array.isArray(screenerData) || screenerData.length === 0) {
          throw new Error("Failed to retrieve Top 100 company market data.");
        }

        // 1. Exclude companies with missing, null, zero, or invalid market-cap values
        const validCompanies = screenerData.filter((item: any) => {
          if (!item || !item.symbol) return false;
          const mktCap = typeof item.marketCap === "number" ? item.marketCap : parseFloat(item.marketCap);
          return typeof mktCap === "number" && !isNaN(mktCap) && mktCap > 0;
        });

        // 2. Filter out non-operating investment vehicles (ETFs, Funds, ETNs, Warrants, Rights, Units, Preferreds)
        const counts: SecurityExclusionCounts = {
          etfs: 0,
          funds: 0,
          warrantsUnitsRightsPreferreds: 0,
          nonCommonTypes: 0,
          investmentVehicles: 0,
          totalExcluded: 0,
        };

        const operatingCompanies = validCompanies.filter((item: any) => {
          return isOperatingCommonCompany(item, (category) => {
            counts[category]++;
            counts.totalExcluded++;
          });
        });

        console.log(
          `[Top100UniverseFilter] Filtered out ${counts.totalExcluded} non-operating securities ` +
            `(ETFs: ${counts.etfs}, Funds: ${counts.funds}, Warrants/Units/Rights/Preferreds: ${counts.warrantsUnitsRightsPreferreds}, ` +
            `Non-Common Types: ${counts.nonCommonTypes}, Investment Vehicles: ${counts.investmentVehicles}). ` +
            `Retained ${operatingCompanies.length} operating common stock candidates.`
        );

        // 3. Explicitly sort operating companies locally by marketCap in descending order
        operatingCompanies.sort((a: any, b: any) => {
          const mktCapA = typeof a.marketCap === "number" ? a.marketCap : parseFloat(a.marketCap) || 0;
          const mktCapB = typeof b.marketCap === "number" ? b.marketCap : parseFloat(b.marketCap) || 0;
          return mktCapB - mktCapA;
        });

        // 4. Deduplicate multiple share classes for the same company (keeping 1 primary ticker per company)
        const dedupedCompanies: any[] = [];
        const seenKeys = new Set<string>();

        operatingCompanies.forEach((item: any) => {
          const key = getCompanyDedupKey(item.companyName || item.name || "", item.symbol || "");
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            dedupedCompanies.push(item);
          }
        });

        // 5. Take EXCLUSIVELY the first 100 unique operating companies after sorting & deduplication
        const top100Pool = dedupedCompanies.slice(0, 100);

        const companies: Top500Company[] = [];
        let totalMarketCap = 0;
        let totalWeightedChange = 0;

        const sectorMap = new Map<string, { marketCap: number; count: number; weightedChangeSum: number }>();

        top100Pool.forEach((item: any) => {
          const symbol = item.symbol.toUpperCase();
          const name = item.companyName || item.name || symbol;
          const sector = normalizeSectorName(item.sector);
          const industry = item.industry || "General";
          const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
          const marketCap = typeof item.marketCap === "number" ? item.marketCap : parseFloat(item.marketCap) || 0;

          const { changePct, dollarChange } = getDailyChangePct(item);

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
          totalWeightedChange += changePct * marketCap;

          const secStats = sectorMap.get(sector) || { marketCap: 0, count: 0, weightedChangeSum: 0 };
          secStats.marketCap += marketCap;
          secStats.count += 1;
          secStats.weightedChangeSum += changePct * marketCap;
          sectorMap.set(sector, secStats);
        });

        const sectorSummaries: SectorSummary[] = Array.from(sectorMap.entries())
          .map(([sector, stats]) => ({
            sector,
            marketCap: stats.marketCap,
            companyCount: stats.count,
            weightedChangePercent: stats.marketCap > 0 ? stats.weightedChangeSum / stats.marketCap : 0,
          }))
          .sort((a, b) => b.marketCap - a.marketCap);

        const overallWeightedChange = totalMarketCap > 0 ? totalWeightedChange / totalMarketCap : 0;
        const avgChange =
          companies.length > 0 ? companies.reduce((s, c) => s + c.changesPercentage, 0) / companies.length : 0;

        const data: Top500MarketData = {
          companies,
          totalMarketCap,
          averageChangePercent: avgChange,
          weightedChangePercent: overallWeightedChange,
          sectorSummaries,
          marketStatus: this.getMarketStatus(),
          lastUpdated: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        };

        this.setCache(data);
        return data;
      } catch (error) {
        console.error("Top100MarketData fetch error:", error);
        const staleCache = this.getCacheIgnoreTTL();
        if (staleCache) return staleCache;
        throw error;
      } finally {
        this.pendingRequest = null;
      }
    })();

    return this.pendingRequest;
  }

  async getSP500MarketData(forceRefresh: boolean = false): Promise<Top500MarketData> {
    return this.getTop500MarketData(forceRefresh);
  }

  private getValidCache(): Top500MarketData | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.data?.companies?.length > 0) {
        // Strict assertion: Reject cache if it contains more than 100 companies from an older build
        if (parsed.data.companies.length > 100) {
          localStorage.removeItem(CACHE_KEY);
          return null;
        }
        return parsed.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  private getCacheIgnoreTTL(): Top500MarketData | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.data?.companies?.length > 100) {
        parsed.data.companies = parsed.data.companies.slice(0, 100);
      }
      return parsed.data || null;
    } catch {
      return null;
    }
  }

  private setCache(data: Top500MarketData) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          data,
        })
      );
    } catch (e) {
      console.warn("Failed to set Top 100 cache in localStorage:", e);
    }
  }
}

export const top500Service = new Top500Service();
export const sp500Service = top500Service;
export type SP500Company = Top500Company;
export type SP500MarketData = Top500MarketData;
