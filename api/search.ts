import { fmpServerService } from "./_lib/fmpServerService";
import { sendJson, extractParam, extractOperation } from "./_lib/handlerHelper";

/**
 * Consolidated Vercel Serverless Function: GET /api/search
 * Supports ?operation=search|resolve
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const operation = extractOperation(req) || "search";

    if (operation === "resolve") {
      const input =
        extractParam(req, "input") ||
        extractParam(req, "query") ||
        extractParam(req, "q");
      if (!input || input.trim().length === 0) {
        return sendJson(res, 400, { message: "Search input is required" });
      }

      const result = await fmpServerService.resolveTicker(input);
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
      return sendJson(res, 200, result);
    }

    // Default: search
    const query = extractParam(req, "query") || extractParam(req, "q") || "";
    const limit = parseInt(extractParam(req, "limit") || "10", 10);

    if (!query || query.trim().length === 0) {
      return sendJson(res, 200, []);
    }

    const results = await fmpServerService.searchCompany(query, limit);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return sendJson(res, 200, results);
  } catch (error: any) {
    console.error("[Search API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
