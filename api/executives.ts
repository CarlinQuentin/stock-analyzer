import { getExecutiveCareerProfile } from "./_lib/executiveEngine.js";
import { sendJson, extractParam } from "./_lib/handlerHelper.js";

export const getExecutiveCareerProfileServer = getExecutiveCareerProfile;

/**
 * Consolidated Vercel Serverless Function: GET /api/executives or /api/executive-profile
 * Supports:
 * - ?name=Tim+Cook
 * - ?company=Apple+Inc
 * - ?symbol=AAPL
 * - ?title=Chief+Executive+Officer
 * - ?refresh=true
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const name = extractParam(req, "name");
    const company = extractParam(req, "company") || extractParam(req, "companyName");
    const symbol = extractParam(req, "symbol") || extractParam(req, "ticker");
    const title = extractParam(req, "title");
    const refresh = extractParam(req, "refresh") === "true";

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return sendJson(res, 400, { message: "Executive name is required" });
    }

    if (!company || typeof company !== "string" || company.trim().length === 0) {
      return sendJson(res, 400, { message: "Company name is required" });
    }

    const cleanName = name.trim();
    const cleanCompany = company.trim();
    const cleanSymbol = symbol ? symbol.trim().toUpperCase() : undefined;
    const cleanTitle = title ? title.trim() : undefined;

    const profile = await getExecutiveCareerProfile(
      cleanName,
      cleanCompany,
      cleanSymbol,
      cleanTitle,
      refresh
    );

    // Cache header for edge / browser performance
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return sendJson(res, 200, profile);
  } catch (error: any) {
    console.error("[Executives API Error]:", error?.message || error);
    return sendJson(res, 500, {
      message: error?.message || "An internal error occurred while fetching executive career profile",
      roles: [],
      source: "none",
      fetchedAt: new Date().toISOString(),
    });
  }
}
