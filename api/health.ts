/**
 * Vercel Serverless Function: GET /api/health
 */
export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-cache");
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "stock-analyzer-api",
  });
}
