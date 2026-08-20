import { fmpServerService } from "../../src/lib/server/fmpServerService";
import { verifyServerAuth } from "../../src/lib/server/authHelper";
import { fetchGoogleStockNews } from "../../src/services/newsEngine";
import { sendJson, extractTicker, extractOperation, extractParam } from "../_lib/handlerHelper";

/**
 * Consolidated Vercel Serverless Function: GET /api/stocks/:ticker
 * Supports ?operation=profile|statements|prices|intraday|outlook|peers|executives|news
 */
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

    const operation = extractOperation(req) || "profile";

    switch (operation) {
      case "profile": {
        const profile = await fmpServerService.getCompanyProfile(ticker);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
        return sendJson(res, 200, profile);
      }

      case "statements": {
        const authResult = await verifyServerAuth(req);
        if (!authResult.authenticated) {
          return sendJson(res, 401, {
            message: authResult.error || "Authentication required. Please sign in.",
          });
        }
        const statements = await fmpServerService.getStatementData(ticker);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
        return sendJson(res, 200, statements);
      }

      case "prices": {
        const prices = await fmpServerService.getHistoricalPrices(ticker);
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
        return sendJson(res, 200, prices);
      }

      case "intraday": {
        const intraday = await fmpServerService.getIntradayPrices(ticker);
        res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
        return sendJson(res, 200, intraday);
      }

      case "outlook": {
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
      }

      case "peers": {
        const peers = await fmpServerService.getStockPeers(ticker);
        res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=172800");
        return sendJson(res, 200, peers);
      }

      case "executives": {
        const executives = await fmpServerService.getKeyExecutives(ticker);
        res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=172800");
        return sendJson(res, 200, executives);
      }

      case "news": {
        const companyName = extractParam(req, "companyName");
        const refresh = extractParam(req, "refresh") === "true";
        const limit = parseInt(extractParam(req, "limit") || "8", 10);
        const news = await fetchGoogleStockNews(ticker, companyName, refresh, limit);
        res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
        return sendJson(res, 200, news);
      }

      default: {
        return sendJson(res, 400, {
          message: `Unknown operation: "${operation}". Supported operations: profile, statements, prices, intraday, outlook, peers, executives, news`,
        });
      }
    }
  } catch (error: any) {
    console.error("[Stocks API Error]:", error?.message || error);
    const msg = error?.message || "";
    let status = 500;
    if (msg.includes("Invalid symbol")) status = 400;
    else if (msg.includes("not found")) status = 404;
    return sendJson(res, status, { error: msg || "Internal server error" });
  }
}
