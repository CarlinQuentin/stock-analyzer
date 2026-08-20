import { fetchGoogleStockNews } from "../../../src/services/newsEngine";

/**
 * Vercel Serverless Function: GET /api/stocks/:ticker/news
 * Directly fetches, parses, and filters Google News RSS server-to-server.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const rawTicker = req.query.ticker || req.query.symbol;
    if (!rawTicker || typeof rawTicker !== "string" || rawTicker.trim().length === 0) {
      return res.status(400).json({ message: "Stock ticker is required" });
    }

    const cleanTicker = rawTicker.trim().toUpperCase();
    const companyName = typeof req.query.companyName === "string" ? req.query.companyName : undefined;
    const forceRefresh = req.query.refresh === "true";
    const limit = parseInt(typeof req.query.limit === "string" ? req.query.limit : "8", 10) || 8;

    const result = await fetchGoogleStockNews(cleanTicker, companyName, forceRefresh, limit);

    // Edge cache: 5 minutes, stale-while-revalidate: 10 minutes
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Vercel News API Error]:", error);
    return res.status(500).json({
      news: [],
      source: "error",
      message: "An internal error occurred while fetching news",
      timestamp: new Date().toISOString(),
    });
  }
}
