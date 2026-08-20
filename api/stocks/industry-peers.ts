import { fmpServerService } from "../../src/lib/server/fmpServerService";
import { sendJson, extractParam } from "../_lib/handlerHelper";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const industry = extractParam(req, "industry");
    const sector = extractParam(req, "sector");
    const limit = parseInt(extractParam(req, "limit") || "30", 10);

    const peers = await fmpServerService.getIndustryPeers(industry, sector, limit);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return sendJson(res, 200, peers);
  } catch (error: any) {
    console.error("[Industry Peers API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
