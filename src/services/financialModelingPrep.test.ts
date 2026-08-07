import { describe, it, expect, vi, beforeEach } from "vitest";
import { fmpService } from "./financialModelingPrep";
import { AxiosError } from "axios";

describe("FinancialModelingPrepService - getStockPeers Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Normalizes ticker symbols (trims whitespace, converts to uppercase) before requesting", async () => {
    const spyGet = vi.spyOn((fmpService as any).client, "get").mockResolvedValue({
      data: [{ symbol: "AAPL", peersList: ["MSFT", "GOOGL"] }],
    });

    const peers = await fmpService.getStockPeers("  aapl  ");

    expect(peers).toEqual(["MSFT", "GOOGL"]);
    expect(spyGet).toHaveBeenCalledWith("/stock_peers", {
      params: expect.objectContaining({ symbol: "AAPL" }),
    });
  });

  it("2. Returns empty array safely when symbol is empty or whitespace", async () => {
    const spyGet = vi.spyOn((fmpService as any).client, "get");
    const peers = await fmpService.getStockPeers("   ");
    expect(peers).toEqual([]);
    expect(spyGet).not.toHaveBeenCalled();
  });

  it("3. Successfully parses direct array responses or objects with peersList property", async () => {
    vi.spyOn((fmpService as any).client, "get").mockResolvedValueOnce({
      data: { peersList: ["NVDA", "AMD", "INTC"] },
    });

    const peers = await fmpService.getStockPeers("NVDA");
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

    const spyGet = vi.spyOn((fmpService as any).client, "get")
      .mockRejectedValueOnce(error404) // Primary /stock_peers fails 404
      .mockResolvedValueOnce({
        data: [{ symbol: "STLD", peersList: ["NUE", "CMC", "CLF"] }],
      }); // Fallback /stock-peers succeeds

    const peers = await fmpService.getStockPeers("STLD");
    expect(peers).toEqual(["NUE", "CMC", "CLF"]);
    expect(spyGet).toHaveBeenNthCalledWith(1, "/stock_peers", expect.anything());
    expect(spyGet).toHaveBeenNthCalledWith(2, "/stock-peers", expect.anything());
  });

  it("5. Classifies and handles 404 responses when no peer dataset exists for a symbol", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const error404 = new AxiosError("Not Found", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
      statusText: "Not Found",
      data: "No peer data found",
      headers: {},
      config: {} as any,
    });

    vi.spyOn((fmpService as any).client, "get").mockRejectedValue(error404);

    const peers = await fmpService.getStockPeers("UNKNOWN");
    expect(peers).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[FMP Stock Peers] 404 Route/Data not found")
    );
  });

  it("6. Handles 401/403 auth errors and logs API key warning", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error401 = new AxiosError("Unauthorized", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 401,
      statusText: "Unauthorized",
      data: { "Error Message": "Invalid API key" },
      headers: {},
      config: {} as any,
    });

    vi.spyOn((fmpService as any).client, "get").mockRejectedValue(error401);

    const peers = await fmpService.getStockPeers("AAPL");
    expect(peers).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[FMP Stock Peers] Auth Error (401)")
    );
  });

  it("7. Handles 429 rate limits gracefully without crashing", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error429 = new AxiosError("Too Many Requests", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 429,
      statusText: "Too Many Requests",
      data: { message: "Limit Exceeded" },
      headers: {},
      config: {} as any,
    });

    vi.spyOn((fmpService as any).client, "get").mockRejectedValue(error429);

    const peers = await fmpService.getStockPeers("AAPL");
    expect(peers).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[FMP Stock Peers] Rate Limit Exceeded (429)")
    );
  });
});
