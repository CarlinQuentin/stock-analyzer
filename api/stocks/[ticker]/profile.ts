import { fmpServerService } from "../../../src/lib/server/fmpServerService";
import { sendJson, extractTicker } from "../../_lib/handlerHelper";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const ticker = extractTicker(req);
    if (!ticker) {
      return sendJson(res, 400, { message: "Stock ticker is required" });
    }

    const profile = await fmpServerService.getCompanyProfile(ticker);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return sendJson(res, 200, profile);
  } catch (error: any) {
    console.error("[Profile API Error]:", error?.message || error);
    const msg = error?.message || "";
    let status = 500;
    if (msg.includes("Invalid symbol")) status = 400;
    else if (msg.includes("not found")) status = 404;
    return sendJson(res, status, { error: msg || "Internal server error" });
  }
}
