import { fmpServerService } from "../../src/lib/server/fmpServerService";
import { sendJson } from "../_lib/handlerHelper";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { message: "Method Not Allowed" });
  }

  try {
    const data = await fmpServerService.getCompanyScreenerPool();
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
    return sendJson(res, 200, data);
  } catch (error: any) {
    console.error("[Screener API Error]:", error?.message || error);
    return sendJson(res, 500, { error: error?.message || "Internal server error" });
  }
}
