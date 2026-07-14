import { useState, useCallback } from "react";
import { StockSearch } from "./components/StockSearch";
import { ThemeToggle } from "./components/ThemeToggle";
import { CompanyHeader } from "./components/CompanyHeader";
import { ScoreGauge } from "./components/ScoreGauge";
import { MetricCard } from "./components/MetricCard";
import { AnalysisTable } from "./components/AnalysisTable";
import { ValuationTable } from "./components/ValuationTable";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorMessage } from "./components/ErrorMessage";
import { ProfileOnlyPage } from "./components/ProfileOnlyPage";
import { fmpService } from "./services/financialModelingPrep";
import { calculateAllMetrics } from "./utils/financialCalculations";
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

function App() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [profileOnly, setProfileOnly] = useState<{
    ticker: string;
    profile: any;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"fundamentals" | "valuation">("fundamentals");

  const handleSearch = useCallback(async (ticker: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveTab("fundamentals");

    try {
      const profile = await fmpService.getCompanyProfile(ticker);

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
        const scores = calculateMetricScores(metrics);
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

        setResult({
          ticker,
          companyProfile: profile,
          metrics,
          scores,
          overallScore,
          analysis: `${profile.companyName} has a quality score of ${overallScore}/100`,
          dataConfidenceScore,
          unavailableMetrics,
          
          valuationMetrics,
          valuationScores,
          overallValuationScore,
          valuationConfidenceScore,
          unavailableValuationMetrics,
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
      setError(err.message || "An error occurred while analyzing the stock");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setResult(null);
    setProfileOnly(null);
  }, []);

  if (isLoading) {
    return (
      <>
        <ThemeToggle />
        <LoadingSpinner message="Analyzing company fundamentals..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <ThemeToggle />
        <ErrorMessage
          title="Analysis Failed"
          message={error}
          onRetry={handleRetry}
        />
      </>
    );
  }

  if (!result && !profileOnly) {
    return (
      <>
        <ThemeToggle />
        <StockSearch onSearch={handleSearch} isLoading={isLoading} />
      </>
    );
  }

  if (profileOnly) {
    return (
      <>
        <ThemeToggle />
        <ProfileOnlyPage
          profile={profileOnly.profile}
          message={profileOnly.message}
          onBack={() => {
            setProfileOnly(null);
            setResult(null);
          }}
        />
      </>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 py-8 px-4 transition-colors duration-300">
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

        {/* Company Header */}
        <CompanyHeader profile={result.companyProfile} />

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
            {/* Detailed Metrics */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Fundamental Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="Revenue Growth"
                  value={result.metrics.revenueCAGR}
                  unit="%"
                  score={result.scores.revenue}
                  description="5-year CAGR"
                  tooltip="The average yearly growth rate of the company's sales over the past five years. Consistent revenue growth can indicate increasing demand and a growing business."
                  icon="📊"
                />
                <MetricCard
                  title="EPS Growth"
                  value={result.metrics.epsGrowth}
                  unit="%"
                  score={result.scores.eps}
                  description="5-year CAGR"
                  tooltip="The average yearly growth rate of the company's earnings per share over the past five years. Consistent EPS growth can indicate a company's ability to generate increasing profits."
                  icon="💹"
                />
                <MetricCard
                  title="FCF Growth"
                  value={result.metrics.fcfGrowth}
                  unit="%"
                  score={result.scores.fcf}
                  description="5-year CAGR"
                  tooltip="The average yearly growth rate of the company's free cash flow over the past five years. Free cash flow shows how much cash the business generates after paying for expenses and investments needed to keep growing."
                  icon="💰"
                />
                <MetricCard
                  title="ROIC"
                  value={result.metrics.roic}
                  unit="%"
                  score={result.scores.roic}
                  description="Return on Invested Capital"
                  tooltip="Measures the return a company earns on the capital invested in its business. Companies with consistently high ROIC often have strong competitive advantages and effective management."
                  icon="🎯"
                />
                <MetricCard
                  title="Debt-to-Equity"
                  value={result.metrics.debtToEquity}
                  score={result.scores.debt}
                  description="Financial leverage"
                  tooltip="Shows how much the company relies on debt compared to its own money to fund the business. Lower debt levels generally indicate a more financially stable company"
                  icon="⚖️"
                />
                <MetricCard
                  title="Profitability"
                  value={result.metrics.netMargin}
                  unit="%"
                  score={result.scores.profitability}
                  description="Net profit margin"
                  tooltip="Shows how much profit the company keeps from each dollar of revenue after all expenses are paid. Higher margins often indicate a more efficient and profitable business."
                  icon="📈"
                />

              </div>
            </div>

            {/* Detailed Financial Analysis Table */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Detailed Financial Analysis
              </h2>
              <AnalysisTable metrics={result.metrics} scores={result.scores} />
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
                    over the past 5 years.{" "}
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
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Valuation Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="P/E Ratio"
                  value={result.valuationMetrics.peRatio}
                  score={result.valuationScores.pe}
                  description="Price to Earnings"
                  tooltip="Calculates the share price divided by earnings per share. A high P/E ratio indicates that investors expect higher earnings growth in the future."
                  icon="🏷️"
                />
                <MetricCard
                  title="P/S Ratio"
                  value={result.valuationMetrics.priceToSalesRatio}
                  score={result.valuationScores.ps}
                  description="Price to Sales"
                  tooltip="Shows how much the market values every dollar of the company's sales. Helpful for valuing growth companies without consistent earnings."
                  icon="📢"
                />
                <MetricCard
                  title="EV/Sales"
                  value={result.valuationMetrics.evToSales}
                  score={result.valuationScores.evs}
                  description="Enterprise Value to Sales"
                  tooltip="Compares enterprise value (market capitalization + debt - cash) to annual revenue. More robust than P/S as it accounts for balance sheet debt."
                  icon="🏢"
                />
                <MetricCard
                  title="P/FCF Ratio"
                  value={result.valuationMetrics.priceToFreeCashFlowsRatio}
                  score={result.valuationScores.pfcf}
                  description="Price to Free Cash Flow"
                  tooltip="Compares stock price to free cash flow. Since cash flow is harder to manipulate than accounting earnings, it is a highly reliable valuation ratio."
                  icon="💸"
                />
                <MetricCard
                  title="Historical Valuation Premium"
                  value={result.valuationMetrics.averagePremium !== null ? result.valuationMetrics.averagePremium * 100 : null}
                  unit="%"
                  score={result.valuationScores.historical}
                  description="Vs. 5-Year Average"
                  tooltip="Measures the average premium or discount of the current valuation multiples compared to their 5-year historical averages."
                  icon="⏳"
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
                    against its 5-year historical multiples.
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
      </div>
    </div>
  );
}

export default App;
