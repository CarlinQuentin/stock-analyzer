import { describe, it, expect } from "vitest";
import { squarify, clampRect, CANVAS_MARGIN } from "./SP500Treemap";

describe("Squarify and Treemap Layout Bounds Tests", () => {
  it("Never lets child stocks exceed parent sector bounds for 1, 2, 3, 10, 50 stocks", () => {
    const parent = { x: 100, y: 50, w: 400, h: 300 };
    for (const count of [1, 2, 3, 4, 5, 10, 25, 50, 100]) {
      const items = Array.from({ length: count }, (_, i) => ({
        data: { sym: `SYM${i}` },
        value: Math.pow(count - i, 1.5) * 100 + 10,
      }));

      const placed = squarify(items, parent);
      expect(placed.length).toBe(items.length);

      placed.forEach((p) => {
        expect(p.rect.x).toBeGreaterThanOrEqual(parent.x - 0.001);
        expect(p.rect.y).toBeGreaterThanOrEqual(parent.y - 0.001);
        expect(p.rect.x + p.rect.w).toBeLessThanOrEqual(parent.x + parent.w + 0.001);
        expect(p.rect.y + p.rect.h).toBeLessThanOrEqual(parent.y + parent.h + 0.001);
      });
    }
  });

  it("Tests extreme aspect ratios (wide/narrow sectors) to ensure stocks never overflow on the right", () => {
    const testBounds = [
      { x: 0, y: 0, w: 1000, h: 50 }, // ultra wide
      { x: 0, y: 0, w: 50, h: 1000 }, // ultra tall
      { x: 28, y: 28, w: 320, h: 550 }, // mobile
      { x: 28, y: 28, w: 1144, h: 624 }, // desktop
      { x: 28, y: 28, w: 1864, h: 744 }, // 2k
      { x: 500, y: 300, w: 123.45, h: 67.89 }, // floating point dimensions
    ];

    testBounds.forEach((bounds) => {
      for (const count of [1, 2, 3, 7, 15, 30]) {
        const items = Array.from({ length: count }, (_, i) => ({
          data: { sym: `TICKER_${i}` },
          value: (count - i) * 50 + (i % 3) * 17 + 1,
        }));

        const placed = squarify(items, bounds);
        expect(placed.length).toBe(items.length);

        placed.forEach((p) => {
          expect(p.rect.x).toBeGreaterThanOrEqual(bounds.x - 0.001);
          expect(p.rect.y).toBeGreaterThanOrEqual(bounds.y - 0.001);
          expect(p.rect.x + p.rect.w).toBeLessThanOrEqual(bounds.x + bounds.w + 0.001);
          expect(p.rect.y + p.rect.h).toBeLessThanOrEqual(bounds.y + bounds.h + 0.001);
        });
      }
    });
  });

  it("Full Treemap Hierarchy: All child stocks fit strictly inside parent sector bounds across multiple viewports and sector filters", () => {
    // Top 100 sample data mimicking real market sectors
    const sampleCompanies = [
      // Health Care
      { symbol: "LLY", sector: "Health Care", marketCap: 800000000000 },
      { symbol: "UNH", sector: "Health Care", marketCap: 500000000000 },
      { symbol: "JNJ", sector: "Health Care", marketCap: 380000000000 },
      { symbol: "ABBV", sector: "Health Care", marketCap: 320000000000 },
      { symbol: "MRK", sector: "Health Care", marketCap: 280000000000 },
      { symbol: "TMO", sector: "Health Care", marketCap: 210000000000 },
      { symbol: "ABT", sector: "Health Care", marketCap: 190000000000 },
      { symbol: "DHR", sector: "Health Care", marketCap: 180000000000 },
      { symbol: "PFE", sector: "Health Care", marketCap: 160000000000 },
      // Consumer Staples / Consumer Defensive
      { symbol: "WMT", sector: "Consumer Staples", marketCap: 600000000000 },
      { symbol: "COST", sector: "Consumer Staples", marketCap: 380000000000 },
      { symbol: "PG", sector: "Consumer Staples", marketCap: 370000000000 },
      { symbol: "KO", sector: "Consumer Staples", marketCap: 290000000000 },
      { symbol: "PEP", sector: "Consumer Staples", marketCap: 240000000000 },
      { symbol: "PM", sector: "Consumer Staples", marketCap: 180000000000 },
      // Utilities
      { symbol: "NEE", sector: "Utilities", marketCap: 160000000000 },
      { symbol: "SO", sector: "Utilities", marketCap: 90000000000 },
      { symbol: "DUK", sector: "Utilities", marketCap: 85000000000 },
      { symbol: "CEG", sector: "Utilities", marketCap: 80000000000 },
      // Single stock sector (e.g. Real Estate with 1 stock)
      { symbol: "PLD", sector: "Real Estate", marketCap: 110000000000 },
      // Technology
      { symbol: "AAPL", sector: "Technology", marketCap: 3400000000000 },
      { symbol: "MSFT", sector: "Technology", marketCap: 3100000000000 },
      { symbol: "NVDA", sector: "Technology", marketCap: 3000000000000 },
      { symbol: "AVGO", sector: "Technology", marketCap: 800000000000 },
      { symbol: "ORCL", sector: "Technology", marketCap: 400000000000 },
      { symbol: "CRM", sector: "Technology", marketCap: 300000000000 },
    ];

    const viewports = [
      { width: 360, height: 550 },
      { width: 640, height: 520 },
      { width: 768, height: 560 },
      { width: 1024, height: 600 },
      { width: 1200, height: 680 },
      { width: 1440, height: 750 },
      { width: 1920, height: 800 },
    ];

    const padding = 2;

    viewports.forEach(({ width, height }) => {
      const canvasBounds = {
        x: CANVAS_MARGIN,
        y: CANVAS_MARGIN,
        w: Math.max(100, width - CANVAS_MARGIN * 2),
        h: Math.max(100, height - CANVAS_MARGIN * 2),
      };

      // Test ALL sectors view
      const sectorMap = new Map<string, typeof sampleCompanies>();
      sampleCompanies.forEach((c) => {
        if (!sectorMap.has(c.sector)) sectorMap.set(c.sector, []);
        sectorMap.get(c.sector)!.push(c);
      });

      const sectorItems = Array.from(sectorMap.entries()).map(([sector, comps]) => ({
        data: { sector, comps },
        value: comps.reduce((acc, c) => acc + c.marketCap, 0),
      }));

      const placedSectors = squarify(sectorItems, canvasBounds);
      expect(placedSectors.length).toBe(sectorItems.length);

      placedSectors.forEach((secNode) => {
        const sRect = secNode.rect;
        // Sector fits within canvas
        expect(sRect.x).toBeGreaterThanOrEqual(canvasBounds.x - 0.01);
        expect(sRect.y).toBeGreaterThanOrEqual(canvasBounds.y - 0.01);
        expect(sRect.x + sRect.w).toBeLessThanOrEqual(canvasBounds.x + canvasBounds.w + 0.01);
        expect(sRect.y + sRect.h).toBeLessThanOrEqual(canvasBounds.y + canvasBounds.h + 0.01);

        const hasHeader = sRect.h >= 24;
        const headerHeight = hasHeader ? Math.min(20, Math.max(15, Math.floor(sRect.h * 0.12))) : 0;
        const innerX = sRect.x + padding;
        const innerY = sRect.y + headerHeight + padding;
        const innerW = Math.max(0, sRect.w - padding * 2);
        const innerH = Math.max(0, sRect.h - headerHeight - padding * 2);

        const innerRect = clampRect({ x: innerX, y: innerY, w: innerW, h: innerH }, sRect);

        const compItems = secNode.data.comps.map((c) => ({ data: c, value: c.marketCap }));
        if (innerRect.w > 0 && innerRect.h > 0) {
          const placedComps = squarify(compItems, innerRect);
          expect(placedComps.length).toBe(compItems.length);

          placedComps.forEach((cNode) => {
            const cRect = clampRect(cNode.rect, innerRect);

            // Invariant 1: childLeft >= parentLeft
            expect(cRect.x).toBeGreaterThanOrEqual(sRect.x - 0.02);
            // Invariant 2: childTop >= parentTop
            expect(cRect.y).toBeGreaterThanOrEqual(sRect.y - 0.02);
            // Invariant 3: childRight <= parentRight (STRICT right-edge test)
            expect(cRect.x + cRect.w).toBeLessThanOrEqual(sRect.x + sRect.w + 0.02);
            // Invariant 4: childBottom <= parentBottom
            expect(cRect.y + cRect.h).toBeLessThanOrEqual(sRect.y + sRect.h + 0.02);

            // Inner containment test: child fits within innerRect
            expect(cRect.x).toBeGreaterThanOrEqual(innerRect.x - 0.02);
            expect(cRect.y).toBeGreaterThanOrEqual(innerRect.y - 0.02);
            expect(cRect.x + cRect.w).toBeLessThanOrEqual(innerRect.x + innerRect.w + 0.02);
            expect(cRect.y + cRect.h).toBeLessThanOrEqual(innerRect.y + innerRect.h + 0.02);
          });
        }
      });
    });
  });

  it("Root Symmetrical Padding Test: Left and Right breathing room are strictly equal and symmetric", () => {
    const containerWidth = 1200;
    const containerHeight = 680;
    const padding = { top: 12, right: 12, bottom: 12, left: 12 };

    const innerX = padding.left;
    const innerY = padding.top;
    const innerWidth = Math.max(0, containerWidth - padding.left - padding.right);
    const innerHeight = Math.max(0, containerHeight - padding.top - padding.bottom);

    const rootBounds = { x: innerX, y: innerY, w: innerWidth, h: innerHeight };
    const rootRight = innerX + innerWidth;
    const rootBottom = innerY + innerHeight;

    const items = [
      { data: { sym: "AAPL" }, value: 3400 },
      { data: { sym: "MSFT" }, value: 3100 },
      { data: { sym: "NVDA" }, value: 3000 },
      { data: { sym: "GOOG" }, value: 2000 },
    ];

    const placed = squarify(items, rootBounds);
    expect(placed.length).toBe(items.length);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    placed.forEach((p) => {
      expect(p.rect.x).toBeGreaterThanOrEqual(innerX - 0.001);
      expect(p.rect.y).toBeGreaterThanOrEqual(innerY - 0.001);
      expect(p.rect.x + p.rect.w).toBeLessThanOrEqual(rootRight + 0.001);
      expect(p.rect.y + p.rect.h).toBeLessThanOrEqual(rootBottom + 0.001);

      if (p.rect.x < minX) minX = p.rect.x;
      if (p.rect.x + p.rect.w > maxX) maxX = p.rect.x + p.rect.w;
      if (p.rect.y < minY) minY = p.rect.y;
      if (p.rect.y + p.rect.h > maxY) maxY = p.rect.y + p.rect.h;
    });

    const leftBreathingRoom = minX;
    const rightBreathingRoom = containerWidth - maxX;
    const topBreathingRoom = minY;
    const bottomBreathingRoom = containerHeight - maxY;

    // Symmetrical horizontal margins
    expect(Math.abs(leftBreathingRoom - padding.left)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(rightBreathingRoom - padding.right)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(leftBreathingRoom - rightBreathingRoom)).toBeLessThanOrEqual(0.01);

    // Symmetrical vertical margins
    expect(Math.abs(topBreathingRoom - padding.top)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(bottomBreathingRoom - padding.bottom)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(topBreathingRoom - bottomBreathingRoom)).toBeLessThanOrEqual(0.01);
  });
});

