import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fetchGoogleStockNews } from "./src/services/newsEngine";
import { fmpServerService } from "./src/lib/server/fmpServerService";
import { verifyServerAuth } from "./src/lib/server/authHelper";
import { checkAnalysisQuota } from "./src/lib/server/quotaHelper";

async function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function apiMiddlewarePlugin(env: Record<string, string>): Plugin {
  // Ensure FMP_API_KEY and Supabase env vars from .env / .env.local are populated in process.env
  if (env.FMP_API_KEY && !process.env.FMP_API_KEY) {
    process.env.FMP_API_KEY = env.FMP_API_KEY;
  }
  if (env.VITE_FMP_API_KEY && !process.env.FMP_API_KEY) {
    process.env.FMP_API_KEY = env.VITE_FMP_API_KEY;
  }
  if (env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
  }
  if (env.VITE_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
  }

  return {
    name: "api-middleware-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          return next();
        }

        const sendResponse = (statusCode: number, data: any) => {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = statusCode;
          res.end(JSON.stringify(data));
        };

        try {
          const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost:5173"}`);
          const pathname = parsedUrl.pathname;
          const searchParams = parsedUrl.searchParams;

          // Route: GET /api/health
          if (pathname === "/api/health") {
            return sendResponse(200, { status: "ok", timestamp: new Date().toISOString() });
          }

          // Route: /api/news or /api/stocks/:ticker/news
          const newsSubpathMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/news$/i);
          if (pathname === "/api/news" || newsSubpathMatch) {
            const rawTicker = newsSubpathMatch
              ? newsSubpathMatch[1]
              : searchParams.get("ticker") || searchParams.get("symbol") || "";
            const ticker = decodeURIComponent(rawTicker).trim().toUpperCase();
            if (!ticker) {
              return sendResponse(400, { message: "Stock ticker is required" });
            }
            const companyName = searchParams.get("companyName") || undefined;
            const refresh = searchParams.get("refresh") === "true";
            const limit = parseInt(searchParams.get("limit") || "8", 10);
            const result = await fetchGoogleStockNews(ticker, companyName, refresh, limit);
            return sendResponse(200, result);
          }

          // Route: /api/search or legacy /api/stocks/search or /api/stocks/resolve
          if (pathname === "/api/search" || pathname === "/api/stocks/search" || pathname === "/api/stocks/resolve") {
            const operation = searchParams.get("operation") || (pathname.endsWith("/resolve") ? "resolve" : "search");
            if (operation === "resolve") {
              const input = searchParams.get("input") || searchParams.get("query") || searchParams.get("q") || "";
              const result = await fmpServerService.resolveTicker(input);
              return sendResponse(200, result);
            }
            const query = searchParams.get("query") || searchParams.get("q") || "";
            const limit = parseInt(searchParams.get("limit") || "10", 10);
            const results = await fmpServerService.searchCompany(query, limit);
            return sendResponse(200, results);
          }

          // Route: /api/market or legacy /api/stocks/movers, screener, batch-quotes, industry-peers
          if (
            pathname === "/api/market" ||
            pathname === "/api/stocks/movers" ||
            pathname === "/api/stocks/market-movers" ||
            pathname === "/api/stocks/screener" ||
            pathname === "/api/stocks/batch-quotes" ||
            pathname === "/api/stocks/industry-peers"
          ) {
            let operation = searchParams.get("operation");
            if (!operation) {
              if (pathname.includes("movers")) operation = "movers";
              else if (pathname.includes("screener")) operation = "screener";
              else if (pathname.includes("batch-quotes")) operation = "batch-quotes";
              else if (pathname.includes("industry-peers")) operation = "industry-peers";
              else if (req.method === "POST") operation = "batch-quotes";
              else operation = "movers";
            }

            if (operation === "screener") {
              const result = await fmpServerService.getCompanyScreenerPool();
              return sendResponse(200, result);
            }

            if (operation === "industry-peers") {
              const industry = searchParams.get("industry") || undefined;
              const sector = searchParams.get("sector") || undefined;
              const limit = parseInt(searchParams.get("limit") || "30", 10);
              const peers = await fmpServerService.getIndustryPeers(industry, sector, limit);
              return sendResponse(200, peers);
            }

            if (operation === "batch-quotes") {
              const body = req.method === "POST" ? await readBody(req) : {};
              const symbols = Array.isArray(body?.symbols) ? body.symbols : [];
              const quotes = await fmpServerService.getBatchQuotes(symbols);
              return sendResponse(200, quotes);
            }

            // Default movers
            const limit = parseInt(searchParams.get("limit") || "10", 10);
            const result = await fmpServerService.getMarketMovers(limit);
            return sendResponse(200, result);
          }

          // Route: /api/stocks/:ticker (or /api/stocks/:ticker/:operation)
          const tickerMatch = pathname.match(/^\/api\/stocks\/([^/]+)(?:\/([^/]+))?$/i);
          if (tickerMatch) {
            const rawTicker = decodeURIComponent(tickerMatch[1]);
            const subOperation = tickerMatch[2];

            // Ignore non-ticker reserved paths
            if (!["search", "resolve", "movers", "screener", "batch-quotes", "industry-peers", "market"].includes(rawTicker.toLowerCase())) {
              const ticker = rawTicker;
              const operation = subOperation || searchParams.get("operation") || "profile";

              if (operation === "statements" || operation === "analysis" || operation === "all") {
                const quotaResult = await checkAnalysisQuota(req, ticker);
                if (!quotaResult.allowed) {
                  return sendResponse(quotaResult.statusCode || 429, {
                    error: quotaResult.error || "LOGIN_REQUIRED",
                    code: quotaResult.code || "LIMIT_EXCEEDED",
                    reason: quotaResult.reason || "QUOTA_EXCEEDED",
                    message:
                      quotaResult.message ||
                      "You have reached your limit of free stock analyses. Please sign up or log in to continue.",
                    count: quotaResult.count,
                    limit: quotaResult.limit,
                    ipCount: quotaResult.ipCount,
                    ipLimit: quotaResult.ipLimit,
                  });
                }

                const authResult = await verifyServerAuth(req);
                const shouldFetchOutlook = Boolean(authResult.authenticated && !authResult.isAnonymous);

                const currentPrice = searchParams.has("currentPrice")
                  ? parseFloat(searchParams.get("currentPrice")!)
                  : undefined;
                const historicalEpsCagr = searchParams.has("historicalEpsCagr")
                  ? parseFloat(searchParams.get("historicalEpsCagr")!)
                  : undefined;
                const historicalRevenueCagr = searchParams.has("historicalRevenueCagr")
                  ? parseFloat(searchParams.get("historicalRevenueCagr")!)
                  : undefined;

                const [statements, futureOutlook] = await Promise.all([
                  fmpServerService.getStatementData(ticker),
                  shouldFetchOutlook
                    ? fmpServerService
                        .getFutureOutlookData(
                          ticker,
                          currentPrice,
                          historicalEpsCagr,
                          historicalRevenueCagr
                        )
                        .catch(() => null)
                    : Promise.resolve(null),
                ]);

                return sendResponse(200, {
                  ...statements,
                  futureOutlook,
                });
              }

              if (operation === "prices") {
                const result = await fmpServerService.getHistoricalPrices(ticker);
                return sendResponse(200, result);
              }

              if (operation === "intraday") {
                const result = await fmpServerService.getIntradayPrices(ticker);
                return sendResponse(200, result);
              }

              if (operation === "outlook") {
                const authResult = await verifyServerAuth(req);
                if (!authResult.authenticated) {
                  return sendResponse(401, {
                    message:
                      authResult.error ||
                      "Authentication required to view future outlook data.",
                  });
                }

                const currentPrice = searchParams.has("currentPrice")
                  ? parseFloat(searchParams.get("currentPrice")!)
                  : undefined;
                const historicalEpsCagr = searchParams.has("historicalEpsCagr")
                  ? parseFloat(searchParams.get("historicalEpsCagr")!)
                  : undefined;
                const historicalRevenueCagr = searchParams.has("historicalRevenueCagr")
                  ? parseFloat(searchParams.get("historicalRevenueCagr")!)
                  : undefined;

                const result = await fmpServerService.getFutureOutlookData(
                  ticker,
                  currentPrice,
                  historicalEpsCagr,
                  historicalRevenueCagr
                );
                return sendResponse(200, result);
              }

              if (operation === "peers") {
                const result = await fmpServerService.getStockPeers(ticker);
                return sendResponse(200, result);
              }

              if (operation === "executives") {
                const result = await fmpServerService.getKeyExecutives(ticker);
                return sendResponse(200, result);
              }

              if (operation === "profile") {
                const result = await fmpServerService.getCompanyProfile(ticker);
                return sendResponse(200, result);
              }

              return sendResponse(400, { message: `Unknown operation: ${operation}` });
            }
          }

          next();
        } catch (err: any) {
          console.error("[Vite API Middleware Error]:", err?.message || err);
          const msg = err?.message || "";
          let status = 500;
          if (msg.includes("Invalid symbol")) status = 400;
          else if (msg.includes("not found")) status = 404;
          return sendResponse(status, { error: msg || "Internal Server Error" });
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), apiMiddlewarePlugin(env)],
    server: {
      port: 5173,
      open: true,
    },
  };
});
