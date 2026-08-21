import { describe, it, expect } from "vitest";
import { generateSitemapXml } from "./sitemap";
import { STOCK_UNIVERSE } from "../data/stockUniverse";
import { PRODUCTION_DOMAIN } from "./seo";

describe("Sitemap Generation Utility", () => {
  it("1. Includes the homepage URL", () => {
    const xml = generateSitemapXml(["AAPL", "MSFT"], PRODUCTION_DOMAIN);
    expect(xml).toContain(`<loc>${PRODUCTION_DOMAIN}/</loc>`);
  });

  it("2. Includes valid stock URLs for provided tickers", () => {
    const xml = generateSitemapXml(["AAPL", "MSFT", "NVDA"], PRODUCTION_DOMAIN);
    expect(xml).toContain(`<loc>${PRODUCTION_DOMAIN}/stock/AAPL</loc>`);
    expect(xml).toContain(`<loc>${PRODUCTION_DOMAIN}/stock/MSFT</loc>`);
    expect(xml).toContain(`<loc>${PRODUCTION_DOMAIN}/stock/NVDA</loc>`);
  });

  it("3. Deduplicates case-insensitive duplicate symbols", () => {
    const xml = generateSitemapXml(["aapl", "AAPL", "Aapl"], PRODUCTION_DOMAIN);
    const matches = xml.match(/<loc>.*?\/stock\/AAPL<\/loc>/g);
    expect(matches).toHaveLength(1);
  });

  it("4. Correctly handles special character ticker symbols", () => {
    const xml = generateSitemapXml(["BRK.B", "BF.B"], PRODUCTION_DOMAIN);
    expect(xml).toContain(`<loc>${PRODUCTION_DOMAIN}/stock/BRK.B</loc>`);
    expect(xml).toContain(`<loc>${PRODUCTION_DOMAIN}/stock/BF.B</loc>`);
  });

  it("5. Generates well-formed XML urlset for full stock universe", () => {
    const xml = generateSitemapXml(STOCK_UNIVERSE, PRODUCTION_DOMAIN);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.endsWith("</urlset>\n")).toBe(true);

    // Over 500 stock URLs + homepage
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBeGreaterThanOrEqual(500);
  });
});
