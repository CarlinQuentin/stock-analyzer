import React, { useEffect } from "react";
import { AnalysisResult } from "../types";

const getScoreCategory = (score: number): { label: string; color: string } => {
  if (score >= 85) return { label: "Excellent", color: "green" };
  if (score >= 70) return { label: "Good", color: "blue" };
  if (score >= 50) return { label: "Average", color: "yellow" };
  return { label: "Poor", color: "red" };
};

interface MetricDetailModalProps {
  metricKey: string;
  result: AnalysisResult;
  onClose: () => void;
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({
  metricKey,
  result,
  onClose,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Extract config based on metric key
  const getConfig = () => {
    const defaultData = {
      title: "Metric Details",
      icon: "📊",
      score: 0,
      value: null as number | null,
      unit: "",
      chartData: [] as { label: string; value: number }[],
      chartValueType: "currency" as "currency" | "percent" | "number",
      directionStrategy: "higherIsBetter" as "higherIsBetter" | "lowerIsBetter",
      description: "",
      formula: "",
      mathExplanation: [] as string[],
      whyItMatters: "",
      tiers: [] as { label: string; range: string; color: string }[],
      getInsights: () => "No automated insights available.",
    };

    switch (metricKey) {
      case "revenue": {
        const revYears = (result.revenueHistory || []).length > 1 ? (result.revenueHistory || []).length - 1 : 0;
        return {
          ...defaultData,
          title: "Revenue Growth",
          icon: "📊",
          score: result.scores.revenue,
          value: result.metrics.revenueCAGR,
          unit: "%",
          chartData: result.revenueHistory || [],
          chartValueType: "currency" as const,
          description: revYears > 0 
            ? `${revYears}-Year Compound Annual Growth Rate (CAGR) of top-line revenue.`
            : "Compound Annual Growth Rate (CAGR) of top-line revenue.",
          formula: "CAGR = (Ending Revenue / Beginning Revenue) ^ (1 / n) - 1",
          mathExplanation: getMathCAGRExplanation(result.revenueHistory || [], "currency", result.metrics.revenueCAGR),
          whyItMatters: "Revenue growth (the 'top-line') measures the expansion of a company's business. It shows customer demand, market share expansion, and pricing power. Without revenue growth, profit growth is limited and must come from cost-cutting, which is unsustainable long-term.",
          tiers: [
            { label: "Excellent", range: "> 15%", color: "text-green-500" },
            { label: "Good", range: "8% - 15%", color: "text-blue-500" },
            { label: "Average", range: "5% - 8%", color: "text-amber-500" },
            { label: "Poor", range: "< 5%", color: "text-red-500" },
          ],
          getInsights: () => analyzeGrowthHistory(result.revenueHistory || [], "revenue"),
        };
      }
      case "eps": {
        const epsYears = (result.epsHistory || []).length > 1 ? (result.epsHistory || []).length - 1 : 0;
        return {
          ...defaultData,
          title: "EPS Growth",
          icon: "💹",
          score: result.scores.eps,
          value: result.metrics.epsGrowth,
          unit: "%",
          chartData: result.epsHistory || [],
          chartValueType: "currency" as const,
          description: epsYears > 0 
            ? `${epsYears}-Year Compound Annual Growth Rate (CAGR) of Earnings Per Share (EPS).`
            : "Compound Annual Growth Rate (CAGR) of Earnings Per Share (EPS).",
          formula: "CAGR = (Ending EPS / Beginning EPS) ^ (1 / n) - 1",
          mathExplanation: getMathCAGRExplanation(result.epsHistory || [], "currency", result.metrics.epsGrowth),
          whyItMatters: "Earnings Per Share (EPS) growth shows how efficiently a company translates top-line growth into bottom-line profits for shareholders. EPS growth can be driven by expanding profit margins or by share repurchases (buybacks) reducing the share count.",
          tiers: [
            { label: "Excellent", range: "> 15%", color: "text-green-500" },
            { label: "Good", range: "8% - 15%", color: "text-blue-500" },
            { label: "Average", range: "5% - 8%", color: "text-amber-500" },
            { label: "Poor", range: "< 5%", color: "text-red-500" },
          ],
          getInsights: () => analyzeGrowthHistory(result.epsHistory || [], "earnings per share"),
        };
      }
      case "fcf": {
        const fcfYears = (result.fcfHistory || []).length > 1 ? (result.fcfHistory || []).length - 1 : 0;
        return {
          ...defaultData,
          title: "FCF Growth",
          icon: "💰",
          score: result.scores.fcf,
          value: result.metrics.fcfGrowth,
          unit: "%",
          chartData: result.fcfHistory || [],
          chartValueType: "currency" as const,
          description: fcfYears > 0 
            ? `${fcfYears}-Year Compound Annual Growth Rate (CAGR) of Free Cash Flow (FCF).`
            : "Compound Annual Growth Rate (CAGR) of Free Cash Flow (FCF).",
          formula: "CAGR = (Ending FCF / Beginning FCF) ^ (1 / n) - 1",
          mathExplanation: getMathCAGRExplanation(result.fcfHistory || [], "currency", result.metrics.fcfGrowth),
          whyItMatters: "Free Cash Flow represents the actual cash a company generates after accounting for cash outflows to support operations and maintain capital assets. Consistent FCF growth gives a company the flexibility to pay dividends, buy back shares, reduce debt, or reinvest in growth.",
          tiers: [
            { label: "Excellent", range: "> 15%", color: "text-green-500" },
            { label: "Good", range: "8% - 15%", color: "text-blue-500" },
            { label: "Average", range: "5% - 8%", color: "text-amber-500" },
            { label: "Poor", range: "< 5%", color: "text-red-500" },
          ],
          getInsights: () => analyzeGrowthHistory(result.fcfHistory || [], "free cash flow"),
        };
      }
      case "roic":
        return {
          ...defaultData,
          title: "Return on Invested Capital (ROIC)",
          icon: "🎯",
          score: result.scores.roic,
          value: result.metrics.roic,
          unit: "%",
          chartData: result.roicHistory || [],
          chartValueType: "percent" as const,
          description: "Measures a company's efficiency in allocating capital to profitable investments.",
          formula: "ROIC = Net Operating Profit After Tax (NOPAT) / Invested Capital",
          mathExplanation: getROICMathExplanation(result.metrics.roic, result.roicHistory || []),
          whyItMatters: "ROIC is one of the most reliable indicators of a company's competitive advantage (moat) and quality of management. High ROIC companies create value by earning returns far above their cost of capital, compounding shareholder value over time.",
          tiers: [
            { label: "Excellent", range: "> 15%", color: "text-green-500" },
            { label: "Good", range: "10% - 15%", color: "text-blue-500" },
            { label: "Average", range: "6% - 10%", color: "text-amber-500" },
            { label: "Poor", range: "< 6%", color: "text-red-500" },
          ],
          getInsights: () => analyzeEfficiencyHistory(result.roicHistory || [], "ROIC", 15),
        };
      case "debt":
        return {
          ...defaultData,
          title: "Debt-to-Equity Ratio",
          icon: "⚖️",
          score: result.scores.debt,
          value: result.metrics.debtToEquity,
          unit: "",
          chartData: result.debtEquityHistory || [],
          chartValueType: "number" as const,
          directionStrategy: "lowerIsBetter" as const,
          description: "Calculates the proportion of debt compared to shareholders' equity.",
          formula: "Debt-to-Equity = Total Debt / Total Shareholders' Equity",
          mathExplanation: getLatestMathExplanation(result.metrics.debtToEquity, result.debtEquityHistory || [], "Debt-to-Equity", ""),
          whyItMatters: "Debt-to-Equity evaluates a company's financial leverage and solvency risk. A lower ratio suggests a more stable, self-funding business that is less exposed to interest rate cycles and bankruptcy risk. However, optimal leverage varies by industry.",
          tiers: [
            { label: "Excellent", range: "< 0.50", color: "text-green-500" },
            { label: "Good", range: "0.50 - 1.50", color: "text-blue-500" },
            { label: "Average", range: "1.50 - 3.00", color: "text-amber-500" },
            { label: "Poor", range: "> 3.00", color: "text-red-500" },
          ],
          getInsights: () => analyzeLeverageHistory(result.debtEquityHistory || []),
        };
      case "profitability":
        return {
          ...defaultData,
          title: "Profitability (Net Margin)",
          icon: "📈",
          score: result.scores.profitability,
          value: result.metrics.netMargin,
          unit: "%",
          chartData: result.profitabilityHistory || [],
          chartValueType: "percent" as const,
          description: "Reflects the company's average Net Income divided by total Revenue.",
          formula: "Net Profit Margin = Net Income / Revenue",
          mathExplanation: getAverageMathExplanation(result.metrics.netMargin, result.profitabilityHistory || [], "%"),
          whyItMatters: "Net profit margin indicates how much of each dollar earned translates directly into profits. Expansion of margins indicates operating leverage, pricing power, and an expanding economic moat.",
          tiers: [
            { label: "Excellent", range: "> 15%", color: "text-green-500" },
            { label: "Good", range: "8% - 15%", color: "text-blue-500" },
            { label: "Average", range: "5% - 8%", color: "text-amber-500" },
            { label: "Poor", range: "< 5%", color: "text-red-500" },
          ],
          getInsights: () => analyzeEfficiencyHistory(result.profitabilityHistory || [], "Net Margin", 15),
        };
      case "pe":
        return {
          ...defaultData,
          title: "P/E Ratio",
          icon: "🏷️",
          score: result.valuationScores.pe,
          value: result.valuationMetrics.peRatio,
          unit: "",
          chartData: result.peHistory || [],
          chartValueType: "number" as const,
          directionStrategy: "lowerIsBetter" as const,
          description: "Price-to-Earnings Ratio over historical fiscal periods.",
          formula: "P/E Ratio = Stock Price / Earnings Per Share (EPS)",
          mathExplanation: getLatestMathExplanation(result.valuationMetrics.peRatio, result.peHistory || [], "P/E Ratio", "x"),
          whyItMatters: "The P/E ratio evaluates how much investors are paying per dollar of current earnings. A lower P/E ratio suggests a cheaper valuation relative to profits.",
          tiers: [
            { label: "Excellent", range: "< 10.0x", color: "text-green-500" },
            { label: "Good", range: "10.0x - 20.0x", color: "text-blue-500" },
            { label: "Average", range: "20.0x - 35.0x", color: "text-amber-500" },
            { label: "Poor", range: "> 35.0x", color: "text-red-500" },
          ],
          getInsights: () => analyzeValuationHistory(result.peHistory || [], "P/E Ratio", 15, 30),
        };
      case "ps":
        return {
          ...defaultData,
          title: "P/S Ratio",
          icon: "📢",
          score: result.valuationScores.ps,
          value: result.valuationMetrics.priceToSalesRatio,
          unit: "",
          chartData: result.psHistory || [],
          chartValueType: "number" as const,
          directionStrategy: "lowerIsBetter" as const,
          description: "Price-to-Sales Ratio over historical fiscal periods.",
          formula: "P/S Ratio = Market Capitalization / Total Revenue",
          mathExplanation: getLatestMathExplanation(result.valuationMetrics.priceToSalesRatio, result.psHistory || [], "P/S Ratio", "x"),
          whyItMatters: "The P/S ratio evaluates market valuation relative to total sales. It is particularly useful for growth or cyclical companies where earnings may fluctuate.",
          tiers: [
            { label: "Excellent", range: "< 1.5x", color: "text-green-500" },
            { label: "Good", range: "1.5x - 3.5x", color: "text-blue-500" },
            { label: "Average", range: "3.5x - 6.0x", color: "text-amber-500" },
            { label: "Poor", range: "> 6.0x", color: "text-red-500" },
          ],
          getInsights: () => analyzeValuationHistory(result.psHistory || [], "P/S Ratio", 2, 5),
        };
      case "evs":
        return {
          ...defaultData,
          title: "EV/Sales Ratio",
          icon: "🏢",
          score: result.valuationScores.evs,
          value: result.valuationMetrics.evToSales,
          unit: "",
          chartData: result.evsHistory || [],
          chartValueType: "number" as const,
          directionStrategy: "lowerIsBetter" as const,
          description: "Enterprise Value to Sales Ratio.",
          formula: "EV/Sales = (Market Cap + Total Debt - Cash) / Revenue",
          mathExplanation: getLatestMathExplanation(result.valuationMetrics.evToSales, result.evsHistory || [], "EV/Sales Ratio", "x"),
          whyItMatters: "EV/Sales accounts for debt and cash balances on the balance sheet, providing a more accurate takeover valuation metric than P/S.",
          tiers: [
            { label: "Excellent", range: "< 1.5x", color: "text-green-500" },
            { label: "Good", range: "1.5x - 3.5x", color: "text-blue-500" },
            { label: "Average", range: "3.5x - 6.0x", color: "text-amber-500" },
            { label: "Poor", range: "> 6.0x", color: "text-red-500" },
          ],
          getInsights: () => analyzeValuationHistory(result.evsHistory || [], "EV/Sales Ratio", 2, 5),
        };
      case "pfcf":
        return {
          ...defaultData,
          title: "P/FCF Ratio",
          icon: "💸",
          score: result.valuationScores.pfcf,
          value: result.valuationMetrics.priceToFreeCashFlowsRatio,
          unit: "",
          chartData: result.pfcfHistory || [],
          chartValueType: "number" as const,
          directionStrategy: "lowerIsBetter" as const,
          description: "Price to Free Cash Flow Ratio.",
          formula: "P/FCF = Market Capitalization / Free Cash Flow",
          mathExplanation: getLatestMathExplanation(result.valuationMetrics.priceToFreeCashFlowsRatio, result.pfcfHistory || [], "P/FCF Ratio", "x"),
          whyItMatters: "Cash flow is much harder to manipulate than accounting earnings. A low P/FCF ratio indicates strong free cash generation relative to stock valuation.",
          tiers: [
            { label: "Excellent", range: "< 12.0x", color: "text-green-500" },
            { label: "Good", range: "12.0x - 20.0x", color: "text-blue-500" },
            { label: "Average", range: "20.0x - 35.0x", color: "text-amber-500" },
            { label: "Poor", range: "> 35.0x", color: "text-red-500" },
          ],
          getInsights: () => analyzeValuationHistory(result.pfcfHistory || [], "P/FCF Ratio", 15, 30),
        };
      case "historical":
        return {
          ...defaultData,
          title: "Historical Valuation Premium",
          icon: "⏳",
          score: result.valuationScores.historical,
          value: result.valuationMetrics.averagePremium !== null ? result.valuationMetrics.averagePremium * 100 : null,
          unit: "%",
          chartData: result.valuationPremiumHistory || [],
          chartValueType: "percent" as const,
          directionStrategy: "lowerIsBetter" as const,
          description: "Percentage premium or discount compared to historical mean multiples.",
          formula: "Premium % = (Current Multiples - Historical Avg Multiples) / Historical Avg Multiples",
          mathExplanation: getAverageMathExplanation(result.valuationMetrics.averagePremium !== null ? result.valuationMetrics.averagePremium * 100 : null, result.valuationPremiumHistory || [], "%"),
          whyItMatters: "Comparing current multiples against historical averages shows whether a stock is trading at a discount or premium relative to its own valuation history.",
          tiers: [
            { label: "Excellent", range: "< -15%", color: "text-green-500" },
            { label: "Good", range: "-15% - +10%", color: "text-blue-500" },
            { label: "Average", range: "+10% - +25%", color: "text-amber-500" },
            { label: "Poor", range: "> +25%", color: "text-red-500" },
          ],
          getInsights: () => analyzeValuationHistory(result.valuationPremiumHistory || [], "Valuation Premium", 0, 20),
        };
      default:
        return defaultData;
    }
  };


  const formatChartValue = (val: number, type: "currency" | "percent" | "number" = "currency"): string => {
    if (type === "percent") {
      return `${val.toFixed(1)}%`;
    }
    if (type === "number") {
      return val.toFixed(2);
    }
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    let text = "";
    if (absVal >= 1e9) {
      text = `${(absVal / 1e9).toFixed(1)}B`;
    } else if (absVal >= 1e6) {
      text = `${(absVal / 1e6).toFixed(1)}M`;
    } else {
      text = absVal.toFixed(2);
    }
    return (isNegative ? "-" : "") + "$" + text;
  };

  // Math Explanations generators
  function getMathCAGRExplanation(
    data: { label: string; value: number }[],
    type: "currency" | "percent" | "number",
    actualCAGR: number | null
  ): string[] {
    if (data.length < 2) return ["Insufficient historical data to calculate CAGR."];
    const first = data[0];
    const last = data[data.length - 1];
    const n = data.length - 1;

    if (first.value <= 0) {
      return [
        `1. Beginning Value (${first.label}): ${formatChartValue(first.value, type)}`,
        `2. Ending Value (${last.label}): ${formatChartValue(last.value, type)}`,
        `3. Period (n): ${n} years (from ${first.label} to ${last.label})`,
        `4. Note: CAGR cannot be calculated when the starting baseline value is zero or negative.`,
      ];
    }

    const ratio = last.value / first.value;
    const finalPct = actualCAGR !== null ? (actualCAGR * 100).toFixed(2) : ((Math.pow(ratio, 1 / n) - 1) * 100).toFixed(2);

    return [
      `1. Beginning Value (${first.label}): ${formatChartValue(first.value, type)}`,
      `2. Ending Value (${last.label}): ${formatChartValue(last.value, type)}`,
      `3. Period (n): ${n} years (from ${first.label} to ${last.label})`,
      `4. Division Ratio: ${formatChartValue(last.value, type)} / ${formatChartValue(first.value, type)} = ${ratio.toFixed(4)}`,
      `5. CAGR formula: (${ratio.toFixed(4)}) ^ (1 / ${n}) - 1`,
      `6. Growth Factor: ${Math.pow(ratio, 1 / n).toFixed(4)}`,
      `7. Final Result: ${finalPct}% CAGR`,
    ];
  }

  function getROICMathExplanation(val: number | null, data: { label: string; value: number }[]): string[] {
    if (val === null || data.length === 0) return ["No ROIC data available."];
    const latest = data[data.length - 1];
    return [
      `1. Latest fiscal year measured: ${latest.label}`,
      `2. Formula: ROIC = Net Operating Profit After Tax (NOPAT) / Invested Capital`,
      `3. NOPAT = Operating Income × (1 - Tax Rate)`,
      `4. Invested Capital = Total Shareholders' Equity + Total Debt`,
      `5. Measured ROIC Result: ${val.toFixed(2)}%`,
    ];
  }

  function getAverageMathExplanation(actualValue: number | null, data: { label: string; value: number }[], symbol: string): string[] {
    if (actualValue === null || data.length === 0) return ["No data available."];
    const sum = data.reduce((acc, curr) => acc + curr.value, 0);

    return [
      `1. Sum of ${data.length} annual values: ${data.map(d => `${d.value.toFixed(1)}${symbol}`).join(" + ")} = ${sum.toFixed(1)}${symbol}`,
      `2. Total periods: ${data.length} years (${data.map(d => d.label).join(", ")})`,
      `3. Measured Average Result: ${actualValue.toFixed(2)}${symbol}`,
    ];
  }

  function getLatestMathExplanation(actualValue: number | null, data: { label: string; value: number }[], name: string, symbol: string): string[] {
    if (actualValue === null || data.length === 0) return ["No data available."];
    const latest = data[data.length - 1];
    return [
      `1. Latest fiscal year checked: ${latest ? latest.label : "Most Recent Fiscal Year"}`,
      `2. Measured ${name} value: ${actualValue.toFixed(2)}${symbol}`,
    ];
  }

  // YoY Growth Helper
  const getYoYGrowth = (index: number, data: { label: string; value: number }[]): string => {
    if (index === 0) return "—";
    const prev = data[index - 1].value;
    const curr = data[index].value;
    if (prev === 0) return "—";
    const growth = ((curr - prev) / Math.abs(prev)) * 100;
    return `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`;
  };

  // Automated Trend Analyzers
  function analyzeGrowthHistory(data: { label: string; value: number }[], metricLabel: string): string {
    if (data.length < 3) return "Steady trend confirmation requires at least 3 consecutive years of data.";

    const growths: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1].value;
      const curr = data[i].value;
      if (prev !== 0) growths.push(((curr - prev) / Math.abs(prev)) * 100);
    }

    const allPositive = growths.every(g => g > 0);
    const allNegative = growths.every(g => g < 0);

    const firstGrowth = growths[0];
    const lastGrowth = growths[growths.length - 1];
    const isAccelerating = lastGrowth > firstGrowth && growths.slice(1).every((g, idx) => g > growths[idx]);
    const isSlowing = lastGrowth < firstGrowth && growths.slice(1).every((g, idx) => g < growths[idx]);

    let text = "";
    if (allPositive) {
      text = `The company has shown consistent year-over-year expansions in ${metricLabel} across the entire ${data.length}-year timeline. `;
      if (isAccelerating) {
        text += "Importantly, this growth is accelerating (growth rates are climbing year-over-year), showing strong momentum.";
      } else if (isSlowing) {
        text += "However, the growth rate is slowing down, showing that although the business is expanding, it is entering a more mature, lower-growth phase.";
      } else {
        text += "The growth rates have remained relatively steady and stable.";
      }
    } else if (allNegative) {
      text = `The company is showing persistent contracting ${metricLabel} values year-over-year, indicating structural declines or significant industry headwinds.`;
    } else {
      text = `The company's ${metricLabel} growth has been volatile and inconsistent. Some years showed strong expansion, while others experienced contractions. `;
      text += "This volatility indicates a cyclical business model or operational instability. Investors should inspect the drivers behind these spikes and dips.";
    }

    return text;
  }

