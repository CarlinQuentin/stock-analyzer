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
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && parts[0] === "api" && parts[1] === "stocks") {
        const potentialTicker = parts[2];
        if (potentialTicker && !["search", "resolve", "movers", "screener", "batch-quotes", "industry-peers", "market"].includes(potentialTicker.toLowerCase())) {
          return decodeURIComponent(potentialTicker);
        }
      }
    } catch {}
  }
  return undefined;
}

export function extractOperation(req: any): string | undefined {
  if (req.query?.operation && typeof req.query.operation === "string") {
    return req.query.operation.toLowerCase().trim();
  }
  if (req.query?.op && typeof req.query.op === "string") {
    return req.query.op.toLowerCase().trim();
  }
  if (req.url) {
    try {
      const parsed = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
      const op = parsed.searchParams.get("operation") || parsed.searchParams.get("op");
      if (op) return op.toLowerCase().trim();

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 4 && parts[0] === "api" && parts[1] === "stocks") {
        return parts[3].toLowerCase().trim();
      }
    } catch {}
  }
  return undefined;
}
