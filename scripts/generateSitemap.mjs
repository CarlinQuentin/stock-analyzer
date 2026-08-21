import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const PRODUCTION_DOMAIN = "https://stock-analyzer-five-rouge.vercel.app";

// Import stock universe from src/data/stockUniverse.ts
const stockUniverseFile = fs.readFileSync(
  path.join(rootDir, "src", "data", "stockUniverse.ts"),
  "utf-8"
);

const matches = stockUniverseFile.match(/"([A-Z0-9.\-_]+)"/g);
const tickers = matches
  ? Array.from(new Set(matches.map((m) => m.replace(/"/g, ""))))
  : [];

const cleanDomain = PRODUCTION_DOMAIN.replace(/\/+$/, "");
const seen = new Set();

const urlEntries = [
  `  <url>\n    <loc>${cleanDomain}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
];

for (const rawTicker of tickers) {
  if (!rawTicker) continue;
  const ticker = rawTicker.trim().toUpperCase();
  if (seen.has(ticker)) continue;
  seen.add(ticker);

  const encodedPath = encodeURIComponent(ticker);
  urlEntries.push(
    `  <url>\n    <loc>${cleanDomain}/stock/${encodedPath}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
  );
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join(
  "\n"
)}\n</urlset>\n`;

const publicDir = path.join(rootDir, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemapXml, "utf-8");
console.log(
  `[Sitemap Generator] Generated sitemap.xml with ${seen.size} stock URLs + homepage.`
);
