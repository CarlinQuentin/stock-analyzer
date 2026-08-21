import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateStockMetadata,
  generateDefaultMetadata,
  generateStockBreadcrumbsJsonLd,
  generateWebSiteJsonLd,
  updateDocumentMetadata,
  PRODUCTION_DOMAIN,
} from "./seo";
import { POPULAR_DIRECTORY_STOCKS } from "../components/PopularStocksDirectory";
import { buildStockUrl } from "./navigation";

describe("SEO Utilities", () => {
  describe("generateStockMetadata", () => {
    it("1. Generates correct title, description, and canonical URL for AAPL + Apple Inc.", () => {
      const meta = generateStockMetadata("AAPL", "Apple Inc.");

      expect(meta.title).toBe(
        "AAPL Stock Analysis & Quality Score (Apple Inc.) | Investor's Edge"
      );
      expect(meta.description).toBe(
        "Fundamental analysis for Apple Inc. (AAPL), including ROIC, free cash flow, growth trends, valuation metrics, and investment quality scoring."
      );
      expect(meta.canonicalUrl).toBe(`${PRODUCTION_DOMAIN}/stock/AAPL`);
      expect(meta.robots).toBe("index, follow");
    });

    it("2. Handles missing company name cleanly by falling back to ticker", () => {
      const meta = generateStockMetadata("MSFT", null);

      expect(meta.title).toBe(
        "MSFT Stock Analysis & Quality Score (MSFT) | Investor's Edge"
      );
      expect(meta.description).toBe(
        "Fundamental analysis for MSFT (MSFT), including ROIC, free cash flow, growth trends, valuation metrics, and investment quality scoring."
      );
      expect(meta.canonicalUrl).toBe(`${PRODUCTION_DOMAIN}/stock/MSFT`);
    });

    it("3. Enforces uppercase and clean URL encoding on tickers", () => {
      const meta = generateStockMetadata("brk.b", "Berkshire Hathaway Inc.");

      expect(meta.title).toContain("BRK.B");
      expect(meta.canonicalUrl).toBe(`${PRODUCTION_DOMAIN}/stock/BRK.B`);
    });

    it("4. Canonical URL strips any tab query parameters", () => {
      const meta = generateStockMetadata("AAPL", "Apple Inc.");
      // Even if a user is viewing ?tab=futureOutlook or ?tab=valuation, canonical path is /stock/AAPL
      expect(meta.canonicalUrl).toBe(`${PRODUCTION_DOMAIN}/stock/AAPL`);
      expect(meta.canonicalUrl).not.toContain("?tab=");
    });
  });

  describe("generateDefaultMetadata", () => {
    it("5. Generates standard homepage metadata", () => {
      const meta = generateDefaultMetadata();

      expect(meta.title).toBe("Investor's Edge | Fundamental Stock Analysis");
      expect(meta.description).toContain("Analyze stocks with fundamental metrics");
      expect(meta.canonicalUrl).toBe(`${PRODUCTION_DOMAIN}/`);
      expect(meta.robots).toBe("index, follow");
    });
  });

  describe("Structured Data (JSON-LD)", () => {
    it("6. Generates valid BreadcrumbList schema for stock page", () => {
      const jsonLd: any = generateStockBreadcrumbsJsonLd("NVDA", "Nvidia Corporation");

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("BreadcrumbList");
      expect(jsonLd.itemListElement).toHaveLength(3);

      expect(jsonLd.itemListElement[0]).toEqual({
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${PRODUCTION_DOMAIN}/`,
      });
      expect(jsonLd.itemListElement[1]).toEqual({
        "@type": "ListItem",
        position: 2,
        name: "Stocks",
      });
      expect(jsonLd.itemListElement[2]).toEqual({
        "@type": "ListItem",
        position: 3,
        name: "NVDA",
        item: `${PRODUCTION_DOMAIN}/stock/NVDA`,
      });
    });

    it("7. Generates valid WebSite schema with SearchAction", () => {
      const jsonLd: any = generateWebSiteJsonLd();

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("WebSite");
      expect(jsonLd.name).toBe("Investor's Edge");
      expect(jsonLd.url).toBe(`${PRODUCTION_DOMAIN}/`);
      expect(jsonLd.potentialAction["@type"]).toBe("SearchAction");
      expect(jsonLd.potentialAction.target.urlTemplate).toBe(
        `${PRODUCTION_DOMAIN}/stock/{search_term_string}`
      );
    });
  });

  describe("updateDocumentMetadata DOM updates", () => {
    let elements: any[] = [];
    let docTitle = "";

    beforeEach(() => {
      elements = [];
      docTitle = "";

      const mockDoc: any = {
        get title() {
          return docTitle;
        },
        set title(val: string) {
          docTitle = val;
        },
        querySelector: (selector: string) => {
          if (selector.startsWith('meta[name="')) {
            const name = selector.match(/meta\[name="([^"]+)"\]/)?.[1];
            return elements.find((el) => el.tagName === "meta" && el.attributes.name === name) || null;
          }
          if (selector.startsWith('meta[property="')) {
            const prop = selector.match(/meta\[property="([^"]+)"\]/)?.[1];
            return elements.find((el) => el.tagName === "meta" && el.attributes.property === prop) || null;
          }
          if (selector === 'link[rel="canonical"]') {
            return elements.find((el) => el.tagName === "link" && el.attributes.rel === "canonical") || null;
          }
          return null;
        },
        getElementById: (id: string) => {
          return elements.find((el) => el.id === id) || null;
        },
        createElement: (tagName: string) => {
          const el = {
            tagName,
            id: "",
            textContent: "",
            attributes: {} as Record<string, string>,
            setAttribute(k: string, v: string) {
              this.attributes[k] = v;
            },
            getAttribute(k: string) {
              return this.attributes[k] || null;
            },
            remove() {
              elements = elements.filter((e) => e !== this);
            },
          };
          return el;
        },
        head: {
          appendChild: (el: any) => {
            elements.push(el);
          },
        },
      };

      (globalThis as any).document = mockDoc;
    });

    afterEach(() => {
      delete (globalThis as any).document;
    });

    it("8. Updates title, description, robots, canonical link, and JSON-LD script in document head", () => {
      const breadcrumbs = generateStockBreadcrumbsJsonLd("AAPL", "Apple Inc.");

      updateDocumentMetadata({
        title: "AAPL Stock Analysis | Investor's Edge",
        description: "Apple Inc. fundamental analysis",
        canonicalUrl: `${PRODUCTION_DOMAIN}/stock/AAPL`,
        robots: "index, follow",
        jsonLd: breadcrumbs,
      });

      expect(docTitle).toBe("AAPL Stock Analysis | Investor's Edge");

      const descMeta = (globalThis as any).document.querySelector('meta[name="description"]');
      expect(descMeta?.getAttribute("content")).toBe("Apple Inc. fundamental analysis");

      const canonicalLink = (globalThis as any).document.querySelector('link[rel="canonical"]');
      expect(canonicalLink?.getAttribute("href")).toBe(`${PRODUCTION_DOMAIN}/stock/AAPL`);

      const robotsMeta = (globalThis as any).document.querySelector('meta[name="robots"]');
      expect(robotsMeta?.getAttribute("content")).toBe("index, follow");

      const script = (globalThis as any).document.getElementById("schema-breadcrumb-jsonld");
      expect(script).not.toBeNull();
      expect(JSON.parse(script.textContent)).toEqual(breadcrumbs);
    });

    it("9. Sets noindex for private/authenticated routes like saved stocks and removes breadcrumb script", () => {
      updateDocumentMetadata({
        title: "Saved Stocks | Investor's Edge",
        description: "View your saved stocks",
        canonicalUrl: `${PRODUCTION_DOMAIN}/saved`,
        robots: "noindex, nofollow",
        jsonLd: null,
      });

      expect(docTitle).toBe("Saved Stocks | Investor's Edge");

      const robotsMeta = (globalThis as any).document.querySelector('meta[name="robots"]');
      expect(robotsMeta?.getAttribute("content")).toBe("noindex, nofollow");

      const script = (globalThis as any).document.getElementById("schema-breadcrumb-jsonld");
      expect(script).toBeNull();
    });
  });

  describe("Crawlable Stock Links Directory", () => {
    it("10. Generates valid canonical paths for all popular directory stocks", () => {
      for (const stock of POPULAR_DIRECTORY_STOCKS) {
        const url = buildStockUrl(stock.symbol);
        expect(url).toBe(`/stock/${encodeURIComponent(stock.symbol)}`);
        expect(stock.symbol).toBeDefined();
        expect(stock.name).toBeDefined();
      }
    });
  });
});
