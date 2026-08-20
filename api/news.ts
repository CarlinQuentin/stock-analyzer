import { fetchGoogleStockNews } from "../src/services/newsEngine";
import { sendJson, extractParam, extractTicker } from "./_lib/handlerHelper";

export const fetchGoogleStockNewsServer = fetchGoogleStockNews;

/**
 * Consolidated Vercel Serverless Function: GET /api/news
 * Supports ?ticker=...&companyName=...&refresh=...&limit=...
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const rawTicker = extractTicker(req) || extractParam(req, "ticker") || extractParam(req, "symbol");
    if (!rawTicker || typeof rawTicker !== "string" || rawTicker.trim().length === 0) {
      return sendJson(res, 400, { message: "Stock ticker is required" });
    }

    const cleanTicker = rawTicker.trim().toUpperCase();
    const companyName = extractParam(req, "companyName");
    const refresh = extractParam(req, "refresh") === "true";
    const limit = parseInt(extractParam(req, "limit") || "8", 10) || 8;

    const result = await fetchGoogleStockNews(cleanTicker, companyName, refresh, limit);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return sendJson(res, 200, result);
  } catch (error: any) {
    console.error("[News API Error]:", error?.message || error);
    return sendJson(res, 500, {
      news: [],
      source: "error",
      message: "An internal error occurred while fetching stock news",
      timestamp: new Date().toISOString(),
    });
  }
}
