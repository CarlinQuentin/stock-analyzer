import { fmpServerService } from "../src/lib/server/fmpServerService";
import { sendJson, extractParam, extractOperation } from "./_lib/handlerHelper";

/**
 * Consolidated Vercel Serverless Function: GET /api/search
 * Supports ?operation=search|resolve
 */
export default async function handler(req: any, res: any) {
  try {
    const query = req.query?.query || req.query?.q || "GOOGL";
    const data = await fmpServerService.searchCompany(query, 5);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || String(err),
      stack: err?.stack,
      env: {
        has_FMP_API_KEY: Boolean(process.env.FMP_API_KEY),
        has_VITE_FMP_API_KEY: Boolean(process.env.VITE_FMP_API_KEY),
      },
    });
  }
}