  function analyzeEfficiencyHistory(data: { label: string; value: number }[], name: string, threshold: number): string {
    if (data.length === 0) return "No trend data available.";
    const latest = data[data.length - 1].value;
    const average = data.reduce((acc, curr) => acc + curr.value, 0) / data.length;
    
    let text = `The company's latest ${name} is ${latest.toFixed(1)}%, with a ${data.length}-year average of ${average.toFixed(1)}%. `;

    if (average >= threshold) {
      text += `This indicates a highly efficient business that easily exceeds typical capital costs (usually ~8-10%), suggesting the presence of a wide economic moat. `;
    } else {
      text += `This indicates moderate to low efficiency. The returns might be close to or below the cost of capital, showing weaker pricing power or capital allocation. `;
    }

    if (data.length >= 2) {
      const first = data[0].value;
      if (latest > first + 2) {
        text += "Importantly, returns are expanding over time, indicating improving operational efficiency and moat expansion.";
      } else if (latest < first - 2) {
        text += "Of concern, efficiency returns are contracting, showing that profit margins or asset turn ratios are degrading over time.";
      } else {
        text += `Returns have remained stable and consistent over the last ${data.length} years.`;
      }
    }

    return text;
  }

  function analyzeLeverageHistory(data: { label: string; value: number }[]): string {
    if (data.length === 0) return "No leverage data available.";
    const latest = data[data.length - 1].value;
    
    let text = `The latest Debt-to-Equity ratio is ${latest.toFixed(2)}. `;
    if (latest <= 0.5) {
      text += "This indicates a conservative capital structure with minimal financial leverage, meaning the business has high solvency safety. ";
    } else if (latest <= 1.5) {
      text += "This indicates moderate, healthy leverage that is typical for capital-intensive companies. ";
    } else {
      text += "This indicates high financial leverage, meaning a significant portion of assets are funded via debt, which increases sensitivity to interest rates and refinancing risk. ";
    }

    if (data.length >= 2) {
      const first = data[0].value;
      if (latest > first + 0.2) {
        text += "Leverage has increased over the period, showing the company is taking on more debt relative to equity to fund its activities.";
      } else if (latest < first - 0.2) {
        text += "Leverage has decreased over the period, showing active deleveraging and strengthening balance sheet safety.";
      } else {
        text += "Debt levels relative to equity have remained stable.";
      }
    }

    return text;
  }

