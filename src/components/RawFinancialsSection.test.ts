import { describe, it, expect } from "vitest";
import {
  formatRawCurrency,
  formatRawEPS,
} from "./RawFinancialsSection";
import { FinancialStatement } from "../types";

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
});
