import { useState, useCallback } from "react";
import { StockSearch } from "./components/StockSearch";
import { CompanyHeader } from "./components/CompanyHeader";
import { ScoreGauge } from "./components/ScoreGauge";
import { MetricCard } from "./components/MetricCard";
import { AnalysisTable } from "./components/AnalysisTable";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorMessage } from "./components/ErrorMessage";
import { ProfileOnlyPage } from "./components/ProfileOnlyPage";
import { fmpService } from "./services/financialModelingPrep";
import { calculateAllMetrics } from "./utils/financialCalculations";
import { calculateMetricScores, calculateOverallScore } from "./utils/scoring";
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

  const handleSearch = useCallback(async (ticker: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const profile = await fmpService.getCompanyProfile(ticker);

      try {
        const {
          incomeStatements,
          balanceSheets,
          cashFlowStatements,
          dividendHistory,
        } = await fmpService.getStatementData(ticker);

        const metrics = calculateAllMetrics(
          incomeStatements,
          balanceSheets,
          cashFlowStatements,
          dividendHistory,
        );
        const scores = calculateMetricScores(metrics);
        const overallScore = calculateOverallScore(scores);

        setResult({
          ticker,
          companyProfile: profile,
          metrics,
          scores,
          overallScore,
          analysis: `${profile.companyName} has a quality score of ${overallScore}/100`,
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
    return <LoadingSpinner message="Analyzing company fundamentals..." />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="Analysis Failed"
        message={error}
        onRetry={handleRetry}
      />
    );
  }

  if (!result && !profileOnly) {
    return <StockSearch onSearch={handleSearch} isLoading={isLoading} />;
  }

  if (profileOnly) {
    return (
      <ProfileOnlyPage
        profile={profileOnly.profile}
        message={profileOnly.message}
        onBack={() => {
          setProfileOnly(null);
          setResult(null);
        }}
      />
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => setResult(null)}
          className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
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

        {/* Overall Score */}
        <ScoreGauge score={result.overallScore} />

        {/* Detailed Metrics */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Fundamental Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Revenue Growth"
              value={result.metrics.revenueCAGR}
              unit="%"
              score={result.scores.revenue}
              description="5-year CAGR"
              tooltip="How much revenue has grown on average each year over the past five years."
              icon="📊"
            />
            <MetricCard
              title="EPS Growth"
              value={result.metrics.epsGrowth}
              unit="%"
              score={result.scores.eps}
              description="5-year CAGR"
              tooltip="How much earnings per share have grown on average each year over the past five years."
              icon="💹"
            />
            <MetricCard
              title="FCF Growth"
              value={result.metrics.fcfGrowth}
              unit="%"
              score={result.scores.fcf}
              description="5-year CAGR"
              tooltip="How much free cash flow has grown on average each year over the past five years."
              icon="💰"
            />
            <MetricCard
              title="ROIC"
              value={result.metrics.roic}
              unit="%"
              score={result.scores.roic}
              description="Return on Invested Capital"
              tooltip="How efficiently the company turns invested capital into profit."
              icon="🎯"
            />
            <MetricCard
              title="Debt-to-Equity"
              value={result.metrics.debtToEquity}
              score={result.scores.debt}
              description="Financial leverage"
              tooltip="How much debt the company uses compared to shareholders' equity."
              icon="⚖️"
            />
            <MetricCard
              title="Profitability"
              value={result.metrics.netMargin}
              unit="%"
              score={result.scores.profitability}
              description="Net profit margin"
              tooltip="How much profit the company keeps from each dollar of revenue."
              icon="📈"
            />
            <MetricCard
              title="Dividends"
              value={result.metrics.dividendCAGR}
              unit="%"
              score={result.scores.dividends}
              description="5-year CAGR"
              tooltip="How much the company's dividends have grown on average each year over the past five years."
              icon="💵"
            />
          </div>
        </div>

        {/* Detailed Analysis Table */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Detailed Financial Analysis
          </h2>
          <AnalysisTable metrics={result.metrics} scores={result.scores} />
        </div>

        {/* Key Insights */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Key Insights
          </h2>
          <div className="space-y-4 text-slate-600">
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

        {/* Footer */}
        <div className="text-center text-slate-600 text-sm mb-8">
          <p>
            This analysis is based on financial data from Financial Modeling
            Prep API and is intended for educational purposes. It does not
            constitute investment advice.
          </p>
          <p className="mt-2">
            <button
              onClick={() => setResult(null)}
              className="text-blue-600 hover:underline"
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
