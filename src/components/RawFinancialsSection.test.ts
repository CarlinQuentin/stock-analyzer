import { describe, it, expect } from "vitest";
import {
  formatRawCurrency,
  formatRawEPS,
  formatPercentage,
  formatRatio,
  formatShareCount,
  formatPeriodDate,
  getMetricDirection,
  getMetricComparisonColor,
  METRIC_SECTIONS,
} from "./RawFinancialsSection";

describe("RawFinancialsSection Formatters & Data Mapping", () => {
  describe("formatRawCurrency", () => {
    it("formats Trillions (T) correctly", () => {
      expect(formatRawCurrency(1.5e12)).toBe("$1.5T");
      expect(formatRawCurrency(1e12)).toBe("$1T");
    });

    it("formats Billions (B) correctly", () => {
      expect(formatRawCurrency(18.2e9)).toBe("$18.2B");
      expect(formatRawCurrency(2.6e9)).toBe("$2.6B");
      expect(formatRawCurrency(1e9)).toBe("$1B");
    });

    it("formats Millions (M) correctly", () => {
      expect(formatRawCurrency(800e6)).toBe("$800M");
      expect(formatRawCurrency(650e6)).toBe("$650M");
    });

    it("formats Thousands (K) correctly", () => {
      expect(formatRawCurrency(500e3)).toBe("$500K");
    });

    it("formats zero and small numbers correctly", () => {
      expect(formatRawCurrency(0)).toBe("$0");
      expect(formatRawCurrency(42)).toBe("$42");
    });

    it("formats negative currency values cleanly", () => {
      expect(formatRawCurrency(-500e6)).toBe("-$500M");
      expect(formatRawCurrency(-1.2e9)).toBe("-$1.2B");
    });

    it("returns — for null, undefined, or NaN", () => {
      expect(formatRawCurrency(null)).toBe("—");
      expect(formatRawCurrency(undefined)).toBe("—");
      expect(formatRawCurrency(NaN)).toBe("—");
    });
  });

  describe("formatRawEPS", () => {
    it("formats positive EPS as standard per-share currency", () => {
      expect(formatRawEPS(8.42)).toBe("$8.42");
      expect(formatRawEPS(7.55)).toBe("$7.55");
    });

    it("formats negative EPS as standard per-share currency", () => {
      expect(formatRawEPS(-1.20)).toBe("-$1.20");
    });

    it("formats zero EPS", () => {
      expect(formatRawEPS(0)).toBe("$0.00");
    });

    it("returns — for invalid values", () => {
      expect(formatRawEPS(null)).toBe("—");
      expect(formatRawEPS(undefined)).toBe("—");
      expect(formatRawEPS(NaN)).toBe("—");
    });
  });

  describe("formatPercentage", () => {
    it("formats decimal ratios as percentages", () => {
      expect(formatPercentage(0.245, true)).toBe("24.5%");
      expect(formatPercentage(-0.052, true)).toBe("-5.2%");
      expect(formatPercentage(0, true)).toBe("0.0%");
    });

    it("formats whole percentages directly", () => {
      expect(formatPercentage(24.5, false)).toBe("24.5%");
      expect(formatPercentage(100, false)).toBe("100.0%");
    });

    it("returns — for invalid values", () => {
      expect(formatPercentage(null)).toBe("—");
      expect(formatPercentage(undefined)).toBe("—");
    });
  });

  describe("formatRatio", () => {
    it("formats multiples with x suffix", () => {
      expect(formatRatio(1.85)).toBe("1.85x");
      expect(formatRatio(24.2)).toBe("24.20x");
      expect(formatRatio(0.45)).toBe("0.45x");
    });

    it("returns — for invalid values", () => {
      expect(formatRatio(null)).toBe("—");
      expect(formatRatio(undefined)).toBe("—");
    });
  });

  describe("formatShareCount", () => {
    it("formats share counts into B / M cleanly", () => {
      expect(formatShareCount(15500000000)).toBe("15.5B");
      expect(formatShareCount(160000000)).toBe("160.0M");
    });

    it("returns — for invalid values", () => {
      expect(formatShareCount(null)).toBe("—");
      expect(formatShareCount(undefined)).toBe("—");
    });
  });

  describe("formatPeriodDate", () => {
    it("formats ISO date string into M/D/YYYY", () => {
      expect(formatPeriodDate("2025-12-31")).toBe("12/31/2025");
      expect(formatPeriodDate("2026-01-31")).toBe("1/31/2026");
      expect(formatPeriodDate("2024-09-30")).toBe("9/30/2024");
    });

    it("returns — for missing or empty date strings", () => {
      expect(formatPeriodDate(null)).toBe("—");
      expect(formatPeriodDate(undefined)).toBe("—");
      expect(formatPeriodDate("")).toBe("—");
    });
  });

  describe("getMetricDirection", () => {
    it("classifies Higher-is-Better metrics correctly", () => {
      expect(getMetricDirection("revenue")).toBe("higher_is_better");
      expect(getMetricDirection("revenueGrowth")).toBe("higher_is_better");
      expect(getMetricDirection("grossProfit")).toBe("higher_is_better");
      expect(getMetricDirection("grossMargin")).toBe("higher_is_better");
      expect(getMetricDirection("operatingIncome")).toBe("higher_is_better");
      expect(getMetricDirection("operatingMargin")).toBe("higher_is_better");
      expect(getMetricDirection("netIncome")).toBe("higher_is_better");
      expect(getMetricDirection("netMargin")).toBe("higher_is_better");
      expect(getMetricDirection("dilutedEps")).toBe("higher_is_better");
      expect(getMetricDirection("epsGrowth")).toBe("higher_is_better");
      expect(getMetricDirection("operatingCashFlow")).toBe("higher_is_better");
      expect(getMetricDirection("freeCashFlow")).toBe("higher_is_better");
      expect(getMetricDirection("fcfMargin")).toBe("higher_is_better");
      expect(getMetricDirection("fcfConversion")).toBe("higher_is_better");
      expect(getMetricDirection("fcfGrowth")).toBe("higher_is_better");
      expect(getMetricDirection("roic")).toBe("higher_is_better");
      expect(getMetricDirection("roe")).toBe("higher_is_better");
      expect(getMetricDirection("roa")).toBe("higher_is_better");
      expect(getMetricDirection("ebitda")).toBe("higher_is_better");
      expect(getMetricDirection("ebitdaMargin")).toBe("higher_is_better");
      expect(getMetricDirection("cashAndEquivalents")).toBe("higher_is_better");
      expect(getMetricDirection("dividendYield")).toBe("higher_is_better");
      expect(getMetricDirection("dividendPerShare")).toBe("higher_is_better");
      expect(getMetricDirection("annualDividendPerShare")).toBe("higher_is_better");
      expect(getMetricDirection("dividendGrowth")).toBe("higher_is_better");
    });

    it("classifies Lower-is-Better metrics correctly", () => {
      expect(getMetricDirection("capitalExpenditures")).toBe("lower_is_better");
      expect(getMetricDirection("totalDebt")).toBe("lower_is_better");
      expect(getMetricDirection("netDebt")).toBe("lower_is_better");
      expect(getMetricDirection("debtToEquity")).toBe("lower_is_better");
      expect(getMetricDirection("netDebtToFcf")).toBe("lower_is_better");
      expect(getMetricDirection("peRatio")).toBe("lower_is_better");
      expect(getMetricDirection("priceToFCF")).toBe("lower_is_better");
      expect(getMetricDirection("priceToSales")).toBe("lower_is_better");
      expect(getMetricDirection("evToEbitda")).toBe("lower_is_better");
      expect(getMetricDirection("dividendPayoutRatio")).toBe("lower_is_better");
      expect(getMetricDirection("dividendFcfCoverage")).toBe("lower_is_better");
    });

    it("classifies neutral metrics correctly", () => {
      expect(getMetricDirection("marketCapitalization")).toBe("neutral");
      expect(getMetricDirection("enterpriseValue")).toBe("neutral");
      expect(getMetricDirection("dividendFrequency")).toBe("neutral");
      expect(getMetricDirection("dividendsPaid")).toBe("neutral");
      expect(getMetricDirection("specialDividend")).toBe("neutral");
    });
  });

  describe("getMetricComparisonColor", () => {
    describe("Higher-is-Better metric rules", () => {
      it("colors green when value increases", () => {
        const color = getMetricComparisonColor(100, 80, "higher_is_better");
        expect(color).toContain("emerald");
      });

      it("colors red when value decreases", () => {
        const color = getMetricComparisonColor(80, 100, "higher_is_better");
        expect(color).toContain("rose");
      });

      it("handles negative numbers: green when negative net income improves (-$50M vs -$100M)", () => {
        const color = getMetricComparisonColor(-50, -100, "higher_is_better");
        expect(color).toContain("emerald");
      });

      it("handles negative numbers: red when negative net income deteriorates (-$100M vs -$50M)", () => {
        const color = getMetricComparisonColor(-100, -50, "higher_is_better");
        expect(color).toContain("rose");
      });

      it("returns default neutral color when values are unchanged", () => {
        const color = getMetricComparisonColor(100, 100, "higher_is_better");
        expect(color).toBe("text-slate-900 dark:text-slate-100");
      });
    });

    describe("Lower-is-Better metric rules", () => {
      it("colors green when Total Debt decreases ($8B vs $10B)", () => {
        const color = getMetricComparisonColor(8e9, 10e9, "lower_is_better");
        expect(color).toContain("emerald");
      });

      it("colors red when Total Debt increases ($10B vs $8B)", () => {
        const color = getMetricComparisonColor(10e9, 8e9, "lower_is_better");
        expect(color).toContain("rose");
      });
    });

    describe("Edge cases & First Available Year", () => {
      it("returns default neutral color when prior value is missing/undefined (First Available Year)", () => {
        const color = getMetricComparisonColor(100, undefined, "higher_is_better");
        expect(color).toBe("text-slate-900 dark:text-slate-100");
      });

      it("returns default neutral color when prior value is null", () => {
        const color = getMetricComparisonColor(100, null, "higher_is_better");
        expect(color).toBe("text-slate-900 dark:text-slate-100");
      });

      it("returns default neutral color when current value is null/undefined", () => {
        const color = getMetricComparisonColor(null, 100, "higher_is_better");
        expect(color).toBe("text-slate-900 dark:text-slate-100");
      });

      it("returns default neutral color for string values (e.g. Dividend Frequency)", () => {
        const color = getMetricComparisonColor("Quarterly", "Quarterly", "neutral");
        expect(color).toBe("text-slate-900 dark:text-slate-100");
      });

      it("returns default neutral color for neutral/unclassified metrics", () => {
        const color = getMetricComparisonColor(100, 80, "neutral");
        expect(color).toBe("text-slate-900 dark:text-slate-100");
      });
    });
  });

  describe("METRIC_SECTIONS configuration", () => {
    it("defines the 6 core financial sections in proper sequence including Dividends", () => {
      const sectionIds = METRIC_SECTIONS.map((s) => s.id);
      expect(sectionIds).toEqual([
        "growthAndProfitability",
        "cashFlow",
        "capitalEfficiency",
        "balanceSheetAndDebt",
        "valuation",
        "dividends",
      ]);
    });

    it("contains exactly 41 high-signal financial metrics across all 6 sections", () => {
      const totalMetrics = METRIC_SECTIONS.reduce((sum, s) => sum + s.rows.length, 0);
      expect(totalMetrics).toBe(41);
    });

    it("Growth & Profitability contains the 10 required growth and margin metrics", () => {
      const growthSec = METRIC_SECTIONS.find((s) => s.id === "growthAndProfitability");
      expect(growthSec?.rows.length).toBe(10);
      const labels = growthSec?.rows.map((r) => r.label);
      expect(labels).toEqual([
        "Revenue",
        "Revenue Growth",
        "Gross Profit",
        "Gross Margin",
        "Operating Income",
        "Operating Margin",
        "Net Income",
        "Net Margin",
        "Diluted EPS",
        "EPS Growth",
      ]);
    });

    it("Cash Flow section contains the 6 required cash metrics", () => {
      const cfSec = METRIC_SECTIONS.find((s) => s.id === "cashFlow");
      expect(cfSec?.rows.length).toBe(6);
      const labels = cfSec?.rows.map((r) => r.label);
      expect(labels).toEqual([
        "Operating Cash Flow",
        "Capital Expenditures",
        "Free Cash Flow",
        "FCF Margin",
        "FCF Conversion",
        "FCF Growth",
      ]);
    });

    it("Capital Efficiency section contains ROIC, ROE, ROA, EBITDA, EBITDA Margin", () => {
      const capSec = METRIC_SECTIONS.find((s) => s.id === "capitalEfficiency");
      expect(capSec?.rows.length).toBe(5);
      const labels = capSec?.rows.map((r) => r.label);
      expect(labels).toEqual(["ROIC", "ROE", "ROA", "EBITDA", "EBITDA Margin"]);
    });

    it("Balance Sheet & Debt section contains the 5 focused leverage metrics", () => {
      const balSec = METRIC_SECTIONS.find((s) => s.id === "balanceSheetAndDebt");
      expect(balSec?.rows.length).toBe(5);
      const labels = balSec?.rows.map((r) => r.label);
      expect(labels).toEqual([
        "Cash & Equivalents",
        "Total Debt",
        "Net Debt",
        "Debt-to-Equity",
        "Net Debt / FCF",
      ]);
    });

    it("Valuation section contains the 6 core market multiple metrics", () => {
      const valSec = METRIC_SECTIONS.find((s) => s.id === "valuation");
      expect(valSec?.rows.length).toBe(6);
      const labels = valSec?.rows.map((r) => r.label);
      expect(labels).toEqual([
        "Market Capitalization",
        "Enterprise Value",
        "P/E",
        "Price / FCF",
        "Price / Sales",
        "EV / EBITDA",
      ]);
    });

    it("Dividends section contains the 9 comprehensive dividend metrics", () => {
      const divSec = METRIC_SECTIONS.find((s) => s.id === "dividends");
      expect(divSec?.rows.length).toBe(9);
      const labels = divSec?.rows.map((r) => r.label);
      expect(labels).toEqual([
        "Dividend Frequency",
        "Dividend Yield",
        "Dividend Per Share (DPS)",
        "Annual Dividend Per Share",
        "Dividend Growth",
        "Total Dividends Paid",
        "Dividend Payout Ratio",
        "Dividend / FCF",
        "Special Dividends",
      ]);
    });
  });
});
