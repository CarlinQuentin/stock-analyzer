import { fmpServerService } from "../../../src/lib/server/fmpServerService";
import { sendJson, extractTicker, extractParam } from "../../_lib/handlerHelper";

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

    const currentPriceParam = extractParam(req, "currentPrice");
    const historicalEpsCagrParam = extractParam(req, "historicalEpsCagr");
    const historicalRevenueCagrParam = extractParam(req, "historicalRevenueCagr");

    const currentPrice = currentPriceParam ? parseFloat(currentPriceParam) : undefined;
    const historicalEpsCagr = historicalEpsCagrParam ? parseFloat(historicalEpsCagrParam) : undefined;
    const historicalRevenueCagr = historicalRevenueCagrParam ? parseFloat(historicalRevenueCagrParam) : undefined;

    const outlook = await fmpServerService.getFutureOutlookData(
      ticker,
      currentPrice,
      historicalEpsCagr,
      historicalRevenueCagr
    );

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return sendJson(res, 200, outlook);
  } catch (error: any) {
    console.error("[Future Outlook API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
