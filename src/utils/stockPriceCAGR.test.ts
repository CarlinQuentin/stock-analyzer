import { describe, it, expect } from "vitest";
import { calculateStockPriceCAGR, calculateTotalReturnCAGR } from "./financialCalculations";

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

describe("calculateTotalReturnCAGR — Total Return Annual Compound Growth Rate", () => {
  it("1. Non-dividend stock: Price CAGR equals Total Return CAGR when close == adjClose", () => {
    const startPrice = 100;
    const endPrice = 150;
    const years = 5;

    const priceCAGR = calculateStockPriceCAGR(startPrice, endPrice, years);
    const totalReturnCAGR = calculateTotalReturnCAGR(startPrice, endPrice, years);

    expect(priceCAGR).toBe(8.45);
    expect(totalReturnCAGR).toBe(8.45);
    expect(totalReturnCAGR).toBe(priceCAGR);
  });

  it("2. Dividend-paying stock: Total Return CAGR > Price CAGR when dividends contribute positively", () => {
    const startClose = 100;
    const endClose = 150; // Raw price appreciation $100 -> $150 (+8.45%/yr)
    const years = 5;

    // Due to reinvested dividends, adjusted starting price was lower ($90 adjClose) relative to $150 endAdjClose
    const startAdjClose = 92.50;
    const endAdjClose = 150.00;

    const priceCAGR = calculateStockPriceCAGR(startClose, endClose, years);
    const totalReturnCAGR = calculateTotalReturnCAGR(startAdjClose, endAdjClose, years);

    expect(priceCAGR).toBe(8.45);
    expect(totalReturnCAGR).toBe(10.15);
    expect(totalReturnCAGR!).toBeGreaterThan(priceCAGR!);
  });

  it("3. Stock split: Handled accurately via adjusted prices without artificial spikes", () => {
    // Stock split 2-for-1: pre-split price was $200 (adjClose $100), post-split price $150 (adjClose $150)
    const startAdjClose = 100;
    const endAdjClose = 150;
    const years = 5;

    const totalReturnCAGR = calculateTotalReturnCAGR(startAdjClose, endAdjClose, years);
    expect(totalReturnCAGR).toBe(8.45);
  });

  it("4. Missing adjClose: Returns null rather than incorrectly falling back to raw close", () => {
    expect(calculateTotalReturnCAGR(null, 150, 5)).toBeNull();
    expect(calculateTotalReturnCAGR(100, undefined, 5)).toBeNull();
    expect(calculateTotalReturnCAGR(undefined, undefined, 5)).toBeNull();
  });

  it("5. Date Consistency: Both CAGR functions evaluate over the exact same time window", () => {
    const years = 4.85; // exact fractional calendar year span
    const startClose = 100;
    const endClose = 160;
    const startAdjClose = 90;
    const endAdjClose = 160;

    const priceCAGR = calculateStockPriceCAGR(startClose, endClose, years);
    const totalReturnCAGR = calculateTotalReturnCAGR(startAdjClose, endAdjClose, years);

    expect(priceCAGR).toBe(10.18);
    expect(totalReturnCAGR).toBe(12.6);
  });
});
