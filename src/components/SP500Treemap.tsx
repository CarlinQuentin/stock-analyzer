import React, { useState, useEffect, useMemo, useRef } from "react";
import { top500Service, Top500Company, Top500MarketData } from "../services/top500Service";
import { formatMarketCap } from "../utils/scoring";

interface Top500TreemapProps {
  onSelectStock: (ticker: string) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TreemapItem<T> {
  data: T;
  value: number;
}

interface PlacedNode<T> {
  data: T;
  rect: Rect;
}

/**
 * Strict rectangle bounds clamping to prevent any pixel from overflowing parent container
 */
function clampRect(rect: Rect, outer: Rect): Rect {
  const minX = Math.max(outer.x, Math.min(rect.x, outer.x + outer.w));
  const minY = Math.max(outer.y, Math.min(rect.y, outer.y + outer.h));
  const maxX = Math.min(outer.x + outer.w, Math.max(minX, rect.x + rect.w));
  const maxY = Math.min(outer.y + outer.h, Math.max(minY, rect.y + rect.h));

  return {
    x: Math.floor(minX * 10) / 10,
    y: Math.floor(minY * 10) / 10,
    w: Math.max(0, Math.floor((maxX - minX) * 10) / 10),
    h: Math.max(0, Math.floor((maxY - minY) * 10) / 10),
  };
}

/**
 * Standard Squarified Treemap Layout Engine (Bruls, Huizing, van Wijk) with strict bounds clamping
 */
function squarify<T>(items: TreemapItem<T>[], bounds: Rect): PlacedNode<T>[] {
  if (!items || items.length === 0 || bounds.w <= 0 || bounds.h <= 0) {
    return [];
  }

  const totalValue = items.reduce((acc, item) => acc + item.value, 0);
  if (totalValue <= 0) return [];

  const results: PlacedNode<T>[] = [];

  function layoutRow(row: TreemapItem<T>[], _rowArea: number, box: Rect, isHorizontal: boolean): Rect {
    const rowLength = row.reduce((sum, item) => sum + item.value, 0);
    const rowThickness = Math.min(rowLength / (isHorizontal ? box.h : box.w), isHorizontal ? box.w : box.h);

    let offset = 0;
    row.forEach((item, idx) => {
      const itemFraction = item.value / rowLength;
      let rect: Rect;

      if (isHorizontal) {
        const itemH = idx === row.length - 1 ? box.h - offset : box.h * itemFraction;
        rect = {
          x: box.x,
          y: box.y + offset,
          w: rowThickness,
          h: itemH,
        };
        offset += itemH;
      } else {
        const itemW = idx === row.length - 1 ? box.w - offset : box.w * itemFraction;
        rect = {
          x: box.x + offset,
          y: box.y,
          w: itemW,
          h: rowThickness,
        };
        offset += itemW;
      }

      results.push({ data: item.data, rect: clampRect(rect, box) });
    });

    if (isHorizontal) {
      return {
        x: box.x + rowThickness,
        y: box.y,
        w: Math.max(0, box.w - rowThickness),
        h: box.h,
      };
    } else {
      return {
        x: box.x,
        y: box.y + rowThickness,
        w: box.w,
        h: Math.max(0, box.h - rowThickness),
      };
    }
  }

  function worst(row: TreemapItem<T>[], sideLength: number): number {
    if (row.length === 0 || sideLength <= 0) return Infinity;
    const s = row.reduce((sum, item) => sum + item.value, 0);
    let max = -Infinity;
    let min = Infinity;

    row.forEach((item) => {
      const val = item.value;
      if (val > max) max = val;
      if (val < min) min = val;
    });

    const s2 = s * s;
    const side2 = sideLength * sideLength;

    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  }

  let remainingItems = items.map((item) => ({
    data: item.data,
    value: (item.value / totalValue) * (bounds.w * bounds.h),
  }));

  let currentBounds = { ...bounds };

  while (remainingItems.length > 0) {
    const sideLength = Math.min(currentBounds.w, currentBounds.h);
    if (sideLength <= 0) break;

    const isHorizontal = currentBounds.w >= currentBounds.h;

    let currentRow: typeof remainingItems = [remainingItems[0]];
    let currentWorst = worst(currentRow, sideLength);

    let i = 1;
    while (i < remainingItems.length) {
      const nextRow = [...currentRow, remainingItems[i]];
      const nextWorst = worst(nextRow, sideLength);

      if (nextWorst <= currentWorst) {
        currentRow = nextRow;
        currentWorst = nextWorst;
        i++;
      } else {
        break;
      }
    }

    const rowArea = currentRow.reduce((sum, item) => sum + item.value, 0);
    currentBounds = layoutRow(currentRow, rowArea, currentBounds, isHorizontal);
    remainingItems = remainingItems.slice(currentRow.length);
  }

  return results;
}

/**
 * Performance color mapping function
 */
function getPerformanceColor(pct: number): { bg: string; text: string; border: string } {
  if (pct === null || pct === undefined || isNaN(pct)) {
    return { bg: "#1e293b", text: "#94a3b8", border: "#334155" };
  }

  // Neutral (flat between -0.05% and +0.05%)
  if (Math.abs(pct) < 0.05) {
    return { bg: "#1e293b", text: "#cbd5e1", border: "#334155" };
  }

  if (pct > 0) {
    if (pct < 0.3) return { bg: "#064e3b", text: "#a7f3d0", border: "#047857" };
    if (pct < 1.0) return { bg: "#047857", text: "#ecfdf5", border: "#10b981" };
    if (pct < 2.5) return { bg: "#059669", text: "#ffffff", border: "#34d399" };
    if (pct < 5.0) return { bg: "#10b981", text: "#ffffff", border: "#6ee7b7" };
    return { bg: "#16a34a", text: "#ffffff", border: "#86efac" };
  } else {
    const abs = Math.abs(pct);
    if (abs < 0.3) return { bg: "#4c0519", text: "#fecdd3", border: "#9f1239" };
    if (abs < 1.0) return { bg: "#881337", text: "#fff1f2", border: "#e11d48" };
    if (abs < 2.5) return { bg: "#be123c", text: "#ffffff", border: "#fb7185" };
    if (abs < 5.0) return { bg: "#e11d48", text: "#ffffff", border: "#fda4af" };
    return { bg: "#dc2626", text: "#ffffff", border: "#fca5a5" };
  }
}

export const Top500Treemap: React.FC<Top500TreemapProps> = ({ onSelectStock }) => {
  const [data, setData] = useState<Top500MarketData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCompany, setHoveredCompany] = useState<Top500Company | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | "ALL">("ALL");

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 680,
  });

  // Measure container dimensions with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        const { width } = entries[0].contentRect;
        if (width > 0) {
          const calcHeight = Math.max(500, Math.min(780, width * 0.56));
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(calcHeight),
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fetchData = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const marketData = await top500Service.getTop500MarketData(forceRefresh);
      setData(marketData);
    } catch (err: any) {
      setError(err?.message || "Failed to load Top 100 market data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Track cursor position for floating tooltip
  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Filter companies by selected sector
  const filteredCompanies = useMemo(() => {
    if (!data) return [];
    if (selectedSectorFilter === "ALL") return data.companies;
    return data.companies.filter((c) => c.sector === selectedSectorFilter);
  }, [data, selectedSectorFilter]);

  // Compute Squarified Treemap layout hierarchy: Sectors -> Companies
  const layout = useMemo(() => {
    if (!data || filteredCompanies.length === 0) {
      return { placedSectors: [], placedCompanies: [] };
    }

    const { width, height } = dimensions;
    const canvasBounds: Rect = { x: 0, y: 0, w: width, h: height };
    const padding = 2;

    // Group companies into sectors
    const sectorMap = new Map<string, Top500Company[]>();
    filteredCompanies.forEach((c) => {
      const sec = c.sector || "Other";
      if (!sectorMap.has(sec)) sectorMap.set(sec, []);
      sectorMap.get(sec)!.push(c);
    });

    // Sector items sorted descending by sector market cap
    const sectorItems = Array.from(sectorMap.entries())
      .map(([sector, comps]) => ({
        data: { sector, comps },
        value: comps.reduce((acc, c) => acc + c.marketCap, 0),
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    // Lay out sector bounding boxes strictly clamped to canvas bounds
    const placedSectors = squarify(sectorItems, canvasBounds).map((sNode) => ({
      ...sNode,
      rect: clampRect(sNode.rect, canvasBounds),
    }));

    const placedCompanies: { company: Top500Company; rect: Rect; sector: string }[] = [];

    // Within each sector box, lay out company rectangles strictly clamped to innerRect
    placedSectors.forEach((secNode) => {
      const { sector, comps } = secNode.data;
      const sRect = secNode.rect;

      const headerHeight = sRect.h < 28 ? 0 : Math.min(22, Math.max(12, Math.floor(sRect.h * 0.12)));
      const innerRect: Rect = clampRect(
        {
          x: sRect.x + padding,
          y: sRect.y + headerHeight + padding,
          w: Math.max(0, sRect.w - padding * 2),
          h: Math.max(0, sRect.h - headerHeight - padding * 2),
        },
        sRect
      );

      if (innerRect.w <= 0 || innerRect.h <= 0) return;

      const compItems = comps
        .map((c) => ({ data: c, value: c.marketCap }))
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value);

      const placedComps = squarify(compItems, innerRect);

      placedComps.forEach((cNode) => {
        placedCompanies.push({
          company: cNode.data,
          rect: clampRect(cNode.rect, innerRect),
          sector,
        });
      });
    });

    return {
      placedSectors,
      placedCompanies,
    };
  }, [data, filteredCompanies, dimensions]);

  if (loading && !data) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4">
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-800 rounded animate-pulse"></div>
            <div className="h-4 w-72 bg-slate-800/60 rounded animate-pulse"></div>
          </div>
          <div className="h-8 w-32 bg-slate-800 rounded-lg animate-pulse"></div>
        </div>
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 min-h-[600px] grid grid-cols-4 gap-3 animate-pulse">
          <div className="col-span-2 row-span-2 bg-slate-900/80 rounded-xl p-4 border border-slate-800"></div>
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800"></div>
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800"></div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800"></div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800"></div>
          <div className="col-span-2 bg-slate-900/70 rounded-xl p-4 border border-slate-800"></div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center shadow-xl my-8">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-xl font-bold text-white mb-2">Market Data Unavailable</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">{error}</p>
        <button
          onClick={() => fetchData(true)}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg"
        >
          Retry Loading Treemap
        </button>
      </div>
    );
  }

  const { totalMarketCap, weightedChangePercent, marketStatus, lastUpdated, sectorSummaries } =
    data || {
      totalMarketCap: 0,
      weightedChangePercent: 0,
      marketStatus: "Closed" as const,
      lastUpdated: "",
      sectorSummaries: [],
    };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-4">
      {/* Treemap Header & Controls */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>🗺️</span> Top 100 U.S. Companies Treemap
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    marketStatus === "Open"
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      marketStatus === "Open" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                    }`}
                  ></span>
                  Market {marketStatus} {marketStatus === "Closed" ? "(Latest Session)" : ""}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  Updated {lastUpdated}
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Largest 100 U.S. companies • Market capitalization weighted • Real-time performance heatmap
            </p>
          </div>

          {/* Stats Badges & Sector Filter */}
          <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 block text-[10px] uppercase font-sans">Total Cap</span>
                <span className="font-extrabold text-white">{formatMarketCap(totalMarketCap)}</span>
              </div>
              <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                <span className="text-slate-400 block text-[10px] uppercase font-sans">Top 100 Day</span>
                <span
                  className={`font-extrabold ${
                    weightedChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {weightedChangePercent >= 0 ? "+" : ""}
                  {weightedChangePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh Top 100 quotes"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Sector Quick Filter Pills */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          <button
            onClick={() => setSelectedSectorFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
              selectedSectorFilter === "ALL"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            All Sectors (100)
          </button>
          {sectorSummaries.map((sec) => (
            <button
              key={sec.sector}
              onClick={() => setSelectedSectorFilter(sec.sector)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedSectorFilter === sec.sector
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>{sec.sector}</span>
              <span
                className={`text-[10px] font-mono font-extrabold px-1 rounded ${
                  sec.weightedChangePercent >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {sec.weightedChangePercent >= 0 ? "+" : ""}
                {sec.weightedChangePercent.toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Treemap Canvas Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCompany(null)}
        className="relative w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl min-h-[500px] select-none box-border"
        style={{ height: `${dimensions.height}px` }}
      >
        {/* Render Sector Bounding Area Labels */}
        {layout.placedSectors &&
          layout.placedSectors.map((secNode) => {
            const { sector } = secNode.data;
            const r = secNode.rect;
            const secSummary = sectorSummaries.find((s) => s.sector === sector);

            return (
              <div
                key={sector}
                className="absolute border border-slate-800/70 bg-slate-900/30 pointer-events-none rounded-md overflow-hidden box-border"
                style={{
                  left: `${r.x}px`,
                  top: `${r.y}px`,
                  width: `${r.w}px`,
                  height: `${r.h}px`,
                }}
              >
                {r.h >= 24 && (
                  <div className="px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-400/90 truncate flex items-center justify-between border-b border-slate-800/40 bg-slate-900/80">
                    <span className="truncate">{sector}</span>
                    {secSummary && r.w > 120 && (
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          secSummary.weightedChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {secSummary.weightedChangePercent >= 0 ? "+" : ""}
                        {secSummary.weightedChangePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {/* Render Company Rectangles */}
        {layout.placedCompanies &&
          layout.placedCompanies.map(({ company, rect }) => {
            const color = getPerformanceColor(company.changesPercentage);
            const isHovered = hoveredCompany?.symbol === company.symbol;

            const isLarge = rect.w >= 75 && rect.h >= 45;
            const isMedium = rect.w >= 45 && rect.h >= 28;
            const isSmall = rect.w >= 28 && rect.h >= 18;

            return (
              <div
                key={company.symbol}
                onClick={() => onSelectStock(company.symbol)}
                onMouseEnter={() => setHoveredCompany(company)}
                className={`absolute transition-all duration-150 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-0.5 rounded-sm box-border ${
                  isHovered ? "z-30 ring-2 ring-white scale-[1.01] shadow-2xl" : "z-10 hover:z-20"
                }`}
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.w}px`,
                  height: `${rect.h}px`,
                  backgroundColor: color.bg,
                  borderColor: color.border,
                  borderWidth: "1px",
                  boxSizing: "border-box",
                }}
              >
                {/* Labels based on block dimensions */}
                {isLarge ? (
                  <div className="text-center min-w-0 max-w-full px-0.5 leading-tight overflow-hidden">
                    <div className="font-extrabold text-xs sm:text-sm tracking-tight text-white truncate drop-shadow-sm">
                      {company.symbol}
                    </div>
                    <div className="text-[10px] text-slate-200/90 font-medium truncate hidden sm:block">
                      {company.name}
                    </div>
                    <div
                      className="text-[11px] font-black font-mono mt-0.5 drop-shadow-sm"
                      style={{ color: color.text }}
                    >
                      {company.changesPercentage >= 0 ? "+" : ""}
                      {company.changesPercentage.toFixed(2)}%
                    </div>
                  </div>
                ) : isMedium ? (
                  <div className="text-center min-w-0 max-w-full px-0.5 leading-tight overflow-hidden">
                    <div className="font-extrabold text-xs text-white truncate drop-shadow-sm">
                      {company.symbol}
                    </div>
                    <div
                      className="text-[10px] font-black font-mono drop-shadow-sm"
                      style={{ color: color.text }}
                    >
                      {company.changesPercentage >= 0 ? "+" : ""}
                      {company.changesPercentage.toFixed(2)}%
                    </div>
                  </div>
                ) : isSmall ? (
                  <div className="font-black text-[10px] text-white truncate drop-shadow-sm px-0.5 overflow-hidden">
                    {company.symbol}
                  </div>
                ) : null}
              </div>
            );
          })}

        {/* Polished Floating Hover Tooltip */}
        {hoveredCompany && (
          <div
            className="pointer-events-none fixed z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs w-64 space-y-2 animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${Math.min(window.innerWidth - 270, Math.max(10, mousePos.x + 20))}px`,
              top: `${Math.min(window.innerHeight - 220, Math.max(10, mousePos.y + 20))}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <div className="font-black text-sm text-white flex items-center gap-2">
                  <span className="truncate max-w-[140px]">{hoveredCompany.name}</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 flex-shrink-0">
                    {hoveredCompany.symbol}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{hoveredCompany.sector}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block font-sans">Price</span>
                <span className="font-bold text-white">${hoveredCompany.price.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-sans">Today's Change</span>
                <span
                  className={`font-bold ${
                    hoveredCompany.changesPercentage >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {hoveredCompany.changesPercentage >= 0 ? "+" : ""}
                  {hoveredCompany.changesPercentage.toFixed(2)}% (
                  {hoveredCompany.change >= 0 ? "+$" : "-$"}
                  {Math.abs(hoveredCompany.change).toFixed(2)})
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-sans">Market Capitalization</span>
                <span className="font-bold text-white">{formatMarketCap(hoveredCompany.marketCap)}</span>
              </div>
            </div>

            <div className="text-[10px] text-blue-400 font-sans text-center pt-1 border-t border-slate-800/60 font-semibold">
              Click to analyze {hoveredCompany.symbol} ➔
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const SP500Treemap = Top500Treemap;
