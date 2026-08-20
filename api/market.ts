import { fmpServerService } from "../src/lib/server/fmpServerService";
import { sendJson, extractParam, extractOperation } from "./_lib/handlerHelper";

/**
 * Consolidated Vercel Serverless Function: GET & POST /api/market
 * Supports ?operation=movers|screener|industry-peers|batch-quotes
 */
export default async function handler(req: any, res: any) {
  try {
    let operation = extractOperation(req);
    if (!operation) {
      if (req.method === "POST") {
        operation = "batch-quotes";
      } else {
        operation = "movers";
      }
    }

    switch (operation) {
      case "movers": {
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.setHeader("Allow", "GET, HEAD");
          return sendJson(res, 405, { message: "Method Not Allowed" });
        }
        const limit = parseInt(extractParam(req, "limit") || "10", 10);
        const data = await fmpServerService.getMarketMovers(limit);
        res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
        return sendJson(res, 200, data);
      }

      case "screener": {
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.setHeader("Allow", "GET, HEAD");
          return sendJson(res, 405, { message: "Method Not Allowed" });
        }
        const data = await fmpServerService.getCompanyScreenerPool();
        res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
        return sendJson(res, 200, data);
      }

      case "industry-peers": {
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.setHeader("Allow", "GET, HEAD");
          return sendJson(res, 405, { message: "Method Not Allowed" });
        }
        const industry = extractParam(req, "industry");
        const sector = extractParam(req, "sector");
        const limit = parseInt(extractParam(req, "limit") || "30", 10);
        const peers = await fmpServerService.getIndustryPeers(industry, sector, limit);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
        return sendJson(res, 200, peers);
      }

      case "batch-quotes": {
        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          return sendJson(res, 405, { message: "Method Not Allowed" });
        }

        let body = req.body;
        if (typeof body === "string") {
          try {
            body = JSON.parse(body);
          } catch {}
        }

        const symbols = Array.isArray(body?.symbols) ? body.symbols : [];
        if (symbols.length === 0) {
          return sendJson(res, 200, []);
        }

        const quotes = await fmpServerService.getBatchQuotes(symbols);
        res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
        return sendJson(res, 200, quotes);
      }

      default: {
        return sendJson(res, 400, {
          message: `Unknown market operation: "${operation}". Supported: movers, screener, industry-peers, batch-quotes`,
        });
      }
    }
  } catch (error: any) {
    console.error("[Market API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
