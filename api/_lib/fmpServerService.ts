import type {
  CompanyProfile,
  FinancialStatement,
  DividendMetrics,
  HistoricalPricePoint,
  MarketMover,
  AnalystEstimatePoint,
  PriceTargetData,
  PriceTargetNewsItem,
  AnalystGradeItem,
  FutureOutlookData,
} from "./types.js";

export interface FmpNormalizedQuote {
  symbol: string;
  price: number;
  change: number | null;
  changesPercentage: number | null;
  marketCap: number;
}

const BASE_URL = "https://financialmodelingprep.com/stable";

export class FmpServerService {
  public client = {
    get: async (endpoint: string, config?: { params?: Record<string, any> }) => {
      const params = config?.params || {};
      const url = new URL(`${BASE_URL}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`);
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timer);
        if (!res.ok) {
          let errData: any = {};
          try {
            errData = await res.json();
          } catch {
            errData = await res.text().catch(() => "");
          }
          const error: any = new Error(`FMP HTTP ${res.status}: ${res.statusText}`);
          error.status = res.status;
          error.response = { status: res.status, data: errData };
          throw error;
        }
        const data = await res.json();
        return { data };
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
          const timeoutErr: any = new Error("FMP request timed out");
          (timeoutErr as any).code = "ECONNABORTED";
          throw timeoutErr;
        }
        throw err;
      }
    },
  };

  private getApiKey(): string {
    const key = process.env.FMP_API_KEY || process.env.VITE_FMP_API_KEY;
    if (!key || key.trim().length === 0) {
      throw new Error("FMP_API_KEY environment variable is not configured on the server");
    }
    return key.trim();
  }

  private getParams() {
    return { apikey: this.getApiKey() };
  }

  public sanitizeSymbol(symbol: string): string {
    if (!symbol || typeof symbol !== "string") {
      throw new Error("Invalid symbol: Ticker symbol is required");
    }
    const clean = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.\-_]{1,20}$/.test(clean)) {
      throw new Error(`Invalid symbol format: "${clean}"`);
    }
    return clean;
  }

  public sanitizeLimit(limit: any, defaultVal = 10, maxVal = 100): number {
    const parsed = parseInt(String(limit), 10);
    if (isNaN(parsed) || parsed <= 0) return defaultVal;
    return Math.min(parsed, maxVal);
  }

  async getCompanyProfile(ticker: string): Promise<CompanyProfile> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/profile", {
        params: { ...this.getParams(), symbol: sym },
      });

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error(`Company not found: ${sym}`);
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
      throw this.handleError(error, `Failed to fetch profile for ${sym}`);
    }
  }

  async searchCompany(query: string, limit: number = 10): Promise<any[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanQuery = query.trim().slice(0, 100);
    const safeLimit = this.sanitizeLimit(limit, 10, 50);

    try {
      const response = await this.client.get("/search-name", {
        params: { ...this.getParams(), query: cleanQuery, limit: safeLimit },
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
        const isUsA =
          a.exchange === "NASDAQ" ||
          a.exchange === "NYSE" ||
          a.exchange === "AMEX" ||
          a.currency === "USD";
        const isUsB =
          b.exchange === "NASDAQ" ||
          b.exchange === "NYSE" ||
          b.exchange === "AMEX" ||
          b.currency === "USD";
        if (isUsA && !isUsB) return -1;
        if (!isUsA && isUsB) return 1;
        return 0;
      });
    } catch (error) {
      console.warn("[FMP Server] Company search failed:", (error as any)?.message || error);
      return [];
    }
  }

  async resolveTicker(input: string): Promise<{ symbol: string }> {
    const trimmed = input.trim();
    if (!trimmed) return { symbol: "" };

    // If input looks like an exact ticker symbol (1-5 chars with no spaces), try direct profile check first
    if (/^[A-Za-z0-9]{1,5}$/.test(trimmed)) {
      try {
        const profile = await this.getCompanyProfile(trimmed);
        if (profile && profile.symbol) return { symbol: profile.symbol };
      } catch {
        // Fall back to company search below
      }
    }

    // Search by company name
    const searchResults = await this.searchCompany(trimmed, 10);
    if (searchResults.length > 0) {
      const cleanMatch = searchResults.find((r) => !r.symbol.includes(".")) || searchResults[0];
      return { symbol: cleanMatch.symbol };
    }

    return { symbol: trimmed.toUpperCase() };
  }

  async getIncomeStatements(ticker: string, limit: number = 11): Promise<FinancialStatement[]> {
    const sym = this.sanitizeSymbol(ticker);
    const safeLimit = this.sanitizeLimit(limit, 11, 30);
    try {
      const response = await this.client.get("/income-statement", {
        params: { ...this.getParams(), symbol: sym, limit: safeLimit },
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error(`No income statement data found for ${sym}`);
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
        weightedAverageShsOutDil:
          statement.weightedAverageShsOutDil ?? statement.weightedAverageSharesDiluted,
        weightedAverageShsOut:
          statement.weightedAverageShsOut ?? statement.weightedAverageSharesOutstanding,
        shares:
          statement.weightedAverageShsOutDil ??
          statement.weightedAverageShsOut ??
          statement.weightedAverageSharesDiluted ??
          statement.weightedAverageSharesOutstanding,
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to fetch income statements for ${sym}`);
    }
  }

  async getBalanceSheets(ticker: string, limit: number = 11): Promise<FinancialStatement[]> {
    const sym = this.sanitizeSymbol(ticker);
    const safeLimit = this.sanitizeLimit(limit, 11, 30);
    try {
      const response = await this.client.get("/balance-sheet-statement", {
        params: { ...this.getParams(), symbol: sym, limit: safeLimit },
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error(`No balance sheet data found for ${sym}`);
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
      throw this.handleError(error, `Failed to fetch balance sheets for ${sym}`);
    }
  }

  async getCashFlowStatements(ticker: string, limit: number = 11): Promise<FinancialStatement[]> {
    const sym = this.sanitizeSymbol(ticker);
    const safeLimit = this.sanitizeLimit(limit, 11, 30);
    try {
      const response = await this.client.get("/cash-flow-statement", {
        params: { ...this.getParams(), symbol: sym, limit: safeLimit },
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error(`No cash flow data found for ${sym}`);
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
        operatingCashFlow:
          statement.operatingCashFlow ?? statement.netCashProvidedByOperatingActivities,
        netCashProvidedByOperatingActivities:
          statement.netCashProvidedByOperatingActivities ?? statement.operatingCashFlow,
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
        netCashUsedProvidedByFinancingActivities:
          statement.netCashUsedProvidedByFinancingActivities,
        effectOfForexExchangeRate: statement.effectOfForexExchangeRate,
        netChangeInCash: statement.netChangeInCash,
        cashAtEndOfPeriod: statement.cashAtEndOfPeriod,
        cashAtBeginningOfPeriod: statement.cashAtBeginningOfPeriod,
        freeCashFlow: statement.freeCashFlow,
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to fetch cash flow statements for ${sym}`);
    }
  }

  async getFinancialRatios(ticker: string, limit: number = 11): Promise<any[]> {
    const sym = this.sanitizeSymbol(ticker);
    const safeLimit = this.sanitizeLimit(limit, 11, 30);
    try {
      const response = await this.client.get("/ratios", {
        params: { ...this.getParams(), symbol: sym, limit: safeLimit },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      return response.data;
    } catch (error) {
      console.warn(`[FMP Server] Failed to fetch ratios for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getDividends(ticker: string, limit: number = 11): Promise<FinancialStatement[]> {
    const sym = this.sanitizeSymbol(ticker);
    const safeLimit = this.sanitizeLimit(limit, 11, 100);
    try {
      const response = await this.client.get("/dividends", {
        params: { ...this.getParams(), symbol: sym, limit: safeLimit },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
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
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    } catch (error) {
      console.warn(`[FMP Server] Failed to fetch dividends for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getDividendMetrics(ticker: string): Promise<DividendMetrics> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/ratios-ttm", {
        params: { ...this.getParams(), symbol: sym },
      });

      if (!response.data?.length) {
        return { dividendYield: null, dividendPerShare: null, dividendPayoutRatio: null };
      }

      const ratios = response.data[0];
      return {
        dividendYield: ratios.dividendYieldTTM,
        dividendPerShare: ratios.dividendPerShareTTM,
        dividendPayoutRatio: ratios.dividendPayoutRatioTTM,
      };
    } catch (error) {
      console.warn(`[FMP Server] Failed to fetch dividend metrics for ${sym}:`, (error as any)?.message);
      return { dividendYield: null, dividendPerShare: null, dividendPayoutRatio: null };
    }
  }

  async getKeyMetrics(ticker: string, limit: number = 11): Promise<any[]> {
    const sym = this.sanitizeSymbol(ticker);
    const safeLimit = this.sanitizeLimit(limit, 11, 30);
    try {
      const response = await this.client.get("/key-metrics", {
        params: { ...this.getParams(), symbol: sym, limit: safeLimit },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      return response.data;
    } catch (error) {
      console.warn(`[FMP Server] Failed to fetch key metrics for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getKeyMetricsTTM(ticker: string): Promise<any | null> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/key-metrics-ttm", {
        params: { ...this.getParams(), symbol: sym },
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
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/ratios-ttm", {
        params: { ...this.getParams(), symbol: sym },
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
    const sym = this.sanitizeSymbol(ticker);
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
        this.getIncomeStatements(sym),
        this.getBalanceSheets(sym),
        this.getCashFlowStatements(sym),
        this.getDividends(sym).catch(() => []),
        this.getDividendMetrics(sym).catch(() => ({
          dividendYield: null,
          dividendPerShare: null,
          dividendPayoutRatio: null,
        })),
        this.getKeyMetrics(sym).catch(() => []),
        this.getFinancialRatios(sym).catch(() => []),
        this.getKeyMetricsTTM(sym).catch(() => null),
        this.getRatiosTTM(sym).catch(() => null),
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
      throw this.handleError(error, `Failed to aggregate statement data for ${sym}`);
    }
  }

  async getHistoricalPrices(ticker: string): Promise<HistoricalPricePoint[]> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const [priceResponse, divResponse] = await Promise.all([
        this.client
          .get("/historical-price-eod/full", {
            params: { ...this.getParams(), symbol: sym },
          })
          .catch(() => null),
        this.client
          .get("/dividends", {
            params: { ...this.getParams(), symbol: sym, limit: 100 },
          })
          .catch(() => ({ data: [] })),
      ]);

      let data = priceResponse?.data;
      if (!data || !Array.isArray(data) || data.length === 0) {
        const lightResponse = await this.client.get("/historical-price-eod/light", {
          params: { ...this.getParams(), symbol: sym },
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
        .filter(
          (item: any) =>
            item.date && (typeof item.close === "number" || typeof item.price === "number")
        )
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentMultiplier = 1.0;
      const pointsWithAdj: HistoricalPricePoint[] = new Array(sortedRaw.length);

      for (let i = sortedRaw.length - 1; i >= 0; i--) {
        const item = sortedRaw[i];
        const closePrice = typeof item.close === "number" ? item.close : item.price || 0;
        const divAmt = divMap.get(item.date);

        if (divAmt && divAmt > 0 && closePrice > 0) {
          currentMultiplier *= 1 + divAmt / closePrice;
        }

        pointsWithAdj[i] = {
          date: item.date,
          open: typeof item.open === "number" ? item.open : closePrice,
          high: typeof item.high === "number" ? item.high : closePrice,
          low: typeof item.low === "number" ? item.low : closePrice,
          close: closePrice,
          adjClose:
            closePrice > 0 ? Number((closePrice / currentMultiplier).toFixed(4)) : closePrice,
          volume: typeof item.volume === "number" ? item.volume : 0,
          change: typeof item.change === "number" ? item.change : 0,
          changePercent: typeof item.changePercent === "number" ? item.changePercent : 0,
        };
      }

      return pointsWithAdj;
    } catch (error) {
      console.warn(`[FMP Server] Failed to fetch historical prices for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getIntradayPrices(ticker: string): Promise<HistoricalPricePoint[]> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const res = await this.client.get("/historical-chart/5min", {
        params: { ...this.getParams(), symbol: sym },
      });

      if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
        return [];
      }

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
      console.warn(`[FMP Server] Failed to fetch 1D intraday prices for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getTopGainers(limit: number = 10): Promise<MarketMover[]> {
    const safeLimit = this.sanitizeLimit(limit, 10, 50);
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
          changesPercentage:
            typeof item.changesPercentage === "number"
              ? item.changesPercentage
              : parseFloat(item.changesPercentage) || 0,
          exchange: item.exchange,
        }))
        .slice(0, safeLimit);
    } catch (error) {
      console.warn("[FMP Server] Failed to fetch top gainers:", (error as any)?.message);
      return [];
    }
  }

  async getTopLosers(limit: number = 10): Promise<MarketMover[]> {
    const safeLimit = this.sanitizeLimit(limit, 10, 50);
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
          changesPercentage:
            typeof item.changesPercentage === "number"
              ? item.changesPercentage
              : parseFloat(item.changesPercentage) || 0,
          exchange: item.exchange,
        }))
        .slice(0, safeLimit);
    } catch (error) {
      console.warn("[FMP Server] Failed to fetch top losers:", (error as any)?.message);
      return [];
    }
  }

  async getMarketMovers(limit: number = 10): Promise<{ gainers: MarketMover[]; losers: MarketMover[] }> {
    const [gainers, losers] = await Promise.all([
      this.getTopGainers(limit),
      this.getTopLosers(limit),
    ]);
    return { gainers, losers };
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
      return [];
    } catch (error) {
      console.warn("[FMP Server] Failed to fetch screener pool:", (error as any)?.message);
      return [];
    }
  }

  async getBatchQuotes(symbols: string[]): Promise<FmpNormalizedQuote[]> {
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) return [];
    // Cap batch size to 100 symbols
    const cleanSymbols = symbols.slice(0, 100).map((s) => this.sanitizeSymbol(s));

    try {
      const promises = cleanSymbols.map(async (sym) => {
        try {
          const res = await this.client.get("/quote", {
            params: { ...this.getParams(), symbol: sym },
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

          const changePct =
            parsedPct !== null && !isNaN(parsedPct) ? Math.round(parsedPct * 100) / 100 : null;
          const dollarChange =
            parsedDollar !== null && !isNaN(parsedDollar)
              ? Math.round(parsedDollar * 100) / 100
              : null;

          const price = typeof raw.price === "number" ? raw.price : parseFloat(raw.price) || 0;
          const marketCap =
            typeof raw.marketCap === "number" ? raw.marketCap : parseFloat(raw.marketCap) || 0;

          return {
            symbol: sym,
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
      console.warn("[FMP Server] Failed to fetch batch quotes:", (error as any)?.message);
      return [];
    }
  }

  async getKeyExecutives(ticker: string): Promise<any[]> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/key-executives", {
        params: { ...this.getParams(), symbol: sym },
      });
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      return response.data;
    } catch (error) {
      console.warn(`[FMP Server] Could not fetch key executives for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getStockPeers(ticker: string): Promise<string[]> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      let response;
      try {
        response = await this.client.get("/stock_peers", {
          params: { ...this.getParams(), symbol: sym },
        });
      } catch (primaryErr: any) {
        if (primaryErr?.response?.status === 404) {
          response = await this.client.get("/stock-peers", {
            params: { ...this.getParams(), symbol: sym },
          });
        } else {
          throw primaryErr;
        }
      }

      if (!response || !response.data) {
        return [];
      }

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

      if (typeof response.data === "object" && Array.isArray(response.data.peersList)) {
        return response.data.peersList
          .filter((s: any) => typeof s === "string" && s.trim().length > 0)
          .map((s: string) => s.trim().toUpperCase());
      }

      return [];
    } catch (error: any) {
      console.warn(`[FMP Server] Stock peers error for ${sym}:`, error?.message || error);
      return [];
    }
  }

  async getIndustryPeers(
    industry?: string,
    sector?: string,
    limit: number = 30
  ): Promise<any[]> {
    const safeLimit = this.sanitizeLimit(limit, 30, 50);
    try {
      const params: any = { ...this.getParams(), limit: safeLimit };
      if (industry) params.industry = industry.slice(0, 100);
      if (sector && !industry) params.sector = sector.slice(0, 100);

      const response = await this.client.get("/stock_screener", { params });
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      return response.data;
    } catch (error) {
      console.warn("[FMP Server] Failed to fetch industry peers:", (error as any)?.message);
      return [];
    }
  }

  async getAnalystEstimates(ticker: string): Promise<AnalystEstimatePoint[]> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/analyst-estimates", {
        params: { ...this.getParams(), symbol: sym, period: "annual" },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      const rawPoints = [...response.data]
        .filter((item) => item && item.date)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const points: AnalystEstimatePoint[] = rawPoints.map((item) => {
        const year = new Date(item.date).getFullYear().toString();
        return {
          symbol: item.symbol || sym,
          date: item.date,
          fiscalYear: `FY ${year}`,
          epsAvg: typeof item.epsAvg === "number" ? item.epsAvg : null,
          epsHigh: typeof item.epsHigh === "number" ? item.epsHigh : null,
          epsLow: typeof item.epsLow === "number" ? item.epsLow : null,
          numAnalystsEps: typeof item.numAnalystsEps === "number" ? item.numAnalystsEps : null,
          revenueAvg: typeof item.revenueAvg === "number" ? item.revenueAvg : null,
          revenueHigh: typeof item.revenueHigh === "number" ? item.revenueHigh : null,
          revenueLow: typeof item.revenueLow === "number" ? item.revenueLow : null,
          numAnalystsRevenue:
            typeof item.numAnalystsRevenue === "number" ? item.numAnalystsRevenue : null,
          ebitdaAvg: typeof item.ebitdaAvg === "number" ? item.ebitdaAvg : null,
          ebitdaHigh: typeof item.ebitdaHigh === "number" ? item.ebitdaHigh : null,
          ebitdaLow: typeof item.ebitdaLow === "number" ? item.ebitdaLow : null,
        };
      });

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        if (curr.epsAvg !== null && prev.epsAvg !== null && prev.epsAvg > 0) {
          curr.epsYoYGrowthPct = Number(
            (((curr.epsAvg - prev.epsAvg) / prev.epsAvg) * 100).toFixed(1)
          );
        }
        if (curr.revenueAvg !== null && prev.revenueAvg !== null && prev.revenueAvg > 0) {
          curr.revenueYoYGrowthPct = Number(
            (((curr.revenueAvg - prev.revenueAvg) / prev.revenueAvg) * 100).toFixed(1)
          );
        }
        if (curr.ebitdaAvg !== null && prev.ebitdaAvg !== null && prev.ebitdaAvg > 0) {
          curr.ebitdaYoYGrowthPct = Number(
            (((curr.ebitdaAvg - prev.ebitdaAvg) / prev.ebitdaAvg) * 100).toFixed(1)
          );
        }
      }

      return points;
    } catch (error) {
      console.warn(`[FMP Server] Could not fetch analyst estimates for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getPriceTargetConsensus(
    ticker: string,
    currentPrice?: number
  ): Promise<PriceTargetData | null> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const [consensusRes, summaryRes] = await Promise.all([
        this.client
          .get("/price-target-consensus", {
            params: { ...this.getParams(), symbol: sym },
          })
          .catch(() => ({ data: [] })),
        this.client
          .get("/price-target-summary", {
            params: { ...this.getParams(), symbol: sym },
          })
          .catch(() => ({ data: [] })),
      ]);

      const consensusData =
        Array.isArray(consensusRes.data) && consensusRes.data.length > 0
          ? consensusRes.data[0]
          : null;
      const summaryData =
        Array.isArray(summaryRes.data) && summaryRes.data.length > 0 ? summaryRes.data[0] : null;

      if (!consensusData && !summaryData) {
        return null;
      }

      const targetConsensus =
        consensusData?.targetConsensus ??
        summaryData?.lastQuarterAvgPriceTarget ??
        summaryData?.lastYearAvgPriceTarget ??
        null;
      const targetHigh = consensusData?.targetHigh ?? null;
      const targetLow = consensusData?.targetLow ?? null;
      const targetMedian = consensusData?.targetMedian ?? null;
      const price = currentPrice || null;

      let impliedUpsidePct: number | null = null;
      if (price !== null && price > 0 && targetConsensus !== null && targetConsensus > 0) {
        impliedUpsidePct = Number((((targetConsensus - price) / price) * 100).toFixed(1));
      }

      return {
        symbol: sym,
        targetHigh,
        targetLow,
        targetConsensus,
        targetMedian,
        currentPrice: price,
        impliedUpsidePct,
        analystCount:
          summaryData?.lastQuarterCount ||
          summaryData?.lastYearCount ||
          summaryData?.lastMonthCount ||
          null,
        lastMonthAvgPriceTarget: summaryData?.lastMonthAvgPriceTarget ?? null,
        lastQuarterAvgPriceTarget: summaryData?.lastQuarterAvgPriceTarget ?? null,
        lastYearAvgPriceTarget: summaryData?.lastYearAvgPriceTarget ?? null,
      };
    } catch (error) {
      console.warn(`[FMP Server] Could not fetch price target consensus for ${sym}:`, (error as any)?.message);
      return null;
    }
  }

  async getRecentPriceTargetNews(ticker: string): Promise<PriceTargetNewsItem[]> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/price-target-news", {
        params: { ...this.getParams(), symbol: sym },
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
      console.warn(`[FMP Server] Could not fetch price target news for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getAnalystGrades(ticker: string): Promise<AnalystGradeItem[]> {
    const sym = this.sanitizeSymbol(ticker);
    try {
      const response = await this.client.get("/grades", {
        params: { ...this.getParams(), symbol: sym },
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
      console.warn(`[FMP Server] Could not fetch analyst grades for ${sym}:`, (error as any)?.message);
      return [];
    }
  }

  async getFutureOutlookData(
    ticker: string,
    currentPrice?: number,
    historicalEpsCagr?: number | null,
    historicalRevenueCagr?: number | null
  ): Promise<FutureOutlookData> {
    const sym = this.sanitizeSymbol(ticker);
    const [estimates, priceTarget, recentPriceTargetNews, recentGrades] = await Promise.all([
      this.getAnalystEstimates(sym),
      this.getPriceTargetConsensus(sym, currentPrice),
      this.getRecentPriceTargetNews(sym),
      this.getAnalystGrades(sym),
    ]);

    const currentYearNum = new Date().getFullYear();
    const futureEstimates = estimates.filter((e) => {
      const yearNum = parseInt(e.fiscalYear.replace("FY ", ""), 10);
      return !isNaN(yearNum) && yearNum >= currentYearNum;
    });

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
    const revenueTrendStatus = determineTrend(
      forwardRevenueGrowthPct,
      historicalRevenueCagr ?? null
    );

    return {
      symbol: sym,
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

  private handleError(error: any, fallbackMessage: string): Error {
    const status = error?.response?.status || error?.status;
    if (status === 401 || status === 403) {
      return new Error("Authentication failed with upstream financial provider");
    }
    if (status === 404) {
      return new Error("Financial data not found for requested symbol");
    }
    if (status === 429) {
      return new Error("Upstream API rate limit reached. Please try again in a few moments");
    }
    if (status && status >= 500) {
      return new Error("Upstream financial service is temporarily unavailable");
    }
    return new Error(error?.message || fallbackMessage);
  }
}

export const fmpServerService = new FmpServerService();
