import { describe, it, expect } from "vitest";
import { calculateStockPriceCAGR } from "./financialCalculations";

describe("calculateStockPriceCAGR — Stock Price Annual Compound Growth Rate", () => {
  it("1. Calculates positive CAGR correctly for stock gains (Example: $100 -> $150 over 5 years)", () => {
    // Starting $100, Ending $150 over 5 years -> +8.45%
    const cagr = calculateStockPriceCAGR(100, 150, 5);
    expect(cagr).toBe(8.45);
  });

  it("2. Calculates zero CAGR when starting and ending prices are equal", () => {
    // Starting $100, Ending $100 over 5 years -> 0.00%
    const cagr = calculateStockPriceCAGR(100, 100, 5);
    expect(cagr).toBe(0);
  });

  it("3. Calculates negative CAGR correctly for stock declines (Example: $100 -> $50 over 5 years)", () => {
    // Starting $100, Ending $50 over 5 years -> -12.94%
    const cagr = calculateStockPriceCAGR(100, 50, 5);
    expect(cagr).toBe(-12.94);
  });

  it("4. Calculates 10-year stock price CAGR correctly ($50 -> $150 over 10 years)", () => {
    // Starting $50, Ending $150 over 10 years -> +11.61%
    const cagr = calculateStockPriceCAGR(50, 150, 10);
    expect(cagr).toBe(11.61);
  });

  it("5. Returns null for invalid, non-positive, or missing inputs", () => {
    expect(calculateStockPriceCAGR(null, 150, 5)).toBeNull();
    expect(calculateStockPriceCAGR(100, undefined, 5)).toBeNull();
    expect(calculateStockPriceCAGR(0, 150, 5)).toBeNull();
    expect(calculateStockPriceCAGR(100, -10, 5)).toBeNull();
    expect(calculateStockPriceCAGR(100, 150, 0)).toBeNull();
  });
});
