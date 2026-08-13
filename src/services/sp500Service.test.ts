import { describe, it, expect } from "vitest";
import { sp500Service } from "./sp500Service";

describe("SP500Service Backwards Compatibility Tests", () => {
  it("exports sp500Service pointing to top500Service", () => {
    expect(sp500Service).toBeDefined();
    expect(typeof sp500Service.getSP500MarketData).toBe("function");
  });
});
