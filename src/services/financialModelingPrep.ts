import axios, { AxiosInstance } from "axios";
import {
  CompanyProfile,
  FinancialStatement,
  DividendMetrics,
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
      if (error.response?.status === 401 || error.response?.status === 403) {
        const details = error.response?.data?.message || error.response?.data;
        return {
          message:
            details ||
            "Invalid API key. Please check your VITE_FMP_API_KEY environment variable.",
          code: "AUTH_ERROR",
          details,
        };
      }
      if (error.response?.status === 404) {
        return {
          message: "Company not found. Please check the ticker symbol.",
          code: "NOT_FOUND",
        };
      }
      if (error.response?.status === 429) {
        return {
          message: "API rate limit exceeded. Please try again later.",
          code: "RATE_LIMIT",
        };
      }
      return {
        message: error.message,
        code: "API_ERROR",
        details: error.response?.data?.message,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: "ERROR",
      };
    }

    return {
      message: "An unknown error occurred",
      code: "UNKNOWN_ERROR",
    };
  }
}

export const fmpService = new FinancialModelingPrepService();
