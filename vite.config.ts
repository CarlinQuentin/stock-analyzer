import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fetchGoogleStockNews } from "./src/services/newsEngine";
import { fmpServerService } from "./src/lib/server/fmpServerService";
import { verifyServerAuth } from "./src/lib/server/authHelper";

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

          // Route: GET /api/health
          if (pathname === "/api/health") {
            return sendResponse(200, { status: "ok", timestamp: new Date().toISOString() });
          }

          // Route: GET /api/stocks/search
          if (pathname === "/api/stocks/search") {
            const query = parsedUrl.searchParams.get("query") || parsedUrl.searchParams.get("q") || "";
            const limit = parseInt(parsedUrl.searchParams.get("limit") || "10", 10);
            const results = await fmpServerService.searchCompany(query, limit);
            return sendResponse(200, results);
          }

          // Route: GET /api/stocks/resolve
          if (pathname === "/api/stocks/resolve") {
            const input = parsedUrl.searchParams.get("input") || parsedUrl.searchParams.get("query") || "";
            const result = await fmpServerService.resolveTicker(input);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/movers or /api/stocks/market-movers
          if (pathname === "/api/stocks/movers" || pathname === "/api/stocks/market-movers") {
            const limit = parseInt(parsedUrl.searchParams.get("limit") || "10", 10);
            const result = await fmpServerService.getMarketMovers(limit);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/screener
          if (pathname === "/api/stocks/screener") {
            const result = await fmpServerService.getCompanyScreenerPool();
            return sendResponse(200, result);
          }

          // Route: POST /api/stocks/batch-quotes
          if (pathname === "/api/stocks/batch-quotes" && req.method === "POST") {
            const body = await readBody(req);
            const symbols = Array.isArray(body?.symbols) ? body.symbols : [];
            const quotes = await fmpServerService.getBatchQuotes(symbols);
            return sendResponse(200, quotes);
          }

          // Route: GET /api/stocks/industry-peers
          if (pathname === "/api/stocks/industry-peers") {
            const industry = parsedUrl.searchParams.get("industry") || undefined;
            const sector = parsedUrl.searchParams.get("sector") || undefined;
            const limit = parseInt(parsedUrl.searchParams.get("limit") || "30", 10);
            const peers = await fmpServerService.getIndustryPeers(industry, sector, limit);
            return sendResponse(200, peers);
          }

          // Route: GET /api/stocks/:ticker/news
          const newsMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/news$/i);
          if (newsMatch) {
            const ticker = decodeURIComponent(newsMatch[1]);
            const companyName = parsedUrl.searchParams.get("companyName") || undefined;
            const refresh = parsedUrl.searchParams.get("refresh") === "true";
            const limit = parseInt(parsedUrl.searchParams.get("limit") || "8", 10);

            const result = await fetchGoogleStockNews(ticker, companyName, refresh, limit);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/:ticker/profile
          const profileMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/profile$/i);
          if (profileMatch) {
            const ticker = decodeURIComponent(profileMatch[1]);
            const result = await fmpServerService.getCompanyProfile(ticker);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/:ticker/statements
          const statementsMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/statements$/i);
          if (statementsMatch) {
            const authResult = await verifyServerAuth(req);
            if (!authResult.authenticated) {
              return sendResponse(401, { message: authResult.error || "Authentication required. Please sign in." });
            }
            const ticker = decodeURIComponent(statementsMatch[1]);
            const result = await fmpServerService.getStatementData(ticker);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/:ticker/prices
          const pricesMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/prices$/i);
          if (pricesMatch) {
            const ticker = decodeURIComponent(pricesMatch[1]);
            const result = await fmpServerService.getHistoricalPrices(ticker);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/:ticker/intraday
          const intradayMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/intraday$/i);
          if (intradayMatch) {
            const ticker = decodeURIComponent(intradayMatch[1]);
            const result = await fmpServerService.getIntradayPrices(ticker);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/:ticker/outlook
          const outlookMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/outlook$/i);
          if (outlookMatch) {
            const ticker = decodeURIComponent(outlookMatch[1]);
            const currentPrice = parsedUrl.searchParams.has("currentPrice")
              ? parseFloat(parsedUrl.searchParams.get("currentPrice")!)
              : undefined;
            const historicalEpsCagr = parsedUrl.searchParams.has("historicalEpsCagr")
              ? parseFloat(parsedUrl.searchParams.get("historicalEpsCagr")!)
              : undefined;
            const historicalRevenueCagr = parsedUrl.searchParams.has("historicalRevenueCagr")
              ? parseFloat(parsedUrl.searchParams.get("historicalRevenueCagr")!)
              : undefined;

            const result = await fmpServerService.getFutureOutlookData(
              ticker,
              currentPrice,
              historicalEpsCagr,
              historicalRevenueCagr
            );
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/:ticker/peers
          const peersMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/peers$/i);
          if (peersMatch) {
            const ticker = decodeURIComponent(peersMatch[1]);
            const result = await fmpServerService.getStockPeers(ticker);
            return sendResponse(200, result);
          }

          // Route: GET /api/stocks/:ticker/executives
          const executivesMatch = pathname.match(/^\/api\/stocks\/([^/]+)\/executives$/i);
          if (executivesMatch) {
            const ticker = decodeURIComponent(executivesMatch[1]);
            const result = await fmpServerService.getKeyExecutives(ticker);
            return sendResponse(200, result);
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
