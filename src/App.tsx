import { useState, useCallback, useEffect } from "react";
import { StockSearch } from "./components/StockSearch";
import { ThemeToggle } from "./components/ThemeToggle";
import { CompanyHeader } from "./components/CompanyHeader";
import { StockNews } from "./components/StockNews";
import { ScoreGauge } from "./components/ScoreGauge";
import { StockPriceChart } from "./components/StockPriceChart";
import { MetricCard } from "./components/MetricCard";
import { AnalysisTable } from "./components/AnalysisTable";
import { ValuationTable } from "./components/ValuationTable";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorMessage } from "./components/ErrorMessage";
import { MetricDetailModal } from "./components/MetricDetailModal";
import { ProfileOnlyPage } from "./components/ProfileOnlyPage";
import { AuthModal } from "./components/AuthModal";
import { UserHeader } from "./components/UserHeader";
import { authService, UserProfile } from "./services/authService";
import { fmpService } from "./services/financialModelingPrep";
import { calculateAllMetrics, calculateFCFMarginHistory, calculateFCFConversionHistory, calculateMarginStabilityHistory, calculateNetDebtToFCFHistory, calculateShareDilutionHistory } from "./utils/financialCalculations";
import { calculateMetricScores, calculateOverallScore, calculateDataConfidenceScore, getUnavailableMetrics } from "./utils/scoring";
import {
  calculateValuationMetrics,
  calculateValuationScores,
  calculateOverallValuationScore,
  calculateValuationConfidenceScore,
  getUnavailableValuationMetrics,
  getValuationAnalysis
} from "./utils/valuationScoring";
import { AnalysisResult } from "./types";

