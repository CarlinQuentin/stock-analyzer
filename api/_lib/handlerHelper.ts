export function sendJson(res: any, statusCode: number, data: any) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export function extractParam(req: any, key: string): string | undefined {
  if (req.query && typeof req.query[key] === "string") {
    return req.query[key];
  }
  if (req.url) {
    try {
      const parsed = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
      return parsed.searchParams.get(key) || undefined;
    } catch {}
  }
  return undefined;
}

export function extractTicker(req: any): string | undefined {
  if (req.query?.ticker && typeof req.query.ticker === "string") {
    return req.query.ticker;
  }
  if (req.query?.symbol && typeof req.query.symbol === "string") {
    return req.query.symbol;
  }
  if (req.url) {
    try {
      const parsed = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
      const match = parsed.pathname.match(/\/api\/stocks\/([^/?]+)/i);
      if (match && !["search", "resolve", "movers", "screener", "batch-quotes", "industry-peers"].includes(match[1].toLowerCase())) {
        return decodeURIComponent(match[1]);
      }
    } catch {}
  }
  return undefined;
}
