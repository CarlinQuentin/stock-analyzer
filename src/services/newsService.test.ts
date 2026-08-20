import { describe, it, expect, beforeEach } from "vitest";
import {
  cleanCanonicalUrl,
  normalizeTitle,
  cleanCompanyName,
  normalizeRssItem,
  filterRelevantNews,
  deduplicateArticles,
  processGoogleNewsRss,
  NewsMemoryCache,
  RawRssNewsItem,
} from "./newsEngine";
import { formatRelativeNewsTime } from "../components/StockNews";
import { NewsItem } from "../types";

describe("Google News RSS Engine & Discovery", () => {
  describe("cleanCanonicalUrl", () => {
    it("removes tracking parameters cleanly", () => {
      const url = "https://bloomberg.com/news/apple-earnings?utm_source=twitter&utm_medium=social&ref=123&fbclid=xyz#section";
      const clean = cleanCanonicalUrl(url);
      expect(clean).toBe("https://bloomberg.com/news/apple-earnings#section");
    });

    it("handles URLs without tracking parameters", () => {
      const url = "https://reuters.com/business/tech/microsoft-deal";
      expect(cleanCanonicalUrl(url)).toBe("https://reuters.com/business/tech/microsoft-deal");
    });
  });

  describe("normalizeTitle", () => {
    it("strips trailing publisher tags and special characters", () => {
      const title = "Eli Lilly Reports Record Q3 Revenue &amp; Profit - Bloomberg";
      expect(normalizeTitle(title)).toBe("eli lilly reports record q3 revenue profit");
    });

    it("strips HTML entities and symbols", () => {
      const title = "Nvidia&#39;s New AI Chip &quot;Blackwell&quot; Ships | Reuters";
      expect(normalizeTitle(title)).toBe("nvidias new ai chip blackwell ships");
    });
  });

  describe("cleanCompanyName", () => {
    it("strips legal and corporate suffixes", () => {
      expect(cleanCompanyName("Eli Lilly and Company")).toBe("Eli Lilly");
      expect(cleanCompanyName("Apple Inc.")).toBe("Apple");
      expect(cleanCompanyName("Microsoft Corporation")).toBe("Microsoft");
      expect(cleanCompanyName("Steel Dynamics, Inc.")).toBe("Steel Dynamics");
      expect(cleanCompanyName("NVIDIA Corporation")).toBe("NVIDIA");
    });
  });

  describe("normalizeRssItem", () => {
    it("normalizes an RSS item into an AGY NewsItem with clean title and source", () => {
      const raw: RawRssNewsItem = {
        title: "Eli Lilly Files Six Lawsuits Over Illicit Retatrutide Sales - simplywall.st",
        link: "https://news.google.com/rss/articles/CBMi123?oc=5&utm_source=rss",
        pubDate: "Fri, 14 Aug 2026 12:48:30 GMT",
        source: "simplywall.st",
        description: "Eli Lilly (LLY) has taken legal action against several online entities...",
      };

      const item = normalizeRssItem(raw, "LLY", 0);
      expect(item.ticker).toBe("LLY");
      expect(item.title).toBe("Eli Lilly Files Six Lawsuits Over Illicit Retatrutide Sales");
      expect(item.source).toBe("simplywall.st");
      expect(item.url).toBe("https://news.google.com/rss/articles/CBMi123?oc=5");
      expect(item.summary).toContain("Eli Lilly (LLY) has taken legal action");
      expect(item.id).toContain("news-LLY");
    });
  });

  describe("filterRelevantNews (Strict Company Isolation)", () => {
    const mixedArticles: NewsItem[] = [
      {
        id: "1",
        ticker: "LLY",
        title: "Eli Lilly Soars Past $1 Trillion Market Cap on Strong Zepbound Demand",
        source: "Bloomberg",
        url: "https://bloomberg.com/lilly-1t",
        publishedAt: new Date().toISOString(),
        summary: "Eli Lilly (LLY) shares surged following FDA approval milestones.",
      },
      {
        id: "2",
        ticker: "LLY",
        title: "Apple Unveils New iPhone 17 and M5 Chips at Cupertino Keynote",
        source: "TechCrunch",
        url: "https://techcrunch.com/apple-keynote",
        publishedAt: new Date().toISOString(),
        summary: "Apple announced its latest hardware line up today in California.",
      },
      {
        id: "3",
        ticker: "LLY",
        title: "Lilly calls on regulators to shut down counterfeit drug sales",
        source: "PR Newswire",
        url: "https://prnewswire.com/lilly-fda",
        publishedAt: new Date().toISOString(),
        summary: "Eli Lilly and Company issued a global statement regarding counterfeit products.",
      },
      {
        id: "4",
        ticker: "LLY",
        title: "Microsoft and OpenAI Partner on Supercomputing Infrastructure",
        source: "CNBC",
        url: "https://cnbc.com/msft-openai",
        publishedAt: new Date().toISOString(),
        summary: "Microsoft shares rose following cloud partnership expansion.",
      },
    ];

    it("strictly isolates Eli Lilly news and discards Apple/Microsoft stories", () => {
      const filtered = filterRelevantNews(mixedArticles, "LLY", "Eli Lilly and Company");
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toContain("Eli Lilly Soars Past $1 Trillion");
      expect(filtered[1].title).toContain("Lilly calls on regulators");
      // Verify Apple and Microsoft were completely filtered out
      expect(filtered.some((a) => a.title.includes("Apple"))).toBe(false);
      expect(filtered.some((a) => a.title.includes("Microsoft"))).toBe(false);
    });
  });

  describe("deduplicateArticles", () => {
    it("deduplicates syndicated stories with same title or canonical link", () => {
      const duplicates: NewsItem[] = [
        {
          id: "1",
          ticker: "LLY",
          title: "Eli Lilly Files Lawsuits Over Counterfeit Weight-Loss Drugs",
          source: "Bloomberg",
          url: "https://bloomberg.com/lilly-suit?utm_source=twitter",
          publishedAt: "2026-08-14T10:00:00Z",
        },
        {
          id: "2",
          ticker: "LLY",
          title: "Eli Lilly Files Lawsuits Over Counterfeit Weight-Loss Drugs - Yahoo",
          source: "Yahoo Finance",
          url: "https://yahoo.com/lilly-suit-dup",
          publishedAt: "2026-08-14T10:05:00Z",
        },
      ];

      const deduped = deduplicateArticles(duplicates);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].source).toBe("Bloomberg");
    });
  });

  describe("parseGoogleNewsXml & processGoogleNewsRss", () => {
    it("parses and filters Google News RSS XML cleanly", () => {
      const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Google News</title>
          <item>
            <title><![CDATA[Eli Lilly Q2 Earnings Beat Estimates with $11.3B in Sales - Bloomberg]]></title>
            <link>https://news.google.com/rss/articles/CBMi111?oc=5</link>
            <pubDate>Fri, 14 Aug 2026 14:00:00 GMT</pubDate>
            <source url="https://bloomberg.com">Bloomberg</source>
            <description><![CDATA[Eli Lilly reported strong revenue growth driven by diabetes and obesity treatments.]]></description>
          </item>
          <item>
            <title><![CDATA[Nvidia Blackwell AI Chips Begin Volume Shipments - Reuters]]></title>
            <link>https://news.google.com/rss/articles/CBMi222?oc=5</link>
            <pubDate>Fri, 14 Aug 2026 13:00:00 GMT</pubDate>
            <source url="https://reuters.com">Reuters</source>
            <description><![CDATA[Nvidia shares gained following datacenter demand updates.]]></description>
          </item>
        </channel>
      </rss>`;

      const processed = processGoogleNewsRss(sampleXml, "LLY", "Eli Lilly and Company", 5);
      expect(processed).toHaveLength(1);
      expect(processed[0].ticker).toBe("LLY");
      expect(processed[0].title).toBe("Eli Lilly Q2 Earnings Beat Estimates with $11.3B in Sales");
      expect(processed[0].source).toBe("Bloomberg");
    });
  });

  describe("NewsMemoryCache (Scoped Isolation)", () => {
    let cache: NewsMemoryCache;

    beforeEach(() => {
      cache = new NewsMemoryCache();
    });

    it("isolates caches by symbol and company name (no cross-contamination)", () => {
      const llyNews: NewsItem[] = [
        {
          id: "1",
          ticker: "LLY",
          title: "Eli Lilly News",
          source: "Bloomberg",
          url: "https://bloomberg.com/lilly",
          publishedAt: new Date().toISOString(),
        },
      ];

      cache.set("LLY", "Eli Lilly and Company", llyNews);

      // LLY should return LLY news
      const llyCached = cache.get("LLY", "Eli Lilly and Company");
      expect(llyCached).toHaveLength(1);
      expect(llyCached?.[0].ticker).toBe("LLY");

      // AAPL should return null (NOT LLY news)
      const aaplCached = cache.get("AAPL", "Apple Inc.");
      expect(aaplCached).toBeNull();
    });
  });

  describe("formatRelativeNewsTime", () => {
    it("formats dates into clean relative times", () => {
      const now = new Date();
      expect(formatRelativeNewsTime(now.toISOString())).toBe("Just now");

      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatRelativeNewsTime(twoHoursAgo.toISOString())).toBe("2h ago");

      const yesterday = new Date(now.getTime() - 26 * 60 * 60 * 1000);
      expect(formatRelativeNewsTime(yesterday.toISOString())).toBe("Yesterday");

      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      expect(formatRelativeNewsTime(fourDaysAgo.toISOString())).toBe("4d ago");
    });
  });

  describe("Vercel Serverless Function & API Path", () => {
    it("handles Vercel API response in newsService without public CORS proxies", async () => {
      const { newsService } = await import("./newsService");
      
      const mockNewsItem: NewsItem = {
        id: "news-STLD-1",
        ticker: "STLD",
        title: "Steel Dynamics Reports Q2 Results",
        source: "Reuters",
        url: "https://reuters.com/stld",
        publishedAt: new Date().toISOString(),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString();
        if (urlStr.includes("/api/stocks/STLD/news")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ticker: "STLD",
              news: [mockNewsItem],
              source: "google_news",
              isStale: false,
              timestamp: new Date().toISOString(),
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      };

      try {
        const result = await newsService.getStockNews("STLD", "Steel Dynamics, Inc.", true);
        expect(result).toHaveLength(1);
        expect(result[0].ticker).toBe("STLD");
        expect(result[0].title).toBe("Steel Dynamics Reports Q2 Results");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

