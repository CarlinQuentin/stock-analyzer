import { fmpServerService } from "../../src/lib/server/fmpServerService";
import { sendJson, extractParam } from "../_lib/handlerHelper";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const limit = parseInt(extractParam(req, "limit") || "10", 10);
    const data = await fmpServerService.getMarketMovers(limit);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return sendJson(res, 200, data);
  } catch (error: any) {
    console.error("[Market Movers API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
