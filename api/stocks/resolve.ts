import { fmpServerService } from "../../src/lib/server/fmpServerService";
import { sendJson, extractParam } from "../_lib/handlerHelper";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const input = extractParam(req, "input") || extractParam(req, "query") || extractParam(req, "q");
    if (!input || input.trim().length === 0) {
      return sendJson(res, 400, { message: "Search input is required" });
    }

    const result = await fmpServerService.resolveTicker(input);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return sendJson(res, 200, result);
  } catch (error: any) {
    console.error("[Resolve Ticker API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
