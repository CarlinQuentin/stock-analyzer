import { fmpServerService } from "../../src/lib/server/fmpServerService";
import { sendJson } from "../_lib/handlerHelper";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
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
  } catch (error: any) {
    console.error("[Batch Quotes API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