import { initAnonymousAuth } from "./services/supabaseClient";
import { stockAnalysisService } from "./services/stockAnalysisService";

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [pendingTicker, setPendingTicker] = useState<string | null>(null);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [profileOnly, setProfileOnly] = useState<{
    ticker: string;
    profile: any;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"fundamentals" | "valuation">("fundamentals");
  const [showAllCharts, setShowAllCharts] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    // Automatically initialize anonymous Supabase auth session for new visitors
    initAnonymousAuth();
    authService.getMe().then((userProfile) => {
      setUser(userProfile);
      setIsCheckingAuth(false);
    });
  }, []);

  const handleLogout = useCallback(() => {
    authService.logout();
    setUser(null);
    setResult(null);
    setProfileOnly(null);
  }, []);

  const handleSearch = useCallback(async (ticker: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveTab("fundamentals");
    setShowAllCharts(false);
    setSelectedMetric(null);

    try {
      // 1. Enforce quota server-side via Supabase RPC / Edge Function (limit = 2 for anonymous users)
      await stockAnalysisService.checkQuotaAndTrack(ticker);

      const [profile, historicalPrices] = await Promise.all([
        fmpService.getCompanyProfile(ticker),
        fmpService.getHistoricalPrices(ticker),
      ]);

      try {
        const {
          incomeStatements,
          balanceSheets,
          cashFlowStatements,
          dividendMetrics,
          keyMetrics,
          financialRatios,
        } = await fmpService.getStatementData(ticker);

        const metrics = calculateAllMetrics(
          incomeStatements,
          balanceSheets,
          cashFlowStatements,
          dividendMetrics,
        );
        const scores = calculateMetricScores(metrics, cashFlowStatements);
        const overallScore = calculateOverallScore(scores);
        const dataConfidenceScore = calculateDataConfidenceScore(scores);
        const unavailableMetrics = getUnavailableMetrics(scores);

        const valuationMetrics = calculateValuationMetrics(
          profile,
          incomeStatements,
          balanceSheets,
          cashFlowStatements,
          keyMetrics,
          financialRatios
        );
        const valuationScores = calculateValuationScores(valuationMetrics);
        const overallValuationScore = calculateOverallValuationScore(valuationScores);
        const valuationConfidenceScore = calculateValuationConfidenceScore(valuationScores);
        const unavailableValuationMetrics = getUnavailableValuationMetrics(valuationScores);

        const fcfHistory = [...cashFlowStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const fcf = (s.operatingCashFlow || 0) - Math.abs(s.capitalExpenditure || 0);
            return { label: year, value: fcf };
          });

        const revenueHistory = [...incomeStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            return { label: year, value: s.revenue || 0 };
          });

        const epsHistory = [...incomeStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            return { label: year, value: s.eps || 0 };
          });

        const roicHistory = [...incomeStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const matchBalance = balanceSheets.find(b => b.date && new Date(b.date).getFullYear().toString() === year);
            let roicVal = 0;
            if (matchBalance && s.operatingIncome && matchBalance.totalEquity && matchBalance.totalDebt) {
              const investedCapital = matchBalance.totalEquity + matchBalance.totalDebt;
              let taxRate = 0.25;
              if (s.netIncome && s.operatingIncome > 0) {
                taxRate = Math.max(0, 1 - s.netIncome / s.operatingIncome);
                taxRate = Math.min(1, taxRate);
              }
              const nopat = s.operatingIncome * (1 - taxRate);
              roicVal = (nopat / investedCapital) * 100;
            }
            return { label: year, value: roicVal };
          })
          .filter(item => item.value !== 0);

        const debtEquityHistory = [...balanceSheets]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const debtToEquity = s.totalEquity ? (s.totalDebt || 0) / s.totalEquity : 0;
            return { label: year, value: debtToEquity };
          });

        const profitabilityHistory = [...incomeStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const netMargin = s.revenue ? ((s.netIncome || 0) / s.revenue) * 100 : 0;
            return { label: year, value: netMargin };
          });

        const fcfMarginHistory = calculateFCFMarginHistory(incomeStatements, cashFlowStatements);
        const fcfConversionHistory = calculateFCFConversionHistory(incomeStatements, cashFlowStatements);
        const marginStabilityHistory = calculateMarginStabilityHistory(incomeStatements);
        const netDebtToFCFHistory = calculateNetDebtToFCFHistory(balanceSheets, cashFlowStatements);
        const shareDilutionHistory = calculateShareDilutionHistory(incomeStatements, balanceSheets);

        // 1. P/E Ratio History
        const peHistory = [...incomeStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const matchRatio = financialRatios ? financialRatios.find((r: any) => r.date && new Date(r.date).getFullYear().toString() === year) : null;
            let val = matchRatio?.priceToEarningsRatio;
            if (!val || val <= 0) {
              if (profile.price && s.eps && s.eps > 0) {
                val = profile.price / s.eps;
              } else if (profile.mktCap && s.netIncome && s.netIncome > 0) {
                val = profile.mktCap / s.netIncome;
              }
            }
            return { label: year, value: val && val > 0 ? val : null };
          })
          .filter((item): item is { label: string; value: number } => item.value !== null && isFinite(item.value));

        // 2. P/S Ratio History
        const psHistory = [...incomeStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const matchRatio = financialRatios ? financialRatios.find((r: any) => r.date && new Date(r.date).getFullYear().toString() === year) : null;
            let val = matchRatio?.priceToSalesRatio;
            if (!val || val <= 0) {
              if (profile.mktCap && s.revenue && s.revenue > 0) {
                val = profile.mktCap / s.revenue;
              }
            }
            return { label: year, value: val && val > 0 ? val : null };
          })
          .filter((item): item is { label: string; value: number } => item.value !== null && isFinite(item.value));

        // 3. EV/Sales History
        const evsHistory = [...incomeStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const matchMetric = keyMetrics ? keyMetrics.find((m: any) => m.date && new Date(m.date).getFullYear().toString() === year) : null;
            let val = matchMetric?.evToSales;
            if (!val || val <= 0) {
              const matchBalance = balanceSheets.find(b => b.date && new Date(b.date).getFullYear().toString() === year);
              if (profile.mktCap && s.revenue && s.revenue > 0 && matchBalance) {
                const totalDebt = matchBalance.totalDebt || 0;
                const cash = matchBalance.cashAndCashEquivalents || 0;
                const ev = profile.mktCap + totalDebt - cash;
                val = ev / s.revenue;
              }
            }
            return { label: year, value: val && val > 0 ? val : null };
          })
          .filter((item): item is { label: string; value: number } => item.value !== null && isFinite(item.value));

        // 4. P/FCF Ratio History
        const pfcfHistory = [...cashFlowStatements]
          .reverse()
          .map(s => {
            const year = s.date ? new Date(s.date).getFullYear().toString() : "N/A";
            const matchRatio = financialRatios ? financialRatios.find((r: any) => r.date && new Date(r.date).getFullYear().toString() === year) : null;
            let val = matchRatio?.priceToFreeCashFlowRatio;
            if (!val || val <= 0) {
              const fcf = (s.operatingCashFlow || 0) - Math.abs(s.capitalExpenditure || 0);
              if (profile.mktCap && fcf > 0) {
                val = profile.mktCap / fcf;
              }
            }
            return { label: year, value: val && val > 0 ? val : null };
          })
          .filter((item): item is { label: string; value: number } => item.value !== null && isFinite(item.value));

        // 5. Valuation Premium History (% premium vs average)
        const peAvg = peHistory.length > 0 ? peHistory.reduce((a, b) => a + b.value, 0) / peHistory.length : null;
        const psAvg = psHistory.length > 0 ? psHistory.reduce((a, b) => a + b.value, 0) / psHistory.length : null;
        const valuationPremiumHistory = peHistory.map(item => {
          const matchPs = psHistory.find(p => p.label === item.label);
          let sum = 0;
          let count = 0;
          if (peAvg && item.value) {
            sum += ((item.value - peAvg) / peAvg) * 100;
            count++;
          }
          if (psAvg && matchPs) {
            sum += ((matchPs.value - psAvg) / psAvg) * 100;
            count++;
          }
          return { label: item.label, value: count > 0 ? sum / count : 0 };
        });

        setResult({
          ticker,
          companyProfile: profile,
          metrics,
          scores,
          overallScore,
          analysis: `${profile.companyName} has a quality score of ${overallScore}/100`,
          dataConfidenceScore,
          unavailableMetrics,
          priceHistory: historicalPrices,
          fcfHistory,
          revenueHistory,
          epsHistory,
          roicHistory,
          debtEquityHistory,
          profitabilityHistory,
          fcfMarginHistory,
          fcfConversionHistory,
          marginStabilityHistory,
          netDebtToFCFHistory,
          shareDilutionHistory,
          
          valuationMetrics,
          valuationScores,
          overallValuationScore,
          valuationConfidenceScore,
          unavailableValuationMetrics,
          peHistory,
          psHistory,
          evsHistory,
          pfcfHistory,
          valuationPremiumHistory,
        });
        setProfileOnly(null);
      } catch (statementError: any) {
        setProfileOnly({
          ticker,
          profile,
          message:
            statementError?.message ||
            "The profile endpoint worked, but the statement endpoints are unavailable under your current plan.",
        });
        setResult(null);
      }
    } catch (err: any) {
      if (err?.code === "LOGIN_REQUIRED" || err?.message?.includes("LOGIN_REQUIRED") || err?.message?.includes("limit of 2")) {
        setPendingTicker(ticker);
        setAuthPromptMessage(err.message || "You have reached your limit of 2 free anonymous stock analyses. Please sign up or log in to continue.");
        setShowAuthModal(true);
      } else {
        const errMsg = typeof err === "string" ? err : (typeof err?.message === "string" ? err.message : (err?.message ? JSON.stringify(err.message) : "An error occurred while analyzing the stock"));
        setError(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAuthSuccess = useCallback((userProfile: UserProfile) => {
    setUser(userProfile);
    setShowAuthModal(false);
    setAuthPromptMessage(null);
    if (pendingTicker) {
      const tickerToRetry = pendingTicker;
      setPendingTicker(null);
      handleSearch(tickerToRetry);
    }
  }, [pendingTicker, handleSearch]);

  const handleRetry = useCallback(() => {
    setError(null);
    setResult(null);
    setProfileOnly(null);
  }, []);

  if (isCheckingAuth) {
    return (
      <>
        <ThemeToggle />
        <LoadingSpinner message="Checking authentication..." />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <div className="fixed top-4 left-4 z-40">
          <UserHeader user={user} onLogout={handleLogout} onLoginRequest={() => setShowAuthModal(true)} />
        </div>
        <ThemeToggle />
        <LoadingSpinner message="Analyzing company fundamentals..." />
        {showAuthModal && (
          <AuthModal
            onLoginSuccess={handleAuthSuccess}
            onClose={() => {
              setShowAuthModal(false);
              setAuthPromptMessage(null);
            }}
            customPrompt={authPromptMessage}
          />
        )}
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="fixed top-4 left-4 z-40">
          <UserHeader user={user} onLogout={handleLogout} onLoginRequest={() => setShowAuthModal(true)} />
        </div>
        <ThemeToggle />
        <ErrorMessage
          title="Analysis Failed"
          message={error}
          onRetry={handleRetry}
        />
        {showAuthModal && (
          <AuthModal
            onLoginSuccess={handleAuthSuccess}
            onClose={() => {
              setShowAuthModal(false);
              setAuthPromptMessage(null);
            }}
            customPrompt={authPromptMessage}
          />
        )}
      </>
    );
  }

  if (!result && !profileOnly) {
    return (
      <>
        <div className="fixed top-4 left-4 z-40">
          <UserHeader user={user} onLogout={handleLogout} onLoginRequest={() => setShowAuthModal(true)} />
        </div>
        <ThemeToggle />
        <StockSearch onSearch={handleSearch} isLoading={isLoading} />
        {showAuthModal && (
          <AuthModal
            onLoginSuccess={handleAuthSuccess}
            onClose={() => {
              setShowAuthModal(false);
              setAuthPromptMessage(null);
            }}
            customPrompt={authPromptMessage}
          />
        )}
      </>
    );
  }

  if (profileOnly) {
    return (
      <>
        <div className="fixed top-4 left-4 z-40">
          <UserHeader user={user} onLogout={handleLogout} onLoginRequest={() => setShowAuthModal(true)} />
        </div>
        <ThemeToggle />
        <ProfileOnlyPage
          profile={profileOnly.profile}
          message={profileOnly.message}
          onBack={() => {
            setProfileOnly(null);
            setResult(null);
          }}
        />
        {showAuthModal && (
          <AuthModal
            onLoginSuccess={handleAuthSuccess}
            onClose={() => {
              setShowAuthModal(false);
              setAuthPromptMessage(null);
            }}
            customPrompt={authPromptMessage}
          />
        )}
      </>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 py-8 px-4 transition-colors duration-300">
      <div className="fixed top-4 left-4 z-40">
        <UserHeader user={user} onLogout={handleLogout} onLoginRequest={() => setShowAuthModal(true)} />
      </div>
      <ThemeToggle />
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => setResult(null)}
          className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Search
        </button>

        {/* Stock Overview Card & Latest News Side-by-Side */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-stretch">
          <div className="lg:col-span-7">
            <CompanyHeader profile={result.companyProfile} />
          </div>
          <div className="lg:col-span-5">
            <StockNews ticker={result.ticker} companyName={result.companyProfile.companyName} />
          </div>
        </div>

        {/* Stock Price History Chart */}
        <StockPriceChart
          priceHistory={result.priceHistory || []}
          profile={result.companyProfile}
        />

        {/* Info Banner explaining Valuation vs Business Quality */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-4 mb-6 transition-all duration-300">
          <p className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
            <span className="text-lg">💡</span>
            <span>
              <strong>Valuation vs. Business Quality:</strong> These metrics evaluate different aspects. A company can have exceptional business fundamentals (high Business Quality) but be trading at an expensive stock price (low Valuation). Conversely, a weak or struggling business can be highly attractive on a valuation basis if the stock trades at a deep discount.
            </span>
          </p>
        </div>

        {/* Gauges Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ScoreGauge
            score={result.overallScore}
            confidence={result.dataConfidenceScore}
            unavailable={result.unavailableMetrics}
            scores={result.scores}
            title="Business Quality Score"
            description={
              result.overallScore >= 85
                ? "This company demonstrates excellent fundamentals with strong growth, profitability, and financial health."
                : result.overallScore >= 70
                  ? "This company shows good fundamentals with solid growth and reasonable debt levels."
                  : result.overallScore >= 50
                    ? "This company shows average fundamentals with mixed metrics across categories."
                    : "This company shows weak fundamentals with concerns across key metrics."
            }
          />
          <ScoreGauge
            score={result.overallValuationScore}
            confidence={result.valuationConfidenceScore}
            unavailable={result.unavailableValuationMetrics}
            valuationScores={result.valuationScores}
            title="Stock Valuation Score"
            description={
              result.overallValuationScore >= 80
                ? "The stock trades at multiples significantly below historical norms, indicating a potential margin of safety."
                : result.overallValuationScore >= 60
                  ? "The stock is priced reasonably relative to its sales, cash flow, and historical averages."
                  : result.overallValuationScore >= 40
                    ? "The stock trades at a slight premium, suggesting future growth is partially priced in."
                    : "The stock trades at high multiples relative to business fundamentals, posing a higher valuation risk."
            }
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
          <button
            onClick={() => setActiveTab("fundamentals")}
            className={`py-3 px-6 font-semibold text-sm transition-all duration-200 border-b-2 -mb-[2px] ${
              activeTab === "fundamentals"
                ? "border-blue-650 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            📊 Business Quality (Fundamentals)
          </button>
          <button
            onClick={() => setActiveTab("valuation")}
            className={`py-3 px-6 font-semibold text-sm transition-all duration-200 border-b-2 -mb-[2px] ${
              activeTab === "valuation"
                ? "border-blue-650 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            💰 Stock Valuation (Price)
          </button>
        </div>

        {/* Fundamentals Tab Content */}
        {activeTab === "fundamentals" && (
          <>
            {/* Detailed Metrics - Two Distinct Sections */}
            <div className="mb-10 space-y-10">
              {/* Section 1: Universal Business Quality Score */}
              <div className="p-6 bg-gradient-to-r from-blue-50/80 via-slate-50 to-emerald-50/60 dark:from-slate-900/90 dark:via-slate-900 dark:to-emerald-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-800/40 shadow-sm transition-all duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-blue-100 dark:border-blue-900/40">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xl">⭐</span>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Universal Business Quality Score
                      </h2>
                      <span className="px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 rounded-full border border-blue-200 dark:border-blue-700/50">
                        Primary Scoring (100% of Business Score)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      These 7 universal metrics apply broadly across all industries and directly determine the overall company rating.
                    </p>
                  </div>
                  {result.fcfHistory && result.fcfHistory.length > 0 && (
                    <button
                      onClick={() => setShowAllCharts(!showAllCharts)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-white hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-blue-200 dark:border-blue-800/50 rounded-lg shadow-sm transition-all duration-200"
                    >
                      <span>{showAllCharts ? "Hide All Trend Charts" : "Show All Trend Charts"}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllCharts ? "rotate-180" : ""}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MetricCard
                    title="ROIC"
                    value={result.metrics.roic}
                    unit="%"
                    score={result.scores.roic}
                    description="Return on Invested Capital"
                    tooltip="Measures the return a company earns on the capital invested in its business. Companies with consistently high ROIC often have strong competitive advantages and effective management."
                    icon="🎯"
                    chartData={result.roicHistory}
                    chartValueType="percent"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("roic")}
                    directionStrategy="higherIsBetter"
                  />
                  <MetricCard
                    title="FCF Margin"
                    value={result.metrics.fcfMargin}
                    unit="%"
                    score={result.scores.fcfMargin}
                    description="Free Cash Flow Margin"
                    tooltip="Measures how efficiently a company converts top-line revenue into bottom-line free cash flow. Higher margins indicate superior cash conversion."
                    icon="💵"
                    chartData={result.fcfMarginHistory}
                    chartValueType="percent"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("fcfMargin")}
                    directionStrategy="higherIsBetter"
                  />
                  <MetricCard
                    title="FCF Consistency"
                    value={result.metrics.fcfConsistency}
                    unit="%"
                    score={result.scores.fcfConsistency}
                    description="Reliability of FCF generation"
                    tooltip="Measures the consistency and reliability of positive free cash flow generation over historical years."
                    icon="🛡️"
                    chartData={result.fcfHistory}
                    chartValueType="currency"
                    chartType="bar"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("fcfConsistency")}
                    directionStrategy="higherIsBetter"
                  />
                  <MetricCard
                    title="FCF Conversion"
                    value={result.metrics.fcfConversion}
                    unit="%"
                    score={result.scores.fcfConversion}
                    description="FCF / Net Income Ratio"
                    tooltip="Measures the percentage of net income converted into real cash flow (FCF / Net Income). Ratios near or above 100% indicate high earnings quality."
                    icon="🔄"
                    chartData={result.fcfConversionHistory}
                    chartValueType="percent"
                    referenceLineValue={100}
                    referenceLineLabel="100% Target"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("fcfConversion")}
                    directionStrategy="higherIsBetter"
                  />
                  <MetricCard
                    title="Margin Stability"
                    value={result.metrics.marginStability}
                    unit="%"
                    score={result.scores.marginStability}
                    description="Operating profitability stability"
                    tooltip="Measures whether operating margins are stable, improving, or volatile over time."
                    icon="📊"
                    chartData={result.marginStabilityHistory}
                    chartValueType="percent"
                    referenceLineValue={
                      result.marginStabilityHistory && result.marginStabilityHistory.length > 0
                        ? result.marginStabilityHistory.reduce((a, b) => a + b.value, 0) / result.marginStabilityHistory.length
                        : undefined
                    }
                    referenceLineLabel={
                      result.marginStabilityHistory && result.marginStabilityHistory.length > 0
                        ? `Avg: ${(result.marginStabilityHistory.reduce((a, b) => a + b.value, 0) / result.marginStabilityHistory.length).toFixed(1)}%`
                        : undefined
                    }
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("marginStability")}
                    directionStrategy="higherIsBetter"
                  />
                  <MetricCard
                    title="Net Debt / FCF"
                    value={result.metrics.netDebtToFCF}
                    unit="x"
                    score={result.scores.netDebtToFCF}
                    description="Solvency & leverage ratio"
                    tooltip="Measures financial flexibility and ability to repay obligations using internally generated cash flow. Lower ratios indicate strong balance sheet health."
                    icon="🏦"
                    chartData={result.netDebtToFCFHistory}
                    chartValueType="number"
                    referenceLineValue={2.0}
                    referenceLineLabel="2.0x Target"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("netDebtToFCF")}
                    directionStrategy="lowerIsBetter"
                  />
                  <MetricCard
                    title="Share Dilution"
                    value={result.metrics.shareDilution}
                    unit="%"
                    score={result.scores.shareDilution}
                    description="Ownership change over time"
                    tooltip="Measures whether management creates or reduces shareholder ownership value over time through share buybacks or equity issuance."
                    icon="🪙"
                    chartData={result.shareDilutionHistory}
                    chartValueType="percent"
                    referenceLineValue={0}
                    referenceLineLabel="0% Baseline"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("shareDilution")}
                    directionStrategy="lowerIsBetter"
                  />
                  <MetricCard
                    title="Revenue Growth"
                    value={result.metrics.revenueCAGR}
                    unit="%"
                    score={result.scores.revenue}
                    description={result.revenueHistory && result.revenueHistory.length > 1 ? `${result.revenueHistory.length - 1}-year CAGR` : "CAGR"}
                    tooltip="The average yearly growth rate of the company's sales over the historical period. Consistent revenue growth can indicate increasing demand and a growing business."
                    icon="📈"
                    chartData={result.revenueHistory}
                    chartValueType="currency"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("revenue")}
                    directionStrategy="higherIsBetter"
                  />
                  <MetricCard
                    title="EPS Growth"
                    value={result.metrics.epsGrowth}
                    statusText={result.metrics.epsTrend}
                    changePct={result.metrics.epsChangePct}
                    unit="%"
                    score={result.scores.eps}
                    description={result.epsHistory && result.epsHistory.length > 1 ? `${result.epsHistory.length - 1}-year CAGR` : "CAGR"}
                    tooltip="The average yearly growth rate of the company's earnings per share over the historical period. Consistent EPS growth can indicate a company's ability to generate increasing profits."
                    icon="💹"
                    chartData={result.epsHistory}
                    chartValueType="currency"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("eps")}
                    directionStrategy="higherIsBetter"
                  />
                </div>
              </div>

              {/* Section 2: Supporting Business Insights */}
              <div className="p-6 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-300">
                <div className="mb-6 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xl">💡</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Supporting Business Insights
                    </h2>
                    <span className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 rounded-full border border-slate-300 dark:border-slate-700">
                      Informational — Excluded from Universal Score
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    These metrics provide additional financial analysis (such as leverage or profit margins) but do not alter the main Universal Score.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MetricCard
                    title="FCF Growth"
                    value={result.metrics.fcfGrowth}
                    statusText={result.metrics.fcfTrend}
                    changePct={result.metrics.fcfBurnChangePct}
                    unit="%"
                    score={result.scores.fcf}
                    description={result.fcfHistory && result.fcfHistory.length > 1 ? `${result.fcfHistory.length - 1}-year CAGR` : "CAGR"}
                    tooltip="The average yearly growth rate of the company's free cash flow over the historical period."
                    icon="💰"
                    chartData={result.fcfHistory}
                    chartValueType="currency"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("fcf")}
                    directionStrategy="higherIsBetter"
                    isInformational={true}
                  />
                  <MetricCard
                    title="Debt-to-Equity"
                    value={result.metrics.debtToEquity}
                    score={result.scores.debt}
                    description="Financial leverage"
                    tooltip="Shows how much the company relies on debt compared to its own money to fund the business."
                    icon="⚖️"
                    chartData={result.debtEquityHistory}
                    chartValueType="number"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("debt")}
                    directionStrategy="lowerIsBetter"
                    isInformational={true}
                  />
                  <MetricCard
                    title="Profitability"
                    value={result.metrics.netMargin}
                    unit="%"
                    score={result.scores.profitability}
                    description="Net profit margin"
                    tooltip="Shows how much profit the company keeps from each dollar of revenue after all expenses are paid."
                    icon="🏛️"
                    chartData={result.profitabilityHistory}
                    chartValueType="percent"
                    isExpanded={showAllCharts}
                    onClick={() => setSelectedMetric("profitability")}
                    directionStrategy="higherIsBetter"
                    isInformational={true}
                  />
                </div>
              </div>
            </div>

            {/* Detailed Financial Analysis Table */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Detailed Financial Analysis
              </h2>
              <AnalysisTable
                metrics={result.metrics}
                scores={result.scores}
                revenueYears={result.revenueHistory && result.revenueHistory.length > 1 ? result.revenueHistory.length - 1 : undefined}
                epsYears={result.epsHistory && result.epsHistory.length > 1 ? result.epsHistory.length - 1 : undefined}
                fcfYears={result.fcfHistory && result.fcfHistory.length > 1 ? result.fcfHistory.length - 1 : undefined}
              />
            </div>

            {/* Key Insights */}
            <div className="bg-white dark:bg-slate-800 border border-transparent dark:border-slate-700/50 rounded-lg shadow-lg p-8 mb-8 transition-colors duration-300">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Key Insights
              </h2>
              <div className="space-y-4 text-slate-600 dark:text-slate-300">
                {result.metrics.revenueCAGR !== null && (
                  <p>
                    <strong>Revenue Trend:</strong> The company's revenue has grown
                    at a CAGR of {(result.metrics.revenueCAGR * 100).toFixed(2)}%
                    over the past 10 years.{" "}
                    {result.metrics.revenueCAGR > 0.15
                      ? "This demonstrates excellent revenue growth."
                      : result.metrics.revenueCAGR > 0.08
                        ? "This represents solid revenue growth."
                        : "This growth rate is moderate."}
                  </p>
                )}
                {result.metrics.debtToEquity !== null && (
                  <p>
                    <strong>Financial Health:</strong> With a debt-to-equity ratio
                    of {result.metrics.debtToEquity.toFixed(2)}, the company{" "}
                    {result.metrics.debtToEquity < 0.5
                      ? "maintains conservative leverage with low financial risk."
                      : result.metrics.debtToEquity <= 1
                        ? "operates with reasonable leverage."
                        : "carries elevated debt levels relative to equity."}
                  </p>
                )}
                {result.metrics.netMargin !== null && (
                  <p>
                    <strong>Profitability:</strong> The company maintains a net
                    profit margin of {result.metrics.netMargin.toFixed(2)}%,
                    indicating{" "}
                    {result.metrics.netMargin >= 10
                      ? "strong"
                      : result.metrics.netMargin >= 5
                        ? "adequate"
                        : "modest"}{" "}
                    profitability.
                  </p>
                )}
                {result.metrics.fcfGrowth !== null && (
                  <p>
                    <strong>Cash Generation:</strong> Free cash flow has grown at{" "}
                    {(result.metrics.fcfGrowth * 100).toFixed(2)}% CAGR, showing{" "}
                    {result.metrics.fcfGrowth > 0.1
                      ? "excellent cash generation capability."
                      : result.metrics.fcfGrowth > 0.05
                        ? "solid cash flow expansion."
                        : "moderate cash flow trends."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Valuation Tab Content */}
        {activeTab === "valuation" && (
          <>
            {/* Valuation Metrics */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Valuation Metrics
                </h2>
                {result.peHistory && result.peHistory.length > 0 && (
                  <button
                    onClick={() => setShowAllCharts(!showAllCharts)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/60 border border-blue-100 dark:border-blue-800/40 rounded-lg shadow-sm transition-all duration-200"
                  >
                    <span>{showAllCharts ? "Hide All Trend Charts" : "Show All Trend Charts"}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                      className={`w-3 h-3 transition-transform duration-200 ${showAllCharts ? "rotate-180" : ""}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="P/E Ratio"
                  value={result.valuationMetrics.peRatio}
                  score={result.valuationScores.pe}
                  description="Price to Earnings"
                  tooltip="Calculates the share price divided by earnings per share. A high P/E ratio indicates that investors expect higher earnings growth in the future."
                  icon="🏷️"
                  chartData={result.peHistory}
                  chartValueType="number"
                  isExpanded={showAllCharts}
                  onClick={() => setSelectedMetric("pe")}
                  directionStrategy="lowerIsBetter"
                />
                <MetricCard
                  title="P/S Ratio"
                  value={result.valuationMetrics.priceToSalesRatio}
                  score={result.valuationScores.ps}
                  description="Price to Sales"
                  tooltip="Shows how much the market values every dollar of the company's sales. Helpful for valuing growth companies without consistent earnings."
                  icon="📢"
                  chartData={result.psHistory}
                  chartValueType="number"
                  isExpanded={showAllCharts}
                  onClick={() => setSelectedMetric("ps")}
                  directionStrategy="lowerIsBetter"
                />
                <MetricCard
                  title="EV/Sales"
                  value={result.valuationMetrics.evToSales}
                  score={result.valuationScores.evs}
                  description="Enterprise Value to Sales"
                  tooltip="Compares enterprise value (market capitalization + debt - cash) to annual revenue. More robust than P/S as it accounts for balance sheet debt."
                  icon="🏢"
                  chartData={result.evsHistory}
                  chartValueType="number"
                  isExpanded={showAllCharts}
                  onClick={() => setSelectedMetric("evs")}
                  directionStrategy="lowerIsBetter"
                />
                <MetricCard
                  title="P/FCF Ratio"
                  value={result.valuationMetrics.priceToFreeCashFlowsRatio}
                  score={result.valuationScores.pfcf}
                  description="Price to Free Cash Flow"
                  tooltip="Compares stock price to free cash flow. Since cash flow is harder to manipulate than accounting earnings, it is a highly reliable valuation ratio."
                  icon="💸"
                  chartData={result.pfcfHistory}
                  chartValueType="number"
                  isExpanded={showAllCharts}
                  onClick={() => setSelectedMetric("pfcf")}
                  directionStrategy="lowerIsBetter"
                />
                <MetricCard
                  title="Historical Valuation Premium"
                  value={result.valuationMetrics.averagePremium !== null ? result.valuationMetrics.averagePremium * 100 : null}
                  unit="%"
                  score={result.valuationScores.historical}
                  description="Vs. Historical Average"
                  tooltip="Measures the average premium or discount of the current valuation multiples compared to their historical averages."
                  icon="⏳"
                  chartData={result.valuationPremiumHistory}
                  chartValueType="percent"
                  isExpanded={showAllCharts}
                  onClick={() => setSelectedMetric("historical")}
                  directionStrategy="lowerIsBetter"
                />
              </div>
            </div>

            {/* Valuation Table */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Detailed Valuation Analysis
              </h2>
              <ValuationTable
                valuationMetrics={result.valuationMetrics}
                valuationScores={result.valuationScores}
              />
            </div>

            {/* Valuation Insights */}
            <div className="bg-white dark:bg-slate-800 border border-transparent dark:border-slate-700/50 rounded-lg shadow-lg p-8 mb-8 transition-colors duration-300">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Valuation Insights
              </h2>
              <div className="space-y-4 text-slate-600 dark:text-slate-300">
                <p>
                  <strong>Current Valuation Stance:</strong> According to our scoring system, the stock's valuation is rated as{" "}
                  <strong className={
                    result.overallValuationScore >= 80 ? "text-green-600 dark:text-green-400" :
                    result.overallValuationScore >= 60 ? "text-blue-600 dark:text-blue-400" :
                    result.overallValuationScore >= 40 ? "text-amber-600 dark:text-amber-400" :
                    "text-red-600 dark:text-red-400"
                  }>
                    {getValuationAnalysis(result.overallValuationScore).label}
                  </strong>.
                </p>
                {result.valuationMetrics.peRatio !== null && (
                  <p>
                    <strong>P/E Multiple:</strong> The P/E ratio is currently{" "}
                    {result.valuationMetrics.peRatio.toFixed(2)}x.{" "}
                    {result.valuationMetrics.peRatio <= 15
                      ? "This is historically considered attractive and undervalued."
                      : result.valuationMetrics.peRatio <= 25
                        ? "This represents a reasonable price for a stable company."
                        : "This indicates a premium valuation, requiring robust future growth to justify."}
                  </p>
                )}
                {result.valuationMetrics.averagePremium !== null && (
                  <p>
                    <strong>Historical Comparison:</strong> The current stock valuation represents a{" "}
                    <strong>
                      {result.valuationMetrics.averagePremium >= 0 ? "premium of " : "discount of "}
                      {Math.abs(result.valuationMetrics.averagePremium * 100).toFixed(1)}%
                    </strong>{" "}
                    against its 10-year historical multiples.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-slate-600 dark:text-slate-400 text-sm mb-8">
          <p>
            This analysis is based on financial data from Financial Modeling
            Prep API and is intended for educational purposes. It does not
            constitute investment advice.
          </p>
          <p className="mt-2">
            <button
              onClick={() => setResult(null)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Analyze another stock
            </button>
          </p>
        </div>

        {/* Metric Detail Modal */}
        {selectedMetric && result && (
          <MetricDetailModal
            metricKey={selectedMetric}
            result={result}
            onClose={() => setSelectedMetric(null)}
          />
        )}

        {/* Auth Modal for Quota Limits or Manual Login */}
        {showAuthModal && (
          <AuthModal
            onLoginSuccess={handleAuthSuccess}
            onClose={() => {
              setShowAuthModal(false);
              setAuthPromptMessage(null);
            }}
            customPrompt={authPromptMessage}
          />
        )}
      </div>
    </div>
  );
}

export default App;
