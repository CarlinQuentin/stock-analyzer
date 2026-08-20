import { NewsItem, StockNewsResponse } from "../types";
import {
  newsMemoryCache,
  cleanCompanyName,
} from "./newsEngine";

export class NewsService {
  /**
   * Fetch General Stock News & Headlines for a ticker using server-side Google discovery.
   * Authoritative route: /api/stocks/:ticker/news
   */
  async getStockNews(
    ticker: string,
    companyName?: string,
    forceRefresh: boolean = false,
  ): Promise<NewsItem[]> {
    if (!ticker || ticker.trim().length === 0) {
      return [];
    }

    const cleanTicker = ticker.toUpperCase().trim();
    const cleanName = cleanCompanyName(companyName);

    // 1. Check client-side memory cache if not force-refreshing
    if (!forceRefresh) {
      const cached = newsMemoryCache.get(cleanTicker, cleanName);
      if (cached && cached.length > 0) {
        return cached;
      }
    }

    // 2. Rate-limit protection against rapid forced refreshes
    if (!newsMemoryCache.canFetchUpstream(cleanTicker, cleanName, forceRefresh)) {
      const existing = newsMemoryCache.get(cleanTicker, cleanName);
      if (existing) return existing;
    }

    // 3. Fetch via authoritative server API route (/api/stocks/:ticker/news)
    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set("refresh", "true");
      if (companyName) params.set("companyName", companyName);

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/stocks/${encodeURIComponent(cleanTicker)}/news${queryString}`, {
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        const payload: StockNewsResponse = await response.json();
        if (payload && Array.isArray(payload.news)) {
          if (payload.news.length > 0) {
            newsMemoryCache.set(cleanTicker, cleanName, payload.news);
          }
          return payload.news;
        }
      } else {
        console.warn(`[NewsService] News API responded with status ${response.status} for ${cleanTicker}`);
      }
    } catch (err) {
      console.warn(`[NewsService] News API fetch error for ${cleanTicker}:`, err);
    }

    // 4. Return empty array if no news found or server error (DO NOT cross-contaminate with other stocks)
    return [];
  }
}

export const newsService = new NewsService();
