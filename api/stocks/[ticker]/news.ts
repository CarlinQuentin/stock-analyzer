export interface NewsItem {
  id: string;
  ticker: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

export interface RawRssNewsItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: string;
  description?: string;
}

export interface GoogleStockNewsResult {
  ticker: string;
  news: NewsItem[];
  source: string;
  isStale: boolean;
  timestamp: string;
}

const NEWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_UPSTREAM_REFRESH_INTERVAL_MS = 10 * 1000; // 10s rate limit
const STOP_WORDS = new Set(["and", "the", "for", "with", "all", "inc", "corp", "co", "ltd", "llc", "group", "class", "com", "net"]);

// In-memory cache for serverless instance
const serverNewsCache = new Map<string, { data: NewsItem[]; timestamp: number; expiresAt: number; lastFetchTime: number }>();

function cleanCanonicalUrl(rawUrl?: string): string {
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

function normalizeTitle(rawTitle?: string): string {
  if (!rawTitle) return "";
  let clean = rawTitle
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

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

function cleanCompanyName(companyName?: string): string {
  if (!companyName) return "";
  return companyName
    .replace(/,?\s*\b(Corporation|Holdings|Group|Corp|Inc|LLC|Ltd|Plc|SA|NV|Company|Co)\b\.?/gi, "")
    .replace(/\s+(and|&)\s*$/i, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

function normalizeRssItem(raw: RawRssNewsItem, ticker: string, index: number = 0): NewsItem {
  const sym = ticker.toUpperCase().trim();
  const rawTitle = (raw.title || "Company Update").trim();
  let title = rawTitle;
  let source = (raw.source || "").trim();

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

function filterRelevantNews(articles: NewsItem[], ticker: string, companyName?: string): NewsItem[] {
  const cleanTicker = ticker.toUpperCase().trim();
  const cleanName = cleanCompanyName(companyName).toLowerCase();
  const nameParts = cleanName.split(/\s+/).filter((p) => p.length >= 3 && !STOP_WORDS.has(p));
  const tickerRegex = new RegExp(`\\b${cleanTicker}\\b`, "i");

  const catalystKeywords = [
    "earnings", "revenue", "profit", "loss", "guidance", "quarterly", "dividend",
    "fda", "approval", "trial", "clinical", "patent", "lawsuit", "sec",
    "acquisition", "merger", "acquired", "buyback", "shares", "partnership",
    "contract", "deal", "ceo", "cfo", "executive", "analyst", "upgrade",
    "downgrade", "target", "rating", "outperform", "product", "launch",
    "sales", "growth", "margins", "results",
  ];

  const scored = articles
    .map((article) => {
      let score = 0;
      const titleLower = article.title.toLowerCase();
      const summaryLower = (article.summary || "").toLowerCase();
      const combined = `${titleLower} ${summaryLower}`;

      let isCompanyMatch = false;

      if (tickerRegex.test(article.title)) {
        score += 20;
        isCompanyMatch = true;
      }

      if (cleanName && cleanName.length > 2 && titleLower.includes(cleanName)) {
        score += 25;
        isCompanyMatch = true;
      } else {
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

      if (!isCompanyMatch) {
        return null;
      }

      for (const kw of catalystKeywords) {
        if (combined.includes(kw)) {
          score += 4;
        }
      }

      try {
        const pubTime = new Date(article.publishedAt).getTime();
        const ageHours = (Date.now() - pubTime) / (1000 * 60 * 60);
        if (ageHours < 24) {
          score += 10;
        } else if (ageHours < 72) {
          score += 5;
        }
      } catch {}

      return { article, score };
    })
    .filter((item): item is { article: NewsItem; score: number } => item !== null);

  return scored.sort((a, b) => b.score - a.score).map((item) => item.article);
}

function deduplicateArticles(articles: NewsItem[]): NewsItem[] {
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

function parseGoogleNewsXml(xmlText: string): RawRssNewsItem[] {
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

async function fetchGoogleNewsRss(query: string): Promise<string> {
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

export async function fetchGoogleStockNewsServer(
  ticker: string,
  companyName?: string,
  forceRefresh: boolean = false,
  limit: number = 8,
): Promise<GoogleStockNewsResult> {
  const cleanTicker = (ticker || "").toUpperCase().trim();
  const cleanName = cleanCompanyName(companyName);
  const cacheKey = `${cleanTicker}:${cleanName.toLowerCase()}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = serverNewsCache.get(cacheKey);
    if (cached && now < cached.expiresAt && cached.data.length > 0) {
      return {
        ticker: cleanTicker,
        news: cached.data.slice(0, limit),
        source: "cache",
        isStale: false,
        timestamp: new Date(cached.timestamp).toISOString(),
      };
    }
  }

  const cached = serverNewsCache.get(cacheKey);
  if (cached && now - cached.lastFetchTime < MIN_UPSTREAM_REFRESH_INTERVAL_MS) {
    return {
      ticker: cleanTicker,
      news: cached.data.slice(0, limit),
      source: "cache",
      isStale: false,
      timestamp: new Date(cached.timestamp).toISOString(),
    };
  }

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
        if (allRawItems.length >= 15) break;
      }
    } catch (err: any) {
      console.warn(`[Vercel News API] Query failed for "${query}":`, err?.message || err);
    }
  }

  if (allRawItems.length > 0) {
    const normalized = allRawItems.map((raw, idx) => normalizeRssItem(raw, cleanTicker, idx));
    const relevant = filterRelevantNews(normalized, cleanTicker, cleanName);
    const deduped = deduplicateArticles(relevant);

    deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const finalNews = deduped.slice(0, limit);

    if (finalNews.length > 0) {
      serverNewsCache.set(cacheKey, {
        data: finalNews,
        timestamp: now,
        expiresAt: now + NEWS_CACHE_TTL_MS,
        lastFetchTime: now,
      });

      return {
        ticker: cleanTicker,
        news: finalNews,
        source: "google_news",
        isStale: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  return {
    ticker: cleanTicker,
    news: [],
    source: "google_news",
    isStale: false,
    timestamp: new Date().toISOString(),
  };
}

function sendJson(res: any, statusCode: number, data: any) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

/**
 * Vercel Serverless Function: GET /api/stocks/:ticker/news
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    let rawTicker = req.query?.ticker || req.query?.symbol;
    let companyName = typeof req.query?.companyName === "string" ? req.query.companyName : undefined;
    let forceRefresh = req.query?.refresh === "true";
    let limit = parseInt(typeof req.query?.limit === "string" ? req.query.limit : "8", 10) || 8;

    // Fallback: Parse from req.url if req.query is missing
    if (req.url) {
      try {
        const parsed = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
        if (!rawTicker) {
          const match = parsed.pathname.match(/\/api\/stocks\/([^/?]+)/i);
          if (match) {
            rawTicker = decodeURIComponent(match[1]);
          }
        }
        if (!companyName && parsed.searchParams.has("companyName")) {
          companyName = parsed.searchParams.get("companyName") || undefined;
        }
        if (parsed.searchParams.get("refresh") === "true") {
          forceRefresh = true;
        }
        if (parsed.searchParams.has("limit")) {
          limit = parseInt(parsed.searchParams.get("limit") || "8", 10) || 8;
        }
      } catch {}
    }

    if (!rawTicker || typeof rawTicker !== "string" || rawTicker.trim().length === 0) {
      return sendJson(res, 400, { message: "Stock ticker is required" });
    }

    const cleanTicker = rawTicker.trim().toUpperCase();
    const result = await fetchGoogleStockNewsServer(cleanTicker, companyName, forceRefresh, limit);

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return sendJson(res, 200, result);
  } catch (error: any) {
    console.error("[Vercel News API Handler Error]:", error);
    return sendJson(res, 500, {
      news: [],
      source: "error",
      message: "An internal error occurred while fetching stock news",
      timestamp: new Date().toISOString(),
    });
  }
}
