import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fetchGoogleStockNews } from "./src/services/newsEngine";

function apiMiddlewarePlugin(): Plugin {
  return {
    name: "api-middleware-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          return next();
        }

        try {
          const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost:5173"}`);
          const pathname = parsedUrl.pathname;

          // Route: GET /api/stocks/:ticker/news
          const match = pathname.match(/^\/api\/stocks\/([^/]+)\/news$/i);
          if (match) {
            const ticker = decodeURIComponent(match[1]);
            const companyName = parsedUrl.searchParams.get("companyName") || undefined;
            const refresh = parsedUrl.searchParams.get("refresh") === "true";
            const limit = parseInt(parsedUrl.searchParams.get("limit") || "8", 10);

            const result = await fetchGoogleStockNews(ticker, companyName, refresh, limit);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(result));
            return;
          }

          // Route: GET /api/health
          if (pathname === "/api/health") {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
            return;
          }

          next();
        } catch (err: any) {
          console.error("[Vite API Middleware Error]:", err);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || "Internal Server Error" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
  server: {
    port: 5173,
    open: true,
  },
});
