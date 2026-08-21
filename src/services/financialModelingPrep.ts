import axios, { AxiosInstance } from "axios";
import {
  CompanyProfile,
  FinancialStatement,
  DividendMetrics,
  HistoricalPricePoint,
  MarketMover,
  ApiError,
  AnalystEstimatePoint,
  PriceTargetData,
  PriceTargetNewsItem,
  AnalystGradeItem,
  FutureOutlookData,
} from "../types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export interface FmpNormalizedQuote {
  symbol: string;
  price: number;
  change: number | null;
  changesPercentage: number | null;
  marketCap: number;
}

class FinancialModelingPrepService {
  public client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "/api/stocks",
      timeout: 15000,
    });

    // Attach Supabase Auth token to server requests if active session exists
    this.client.interceptors.request.use(async (config) => {
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            config.headers = config.headers || {};
            config.headers["Authorization"] = `Bearer ${data.session.access_token}`;
          }
        } catch {
          // Ignore auth session retrieval errors
        }
      }
      return config;
    });
  }

  async getCompanyProfile(ticker: string): Promise<CompanyProfile> {
    const sym = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const response = await this.client.get(`/${sym}/profile`);
      if (!response.data || typeof response.data !== "object") {
        throw new Error(`Company not found: ${ticker}`);
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchCompany(query: string): Promise<any[]> {
    if (!query || query.trim().length === 0) return [];
    try {
      const response = await this.client.get("/search", {
        params: { query: query.trim(), limit: 10 },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn("Company search failed:", error);
      return [];
    }
  }

  async resolveTicker(input: string): Promise<string> {
    const trimmed = input.trim();
    if (!trimmed) return "";

    try {
      const response = await this.client.get("/resolve", {
        params: { input: trimmed },
      });
      if (response.data?.symbol) {
        return response.data.symbol;
      }
    } catch {
      // Fall back to uppercase input
    }
    return trimmed.toUpperCase();
  }

  async getIncomeStatements(
    ticker: string,
    _limit: number = 11
  ): Promise<FinancialStatement[]> {
    const data = await this.getStatementData(ticker);
    return data.incomeStatements || [];
  }

  async getBalanceSheets(
    ticker: string,
    _limit: number = 11
  ): Promise<FinancialStatement[]> {
    const data = await this.getStatementData(ticker);
    return data.balanceSheets || [];
  }

  async getCashFlowStatements(
    ticker: string,
    _limit: number = 11
  ): Promise<FinancialStatement[]> {
    const data = await this.getStatementData(ticker);
    return data.cashFlowStatements || [];
  }

  async getFinancialRatios(ticker: string, _limit: number = 11): Promise<any> {
    const data = await this.getStatementData(ticker);
    return data.financialRatios || [];
  }

  async getDividends(
    ticker: string,
    _limit: number = 11
  ): Promise<FinancialStatement[]> {
    const data = await this.getStatementData(ticker);
    return data.dividendHistory || [];
  }

  async getDividendMetrics(ticker: string): Promise<DividendMetrics> {
    const data = await this.getStatementData(ticker);
    return (
      data.dividendMetrics || {
        dividendYield: null,
        dividendPerShare: null,
        dividendPayoutRatio: null,
      }
    );
  }

  async getKeyMetrics(ticker: string, _limit: number = 11): Promise<any[]> {
    const data = await this.getStatementData(ticker);
    return data.keyMetrics || [];
  }

  async getKeyMetricsTTM(ticker: string): Promise<any | null> {
    const data = await this.getStatementData(ticker);
    return data.keyMetricsTTM ?? null;
  }

  async getRatiosTTM(ticker: string): Promise<any | null> {
    const data = await this.getStatementData(ticker);
    return data.ratiosTTM ?? null;
  }

  async getStatementData(ticker: string) {
    const sym = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const response = await this.client.get(`/${sym}/statements`);
      if (!response.data) {
        throw new Error(`No financial statement data found for ${ticker}`);
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAllData(ticker: string) {
    try {
      const [profile, statementData] = await Promise.all([
        this.getCompanyProfile(ticker),
        this.getStatementData(ticker),
      ]);

      return {
        profile,
        ...statementData,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getHistoricalPrices(ticker: string): Promise<HistoricalPricePoint[]> {
    const sym = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const response = await this.client.get(`/${sym}/prices`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn("Failed to fetch historical prices:", error);
      return [];
    }
  }

  async getIntradayPrices(ticker: string): Promise<HistoricalPricePoint[]> {
    const sym = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const response = await this.client.get(`/${sym}/intraday`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn("Failed to fetch 1D intraday prices:", error);
      return [];
    }
  }

  async getTopGainers(limit: number = 10): Promise<MarketMover[]> {
    try {
      const response = await this.client.get("/movers", { params: { limit } });
      return response.data?.gainers || [];
    } catch (error) {
      console.warn("Failed to fetch top gainers:", error);
      return [];
    }
  }

  async getTopLosers(limit: number = 10): Promise<MarketMover[]> {
    try {
      const response = await this.client.get("/movers", { params: { limit } });
      return response.data?.losers || [];
    } catch (error) {
      console.warn("Failed to fetch top losers:", error);
      return [];
    }
  }

  async getCompanyScreenerPool(): Promise<any[]> {
    try {
      const response = await this.client.get("/screener");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn("Failed to fetch company screener pool:", error);
      return [];
    }
  }

  async getSP500Constituents(): Promise<any[]> {
    return this.getCompanyScreenerPool();
  }

  async getBatchQuotes(symbols: string[]): Promise<FmpNormalizedQuote[]> {
    if (!symbols || symbols.length === 0) return [];
    try {
      const response = await this.client.post("/batch-quotes", { symbols });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn("Failed to fetch batch quotes:", error);
      return [];
    }
  }

  async getKeyExecutives(ticker: string): Promise<any[]> {
    const sym = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const response = await this.client.get(`/${sym}/executives`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn(`Could not fetch key executives for ${ticker}:`, error);
      return [];
    }
  }

  async getStockPeers(ticker: string): Promise<string[]> {
    const sym = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const response = await this.client.get(`/${sym}/peers`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn(`Could not fetch stock peers for ${ticker}:`, error);
      return [];
    }
  }

  async getIndustryPeers(industry?: string, sector?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (industry) params.industry = industry;
      if (sector) params.sector = sector;
      const response = await this.client.get("/industry-peers", { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn("Could not fetch industry peers from screener:", error);
      return [];
    }
  }

  async getAnalystEstimates(ticker: string): Promise<AnalystEstimatePoint[]> {
    const outlook = await this.getFutureOutlookData(ticker);
    return outlook.estimates || [];
  }

  async getPriceTargetConsensus(
    ticker: string,
    currentPrice?: number
  ): Promise<PriceTargetData | null> {
    const outlook = await this.getFutureOutlookData(ticker, currentPrice);
    return outlook.priceTarget ?? null;
  }

  async getRecentPriceTargetNews(ticker: string): Promise<PriceTargetNewsItem[]> {
    const outlook = await this.getFutureOutlookData(ticker);
    return outlook.recentPriceTargetNews || [];
  }

  async getAnalystGrades(ticker: string): Promise<AnalystGradeItem[]> {
    const outlook = await this.getFutureOutlookData(ticker);
    return outlook.recentGrades || [];
  }

  async getFutureOutlookData(
    ticker: string,
    currentPrice?: number,
    historicalEpsCagr?: number | null,
    historicalRevenueCagr?: number | null
  ): Promise<FutureOutlookData> {
    const sym = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const params: any = {};
      if (currentPrice !== undefined && currentPrice !== null) {
        params.currentPrice = currentPrice;
      }
      if (historicalEpsCagr !== undefined && historicalEpsCagr !== null) {
        params.historicalEpsCagr = historicalEpsCagr;
      }
      if (historicalRevenueCagr !== undefined && historicalRevenueCagr !== null) {
        params.historicalRevenueCagr = historicalRevenueCagr;
      }

      const response = await this.client.get(`/${sym}/outlook`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): ApiError {
    if (axios.isAxiosError(error)) {
      const rawData = error.response?.data;
      let extractedMsg = "";
      if (typeof rawData === "string") {
        extractedMsg = rawData;
      } else if (rawData && typeof rawData === "object") {
        extractedMsg =
          rawData.message ||
          rawData.error ||
          rawData["Error Message"] ||
          JSON.stringify(rawData);
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          message: extractedMsg || "Authentication required. Please sign in.",
          code: "AUTH_ERROR",
          details: extractedMsg,
        };
      }
      if (error.response?.status === 404) {
        return {
          message: extractedMsg || "Financial data not found for requested symbol.",
          code: "NOT_FOUND",
        };
      }
      if (error.response?.status === 429) {
        return {
          message: extractedMsg || "Analysis limit reached. Please sign in to continue.",
          code: rawData?.code || "LOGIN_REQUIRED",
          details: extractedMsg,
        };
      }
      return {
        message: extractedMsg || error.message || "An API error occurred",
        code: "API_ERROR",
        details: extractedMsg,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: "ERROR",
      };
    }

    return {
      message: typeof error === "string" ? error : "An unknown error occurred",
      code: "UNKNOWN_ERROR",
    };
  }
}

export const fmpService = new FinancialModelingPrepService();
