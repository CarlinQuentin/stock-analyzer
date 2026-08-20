import type { NewsItem } from "./types";

export interface RawRssNewsItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: string;
  description?: string;
}

// 5 minutes short-lived cache TTL
export const NEWS_CACHE_TTL_MS = 5 * 60 * 1000;
// 10 seconds minimum interval between upstream requests per ticker
export const MIN_UPSTREAM_REFRESH_INTERVAL_MS = 10 * 1000;

/**
 * Clean URLs by stripping tracking parameters
 */
export function cleanCanonicalUrl(rawUrl?: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    const paramsToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (
        key.startsWith("utm_") ||
        key === "ref" ||
        key === "fbclid" ||
        key === "gclid" ||
        key === "source" ||
        key === "ncid"
      ) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Normalize title by stripping HTML entities, punctuation, extra whitespace, and publisher suffixes
 */
export function normalizeTitle(rawTitle?: string): string {
  if (!rawTitle) return "";
  let clean = rawTitle
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Remove common trailing publisher tags: e.g. " - Bloomberg", " | Reuters", " - Yahoo", " - CNBC"
  clean = clean.replace(
    /\s*[-|–—]\s*(Bloomberg|Reuters|CNBC|Yahoo|TheFly|Seeking Alpha|InvestorPlace|MarketWatch|Benzinga|The Motley Fool|Forbes|Barron's|WSJ|Wall Street Journal|AP|PR Newswire|Business Wire|simplywall\.st|TipRanks|TechStock²|thestreet\.com|Stock Titan|TradingView|MarketBeat|ChartMill).*$/i,
    "",
  );

  return clean
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean company name by stripping legal corporate suffixes
 */
export function cleanCompanyName(companyName?: string): string {
  if (!companyName) return "";
  return companyName
    .replace(/,?\s*\b(Corporation|Holdings|Group|Corp|Inc|LLC|Ltd|Plc|SA|NV|Company|Co)\b\.?/gi, "")
    .replace(/\s+(and|&)\s*$/i, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple string hash for stable IDs
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

/**
 * Normalizes an RSS news item into AGY-standard NewsItem
 */
export function normalizeRssItem(
  raw: RawRssNewsItem,
  ticker: string,
  index: number = 0,
): NewsItem {
  const sym = ticker.toUpperCase().trim();
  const rawTitle = (raw.title || "Company Update").trim();
  let title = rawTitle;
  let source = (raw.source || "").trim();

  // If source was not explicitly provided in XML, parse trailing publisher from title (e.g. "Headline - Bloomberg")
  if (rawTitle.includes(" - ")) {
    const parts = rawTitle.split(" - ");
    if (!source) {
      source = parts.pop() || "Financial News";
    } else {
      parts.pop();
    }
    title = parts.join(" - ").trim();
  }

  if (!source) source = "Market News";

  const url = cleanCanonicalUrl(raw.link);
  const publishedAt = raw.pubDate ? new Date(raw.pubDate).toISOString() : new Date().toISOString();
  const summary = raw.description ? raw.description.replace(/<[^>]*>/g, "").trim() : undefined;

  const idSource = url || `${sym}-${normalizeTitle(title)}-${publishedAt}`;
  const id = `news-${sym}-${Math.abs(hashString(idSource))}-${index}`;

  return {
    id,
    ticker: sym,
    title,
    source,
    url,
    publishedAt,
    summary,
  };
}

const STOP_WORDS = new Set(["and", "the", "for", "with", "all", "inc", "corp", "co", "ltd", "llc", "group", "class", "com", "net"]);

/**
 * Filter and score articles strictly for company-specific relevance
 */
export function filterRelevantNews(
  articles: NewsItem[],
  ticker: string,
  companyName?: string,
): NewsItem[] {
  const cleanTicker = ticker.toUpperCase().trim();
  const cleanName = cleanCompanyName(companyName).toLowerCase();
  // Name keywords (split by space to catch "Eli Lilly", "Lilly", "Steel Dynamics")
  const nameParts = cleanName.split(/\s+/).filter((p) => p.length >= 3 && !STOP_WORDS.has(p));

  const tickerRegex = new RegExp(`\\b${cleanTicker}\\b`, "i");

  // High-impact investment catalyst keyword triggers
  const catalystKeywords = [
    "earnings",
    "revenue",
    "profit",
    "loss",
    "guidance",
    "quarterly",
    "dividend",
    "fda",
    "approval",
    "trial",
    "clinical",
    "patent",
    "lawsuit",
    "sec",
    "acquisition",
    "merger",
    "acquired",
    "buyback",
    "shares",
    "partnership",
    "contract",
    "deal",
    "ceo",
    "cfo",
    "executive",
    "analyst",
    "upgrade",
    "downgrade",
    "target",
    "rating",
    "outperform",
    "product",
    "launch",
    "sales",
    "growth",
    "margins",
    "results",
  ];

  const scored = articles
    .map((article) => {
      let score = 0;
      const titleLower = article.title.toLowerCase();
      const summaryLower = (article.summary || "").toLowerCase();
      const combined = `${titleLower} ${summaryLower}`;

      // 1. Check if article is genuinely about this company
      let isCompanyMatch = false;

      if (tickerRegex.test(article.title)) {
        score += 20;
        isCompanyMatch = true;
      }

      if (cleanName && cleanName.length > 2 && titleLower.includes(cleanName)) {
        score += 25;
        isCompanyMatch = true;
      } else {
        // Check partial company name parts (e.g. "Lilly" for "Eli Lilly")
        for (const part of nameParts) {
          if (titleLower.includes(part)) {
            score += 15;
            isCompanyMatch = true;
            break;
          }
        }
      }

      if (tickerRegex.test(summaryLower) || (cleanName && cleanName.length > 2 && summaryLower.includes(cleanName))) {
        score += 8;
        isCompanyMatch = true;
      }

      // If neither ticker nor company name appears at all, reject immediately
      if (!isCompanyMatch) {
        return null;
      }

      // 2. Score catalyst keywords
      for (const kw of catalystKeywords) {
        if (combined.includes(kw)) {
          score += 4;
        }
      }

      // 3. Recency boost (newer articles get bonus points)
      try {
        const pubTime = new Date(article.publishedAt).getTime();
        const ageHours = (Date.now() - pubTime) / (1000 * 60 * 60);
        if (ageHours < 24) {
          score += 10;
        } else if (ageHours < 72) {
          score += 5;
        }
      } catch {
        // Ignore date parse issues
      }

      return { article, score };
    })
    .filter((item): item is { article: NewsItem; score: number } => item !== null);

  // Sort by relevance score descending
  return scored.sort((a, b) => b.score - a.score).map((item) => item.article);
}

/**
 * Deduplicate articles by canonical URL and normalized title signature
 */
export function deduplicateArticles(articles: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: NewsItem[] = [];

  for (const article of articles) {
    const urlKey = cleanCanonicalUrl(article.url);
    const titleKey = normalizeTitle(article.title);

    if (urlKey && seenUrls.has(urlKey)) continue;
    if (titleKey && seenTitles.has(titleKey)) continue;

    if (urlKey) seenUrls.add(urlKey);
    if (titleKey) seenTitles.add(titleKey);
    deduped.push(article);
  }

  return deduped;
}

/**
 * Parse Google News RSS XML string into RawRssNewsItem array
 */
export function parseGoogleNewsXml(xmlText: string): RawRssNewsItem[] {
  if (!xmlText || typeof xmlText !== "string") return [];

  const items: RawRssNewsItem[] = [];
  const itemMatches = [...xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  for (const match of itemMatches) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);

    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "";
    const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "";
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
    const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "";
    const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "";

    if (title) {
      items.push({
        title,
        link,
        pubDate,
        source,
        description,
      });
    }
  }

  return items;
}

/**
 * Process raw RSS items into curated NewsItem array
 */
export function processGoogleNewsRss(
  xmlText: string,
  ticker: string,
  companyName?: string,
  limit: number = 8,
): NewsItem[] {
  const rawItems = parseGoogleNewsXml(xmlText);
  if (rawItems.length === 0) return [];

  // 1. Normalize
  const normalized = rawItems.map((raw, idx) => normalizeRssItem(raw, ticker, idx));

  // 2. Filter strictly for this specific company
  const relevant = filterRelevantNews(normalized, ticker, companyName);

  // 3. Deduplicate
  const deduped = deduplicateArticles(relevant);

  // 4. Sort by date descending
  deduped.sort((a, b) => {
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    if (isNaN(dateA) || isNaN(dateB)) return 0;
    return dateB - dateA;
  });

  return deduped.slice(0, limit);
}

/**
 * Scoped in-memory cache keyed by Symbol + CompanyName
 */
export class NewsMemoryCache {
  private cache = new Map<string, { data: NewsItem[]; timestamp: number; expiresAt: number; lastFetchTime: number }>();

  private getCacheKey(ticker: string, companyName?: string): string {
    const cleanSym = ticker.toUpperCase().trim();
    const cleanName = cleanCompanyName(companyName).toLowerCase();
    return `${cleanSym}:${cleanName}`;
  }

  get(ticker: string, companyName?: string): NewsItem[] | null {
    const key = this.getCacheKey(ticker, companyName);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() < entry.expiresAt && entry.data.length > 0) {
      return entry.data;
    }

    return null;
  }

  set(ticker: string, companyName: string | undefined, data: NewsItem[]): void {
    const key = this.getCacheKey(ticker, companyName);
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + NEWS_CACHE_TTL_MS,
      lastFetchTime: now,
    });
  }

  canFetchUpstream(ticker: string, companyName?: string, forceRefresh = false): boolean {
    const key = this.getCacheKey(ticker, companyName);
    const entry = this.cache.get(key);
    if (!entry) return true;

    const now = Date.now();
    if (now - entry.lastFetchTime < MIN_UPSTREAM_REFRESH_INTERVAL_MS) {
      return false; // Rate-limited
    }

    if (forceRefresh) return true;
    return now >= entry.expiresAt;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const newsMemoryCache = new NewsMemoryCache();

/**
 * Fetches Google News RSS search directly via server-side fetch
 */
export async function fetchGoogleNewsRss(query: string): Promise<string> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(rssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`Google News RSS responded with status ${res.status}`);
  }

  return await res.text();
}

export interface GoogleStockNewsResult {
  ticker: string;
  news: NewsItem[];
  source: string;
  isStale: boolean;
  timestamp: string;
}

/**
 * Server-side entry point for discovering company-specific stock news via Google search
 */
export async function fetchGoogleStockNews(
  ticker: string,
  companyName?: string,
  forceRefresh: boolean = false,
  limit: number = 8,
): Promise<GoogleStockNewsResult> {
  const cleanTicker = (ticker || "").toUpperCase().trim();
  const cleanName = cleanCompanyName(companyName);
  const startTime = Date.now();

  // 1. Check scoped cache if not force-refreshing
  if (!forceRefresh) {
    const cached = newsMemoryCache.get(cleanTicker, cleanName);
    if (cached && cached.length > 0) {
      return {
        ticker: cleanTicker,
        news: cached.slice(0, limit),
        source: "cache",
        isStale: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 2. Multi-stage Google News queries
  const queries: string[] = [];
  if (cleanName && cleanName.length > 2) {
    queries.push(`"${cleanName}" ${cleanTicker} news`);
    queries.push(`"${cleanName}" stock`);
  }
  queries.push(`${cleanTicker} stock news`);

  const allRawItems: RawRssNewsItem[] = [];

  for (const query of queries) {
    try {
      const xmlText = await fetchGoogleNewsRss(query);
      const items = parseGoogleNewsXml(xmlText);
      if (items.length > 0) {
        allRawItems.push(...items);
        if (allRawItems.length >= 15) break; // sufficient raw pool
      }
    } catch (err: any) {
      console.warn(`[News API] Query failed for "${query}":`, err?.message || err);
    }
  }

  const durationMs = Date.now() - startTime;

  // 3. Process, filter strictly for this company, deduplicate, and sort
  if (allRawItems.length > 0) {
    const normalized = allRawItems.map((raw, idx) => normalizeRssItem(raw, cleanTicker, idx));
    const relevant = filterRelevantNews(normalized, cleanTicker, cleanName);
    const deduped = deduplicateArticles(relevant);

    deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const finalNews = deduped.slice(0, limit);

    if (finalNews.length > 0) {
      newsMemoryCache.set(cleanTicker, cleanName, finalNews);
      console.info(`[News API] Ticker: ${cleanTicker} (${cleanName}) | Duration: ${durationMs}ms | Count: ${finalNews.length} | Source: google_news`);

      return {
        ticker: cleanTicker,
        news: finalNews,
        source: "google_news",
        isStale: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 4. If no company-specific news was found, return clean empty result
  console.info(`[News API] No matching news found for ${cleanTicker} (${cleanName}) | Duration: ${durationMs}ms`);
  return {
    ticker: cleanTicker,
    news: [],
    source: "google_news",
    isStale: false,
    timestamp: new Date().toISOString(),
  };
}

