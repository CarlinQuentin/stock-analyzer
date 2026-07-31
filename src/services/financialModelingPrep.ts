import axios, { AxiosInstance } from "axios";
import {
  CompanyProfile,
  FinancialStatement,
  DividendMetrics,
  HistoricalPricePoint,
  ApiError,
} from "../types";

const BASE_URL = "https://financialmodelingprep.com/stable";
const API_KEY = import.meta.env.VITE_FMP_API_KEY;

if (!API_KEY) {
  console.warn("Warning: VITE_FMP_API_KEY environment variable is not set");
}

class FinancialModelingPrepService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
    });
  }

  private getParams() {
    return { apikey: API_KEY };
  }

  async getCompanyProfile(ticker: string): Promise<CompanyProfile> {
    try {
      const response = await this.client.get("/profile", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase() },
      });

      if (!response.data || response.data.length === 0) {
        throw new Error(`Company not found: ${ticker}`);
      }

      const data = response.data[0];
      return {
        symbol: data.symbol,
        companyName: data.companyName,
        sector: data.sector,
        industry: data.industry,
        website: data.website,
        description: data.description,
        image: data.image,
        mktCap: data.marketCap,
        price: data.price,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getIncomeStatements(
    ticker: string,
    limit: number = 10,
  ): Promise<FinancialStatement[]> {
    try {
      const response = await this.client.get("/income-statement", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No income statement data found for ${ticker}`);
      }

      return response.data.map((statement: any) => ({
        date: statement.date,
        revenue: statement.revenue,
        netIncome: statement.netIncome,
        grossProfit: statement.grossProfit,
        operatingIncome: statement.operatingIncome,
        eps: statement.eps,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBalanceSheets(
    ticker: string,
    limit: number = 10,
  ): Promise<FinancialStatement[]> {
    try {
      const response = await this.client.get("/balance-sheet-statement", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No balance sheet data found for ${ticker}`);
      }

      return response.data.map((statement: any) => ({
        date: statement.date,
        totalAssets: statement.totalAssets,
        totalDebt: statement.totalDebt,
        totalEquity: statement.totalEquity,
        shares: statement.commonStockSharesIssued,
        cashAndCashEquivalents: statement.cashAndCashEquivalents || 0,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCashFlowStatements(
    ticker: string,
    limit: number = 10,
  ): Promise<FinancialStatement[]> {
    try {
      const response = await this.client.get("/cash-flow-statement", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No cash flow data found for ${ticker}`);
      }

      return response.data.map((statement: any) => ({
        date: statement.date,
        operatingCashFlow: statement.operatingCashFlow,
        capitalExpenditure: statement.capitalExpenditure,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getFinancialRatios(ticker: string, limit: number = 10): Promise<any> {
    try {
      const response = await this.client.get("/ratios", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No financial ratios found for ${ticker}`);
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDividends(
    ticker: string,
    limit: number = 10,
  ): Promise<FinancialStatement[]> {
    try {
      const response = await this.client.get("/dividends", {
        params: {
          ...this.getParams(),
          symbol: ticker.toUpperCase(),
          limit,
        },
      });

      if (!response.data) {
        throw new Error(`No dividend data found for ${ticker}`);
      }

      return response.data
        .map((dividend: any) => ({
          date: dividend.date,
          dividend: dividend.dividend,
          dividendYield: dividend.yield,
          dividendFrequency: dividend.frequency,
        }))
        .sort(
          (a: { date: string }, b: { date: string }) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getHistoricalPrices(ticker: string): Promise<HistoricalPricePoint[]> {
    try {
      let response = await this.client.get("/historical-price-eod/full", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase() },
      });

      let data = response.data;
      if (!data || !Array.isArray(data) || data.length === 0) {
        response = await this.client.get("/historical-price-eod/light", {
          params: { ...this.getParams(), symbol: ticker.toUpperCase() },
        });
        data = response.data;
      }

      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data
        .map((item: any) => ({
          date: item.date,
          open: typeof item.open === "number" ? item.open : item.price,
          high: typeof item.high === "number" ? item.high : item.price,
          low: typeof item.low === "number" ? item.low : item.price,
          close: typeof item.close === "number" ? item.close : item.price,
          volume: typeof item.volume === "number" ? item.volume : 0,
          change: typeof item.change === "number" ? item.change : 0,
          changePercent: typeof item.changePercent === "number" ? item.changePercent : 0,
        }))
        .filter((item: HistoricalPricePoint) => item.date && typeof item.close === "number" && !isNaN(item.close))
        .sort(
          (a: HistoricalPricePoint, b: HistoricalPricePoint) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    } catch (error) {
      console.warn("Failed to fetch historical prices:", error);
      return [];
    }
  }

  async getDividendMetrics(ticker: string): Promise<DividendMetrics> {
    try {
      const response = await this.client.get("/ratios-ttm", {
        params: {
          ...this.getParams(),
          symbol: ticker.toUpperCase(),
        },
      });

      if (!response.data?.length) {
        throw new Error(`No dividend metrics found for ${ticker}`);
      }

      const ratios = response.data[0];

      return {
        dividendYield: ratios.dividendYieldTTM,
        dividendPerShare: ratios.dividendPerShareTTM,
        dividendPayoutRatio: ratios.dividendPayoutRatioTTM,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getKeyMetrics(
    ticker: string,
    limit: number = 10,
  ): Promise<any[]> {
    try {
      const response = await this.client.get("/key-metrics", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No key metrics found for ${ticker}`);
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getStatementData(ticker: string) {
    try {
      const [
        incomeStatements,
        balanceSheets,
        cashFlowStatements,
        dividendHistory,
        dividendMetrics,
      ] = await Promise.all([
        this.getIncomeStatements(ticker),
        this.getBalanceSheets(ticker),
        this.getCashFlowStatements(ticker),
        this.getDividends(ticker),
        this.getDividendMetrics(ticker),
      ]);

      let keyMetrics: any[] = [];
      try {
        keyMetrics = await this.getKeyMetrics(ticker);
      } catch (err) {
        console.warn("Failed to fetch key metrics, falling back to manual calculations:", err);
      }

      let financialRatios: any[] = [];
      try {
        financialRatios = await this.getFinancialRatios(ticker);
      } catch (err) {
        console.warn("Failed to fetch financial ratios, falling back to manual calculations:", err);
      }

      return {
        incomeStatements,
        balanceSheets,
        cashFlowStatements,
        dividendHistory,
        dividendMetrics,
        keyMetrics,
        financialRatios,
      };
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

  private handleError(error: any): ApiError {
    if (axios.isAxiosError(error)) {
      const rawData = error.response?.data;
      let extractedMsg = "";
      if (typeof rawData === "string") {
        extractedMsg = rawData;
      } else if (rawData && typeof rawData === "object") {
        extractedMsg =
          rawData["Error Message"] ||
          rawData.message ||
          rawData.error ||
          JSON.stringify(rawData);
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          message:
            extractedMsg ||
            "Invalid API key. Please check your VITE_FMP_API_KEY environment variable.",
          code: "AUTH_ERROR",
          details: extractedMsg,
        };
      }
      if (error.response?.status === 404) {
        return {
          message: extractedMsg || "Company not found. Please check the ticker symbol.",
          code: "NOT_FOUND",
        };
      }
      if (error.response?.status === 429) {
        return {
          message: extractedMsg || "API rate limit exceeded. Please try again later.",
          code: "RATE_LIMIT",
        };
      }
      return {
        message: extractedMsg || error.message || "An API error occurred",
        code: "API_ERROR",
        details: extractedMsg,
      };
    }

    if (error && typeof error === "object") {
      const msg = error.message;
      if (typeof msg === "string") {
        return { message: msg, code: "ERROR" };
      } else if (msg && typeof msg === "object") {
        return {
          message: msg["Error Message"] || msg.message || JSON.stringify(msg),
          code: "ERROR",
        };
      }
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
