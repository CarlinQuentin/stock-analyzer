/**
 * Vercel Serverless Function: GET /api/health
 */
export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-cache");
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      has_FMP_API_KEY: Boolean(process.env.FMP_API_KEY),
      has_VITE_FMP_API_KEY: Boolean(process.env.VITE_FMP_API_KEY),
      has_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
      has_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
    },
  });
}
