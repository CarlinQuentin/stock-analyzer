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

    const prices = await fmpServerService.getIntradayPrices(ticker);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return sendJson(res, 200, prices);
  } catch (error: any) {
    console.error("[Intraday Prices API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
