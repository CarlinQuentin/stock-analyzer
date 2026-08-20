import { describe, it, expect, vi, beforeEach } from "vitest";
import { fmpServerService } from "../lib/server/fmpServerService";
import { fmpService } from "./financialModelingPrep";
import { AxiosError } from "axios";

describe("FinancialModelingPrepService - Server & Client Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FMP_API_KEY = "test_fmp_api_key";
  });

  describe("Server FmpServerService - getStockPeers", () => {
    it("1. Normalizes ticker symbols (trims whitespace, converts to uppercase) before requesting", async () => {
      const spyGet = vi.spyOn((fmpServerService as any).client, "get").mockResolvedValue({
        data: [{ symbol: "AAPL", peersList: ["MSFT", "GOOGL"] }],
      });

      const peers = await fmpServerService.getStockPeers("  aapl  ");

      expect(peers).toEqual(["MSFT", "GOOGL"]);
      expect(spyGet).toHaveBeenCalledWith("/stock_peers", {
        params: expect.objectContaining({ symbol: "AAPL" }),
      });
    });

    it("2. Returns empty array safely when symbol is empty or whitespace", async () => {
      const spyGet = vi.spyOn((fmpServerService as any).client, "get");
      await expect(fmpServerService.getStockPeers("   ")).rejects.toThrow();
      expect(spyGet).not.toHaveBeenCalled();
    });

    it("3. Successfully parses direct array responses or objects with peersList property", async () => {
      vi.spyOn((fmpServerService as any).client, "get").mockResolvedValueOnce({
        data: { peersList: ["NVDA", "AMD", "INTC"] },
      });

      const peers = await fmpServerService.getStockPeers("NVDA");
      expect(peers).toEqual(["NVDA", "AMD", "INTC"]);
    });

    it("4. Attempts fallback to /stock-peers if primary /stock_peers route returns 404", async () => {
      const error404 = new AxiosError("Not Found", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        data: { message: "Route or data not found" },
        headers: {},
        config: {} as any,
      });

      const spyGet = vi
        .spyOn((fmpServerService as any).client, "get")
        .mockRejectedValueOnce(error404) // Primary /stock_peers fails 404
        .mockResolvedValueOnce({
          data: [{ symbol: "STLD", peersList: ["NUE", "CMC", "CLF"] }],
        }); // Fallback /stock-peers succeeds

      const peers = await fmpServerService.getStockPeers("STLD");
      expect(peers).toEqual(["NUE", "CMC", "CLF"]);
      expect(spyGet).toHaveBeenNthCalledWith(1, "/stock_peers", expect.anything());
      expect(spyGet).toHaveBeenNthCalledWith(2, "/stock-peers", expect.anything());
    });

    it("5. Handles empty/missing peer dataset gracefully without throwing", async () => {
      const error404 = new AxiosError("Not Found", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        data: "No peer data found",
        headers: {},
        config: {} as any,
      });

      vi.spyOn((fmpServerService as any).client, "get").mockRejectedValue(error404);

      const peers = await fmpServerService.getStockPeers("UNKNOWN");
      expect(peers).toEqual([]);
    });

    it("6. Handles 401/403 auth errors and logs warning without leaking key", async () => {
      const error401 = new AxiosError("Unauthorized", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 401,
        statusText: "Unauthorized",
        data: { "Error Message": "Invalid API key" },
        headers: {},
        config: {} as any,
      });

      vi.spyOn((fmpServerService as any).client, "get").mockRejectedValue(error401);

      const peers = await fmpServerService.getStockPeers("AAPL");
      expect(peers).toEqual([]);
    });

    it("7. Handles 429 rate limits gracefully without crashing", async () => {
      const error429 = new AxiosError("Too Many Requests", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 429,
        statusText: "Too Many Requests",
        data: { message: "Limit Exceeded" },
        headers: {},
        config: {} as any,
      });

      vi.spyOn((fmpServerService as any).client, "get").mockRejectedValue(error429);

      const peers = await fmpServerService.getStockPeers("AAPL");
      expect(peers).toEqual([]);
    });
  });

  describe("Client fmpService - /api/stocks proxying", () => {
    it("8. Calls relative /api/stocks/AAPL/profile for company profile", async () => {
      const spyGet = vi.spyOn((fmpService as any).client, "get").mockResolvedValue({
        data: {
          symbol: "AAPL",
          companyName: "Apple Inc.",
          sector: "Technology",
          industry: "Consumer Electronics",
          mktCap: 3000000000000,
          price: 190.5,
        },
      });

      const profile = await fmpService.getCompanyProfile("AAPL");
      expect(profile.symbol).toBe("AAPL");
      expect(profile.companyName).toBe("Apple Inc.");
      expect(spyGet).toHaveBeenCalledWith("/AAPL/profile");
    });

    it("9. Calls relative /api/stocks/AAPL/statements for statement data", async () => {
      const mockStatementData = {
        incomeStatements: [{ date: "2025-12-31", revenue: 1000000 }],
        balanceSheets: [{ date: "2025-12-31", totalAssets: 5000000 }],
        cashFlowStatements: [{ date: "2025-12-31", operatingCashFlow: 800000 }],
        dividendHistory: [],
        dividendMetrics: { dividendYield: 0.01 },
        keyMetrics: [],
        financialRatios: [],
      };

      const spyGet = vi.spyOn((fmpService as any).client, "get").mockResolvedValue({
        data: mockStatementData,
      });

      const statements = await fmpService.getStatementData("AAPL");
      expect(statements.incomeStatements).toHaveLength(1);
      expect(spyGet).toHaveBeenCalledWith("/AAPL/statements");
    });
  });
});
