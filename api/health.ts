/**
 * Vercel Serverless Function: GET /api/health
 */
import { fmpServerService } from "./_lib/fmpServerService";

export default async function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-cache");
  try {
    const profile = await fmpServerService.getCompanyProfile("GOOGL");
    return res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      profile_test: profile.symbol,
      env: {
        has_FMP_API_KEY: Boolean(process.env.FMP_API_KEY),
        has_VITE_FMP_API_KEY: Boolean(process.env.VITE_FMP_API_KEY),
        has_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
        has_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
      },
    });
  } catch (err: any) {
    return res.status(200).json({
      status: "error_caught",
      error_message: err?.message || String(err),
      error_stack: err?.stack,
      error_name: err?.name,
    });
  }
}
