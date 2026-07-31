import { fmpService } from "./financialModelingPrep";
import { supabase, isSupabaseConfigured, initAnonymousAuth } from "./supabaseClient";

export interface QuotaCheckResult {
  allowed: boolean;
  code?: string;
  message?: string;
}

const LOCAL_QUOTA_KEY = "stock_analyzer_anonymous_analyses";

class StockAnalysisService {
  /**
   * Enforce quota server-side via Supabase RPC (or local fallback mode)
   */
  async checkQuotaAndTrack(ticker: string): Promise<QuotaCheckResult> {
    const cleanTicker = ticker.trim().toUpperCase();

    if (isSupabaseConfigured) {
      // 1. Automatically initialize anonymous auth session for new visitors
      const session = await initAnonymousAuth();
      if (session) {
        // 2. Execute atomic Postgres RPC server-side for dual quota & IP abuse enforcement
        const { data: quotaData, error: rpcError } = await supabase.rpc(
          "check_and_increment_analysis_limit",
          {
            p_ticker: cleanTicker,
            p_max_anonymous_limit: 2,
            p_max_ip_limit: 10,
            p_ip_window_hours: 24,
          }
        );

        if (!rpcError && quotaData) {
          // 3. Enforce limit exceeded (user limit or IP abuse limit)
          if (quotaData.status === "LIMIT_EXCEEDED" || quotaData.code === "LOGIN_REQUIRED") {
            const err: any = new Error(
              quotaData.message ||
                "You have reached your limit of free stock analyses. Please sign up or log in to continue."
            );
            err.code = "LOGIN_REQUIRED";
            throw err;
          }

          return { allowed: true };
        }
      }
      // If anonymous auth is disabled in Supabase Cloud dashboard, fallback to local storage quota tracking
    }

    // Local Fallback Mode when Supabase credentials are not configured
    const currentUserStr = localStorage.getItem("stock_analyzer_demo_user");
    if (currentUserStr) {
      try {
        const user = JSON.parse(currentUserStr);
        // Logged-in user has unlimited access
        if (user && user.email && !user.id.startsWith("local-")) {
          return { allowed: true };
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }

    // Anonymous Local Storage Quota
    const rawAnalyses = localStorage.getItem(LOCAL_QUOTA_KEY);
    const analyses: string[] = rawAnalyses ? JSON.parse(rawAnalyses) : [];

    if (analyses.includes(cleanTicker)) {
      return { allowed: true };
    }

    if (analyses.length >= 2) {
      const err: any = new Error(
        "You have reached your limit of 2 free anonymous stock analyses. Please sign up or log in to continue."
      );
      err.code = "LOGIN_REQUIRED";
      throw err;
    }

    analyses.push(cleanTicker);
    localStorage.setItem(LOCAL_QUOTA_KEY, JSON.stringify(analyses));
    return { allowed: true };
  }

  /**
   * Execute full stock data retrieval after server-side quota verification
   */
  async getStockAnalysisData(ticker: string) {
    // Enforce quota server-side
    await this.checkQuotaAndTrack(ticker);

    // Fetch financial statement data
    return await fmpService.getAllData(ticker);
  }
}

export const stockAnalysisService = new StockAnalysisService();
