import { fmpService } from "./financialModelingPrep";

/**
 * Service for coordinating stock analysis retrieval.
 * Quota and IP abuse limits are enforced exclusively server-side in the Vercel API routes.
 */
class StockAnalysisService {
  /**
   * Execute full stock data retrieval (server enforces quota and IP limits)
   */
  async getStockAnalysisData(ticker: string) {
    return await fmpService.getAllData(ticker);
  }
}

export const stockAnalysisService = new StockAnalysisService();
