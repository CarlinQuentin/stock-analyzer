import { NewsItem, StockNewsResponse } from "../types";
import {
  newsMemoryCache,
  processGoogleNewsRss,
  cleanCompanyName,
} from "./newsEngine";

export class NewsService {
  /**
   * Fetch General Stock News & Headlines for a ticker using Google search-based discovery.
   * Primary route: AGY Server Endpoint (/api/stocks/:ticker/news).
   * Fallback: Direct Google News RSS fetch.
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

    // 3. Attempt to fetch via AGY Server Route (/api/stocks/:ticker/news)
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
      }
    } catch {
      // Backend route unreachable, proceed to direct client fallback
    }

    // 4. Direct Client Fallback: Query Google News RSS directly
    try {
      const query = cleanName && cleanName.length > 2
        ? `"${cleanName}" ${cleanTicker} news`
        : `${cleanTicker} stock news`;

      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
      ];

      let xmlText = "";
      for (const pUrl of proxyUrls) {
        try {
          const proxyRes = await fetch(pUrl);
          if (proxyRes.ok) {
            const txt = await proxyRes.text();
            if (txt && txt.includes("<item>")) {
              xmlText = txt;
              break;
            }
          }
        } catch {
          // ignore proxy failure and try next
        }
      }

      if (xmlText) {
        const directNews = processGoogleNewsRss(xmlText, cleanTicker, cleanName, 8);
        if (directNews.length > 0) {
          newsMemoryCache.set(cleanTicker, cleanName, directNews);
          return directNews;
        }
      }
    } catch (err) {
      console.warn(`[NewsService] Direct news fetch error for ${cleanTicker}:`, err);
    }

    // 5. If no news found, return empty array (DO NOT cross-contaminate with other stocks)
    return [];
  }
}

export const newsService = new NewsService();
