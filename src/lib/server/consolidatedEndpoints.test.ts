import { describe, it, expect, vi, beforeEach } from "vitest";
import stocksHandler from "../../../api/stocks/[ticker]";
import marketHandler from "../../../api/market";
import searchHandler from "../../../api/search";
import newsHandler from "../../../api/news";
import { fmpServerService } from "./fmpServerService";

describe("Consolidated Vercel Serverless Function Handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FMP_API_KEY = "test_fmp_api_key";
  });

  const createMockRes = () => {
    const res: any = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader: vi.fn((k, v) => {
        res.headers[k] = v;
      }),
      status: vi.fn((code) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn((data) => {
        res.body = data;
        return res;
      }),
      end: vi.fn((data) => {
        if (typeof data === "string") {
          try {
            res.body = JSON.parse(data);
          } catch {
            res.body = data;
          }
        }
      }),
    };
    return res;
  };

  describe("1. api/stocks/[ticker].ts", () => {
    it("1.1 Routes ?operation=profile to getCompanyProfile", async () => {
      vi.spyOn(fmpServerService, "getCompanyProfile").mockResolvedValue({
        symbol: "AAPL",
        companyName: "Apple Inc.",
      } as any);

      const req = { method: "GET", query: { ticker: "AAPL", operation: "profile" } };
      const res = createMockRes();

      await stocksHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.symbol).toBe("AAPL");
    });

    it("1.2 Rejects unauthenticated requests to ?operation=statements with 401", async () => {
      const req = { method: "GET", query: { ticker: "NVDA", operation: "statements" }, headers: {} };
      const res = createMockRes();

      await stocksHandler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBeDefined();
    });

    it("1.3 Handles invalid symbol format with 400", async () => {
      const req = { method: "GET", query: { ticker: "INVALID$$$TICKER", operation: "profile" } };
      const res = createMockRes();

      await stocksHandler(req, res);

      expect(res.statusCode).toBe(400);
    });

    it("1.4 Handles unsupported operation with 400", async () => {
      const req = { method: "GET", query: { ticker: "AAPL", operation: "nonexistent_op" } };
      const res = createMockRes();

      await stocksHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Unknown operation");
    });
  });

  describe("2. api/market.ts", () => {
    it("2.1 Routes ?operation=movers to getMarketMovers", async () => {
      vi.spyOn(fmpServerService, "getMarketMovers").mockResolvedValue({
        gainers: [{ symbol: "TSLA", name: "Tesla Inc", price: 200, change: 10, changesPercentage: 5 }],
        losers: [],
      });

      const req = { method: "GET", query: { operation: "movers" } };
      const res = createMockRes();

      await marketHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.gainers).toHaveLength(1);
    });

    it("2.2 Routes ?operation=screener to getCompanyScreenerPool", async () => {
      vi.spyOn(fmpServerService, "getCompanyScreenerPool").mockResolvedValue([
        { symbol: "AAPL", marketCap: 3000000000000 } as any,
      ]);

      const req = { method: "GET", query: { operation: "screener" } };
      const res = createMockRes();

      await marketHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("2.3 Routes POST ?operation=batch-quotes with symbols array", async () => {
      vi.spyOn(fmpServerService, "getBatchQuotes").mockResolvedValue([
        { symbol: "AAPL", price: 180, change: 1, changesPercentage: 0.5, marketCap: 3000000000000 },
      ]);

      const req = {
        method: "POST",
        query: { operation: "batch-quotes" },
        body: { symbols: ["AAPL"] },
      };
      const res = createMockRes();

      await marketHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body[0].symbol).toBe("AAPL");
    });
  });

  describe("3. api/search.ts", () => {
    it("3.1 Routes ?operation=search to searchCompany", async () => {
      vi.spyOn(fmpServerService, "searchCompany").mockResolvedValue([
        { symbol: "MSFT", name: "Microsoft Corporation" },
      ]);

      const req = { method: "GET", query: { query: "MSFT", operation: "search" } };
      const res = createMockRes();

      await searchHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body[0].symbol).toBe("MSFT");
    });

    it("3.2 Routes ?operation=resolve to resolveTicker", async () => {
      vi.spyOn(fmpServerService, "resolveTicker").mockResolvedValue({ symbol: "NVDA" });

      const req = { method: "GET", query: { input: "NVIDIA", operation: "resolve" } };
      const res = createMockRes();

      await searchHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.symbol).toBe("NVDA");
    });
  });

  describe("4. api/news.ts", () => {
    it("4.1 Rejects missing ticker with 400", async () => {
      const req = { method: "GET", query: {} };
      const res = createMockRes();

      await newsHandler(req, res);

      expect(res.statusCode).toBe(400);
    });
  });
});
