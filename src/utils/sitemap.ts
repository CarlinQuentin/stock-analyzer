import { PRODUCTION_DOMAIN } from "./seo";

/**
 * Generates an XML sitemap conforming to sitemaps.org standards.
 * Includes the home page and canonical stock pages for supported tickers.
 */
export function generateSitemapXml(
  tickers: string[],
  domain: string = PRODUCTION_DOMAIN
): string {
  const cleanDomain = domain.replace(/\/+$/, "");
  const seen = new Set<string>();

  const urlEntries: string[] = [
    `  <url>\n    <loc>${cleanDomain}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ];

  for (const rawTicker of tickers) {
    if (!rawTicker || typeof rawTicker !== "string") continue;
    const ticker = rawTicker.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);

    const encodedPath = encodeURIComponent(ticker);
    urlEntries.push(
      `  <url>\n    <loc>${cleanDomain}/stock/${encodedPath}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join(
    "\n"
  )}\n</urlset>\n`;
}
