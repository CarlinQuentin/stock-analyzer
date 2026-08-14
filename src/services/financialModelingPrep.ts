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

export interface FmpNormalizedQuote {
  symbol: string;
  price: number;
  change: number | null;
  changesPercentage: number | null;
  marketCap: number;
}

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

  async searchCompany(query: string): Promise<any[]> {
    if (!query || query.trim().length === 0) return [];
    try {
      const response = await this.client.get("/search-name", {
        params: { ...this.getParams(), query: query.trim(), limit: 10 },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      const results = response.data.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        currency: item.currency,
        exchange: item.exchangeShortName || item.exchange,
        exchangeFullName: item.exchangeFullName,
      }));

      // Sort so US exchanges (NASDAQ, NYSE, AMEX) come first
      return results.sort((a: any, b: any) => {
        const isUsA = a.exchange === "NASDAQ" || a.exchange === "NYSE" || a.exchange === "AMEX" || a.currency === "USD";
        const isUsB = b.exchange === "NASDAQ" || b.exchange === "NYSE" || b.exchange === "AMEX" || b.currency === "USD";
        if (isUsA && !isUsB) return -1;
        if (!isUsA && isUsB) return 1;
        return 0;
      });
    } catch (error) {
      console.warn("Company search failed:", error);
      return [];
    }
  }

  async resolveTicker(input: string): Promise<string> {
    const trimmed = input.trim();
    if (!trimmed) return "";

    // If input looks like an exact ticker symbol (1-5 chars with no spaces), try direct profile check first
    if (/^[A-Za-z0-9]{1,5}$/.test(trimmed)) {
      try {
        const profile = await this.getCompanyProfile(trimmed);
        if (profile && profile.symbol) return profile.symbol;
      } catch {
        // Fall back to company search below
      }
    }

    // Search by company name
    const searchResults = await this.searchCompany(trimmed);
    if (searchResults.length > 0) {
      // Find clean match without dot suffix like .DE or .L if available
      const cleanMatch = searchResults.find((r) => !r.symbol.includes(".")) || searchResults[0];
      return cleanMatch.symbol;
    }

    return trimmed.toUpperCase();
  }

  async getIncomeStatements(
    ticker: string,
    limit: number = 11,
  ): Promise<FinancialStatement[]> {
    try {
      const response = await this.client.get("/income-statement", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No income statement data found for ${ticker}`);
      }

      return response.data.map((statement: any) => ({
        ...statement,
        date: statement.date,
        symbol: statement.symbol,
        period: statement.period,
        calendarYear: statement.calendarYear,
        revenue: statement.revenue,
        costOfRevenue: statement.costOfRevenue,
        grossProfit: statement.grossProfit,
        grossProfitRatio: statement.grossProfitRatio,
        researchAndDevelopmentExpenses: statement.researchAndDevelopmentExpenses,
        generalAndAdministrativeExpenses: statement.generalAndAdministrativeExpenses,
        sellingAndMarketingExpenses: statement.sellingAndMarketingExpenses,
        sellingGeneralAndAdministrativeExpenses: statement.sellingGeneralAndAdministrativeExpenses,
        otherExpenses: statement.otherExpenses,
        operatingExpenses: statement.operatingExpenses,
        operatingIncome: statement.operatingIncome,
        operatingIncomeRatio: statement.operatingIncomeRatio,
        interestIncome: statement.interestIncome,
        interestExpense: statement.interestExpense,
        depreciationAndAmortization: statement.depreciationAndAmortization,
        ebitda: statement.ebitda,
        ebitdaratio: statement.ebitdaratio,
        totalOtherIncomeExpensesNet: statement.totalOtherIncomeExpensesNet,
        incomeBeforeTax: statement.incomeBeforeTax,
        incomeBeforeTaxRatio: statement.incomeBeforeTaxRatio,
        incomeTaxExpense: statement.incomeTaxExpense,
        netIncome: statement.netIncome,
        netIncomeRatio: statement.netIncomeRatio,
        eps: statement.eps,
        epsdiluted: statement.epsdiluted,
        weightedAverageShsOutDil: statement.weightedAverageShsOutDil ?? statement.weightedAverageSharesDiluted,
        weightedAverageShsOut: statement.weightedAverageShsOut ?? statement.weightedAverageSharesOutstanding,
        shares: statement.weightedAverageShsOutDil ?? statement.weightedAverageShsOut ?? statement.weightedAverageSharesDiluted ?? statement.weightedAverageSharesOutstanding,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBalanceSheets(
    ticker: string,
    limit: number = 11,
  ): Promise<FinancialStatement[]> {
    try {
      const response = await this.client.get("/balance-sheet-statement", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No balance sheet data found for ${ticker}`);
      }

      return response.data.map((statement: any) => ({
        ...statement,
        date: statement.date,
        symbol: statement.symbol,
        period: statement.period,
        calendarYear: statement.calendarYear,
        cashAndCashEquivalents: statement.cashAndCashEquivalents || 0,
        shortTermInvestments: statement.shortTermInvestments,
        cashAndShortTermInvestments: statement.cashAndShortTermInvestments,
        netReceivables: statement.netReceivables ?? statement.accountsReceivables,
        inventory: statement.inventory,
        otherCurrentAssets: statement.otherCurrentAssets,
        totalCurrentAssets: statement.totalCurrentAssets,
        propertyPlantEquipmentNet: statement.propertyPlantEquipmentNet,
        goodwill: statement.goodwill,
        intangibleAssets: statement.intangibleAssets,
        goodwillAndIntangibleAssets: statement.goodwillAndIntangibleAssets,
        longTermInvestments: statement.longTermInvestments,
        taxAssets: statement.taxAssets,
        otherNonCurrentAssets: statement.otherNonCurrentAssets,
        totalNonCurrentAssets: statement.totalNonCurrentAssets,
        otherAssets: statement.otherAssets,
        totalAssets: statement.totalAssets,
        accountPayables: statement.accountPayables ?? statement.accountsPayables,
        shortTermDebt: statement.shortTermDebt,
        taxPayables: statement.taxPayables,
        deferredRevenue: statement.deferredRevenue,
        otherCurrentLiabilities: statement.otherCurrentLiabilities,
        totalCurrentLiabilities: statement.totalCurrentLiabilities,
        longTermDebt: statement.longTermDebt,
        deferredRevenueNonCurrent: statement.deferredRevenueNonCurrent,
        deferredTaxLiabilitiesNonCurrent: statement.deferredTaxLiabilitiesNonCurrent,
        otherNonCurrentLiabilities: statement.otherNonCurrentLiabilities,
        totalNonCurrentLiabilities: statement.totalNonCurrentLiabilities,
        otherLiabilities: statement.otherLiabilities,
        capitalLeaseObligations: statement.capitalLeaseObligations,
        totalLiabilities: statement.totalLiabilities,
        preferredStock: statement.preferredStock,
        commonStock: statement.commonStock,
        retainedEarnings: statement.retainedEarnings,
        accumulatedOtherComprehensiveIncomeLoss: statement.accumulatedOtherComprehensiveIncomeLoss,
        othertotalStockholdersEquity: statement.othertotalStockholdersEquity,
        totalStockholdersEquity: statement.totalStockholdersEquity,
        totalEquity: statement.totalEquity ?? statement.totalStockholdersEquity,
        totalLiabilitiesAndStockholdersEquity: statement.totalLiabilitiesAndStockholdersEquity,
        minorityInterest: statement.minorityInterest,
        totalLiabilitiesAndTotalEquity: statement.totalLiabilitiesAndTotalEquity,
        totalInvestments: statement.totalInvestments,
        totalDebt: statement.totalDebt,
        netDebt: statement.netDebt,
        shares: statement.commonStockSharesIssued,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCashFlowStatements(
    ticker: string,
    limit: number = 11,
  ): Promise<FinancialStatement[]> {
    try {
      const response = await this.client.get("/cash-flow-statement", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), limit },
      });

      if (!response.data) {
        throw new Error(`No cash flow data found for ${ticker}`);
      }

      return response.data.map((statement: any) => ({
        ...statement,
        date: statement.date,
        symbol: statement.symbol,
        period: statement.period,
        calendarYear: statement.calendarYear,
        netIncome: statement.netIncome,
        depreciationAndAmortization: statement.depreciationAndAmortization,
        deferredIncomeTax: statement.deferredIncomeTax,
        stockBasedCompensation: statement.stockBasedCompensation,
        changeInWorkingCapital: statement.changeInWorkingCapital,
        accountsReceivables: statement.accountsReceivables,
        inventory: statement.inventory,
        accountsPayables: statement.accountsPayables,
        otherWorkingCapital: statement.otherWorkingCapital,
        otherNonCashItems: statement.otherNonCashItems,
        operatingCashFlow: statement.operatingCashFlow ?? statement.netCashProvidedByOperatingActivities,
        netCashProvidedByOperatingActivities: statement.netCashProvidedByOperatingActivities ?? statement.operatingCashFlow,
        investmentsInPropertyPlantAndEquipment: statement.investmentsInPropertyPlantAndEquipment,
        capitalExpenditure: statement.capitalExpenditure,
        acquisitionsNet: statement.acquisitionsNet,
        purchasesOfInvestments: statement.purchasesOfInvestments,
        salesMaturitiesOfInvestments: statement.salesMaturitiesOfInvestments,
        otherInvestingActivites: statement.otherInvestingActivites,
        netCashUsedForInvestingActivites: statement.netCashUsedForInvestingActivites,
        debtRepayment: statement.debtRepayment,
        commonStockIssued: statement.commonStockIssued,
        commonStockRepurchased: statement.commonStockRepurchased,
        dividendsPaid: statement.dividendsPaid,
        otherFinancingActivites: statement.otherFinancingActivites,
        netCashUsedProvidedByFinancingActivities: statement.netCashUsedProvidedByFinancingActivities,
        effectOfForexExchangeRate: statement.effectOfForexExchangeRate,
        netChangeInCash: statement.netChangeInCash,
        cashAtEndOfPeriod: statement.cashAtEndOfPeriod,
        cashAtBeginningOfPeriod: statement.cashAtBeginningOfPeriod,
        freeCashFlow: statement.freeCashFlow,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getFinancialRatios(ticker: string, limit: number = 11): Promise<any> {
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
    limit: number = 11,
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
      const symbol = ticker.toUpperCase();
      const [priceResponse, divResponse] = await Promise.all([
        this.client.get("/historical-price-eod/full", {
          params: { ...this.getParams(), symbol },
        }).catch(() => null),
        this.client.get("/dividends", {
          params: { ...this.getParams(), symbol, limit: 100 },
        }).catch(() => ({ data: [] })),
      ]);

      let data = priceResponse?.data;
      if (!data || !Array.isArray(data) || data.length === 0) {
        const lightResponse = await this.client.get("/historical-price-eod/light", {
          params: { ...this.getParams(), symbol },
        });
        data = lightResponse.data;
      }

      if (!data || !Array.isArray(data)) {
        return [];
      }

      const rawDividends = divResponse && Array.isArray(divResponse.data) ? divResponse.data : [];
      const divMap = new Map<string, number>();
      rawDividends.forEach((d: any) => {
        if (d.date && (typeof d.adjDividend === "number" || typeof d.dividend === "number")) {
          const val = typeof d.adjDividend === "number" ? d.adjDividend : d.dividend;
          if (val > 0) divMap.set(d.date, val);
        }
      });

      const sortedRaw = data
        .filter((item: any) => item.date && (typeof item.close === "number" || typeof item.price === "number"))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentMultiplier = 1.0;
      const pointsWithAdj: HistoricalPricePoint[] = new Array(sortedRaw.length);

      for (let i = sortedRaw.length - 1; i >= 0; i--) {
        const item = sortedRaw[i];
        const closePrice = typeof item.close === "number" ? item.close : item.price || 0;
        const divAmt = divMap.get(item.date);

        if (divAmt && divAmt > 0 && closePrice > 0) {
          currentMultiplier *= (1 + divAmt / closePrice);
        }

        pointsWithAdj[i] = {
          date: item.date,
          open: typeof item.open === "number" ? item.open : closePrice,
          high: typeof item.high === "number" ? item.high : closePrice,
          low: typeof item.low === "number" ? item.low : closePrice,
          close: closePrice,
          adjClose: closePrice > 0 ? Number((closePrice / currentMultiplier).toFixed(4)) : closePrice,
          volume: typeof item.volume === "number" ? item.volume : 0,
          change: typeof item.change === "number" ? item.change : 0,
          changePercent: typeof item.changePercent === "number" ? item.changePercent : 0,
        };
      }

      return pointsWithAdj;
    } catch (error) {
      console.warn("Failed to fetch historical prices:", error);
      return [];
    }
  }

  async getIntradayPrices(ticker: string): Promise<HistoricalPricePoint[]> {
    try {
      const symbol = ticker.toUpperCase();
      const res = await this.client.get("/historical-chart/5min", {
        params: { ...this.getParams(), symbol },
      });

      if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
        return [];
      }

      // Find the most recent date present in the 5-min intraday dataset (e.g. "2026-08-13")
      const latestDateStr = res.data[0].date.split(" ")[0];
      const todayPoints = res.data
        .filter((pt: any) => pt.date && pt.date.startsWith(latestDateStr))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return todayPoints.map((pt: any) => {
        const closePrice = typeof pt.close === "number" ? pt.close : parseFloat(pt.close) || 0;
        return {
          date: pt.date,
          open: typeof pt.open === "number" ? pt.open : parseFloat(pt.open) || closePrice,
          high: typeof pt.high === "number" ? pt.high : parseFloat(pt.high) || closePrice,
          low: typeof pt.low === "number" ? pt.low : parseFloat(pt.low) || closePrice,
          close: closePrice,
          adjClose: closePrice,
          volume: typeof pt.volume === "number" ? pt.volume : parseFloat(pt.volume) || 0,
        };
      });
    } catch (error) {
      console.warn("Failed to fetch 1D intraday prices:", error);
      return [];
    }
  }

  async getTopGainers(limit: number = 10): Promise<MarketMover[]> {
    try {
      const response = await this.client.get("/biggest-gainers", {
        params: this.getParams(),
      });
      if (!response.data || !Array.isArray(response.data)) return [];
      return response.data
        .map((item: any) => ({
          symbol: item.symbol,
          name: item.name || item.symbol,
          price: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
          change: typeof item.change === "number" ? item.change : parseFloat(item.change) || 0,
          changesPercentage: typeof item.changesPercentage === "number" ? item.changesPercentage : parseFloat(item.changesPercentage) || 0,
          exchange: item.exchange,
        }))
        .slice(0, limit);
    } catch (error) {
      console.warn("Failed to fetch top gainers:", error);
      return [];
    }
  }

  async getTopLosers(limit: number = 10): Promise<MarketMover[]> {
    try {
      const response = await this.client.get("/biggest-losers", {
        params: this.getParams(),
      });
      if (!response.data || !Array.isArray(response.data)) return [];
      return response.data
        .map((item: any) => ({
          symbol: item.symbol,
          name: item.name || item.symbol,
          price: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
          change: typeof item.change === "number" ? item.change : parseFloat(item.change) || 0,
          changesPercentage: typeof item.changesPercentage === "number" ? item.changesPercentage : parseFloat(item.changesPercentage) || 0,
          exchange: item.exchange,
        }))
        .slice(0, limit);
    } catch (error) {
      console.warn("Failed to fetch top losers:", error);
      return [];
    }
  }

  async getCompanyScreenerPool(): Promise<any[]> {
    try {
      const response = await this.client.get("/company-screener", {
        params: {
          ...this.getParams(),
          exchange: "NASDAQ,NYSE,AMEX",
          country: "US",
          isEtf: false,
          isFund: false,
          isActivelyTrading: true,
          limit: 1000,
        },
      });
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
    } catch (error) {
      console.warn("Failed to fetch company screener pool:", error);
    }
    return [];
  }

  async getSP500Constituents(): Promise<any[]> {
    return this.getCompanyScreenerPool();
  }

  async getBatchQuotes(symbols: string[]): Promise<FmpNormalizedQuote[]> {
    if (!symbols || symbols.length === 0) return [];
    try {
      const promises = symbols.map(async (sym) => {
        try {
          const res = await this.client.get("/quote", {
            params: { ...this.getParams(), symbol: sym.toUpperCase() },
          });

          if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
            return null;
          }

          const raw = res.data[0];
          const rawChangePct = raw.changePercentage ?? raw.changesPercentage ?? null;
          const rawDollarChange = raw.change ?? raw.dollarChange ?? null;

          const parsedPct =
            typeof rawChangePct === "number"
              ? rawChangePct
              : typeof rawChangePct === "string"
              ? parseFloat(rawChangePct)
              : null;
          const parsedDollar =
            typeof rawDollarChange === "number"
              ? rawDollarChange
              : typeof rawDollarChange === "string"
              ? parseFloat(rawDollarChange)
              : null;

          const changePct = parsedPct !== null && !isNaN(parsedPct) ? Math.round(parsedPct * 100) / 100 : null;
          const dollarChange = parsedDollar !== null && !isNaN(parsedDollar) ? Math.round(parsedDollar * 100) / 100 : null;

          const price = typeof raw.price === "number" ? raw.price : parseFloat(raw.price) || 0;
          const marketCap = typeof raw.marketCap === "number" ? raw.marketCap : parseFloat(raw.marketCap) || 0;

          return {
            symbol: sym.toUpperCase(),
            price,
            change: dollarChange,
            changesPercentage: changePct,
            marketCap,
          };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(promises);
      return results.filter((q): q is FmpNormalizedQuote => q !== null);
    } catch (error) {
      console.warn("Failed to fetch batch quotes:", error);
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
    limit: number = 11,
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

  async getKeyMetricsTTM(ticker: string): Promise<any | null> {
    try {
      const response = await this.client.get("/key-metrics-ttm", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase() },
      });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  async getRatiosTTM(ticker: string): Promise<any | null> {
    try {
      const response = await this.client.get("/ratios-ttm", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase() },
      });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch {
      return null;
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
        keyMetricsRes,
        financialRatiosRes,
        keyMetricsTTM,
        ratiosTTM,
      ] = await Promise.all([
        this.getIncomeStatements(ticker),
        this.getBalanceSheets(ticker),
        this.getCashFlowStatements(ticker),
        this.getDividends(ticker).catch(() => []),
        this.getDividendMetrics(ticker).catch(() => ({
          dividendYield: null,
          dividendPerShare: null,
          dividendPayoutRatio: null,
        })),
        this.getKeyMetrics(ticker).catch(() => []),
        this.getFinancialRatios(ticker).catch(() => []),
        this.getKeyMetricsTTM(ticker).catch(() => null),
        this.getRatiosTTM(ticker).catch(() => null),
      ]);

      return {
        incomeStatements,
        balanceSheets,
        cashFlowStatements,
        dividendHistory,
        dividendMetrics,
        keyMetrics: keyMetricsRes || [],
        financialRatios: financialRatiosRes || [],
        keyMetricsTTM,
        ratiosTTM,
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

  async getKeyExecutives(ticker: string): Promise<any[]> {
    try {
      const response = await this.client.get("/key-executives", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase() },
      });
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      return response.data;
    } catch (error) {
      console.warn(`Could not fetch key executives for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Reusable method for retrieving stock peers from FMP API
   * Normalizes ticker symbols, handles route variations, and logs error classifications
   */
  async getStockPeers(ticker: string): Promise<string[]> {
    if (!ticker || typeof ticker !== "string") {
      return [];
    }

    const normalizedSymbol = encodeURIComponent(ticker.trim().toUpperCase());
    if (!normalizedSymbol) {
      return [];
    }

    const endpointUrl = `${BASE_URL}/stock_peers?symbol=${normalizedSymbol}`;

    try {
      let response;
      try {
        response = await this.client.get("/stock_peers", {
          params: { ...this.getParams(), symbol: normalizedSymbol },
        });
      } catch (primaryErr: any) {
        // Fall back to /stock-peers (hyphenated) if primary /stock_peers route returns 404
        if (primaryErr?.response?.status === 404) {
          try {
            response = await this.client.get("/stock-peers", {
              params: { ...this.getParams(), symbol: normalizedSymbol },
            });
          } catch (fallbackErr) {
            throw primaryErr; // Rethrow primary error for classification
          }
        } else {
          throw primaryErr;
        }
      }

      if (!response || !response.data) {
        return [];
      }

      // Format 1: Array of objects [{ symbol: "AAPL", peersList: ["MSFT", "GOOGL"] }]
      if (Array.isArray(response.data) && response.data.length > 0) {
        const firstItem = response.data[0];
        if (firstItem && Array.isArray(firstItem.peersList)) {
          return firstItem.peersList
            .filter((s: any) => typeof s === "string" && s.trim().length > 0)
            .map((s: string) => s.trim().toUpperCase());
        }
        if (typeof firstItem === "string") {
          return response.data
            .filter((s: any) => typeof s === "string" && s.trim().length > 0)
            .map((s: string) => s.trim().toUpperCase());
        }
      }

      // Format 2: Object with peersList property
      if (typeof response.data === "object" && Array.isArray(response.data.peersList)) {
        return response.data.peersList
          .filter((s: any) => typeof s === "string" && s.trim().length > 0)
          .map((s: string) => s.trim().toUpperCase());
      }

      return [];
    } catch (error: any) {
      this.logPeersError(normalizedSymbol, endpointUrl, error);
      return [];
    }
  }

  private logPeersError(symbol: string, endpointUrl: string, error: any): void {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const fmpMsg =
        typeof data === "string"
          ? data
          : data?.["Error Message"] || data?.message || data?.error || JSON.stringify(data || {});

      if (status === 404) {
        console.info(
          `[FMP Stock Peers] 404 Route/Data not found for '${symbol}' at ${endpointUrl}. Response: ${fmpMsg || "No peer data available"}`
        );
      } else if (status === 401 || status === 403) {
        console.warn(
          `[FMP Stock Peers] Auth Error (${status}) for '${symbol}' at ${endpointUrl}. Invalid API Key. Response: ${fmpMsg}`
        );
      } else if (status === 429) {
        console.warn(
          `[FMP Stock Peers] Rate Limit Exceeded (429) for '${symbol}'. Response: ${fmpMsg}`
        );
      } else {
        console.warn(
          `[FMP Stock Peers] HTTP ${status || "UNKNOWN"} error for '${symbol}' at ${endpointUrl}: ${fmpMsg}`
        );
      }
    } else {
      console.warn(
        `[FMP Stock Peers] Network/Client failure for '${symbol}' at ${endpointUrl}: ${error?.message || error}`
      );
    }
  }

  async getIndustryPeers(industry?: string, sector?: string): Promise<any[]> {
    try {
      const params: any = { ...this.getParams(), limit: 30 };
      if (industry) params.industry = industry;
      if (sector && !industry) params.sector = sector;

      const response = await this.client.get("/stock_screener", { params });
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      return response.data;
    } catch (error) {
      console.warn("Could not fetch industry peers from screener:", error);
      return [];
    }
  }

  /**
   * Fetch Analyst Statement Estimates (annual forecasts)
   */
  async getAnalystEstimates(ticker: string): Promise<AnalystEstimatePoint[]> {
    try {
      const response = await this.client.get("/analyst-estimates", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase(), period: "annual" },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      // Sort items chronologically by date
      const rawPoints = [...response.data]
        .filter((item) => item && item.date)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const points: AnalystEstimatePoint[] = rawPoints.map((item) => {
        const year = new Date(item.date).getFullYear().toString();
        return {
          symbol: item.symbol || ticker,
          date: item.date,
          fiscalYear: `FY ${year}`,
          epsAvg: typeof item.epsAvg === "number" ? item.epsAvg : null,
          epsHigh: typeof item.epsHigh === "number" ? item.epsHigh : null,
          epsLow: typeof item.epsLow === "number" ? item.epsLow : null,
          numAnalystsEps: typeof item.numAnalystsEps === "number" ? item.numAnalystsEps : null,
          revenueAvg: typeof item.revenueAvg === "number" ? item.revenueAvg : null,
          revenueHigh: typeof item.revenueHigh === "number" ? item.revenueHigh : null,
          revenueLow: typeof item.revenueLow === "number" ? item.revenueLow : null,
          numAnalystsRevenue: typeof item.numAnalystsRevenue === "number" ? item.numAnalystsRevenue : null,
          ebitdaAvg: typeof item.ebitdaAvg === "number" ? item.ebitdaAvg : null,
          ebitdaHigh: typeof item.ebitdaHigh === "number" ? item.ebitdaHigh : null,
          ebitdaLow: typeof item.ebitdaLow === "number" ? item.ebitdaLow : null,
        };
      });

      // Calculate YoY growth between consecutive fiscal years
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        if (curr.epsAvg !== null && prev.epsAvg !== null && prev.epsAvg > 0) {
          curr.epsYoYGrowthPct = Number((((curr.epsAvg - prev.epsAvg) / prev.epsAvg) * 100).toFixed(1));
        }
        if (curr.revenueAvg !== null && prev.revenueAvg !== null && prev.revenueAvg > 0) {
          curr.revenueYoYGrowthPct = Number((((curr.revenueAvg - prev.revenueAvg) / prev.revenueAvg) * 100).toFixed(1));
        }
        if (curr.ebitdaAvg !== null && prev.ebitdaAvg !== null && prev.ebitdaAvg > 0) {
          curr.ebitdaYoYGrowthPct = Number((((curr.ebitdaAvg - prev.ebitdaAvg) / prev.ebitdaAvg) * 100).toFixed(1));
        }
      }

      return points;
    } catch (error) {
      console.warn("Could not fetch analyst estimates:", error);
      return [];
    }
  }

  /**
   * Fetch Price Target Consensus & Summary Data
   */
  async getPriceTargetConsensus(ticker: string, currentPrice?: number): Promise<PriceTargetData | null> {
    try {
      const [consensusRes, summaryRes] = await Promise.all([
        this.client.get("/price-target-consensus", {
          params: { ...this.getParams(), symbol: ticker.toUpperCase() },
        }).catch(() => ({ data: [] })),
        this.client.get("/price-target-summary", {
          params: { ...this.getParams(), symbol: ticker.toUpperCase() },
        }).catch(() => ({ data: [] })),
      ]);

      const consensusData = Array.isArray(consensusRes.data) && consensusRes.data.length > 0 ? consensusRes.data[0] : null;
      const summaryData = Array.isArray(summaryRes.data) && summaryRes.data.length > 0 ? summaryRes.data[0] : null;

      if (!consensusData && !summaryData) {
        return null;
      }

      const targetConsensus = consensusData?.targetConsensus ?? summaryData?.lastQuarterAvgPriceTarget ?? summaryData?.lastYearAvgPriceTarget ?? null;
      const targetHigh = consensusData?.targetHigh ?? null;
      const targetLow = consensusData?.targetLow ?? null;
      const targetMedian = consensusData?.targetMedian ?? null;
      const price = currentPrice || null;

      let impliedUpsidePct: number | null = null;
      if (price !== null && price > 0 && targetConsensus !== null && targetConsensus > 0) {
        impliedUpsidePct = Number((((targetConsensus - price) / price) * 100).toFixed(1));
      }

      return {
        symbol: ticker.toUpperCase(),
        targetHigh,
        targetLow,
        targetConsensus,
        targetMedian,
        currentPrice: price,
        impliedUpsidePct,
        analystCount: summaryData?.lastQuarterCount || summaryData?.lastYearCount || summaryData?.lastMonthCount || null,
        lastMonthAvgPriceTarget: summaryData?.lastMonthAvgPriceTarget ?? null,
        lastQuarterAvgPriceTarget: summaryData?.lastQuarterAvgPriceTarget ?? null,
        lastYearAvgPriceTarget: summaryData?.lastYearAvgPriceTarget ?? null,
      };
    } catch (error) {
      console.warn("Could not fetch price target consensus:", error);
      return null;
    }
  }


  /**
   * Fetch Recent Price Target News / Updates
   */
  async getRecentPriceTargetNews(ticker: string): Promise<PriceTargetNewsItem[]> {
    try {
      const response = await this.client.get("/price-target-news", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase() },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      return response.data.slice(0, 10).map((item) => ({
        publishedDate: item.publishedDate || "",
        newsTitle: item.newsTitle || "",
        priceTarget: typeof item.priceTarget === "number" ? item.priceTarget : null,
        priceWhenPosted: typeof item.priceWhenPosted === "number" ? item.priceWhenPosted : null,
        analystCompany: item.analystCompany || item.newsPublisher || "",
        newsPublisher: item.newsPublisher || "",
      }));
    } catch (error) {
      console.warn("Could not fetch price target news:", error);
      return [];
    }
  }

  /**
   * Fetch Recent Analyst Rating Grades (Upgrades/Downgrades/Maintains)
   */
  async getAnalystGrades(ticker: string): Promise<AnalystGradeItem[]> {
    try {
      const response = await this.client.get("/grades", {
        params: { ...this.getParams(), symbol: ticker.toUpperCase() },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      return response.data.slice(0, 10).map((item) => ({
        date: item.date || "",
        gradingCompany: item.gradingCompany || "",
        previousGrade: item.previousGrade || "",
        newGrade: item.newGrade || "",
        action: item.action || "",
      }));
    } catch (error) {
      console.warn("Could not fetch analyst grades:", error);
      return [];
    }
  }

  /**
   * Aggregator: Fetch Complete Future Outlook Dataset
   */
  async getFutureOutlookData(
    ticker: string,
    currentPrice?: number,
    historicalEpsCagr?: number | null,
    historicalRevenueCagr?: number | null
  ): Promise<FutureOutlookData> {
    const [estimates, priceTarget, recentPriceTargetNews, recentGrades] = await Promise.all([
      this.getAnalystEstimates(ticker),
      this.getPriceTargetConsensus(ticker, currentPrice),
      this.getRecentPriceTargetNews(ticker),
      this.getAnalystGrades(ticker),
    ]);

    // Identify current and future fiscal year entries
    const currentYearNum = new Date().getFullYear();
    const futureEstimates = estimates.filter((e) => {
      const yearNum = parseInt(e.fiscalYear.replace("FY ", ""), 10);
      return !isNaN(yearNum) && yearNum >= currentYearNum;
    });

    // Compute expected forward growth rates
    let forwardEpsGrowthPct: number | null = null;
    let forwardRevenueGrowthPct: number | null = null;
    let forwardEbitdaGrowthPct: number | null = null;

    if (futureEstimates.length >= 2) {
      const e2 = futureEstimates[1];

      if (e2.epsYoYGrowthPct !== undefined && e2.epsYoYGrowthPct !== null) {
        forwardEpsGrowthPct = e2.epsYoYGrowthPct;
      }
      if (e2.revenueYoYGrowthPct !== undefined && e2.revenueYoYGrowthPct !== null) {
        forwardRevenueGrowthPct = e2.revenueYoYGrowthPct;
      }
      if (e2.ebitdaYoYGrowthPct !== undefined && e2.ebitdaYoYGrowthPct !== null) {
        forwardEbitdaGrowthPct = e2.ebitdaYoYGrowthPct;
      }
    } else if (futureEstimates.length === 1 && futureEstimates[0].epsYoYGrowthPct != null) {
      forwardEpsGrowthPct = futureEstimates[0].epsYoYGrowthPct ?? null;
      forwardRevenueGrowthPct = futureEstimates[0].revenueYoYGrowthPct ?? null;
      forwardEbitdaGrowthPct = futureEstimates[0].ebitdaYoYGrowthPct ?? null;
    }

    // Determine trend status vs historical CAGR
    const determineTrend = (
      forwardPct: number | null,
      histCagr: number | null
    ): "Accelerating" | "Stable" | "Decelerating" | "N/A" => {
      if (forwardPct === null || histCagr === null || isNaN(forwardPct) || isNaN(histCagr)) {
        return "N/A";
      }
      const histPct = histCagr * 100;
      const diff = forwardPct - histPct;
      if (diff > 2.0) return "Accelerating";
      if (diff < -2.0) return "Decelerating";
      return "Stable";
    };

    const epsTrendStatus = determineTrend(forwardEpsGrowthPct, historicalEpsCagr ?? null);
    const revenueTrendStatus = determineTrend(forwardRevenueGrowthPct, historicalRevenueCagr ?? null);

    return {
      symbol: ticker.toUpperCase(),
      estimates,
      priceTarget,
      recentPriceTargetNews,
      recentGrades,
      forwardEpsGrowthPct,
      forwardRevenueGrowthPct,
      forwardEbitdaGrowthPct,
      historicalEpsCagr: historicalEpsCagr ?? null,
      historicalRevenueCagr: historicalRevenueCagr ?? null,
      epsTrendStatus,
      revenueTrendStatus,
      lastUpdated: new Date().toISOString(),
    };
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