  function analyzeValuationHistory(data: { label: string; value: number }[], name: string, lowVal: number, highVal: number): string {
    if (data.length === 0) return "No historical valuation data available.";
    const latest = data[data.length - 1].value;
    const avg = data.reduce((acc, curr) => acc + curr.value, 0) / data.length;
    let text = `The latest ${name} is ${latest.toFixed(1)}, with a ${data.length}-year historical average of ${avg.toFixed(1)}. `;
    if (latest <= lowVal) {
      text += "This places current valuation in an attractive discount range relative to historical norms. ";
    } else if (latest >= highVal) {
      text += "This places current valuation in a premium/expensive range. ";
    } else {
      text += "This indicates valuation is in line with reasonable historical expectations. ";
    }
    return text;
  }

  const getBadgeClasses = (color: string) => {
    const maps: Record<string, string> = {
      green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/40",
      blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40",
      yellow: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40",
      red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/40",
    };
    return maps[color] || "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800";
  };

  const getHexColor = (color: string) => {
    const maps: Record<string, string> = {
      green: "#10b981",
      blue: "#3b82f6",
      yellow: "#f59e0b",
      red: "#ef4444",
    };
    return maps[color] || "#94a3b8";
  };


  // SVG Chart points calculation
  const renderBigChart = () => {
    if (config.chartData.length === 0) return <div className="text-slate-400 italic text-sm text-center py-10">Data not available</div>;

    const width = 600;
    const height = 240;
    const paddingLeft = 35;
    const paddingRight = 35;
    const paddingTop = 30;
    const paddingBottom = 30;

    const values = config.chartData.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    
    const adjustedMin = range === 0 ? minVal - 1 : minVal - range * 0.15;
    const adjustedMax = range === 0 ? maxVal + 1 : maxVal + range * 0.15;

    const points = config.chartData.map((item, i) => {
      const divisor = config.chartData.length > 1 ? config.chartData.length - 1 : 1;
      const x = paddingLeft + (i / divisor) * (width - paddingLeft - paddingRight);
      const val = item.value;
      const y = height - paddingBottom - ((val - adjustedMin) / (adjustedMax - adjustedMin)) * (height - paddingTop - paddingBottom);
      return { x, y, label: item.label, value: item.value };
    });

    const gradId = `modal-chart-grad-${metricKey}`;

    let linePath = "";
    let areaPath = "";

    if (points.length > 1) {
      linePath = `M ${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`;
      areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} L ${points[0].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} Z`;
    }

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activeColorHex} stopOpacity="0.25" />
            <stop offset="100%" stopColor={activeColorHex} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Gridlines */}
        <line 
          x1={paddingLeft} 
          y1={height - paddingBottom} 
          x2={width - paddingRight} 
          y2={height - paddingBottom} 
          className="stroke-slate-200 dark:stroke-slate-700/80 stroke-1"
          strokeDasharray="4,4"
        />
        <line 
          x1={paddingLeft} 
          y1={paddingTop} 
          x2={width - paddingRight} 
          y2={paddingTop} 
          className="stroke-slate-200/50 dark:stroke-slate-700/40 stroke-1"
          strokeDasharray="4,4"
        />

        {/* Area */}
        {points.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Path Line */}
        {points.length > 1 && (
          <path 
            d={linePath} 
            fill="none" 
            stroke={activeColorHex} 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        )}

        {/* Nodes */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Value Label above dot */}
            <text 
              x={p.x} 
              y={p.y - 8} 
              textAnchor="middle" 
              className="text-[10px] font-bold fill-slate-700 dark:fill-slate-200"
            >
              {formatChartValue(p.value, config.chartValueType)}
            </text>
            
            {/* Circle Node */}
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="5" 
              fill={activeColorHex} 
              className="stroke-white dark:stroke-slate-900 stroke-[2.5px] drop-shadow-sm"
            />
            
            {/* Year Label below axis */}
            <text 
              x={p.x} 
              y={height - 6} 
              textAnchor="middle" 
              className="text-[10px] font-semibold fill-slate-400 dark:fill-slate-400"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  const config = getConfig();
  const { label: scoreLabel, color: scoreColor } = getScoreCategory(config.score || 0);

  const getTrendColorHex = (
    data: { value: number }[],
    strategy: "higherIsBetter" | "lowerIsBetter",
    defaultHex: string
  ): string => {
    if (data.length < 2) return defaultHex;
    const firstVal = data[0].value;
    const lastVal = data[data.length - 1].value;
    if (lastVal === firstVal) return "#94a3b8"; // Neutral slate
    const isImprovement = strategy === "lowerIsBetter" 
      ? lastVal < firstVal 
      : lastVal > firstVal;
    return isImprovement ? "#10b981" : "#ef4444"; // Green vs Red
  };

  const defaultColorHex = getHexColor(scoreColor);
  const activeColorHex = config.directionStrategy && config.chartData.length > 0
    ? getTrendColorHex(config.chartData, config.directionStrategy, defaultColorHex)
    : defaultColorHex;

  const getYoYColorClass = (growthText: string, strategy: "higherIsBetter" | "lowerIsBetter") => {
    if (growthText === "—" || growthText === "—%") return "text-slate-400 dark:text-slate-500";
    const isPositive = growthText.startsWith("+");
    const isNegative = growthText.startsWith("-");
    
    if (strategy === "lowerIsBetter") {
      if (isPositive) return "text-red-600 dark:text-red-400";
      if (isNegative) return "text-green-600 dark:text-green-400";
    } else {
      if (isPositive) return "text-green-600 dark:text-green-400";
      if (isNegative) return "text-red-600 dark:text-red-400";
    }
    return "text-slate-400 dark:text-slate-500";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      {/* Outer Click Dismiss */}
      <div className="absolute inset-0 cursor-default" onClick={onClose}></div>

      {/* Modal Box */}
      <div className="relative w-[90vw] max-w-7xl max-h-[85vh] md:max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-y-auto flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200 z-10">
        
        {/* Left Panel: Charts and Table */}
        <div className="w-full md:w-1/2 p-6 md:border-r border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{config.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
            </div>
          </div>

          {/* SVG Trend Chart */}
          <div className="w-full h-64 sm:h-72 lg:h-80 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100/70 dark:border-slate-800/50 flex items-center justify-center mb-6">
            <div className="w-full h-full">
              {renderBigChart()}
            </div>
          </div>

          {/* Value Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
              Historical Annual Data
            </h3>
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2.5">Fiscal Year</th>
                    <th className="px-4 py-2.5 text-right">Value</th>
                    <th className="px-4 py-2.5 text-right">YoY Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
                  {config.chartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{item.label}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                        {formatChartValue(item.value, config.chartValueType)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${getYoYColorClass(getYoYGrowth(idx, config.chartData), config.directionStrategy)}`}>
                        {getYoYGrowth(idx, config.chartData)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {config.chartData.length < 10 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-2 italic">
                * Note: Fewer than 10 years of historical data are currently available for this stock.
              </p>
            )}
          </div>
        </div>

