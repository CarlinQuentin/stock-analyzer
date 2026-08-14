// In-Memory Server Cache strictly keyed by Symbol + CompanyName
const serverNewsCache = new Map();
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_UPSTREAM_REFRESH_INTERVAL_MS = 10 * 1000; // 10s rate-limit on forced refresh

/**
 * Strips tracking parameters from URLs
 */
function cleanCanonicalUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    const paramsToDelete = [];
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
 * Normalizes title for deduplication
 */
function normalizeTitle(rawTitle) {
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

/**
 * Normalizes company name for relevance matching
 */
function cleanCompanyName(companyName) {
  if (!companyName) return "";
  return companyName
    .replace(/,?\s*\b(Corporation|Holdings|Group|Corp|Inc|LLC|Ltd|Plc|SA|NV|Company|Co)\b\.?/gi, "")
    .replace(/\s+(and|&)\s*$/i, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes an RSS item into standard NewsItem
 */
function normalizeRssItem(raw, ticker, idx) {
  const sym = ticker.toUpperCase().trim();
  const rawTitle = (raw.title || "Company Update").trim();
  let title = rawTitle;
  let source = (raw.source || "").trim();

  if (rawTitle.includes(" - ")) {
    const parts = rawTitle.split(" - ");
    if (!source) {
      source = parts.pop() || "Market News";
    } else {
      parts.pop();
    }
    title = parts.join(" - ").trim();
  }

  if (!source) source = "Market News";

  const url = cleanCanonicalUrl(raw.link);
  const publishedAt = raw.pubDate ? new Date(raw.pubDate).toISOString() : new Date().toISOString();
  const summary = raw.description ? raw.description.replace(/<[^>]*>/g, "").trim() : undefined;

  let hash = 0;
  const str = url || `${sym}-${title}-${publishedAt}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  return {
    id: `news-${sym}-${Math.abs(hash)}-${idx}`,
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
 * Parses Google News RSS XML string into raw item array
 */
function parseGoogleNewsXml(xmlText) {
  if (!xmlText || typeof xmlText !== "string") return [];

  const items = [];
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
 * Filter articles strictly for company relevance (rejecting unrelated company news)
 */
function filterRelevantArticles(articles, ticker, companyName) {
  const cleanTicker = ticker.toUpperCase().trim();
  const cleanName = cleanCompanyName(companyName).toLowerCase();
  const nameParts = cleanName.split(/\s+/).filter((p) => p.length >= 3 && !STOP_WORDS.has(p));
  const tickerRegex = new RegExp(`\\b${cleanTicker}\\b`, "i");

  const catalystKeywords = [
    "earnings", "revenue", "profit", "loss", "guidance", "quarterly",
    "dividend", "fda", "approval", "trial", "clinical", "patent",
    "lawsuit", "sec", "acquisition", "merger", "buyback", "shares",
    "partnership", "contract", "deal", "ceo", "cfo", "analyst",
    "upgrade", "downgrade", "target", "rating", "product", "launch",
    "sales", "growth", "margins", "results",
  ];

  const scored = [];

  for (const article of articles) {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const summaryLower = (article.summary || "").toLowerCase();
    const combined = `${titleLower} ${summaryLower}`;

    let isCompanyMatch = false;

    // Direct ticker in title
    if (tickerRegex.test(article.title)) {
      score += 20;
      isCompanyMatch = true;
    }

    // Full company name in title
    if (cleanName && cleanName.length > 2 && titleLower.includes(cleanName)) {
      score += 25;
      isCompanyMatch = true;
    } else {
      // Partial company name match (e.g. "Lilly" for "Eli Lilly")
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

    // Completely skip articles that do not mention this ticker or company name
    if (!isCompanyMatch) {
      continue;
    }

    // Boost corporate catalyst keywords
    for (const kw of catalystKeywords) {
      if (combined.includes(kw)) {
        score += 4;
      }
    }

    // Recency bonus
    try {
      const pubTime = new Date(article.publishedAt).getTime();
      const ageHours = (Date.now() - pubTime) / (1000 * 60 * 60);
      if (ageHours < 24) score += 10;
      else if (ageHours < 72) score += 5;
    } catch {
      // ignore
    }

    scored.push({ article, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((item) => item.article);
}

/**
 * Deduplicates articles by URL and title signature
 */
function deduplicate(articles) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const deduped = [];

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
 * Fetches Google News RSS search directly via server-side fetch
 */
async function fetchGoogleNewsRss(query) {
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

/**
 * Server-side entry point for discovering company-specific stock news via Google search
 */
export async function getStockNewsServer(ticker, companyName, forceRefresh = false, limit = 8) {
  const cleanTicker = (ticker || "").toUpperCase().trim();
  const cleanName = cleanCompanyName(companyName);
  const cacheKey = `${cleanTicker}:${cleanName.toLowerCase()}`;
  const startTime = Date.now();

  // 1. Check scoped cache if not force-refreshing
  const cached = serverNewsCache.get(cacheKey);
  const now = Date.now();

  if (!forceRefresh && cached && now < cached.expiresAt && cached.data.length > 0) {
    return {
      ticker: cleanTicker,
      news: cached.data.slice(0, limit),
      source: "cache",
      isStale: false,
      timestamp: new Date(cached.timestamp).toISOString(),
    };
  }

  // Rate-limit check on rapid force-refreshes (10s)
  if (cached && now - cached.lastFetchTime < MIN_UPSTREAM_REFRESH_INTERVAL_MS) {
    return {
      ticker: cleanTicker,
      news: cached.data.slice(0, limit),
      source: "cache",
      isStale: false,
      timestamp: new Date(cached.timestamp).toISOString(),
    };
  }

  // 2. Multi-stage Google News queries
  const queries = [];
  if (cleanName && cleanName.length > 2) {
    queries.push(`"${cleanName}" ${cleanTicker} news`);
    queries.push(`"${cleanName}" stock`);
  }
  queries.push(`${cleanTicker} stock news`);

  let allRawItems = [];

  for (const query of queries) {
    try {
      const xmlText = await fetchGoogleNewsRss(query);
      const items = parseGoogleNewsXml(xmlText);
      if (items.length > 0) {
        allRawItems.push(...items);
        if (allRawItems.length >= 15) break; // sufficient raw pool
      }
    } catch (err) {
      console.warn(`[News API] Query failed for "${query}":`, err.message);
    }
  }

  const durationMs = Date.now() - startTime;

  // 3. Process, filter strictly for this company, deduplicate, and sort
  if (allRawItems.length > 0) {
    const normalized = allRawItems.map((raw, idx) => normalizeRssItem(raw, cleanTicker, idx));
    const relevant = filterRelevantArticles(normalized, cleanTicker, cleanName);
    const deduped = deduplicate(relevant);

    deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const finalNews = deduped.slice(0, limit);

    if (finalNews.length > 0) {
      serverNewsCache.set(cacheKey, {
        data: finalNews,
        timestamp: now,
        expiresAt: now + NEWS_CACHE_TTL_MS,
        lastFetchTime: now,
      });

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

  // 4. If no company-specific news was found, return clean empty result (DO NOT cross-contaminate with other stocks)
  console.info(`[News API] No matching news found for ${cleanTicker} (${cleanName}) | Duration: ${durationMs}ms`);
  return {
    ticker: cleanTicker,
    news: [],
    source: "google_news",
    isStale: false,
    timestamp: new Date().toISOString(),
  };
}
