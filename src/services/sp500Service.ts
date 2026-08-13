import { fmpService } from "./financialModelingPrep";

export interface SP500Company {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
}

export interface SectorSummary {
  sector: string;
  marketCap: number;
  companyCount: number;
  weightedChangePercent: number;
}

export interface SP500MarketData {
  companies: SP500Company[];
  totalMarketCap: number;
  averageChangePercent: number;
  weightedChangePercent: number;
  sectorSummaries: SectorSummary[];
  marketStatus: "Open" | "Closed";
  lastUpdated: string;
}

const CACHE_KEY = "investors_edge_sp500_treemap_cache_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

class SP500Service {
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
   * Fetch full S&P 500 market data with batch quote requests
   */
  async getSP500MarketData(forceRefresh: boolean = false): Promise<SP500MarketData> {
    if (!forceRefresh) {
      const cached = this.getValidCache();
      if (cached) {
        return cached;
      }
    }

    try {
      // 1. Fetch S&P 500 constituent list
      const constituents = await fmpService.getSP500Constituents();
      if (!constituents || constituents.length === 0) {
        throw new Error("Failed to retrieve S&P 500 constituents list.");
      }

      // Map symbol -> sector/name
      const constituentMap = new Map<string, { name: string; sector: string }>();
      const symbols: string[] = [];

      constituents.forEach((c) => {
        if (c.symbol) {
          const sym = c.symbol.toUpperCase();
          constituentMap.set(sym, {
            name: c.name || sym,
            sector: c.sector || "Other",
          });
          symbols.push(sym);
        }
      });

      // 2. Fetch quotes in batch chunks of 80 symbols to respect API limits
      const BATCH_SIZE = 80;
      const quotePromises: Promise<any[]>[] = [];

      for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        const chunk = symbols.slice(i, i + BATCH_SIZE);
        quotePromises.push(fmpService.getBatchQuotes(chunk));
      }

      const rawQuoteArrays = await Promise.all(quotePromises);
      const allQuotes = rawQuoteArrays.flat();

      // 3. Merge quotes with constituent metadata
      const companies: SP500Company[] = [];
      let totalMarketCap = 0;
      let totalWeightedChange = 0;

      const sectorMap = new Map<string, { marketCap: number; count: number; weightedChangeSum: number }>();

      allQuotes.forEach((q) => {
        if (!q || !q.symbol) return;
        const sym = q.symbol.toUpperCase();
        const metadata = constituentMap.get(sym) || { name: q.name || sym, sector: "Other" };

        const price = typeof q.price === "number" ? q.price : parseFloat(q.price) || 0;
        const change = typeof q.change === "number" ? q.change : parseFloat(q.change) || 0;
        const changesPercentage =
          typeof q.changePercentage === "number"
            ? q.changePercentage
            : typeof q.changesPercentage === "number"
            ? q.changesPercentage
            : typeof q.changePercent === "number"
            ? q.changePercent
            : parseFloat(q.changePercentage || q.changesPercentage) || 0;
        const marketCap = typeof q.marketCap === "number" ? q.marketCap : parseFloat(q.marketCap) || 0;

        if (marketCap <= 0) return;

        const company: SP500Company = {
          symbol: sym,
          name: metadata.name,
          sector: metadata.sector,
          price,
          change,
          changesPercentage,
          marketCap,
        };

        companies.push(company);
        totalMarketCap += marketCap;
        totalWeightedChange += changesPercentage * marketCap;

        // Group into sector stats
        const secStats = sectorMap.get(metadata.sector) || { marketCap: 0, count: 0, weightedChangeSum: 0 };
        secStats.marketCap += marketCap;
        secStats.count += 1;
        secStats.weightedChangeSum += changesPercentage * marketCap;
        sectorMap.set(metadata.sector, secStats);
      });

      // If batch quotes yielded few companies, fallback or sort
      companies.sort((a, b) => b.marketCap - a.marketCap);

      const sectorSummaries: SectorSummary[] = Array.from(sectorMap.entries())
        .map(([sector, stats]) => ({
          sector,
          marketCap: stats.marketCap,
          companyCount: stats.count,
          weightedChangePercent: stats.marketCap > 0 ? stats.weightedChangeSum / stats.marketCap : 0,
        }))
        .sort((a, b) => b.marketCap - a.marketCap);

      const overallWeightedChange = totalMarketCap > 0 ? totalWeightedChange / totalMarketCap : 0;
      const avgChange = companies.length > 0 ? companies.reduce((s, c) => s + c.changesPercentage, 0) / companies.length : 0;

      const data: SP500MarketData = {
        companies,
        totalMarketCap,
        averageChangePercent: avgChange,
        weightedChangePercent: overallWeightedChange,
        sectorSummaries,
        marketStatus: this.getMarketStatus(),
        lastUpdated: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      };

      // Store in localStorage cache
      this.setCache(data);

      return data;
    } catch (error) {
      console.error("SP500MarketData fetch error:", error);
      // Fallback to cache if available even if expired
      const staleCache = this.getCacheIgnoreTTL();
      if (staleCache) return staleCache;
      throw error;
    }
  }

  private getValidCache(): SP500MarketData | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.data?.companies?.length > 0) {
        return parsed.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  private getCacheIgnoreTTL(): SP500MarketData | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data || null;
    } catch {
      return null;
    }
  }

  private setCache(data: SP500MarketData) {
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
      console.warn("Failed to set S&P 500 cache in localStorage:", e);
    }
  }
}

export const sp500Service = new SP500Service();