        {/* Right Panel: Scoring, Math, Education & Observations */}
        <div className="w-full md:w-1/2 p-6 flex flex-col justify-between bg-slate-50/20 dark:bg-slate-900/10">
          <div>
            {/* Close Button positioned above the Metric Value Card */}
            <div className="flex justify-end mb-3">
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-all hover:scale-105 active:scale-95 border border-slate-200/60 dark:border-slate-700/50 shadow-sm"
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Metric Value & Score Summary Block */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest block mb-0.5">
                  Metric Value
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {config.value !== null ? (
                    <>
                      {config.unit === "%" && Math.abs(config.value) <= 1
                        ? (config.value * 100).toFixed(2)
                        : config.value.toFixed(2)}
                      <span className="text-lg text-slate-500 font-semibold ml-1">{config.unit}</span>
                    </>
                  ) : (
                    "N/A"
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest block mb-0.5">
                  Quality Score
                </span>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {config.score !== null ? config.score : "N/A"}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs">/ 100</span>
                  <div className={`ml-2 px-3 py-1 border rounded-full font-bold text-xs ${getBadgeClasses(scoreColor)}`}>
                    {scoreLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* Formula Math Section */}
            <div className="mb-6 bg-white dark:bg-slate-800 p-4 border border-slate-150 dark:border-slate-800 rounded-xl">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                Calculation & Formula
              </h4>
              <div className="bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-3 overflow-x-auto whitespace-pre">
                {config.formula}
              </div>
              <div className="space-y-1.5">
                {config.mathExplanation.map((step, idx) => (
                  <p key={idx} className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed font-medium">
                    {step}
                  </p>
                ))}
              </div>
            </div>

            {/* Educational Info */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                Why This Metric Matters
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed">
                {config.whyItMatters}
              </p>
            </div>

            {/* Metric Score Ranges */}
            <div className="mb-6 border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5">
                Evaluation Standards
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {config.tiers.map((tier, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-800/60 px-3 py-2 rounded-lg">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">{tier.label}</span>
                    <span className={`font-bold ${tier.color}`}>{tier.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Observations and Insights */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
              Automated Data Insights
            </h4>
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/30 p-3 rounded-lg flex items-start gap-2.5">
              <span className="text-lg">💡</span>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                {config.getInsights()}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
