import { describe, it, expect } from "vitest";
import {
  formatRawCurrency,
  formatRawEPS,
  getMetricDirection,
  getMetricComparisonColor,
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

    it("returns N/A for null, undefined, or NaN", () => {
      expect(formatRawCurrency(null)).toBe("N/A");
      expect(formatRawCurrency(undefined)).toBe("N/A");
      expect(formatRawCurrency(NaN)).toBe("N/A");
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

    it("returns N/A for invalid values", () => {
      expect(formatRawEPS(null)).toBe("N/A");
      expect(formatRawEPS(undefined)).toBe("N/A");
      expect(formatRawEPS(NaN)).toBe("N/A");
    });
  });

  describe("getMetricDirection", () => {
    it("classifies Higher-is-Better metrics correctly", () => {
      expect(getMetricDirection("revenue")).toBe("higher_is_better");
      expect(getMetricDirection("operatingIncome")).toBe("higher_is_better");
      expect(getMetricDirection("netIncome")).toBe("higher_is_better");
      expect(getMetricDirection("eps")).toBe("higher_is_better");
      expect(getMetricDirection("freeCashFlow")).toBe("higher_is_better");
      expect(getMetricDirection("cashAndEquivalents")).toBe("higher_is_better");
      expect(getMetricDirection("grossMargin")).toBe("higher_is_better");
      expect(getMetricDirection("roic")).toBe("higher_is_better");
    });

    it("classifies Lower-is-Better metrics correctly", () => {
      expect(getMetricDirection("totalDebt")).toBe("lower_is_better");
      expect(getMetricDirection("sharesOutstanding")).toBe("lower_is_better");
      expect(getMetricDirection("interestExpense")).toBe("lower_is_better");
      expect(getMetricDirection("operatingExpenses")).toBe("lower_is_better");
      expect(getMetricDirection("sga")).toBe("lower_is_better");
      expect(getMetricDirection("costOfRevenue")).toBe("lower_is_better");
      expect(getMetricDirection("taxRate")).toBe("lower_is_better");
      expect(getMetricDirection("capex")).toBe("lower_is_better");
    });

    it("classifies unknown/unclassified metrics as neutral", () => {
      expect(getMetricDirection("workingCapital")).toBe("neutral");
      expect(getMetricDirection("randomField")).toBe("neutral");
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

      it("colors green when Shares Outstanding decrease due to buybacks (1.0B vs 1.2B)", () => {
        const color = getMetricComparisonColor(1.0e9, 1.2e9, "lower_is_better");
        expect(color).toContain("emerald");
      });

      it("colors red when Shares Outstanding increase due to dilution (1.2B vs 1.0B)", () => {
        const color = getMetricComparisonColor(1.2e9, 1.0e9, "lower_is_better");
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

      it("returns default neutral color for neutral/unclassified metrics", () => {
        const color = getMetricComparisonColor(100, 80, "neutral");
        expect(color).toBe("text-slate-900 dark:text-slate-100");
      });
    });
  });
});
