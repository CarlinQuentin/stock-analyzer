import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { top500Service, Top500Company, Top500MarketData, isValidTop100Snapshot } from "../services/top500Service";
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
 * Authoritative symmetrical root treemap drawing padding (in pixels)
 * Used to establish one explicit inner drawing rectangle for all treemap calculations
 */
export const ROOT_PADDING = {
  top: 12,
  right: 12,
  bottom: 12,
  left: 12,
};

export const CANVAS_MARGIN = ROOT_PADDING.left;
/**
 * Strict rectangle bounds clamping to guarantee every tile fits completely inside parent rectangle
 */
export function clampRect(rect: Rect, outer: Rect): Rect {
  const outerRight = outer.x + outer.w;
  const outerBottom = outer.y + outer.h;

  const minX = Math.max(outer.x, Math.min(rect.x, outerRight));
  const minY = Math.max(outer.y, Math.min(rect.y, outerBottom));
  const maxX = Math.min(outerRight, Math.max(minX, rect.x + rect.w));
  const maxY = Math.min(outerBottom, Math.max(minY, rect.y + rect.h));

  const x = Math.floor(minX * 100) / 100;
  const y = Math.floor(minY * 100) / 100;
  const maxAvailableW = Math.max(0, outerRight - x);
  const maxAvailableH = Math.max(0, outerBottom - y);
  const w = Math.max(0, Math.min(Math.floor((maxX - minX) * 100) / 100, maxAvailableW));
  const h = Math.max(0, Math.min(Math.floor((maxY - minY) * 100) / 100, maxAvailableH));

  return { x, y, w, h };
}

/**
 * Calculate responsive dynamic typography and content mode for a treemap tile
 */
export function getTileContentConfig(w: number, h: number) {
  const innerW = Math.max(0, w - 2);
  const innerH = Math.max(0, h - 2);

  // Dynamic font sizing based on available tile interior width & height
  const tickerFontSize = Math.max(8, Math.min(13, Math.floor(Math.min(innerW * 0.22, innerH * 0.34))));
  const changeFontSize = Math.max(7, Math.min(10, Math.floor(tickerFontSize * 0.8)));

  let showName = false;
  let showChange = false;

  if (innerW >= 70 && innerH >= 42) {
    showName = true;
    showChange = true;
  } else if (innerW >= 32 && innerH >= 20) {
    showChange = true;
  }

  return {
    tickerFontSize,
    changeFontSize,
    showName,
    showChange,
  };
}

/**
 * Standard Squarified Treemap Layout Engine (Bruls, Huizing, van Wijk) with strict bounds clamping
 */
export function squarify<T>(items: TreemapItem<T>[], bounds: Rect): PlacedNode<T>[] {
  if (!items || items.length === 0 || bounds.w <= 0 || bounds.h <= 0) {
    return [];
  }

  const validItems = items.filter((item) => item && typeof item.value === "number" && !isNaN(item.value) && item.value > 0);
  if (validItems.length === 0) return [];

  const totalValue = validItems.reduce((acc, item) => acc + item.value, 0);
  if (totalValue <= 0) return [];

  const results: PlacedNode<T>[] = [];

  function worst(row: { data: T; value: number }[], sideLength: number, totalRemVal: number, remBoundsArea: number): number {
    if (row.length === 0 || sideLength <= 0 || totalRemVal <= 0) return Infinity;
    const rowValSum = row.reduce((sum, item) => sum + item.value, 0);
    const rowArea = (rowValSum / totalRemVal) * remBoundsArea;
    const thickness = rowArea / sideLength;
    if (thickness <= 0) return Infinity;

    let maxAspect = -Infinity;
    for (const item of row) {
      const itemLength = (item.value / rowValSum) * sideLength;
      if (itemLength <= 0) return Infinity;
      const aspect = Math.max(thickness / itemLength, itemLength / thickness);
      if (aspect > maxAspect) maxAspect = aspect;
    }
    return maxAspect;
  }

  let remItems = [...validItems];
  let remTotalVal = totalValue;
  let remBounds: Rect = {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
  };

  const boundsRight = bounds.x + bounds.w;
  const boundsBottom = bounds.y + bounds.h;

  while (remItems.length > 0) {
    const sideLength = Math.min(remBounds.w, remBounds.h);
    if (sideLength <= 0) {
      // Place any remaining zero-space items at safe boundary without overflowing
      for (const item of remItems) {
        results.push({
          data: item.data,
          rect: {
            x: Math.min(remBounds.x, boundsRight),
            y: Math.min(remBounds.y, boundsBottom),
            w: 0,
            h: 0,
          },
        });
      }
      break;
    }

    const isHorizontal = remBounds.w >= remBounds.h;
    const remBoundsArea = remBounds.w * remBounds.h;

    let currentRow: typeof remItems = [remItems[0]];
    let currentWorst = worst(currentRow, sideLength, remTotalVal, remBoundsArea);

    let i = 1;
    while (i < remItems.length) {
      const nextRow = [...currentRow, remItems[i]];
      const nextWorst = worst(nextRow, sideLength, remTotalVal, remBoundsArea);

      if (nextWorst <= currentWorst) {
        currentRow = nextRow;
        currentWorst = nextWorst;
        i++;
      } else {
        break;
      }
    }

    const rowValSum = currentRow.reduce((sum, item) => sum + item.value, 0);
    const isLastRow = currentRow.length === remItems.length;

    // Calculate row thickness strictly within remaining bounds
    let rowThickness: number;
    if (isHorizontal) {
      rowThickness = isLastRow
        ? remBounds.w
        : Math.min(remBounds.w, (rowValSum / remTotalVal) * remBounds.w);
    } else {
      rowThickness = isLastRow
        ? remBounds.h
        : Math.min(remBounds.h, (rowValSum / remTotalVal) * remBounds.h);
    }

    // Lay out items within this row
    let offset = 0;
    const availableSide = isHorizontal ? remBounds.h : remBounds.w;

    currentRow.forEach((item, idx) => {
      const isLastItemInRow = idx === currentRow.length - 1;
      const itemFraction = item.value / rowValSum;

      let itemSize: number;
      if (isLastItemInRow) {
        itemSize = Math.max(0, availableSide - offset);
      } else {
        itemSize = Math.max(0, Math.min(availableSide - offset, itemFraction * availableSide));
      }

      let rawX: number;
      let rawY: number;
      let rawW: number;
      let rawH: number;

      if (isHorizontal) {
        rawX = remBounds.x;
        rawY = remBounds.y + offset;
        rawW = rowThickness;
        rawH = itemSize;
      } else {
        rawX = remBounds.x + offset;
        rawY = remBounds.y;
        rawW = itemSize;
        rawH = rowThickness;
      }

      offset += itemSize;

      // Strictly clamp coordinates to parent bounds with 2-decimal precision
      const clampedX = Math.floor(Math.max(bounds.x, Math.min(rawX, boundsRight)) * 100) / 100;
      const clampedY = Math.floor(Math.max(bounds.y, Math.min(rawY, boundsBottom)) * 100) / 100;
      const maxW = Math.max(0, boundsRight - clampedX);
      const maxH = Math.max(0, boundsBottom - clampedY);
      const clampedW = Math.max(0, Math.min(Math.floor(rawW * 100) / 100, maxW));
      const clampedH = Math.max(0, Math.min(Math.floor(rawH * 100) / 100, maxH));

      results.push({
        data: item.data,
        rect: {
          x: clampedX,
          y: clampedY,
          w: clampedW,
          h: clampedH,
        },
      });
    });

    // Advance remaining bounds
    if (isHorizontal) {
      const nextX = remBounds.x + rowThickness;
      remBounds = {
        x: nextX,
        y: remBounds.y,
        w: Math.max(0, boundsRight - nextX),
        h: remBounds.h,
      };
    } else {
      const nextY = remBounds.y + rowThickness;
      remBounds = {
        x: remBounds.x,
        y: nextY,
        w: remBounds.w,
        h: Math.max(0, boundsBottom - nextY),
      };
    }

    remItems = remItems.slice(currentRow.length);
    remTotalVal = Math.max(0, remTotalVal - rowValSum);
  }

  return results;
}

/**
 * Finviz-style performance color mapping function based strictly on empirical FMP percentage
 */
function getPerformanceColor(pct: number | null): { bg: string; text: string; border: string } {
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
  const [mouseClientPos, setMouseClientPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | "ALL">("ALL");

  // Finviz Interactive Map Zoom & Pan State
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 680,
  });

  // Callback ref to capture element mounting immediately after loading completes
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) {
      const clientW = node.clientWidth > 0 ? node.clientWidth : Math.floor(node.getBoundingClientRect().width);
      if (clientW > 0) {
        let calcHeight = 680;
        if (clientW >= 1024) {
          calcHeight = Math.max(560, Math.min(850, Math.floor(clientW * 0.52)));
        } else if (clientW >= 640) {
          calcHeight = Math.max(520, Math.floor(clientW * 0.65));
        } else {
          calcHeight = Math.max(550, Math.floor(clientW * 0.9));
        }
        setDimensions({ width: clientW, height: calcHeight });
      }
    }
  }, []);

  // Keep ref values in sync for native wheel listener
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  // Measure container dimensions with ResizeObserver and calculate responsive height curve
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      if (containerRef.current) {
        const target = containerRef.current;
        const rect = target.getBoundingClientRect();
        const clientW = target.clientWidth > 0 ? target.clientWidth : Math.floor(rect.width);
        if (clientW > 0) {
          let calcHeight = 680;
          if (clientW >= 1024) {
            calcHeight = Math.max(560, Math.min(850, Math.floor(clientW * 0.52)));
          } else if (clientW >= 640) {
            calcHeight = Math.max(520, Math.floor(clientW * 0.65));
          } else {
            calcHeight = Math.max(550, Math.floor(clientW * 0.9));
          }

          setDimensions({ width: clientW, height: calcHeight });
        }
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [loading, Boolean(data)]);

  // Native non-passive wheel event listener to lock broader page scrolling while mouse is over the chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      // Prevent broader page from scrolling when mouse is over the chart container
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      let newZoom = Math.min(4.5, Math.max(1.0, currentZoom * zoomFactor));

      if (newZoom <= 1.001) {
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
        return;
      }

      const pointX = (mouseX - currentPan.x) / currentZoom;
      const pointY = (mouseY - currentPan.y) / currentZoom;

      let newPanX = mouseX - pointX * newZoom;
      let newPanY = mouseY - pointY * newZoom;

      const minPanX = -rect.width * (newZoom - 1);
      const minPanY = -rect.height * (newZoom - 1);

      newPanX = Math.min(0, Math.max(minPanX, newPanX));
      newPanY = Math.min(0, Math.max(minPanY, newPanY));

      setZoom(newZoom);
      setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    };

    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onNativeWheel);
    };
  }, [loading, Boolean(data)]);

  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const fetchData = async (forceRefresh: boolean = false) => {
    const currentReqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const marketData = await top500Service.getTop500MarketData(forceRefresh);
      if (!isMountedRef.current || currentReqId !== requestIdRef.current) {
        // Obsolete or unmounted request — ignore
        return;
      }
      if (isValidTop100Snapshot(marketData)) {
        setData(marketData);
      } else {
        setError("Market dataset is incomplete. Please refresh.");
      }
    } catch (err: any) {
      if (!isMountedRef.current || currentReqId !== requestIdRef.current) return;
      setError(err?.message || "Failed to load Top 100 market data.");
    } finally {
      if (isMountedRef.current && currentReqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    // Subscribe to background SWR refreshes
    const unsubscribe = top500Service.subscribe((freshData) => {
      if (isMountedRef.current && isValidTop100Snapshot(freshData)) {
        setData(freshData);
        setLoading(false);
        setError(null);
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  // Finviz Interactive Map: Drag-to-Pan (active when zoomed > 1.0)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1.001) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMouseClientPos({ x: e.clientX, y: e.clientY });

    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    let newPanX = panStartRef.current.x + dx;
    let newPanY = panStartRef.current.y + dy;

    const minPanX = -rect.width * (zoom - 1);
    const minPanY = -rect.height * (zoom - 1);

    newPanX = Math.min(0, Math.max(minPanX, newPanX));
    newPanY = Math.min(0, Math.max(minPanY, newPanY));

    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double Click: Reset Zoom & Pan to fit container (100%)
  const handleDoubleClick = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Filter companies by selected sector
  const filteredCompanies = useMemo(() => {
    if (!data) return [];
    if (selectedSectorFilter === "ALL") return data.companies;
    return data.companies.filter((c) => c.sector === selectedSectorFilter);
  }, [data, selectedSectorFilter]);

  // Compute Squarified Treemap layout hierarchy: Sectors -> Companies within safe inset bounds
  const layout = useMemo(() => {
    if (!data || filteredCompanies.length === 0) {
      return { placedSectors: [], placedCompanies: [] };
    }

    const { width: containerWidth, height: containerHeight } = dimensions;

    // Establish ONE authoritative inner drawing rectangle before performing any treemap calculations
    const padding = ROOT_PADDING;
    const innerX = padding.left;
    const innerY = padding.top;
    const innerWidth = Math.max(0, containerWidth - padding.left - padding.right);
    const innerHeight = Math.max(0, containerHeight - padding.top - padding.bottom);

    const rootBounds: Rect = {
      x: innerX,
      y: innerY,
      w: innerWidth,
      h: innerHeight,
    };

    const rootRight = innerX + innerWidth;
    const rootBottom = innerY + innerHeight;
    const sectorPadding = 2;

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

    // Lay out sector bounding boxes strictly clamped to rootBounds (innerWidth x innerHeight)
    const placedSectors = squarify(sectorItems, rootBounds).map((sNode) => ({
      ...sNode,
      rect: clampRect(sNode.rect, rootBounds),
    }));

    const placedCompanies: { company: Top500Company; rect: Rect; sector: string }[] = [];

    // Within each sector box, lay out company rectangles strictly clamped to sector inner bounds and root bounds
    placedSectors.forEach((secNode) => {
      const { sector, comps } = secNode.data;
      const sRect = secNode.rect;

      const hasHeader = sRect.h >= 24;
      const headerHeight = hasHeader ? Math.min(20, Math.max(15, Math.floor(sRect.h * 0.12))) : 0;
      const innerXSec = sRect.x + sectorPadding;
      const innerYSec = sRect.y + headerHeight + sectorPadding;
      const innerWSec = Math.max(0, sRect.w - sectorPadding * 2);
      const innerHSec = Math.max(0, sRect.h - headerHeight - sectorPadding * 2);

      const sectorInnerRect: Rect = clampRect(
        {
          x: innerXSec,
          y: innerYSec,
          w: innerWSec,
          h: innerHSec,
        },
        sRect
      );

      const compItems = comps
        .map((c) => ({ data: c, value: c.marketCap }))
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value);

      if (sectorInnerRect.w > 0 && sectorInnerRect.h > 0) {
        const placedComps = squarify(compItems, sectorInnerRect);

        placedComps.forEach((cNode) => {
          let cRect = clampRect(cNode.rect, sectorInnerRect);

          // Add boundary protection: strictly enforce root bounds
          cRect = {
            x: Math.max(innerX, Math.min(cRect.x, rootRight)),
            y: Math.max(innerY, Math.min(cRect.y, rootBottom)),
            w: Math.max(0, Math.min(cRect.w, rootRight - cRect.x)),
            h: Math.max(0, Math.min(cRect.h, rootBottom - cRect.y)),
          };

          placedCompanies.push({
            company: cNode.data,
            rect: cRect,
            sector,
          });
        });
      }
    });

    // Development-time validation: ensure no rectangle escapes root bounds
    const EPSILON = 0.5;
    placedSectors.forEach((sNode) => {
      const rect = sNode.rect;
      if (
        rect.x < innerX - EPSILON ||
        rect.y < innerY - EPSILON ||
        rect.x + rect.w > rootRight + EPSILON ||
        rect.y + rect.h > rootBottom + EPSILON
      ) {
        console.warn("Treemap sector rectangle escaped root bounds", {
          sector: sNode.data.sector,
          rect,
          innerX,
          innerY,
          innerWidth,
          innerHeight,
          rootRight,
          rootBottom,
        });
      }
    });

    placedCompanies.forEach(({ company, rect }) => {
      if (
        rect.x < innerX - EPSILON ||
        rect.y < innerY - EPSILON ||
        rect.x + rect.w > rootRight + EPSILON ||
        rect.y + rect.h > rootBottom + EPSILON
      ) {
        console.warn("Treemap stock rectangle escaped root bounds", {
          symbol: company.symbol,
          rect,
          innerX,
          innerY,
          innerWidth,
          innerHeight,
          rootRight,
          rootBottom,
        });
      }
    });

    return {
      placedSectors,
      placedCompanies,
    };
  }, [data, filteredCompanies, dimensions]);

  if (loading && !data) {
    return (
      <div className="w-full space-y-4">
        <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-lg dark:shadow-xl flex items-center justify-between transition-colors">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse"></div>
          </div>
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
        </div>
        <div className="bg-slate-900/95 dark:bg-slate-950 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 min-h-[600px] grid grid-cols-4 gap-3 animate-pulse transition-colors">
          <div className="col-span-2 row-span-2 bg-slate-800/80 dark:bg-slate-900/80 rounded-xl p-4 border border-slate-700/60 dark:border-slate-800"></div>
          <div className="bg-slate-800/60 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-700/60 dark:border-slate-800"></div>
          <div className="bg-slate-800/60 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-700/60 dark:border-slate-800"></div>
          <div className="bg-slate-800/50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-700/60 dark:border-slate-800"></div>
          <div className="bg-slate-800/50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-700/60 dark:border-slate-800"></div>
          <div className="col-span-2 bg-slate-800/70 dark:bg-slate-900/70 rounded-xl p-4 border border-slate-700/60 dark:border-slate-800"></div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 text-center shadow-lg dark:shadow-xl my-8 transition-colors">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Market Data Unavailable</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">{error}</p>
        <button
          onClick={() => fetchData(true)}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md"
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

  // Compute side offset position for hover tooltip so tile under mouse cursor remains 100% visible
  const tooltipWidth = 260;
  const tooltipHeight = 170;
  const offsetDist = 45;

  const prefersRight = mouseClientPos.x + offsetDist + tooltipWidth < (typeof window !== "undefined" ? window.innerWidth : 1200) - 20;
  const tooltipLeft = prefersRight
    ? mouseClientPos.x + offsetDist
    : Math.max(10, mouseClientPos.x - offsetDist - tooltipWidth);

  const prefersBelow = mouseClientPos.y + offsetDist + tooltipHeight < (typeof window !== "undefined" ? window.innerHeight : 800) - 20;
  const tooltipTop = prefersBelow
    ? mouseClientPos.y + 10
    : Math.max(10, mouseClientPos.y - tooltipHeight);

  return (
    <div className="w-full space-y-4 overflow-hidden">
      {/* Treemap Header & Controls */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-lg dark:shadow-xl transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>🗺️</span> Top 100 U.S. Companies Market Map
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                    marketStatus === "Open"
                      ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      marketStatus === "Open" ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-slate-400"
                    }`}
                  ></span>
                  Market {marketStatus} {marketStatus === "Closed" ? "(Latest Session)" : ""}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
                  Updated {lastUpdated}
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Finviz-style Market Map • Area weighted by Market Cap • Heatmap colored by Performance
            </p>
          </div>

          {/* Stats Badges & Sector Filter */}
          <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="bg-slate-100/90 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans font-semibold">Total Cap</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{formatMarketCap(totalMarketCap)}</span>
              </div>
              <div className="bg-slate-100/90 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-sans font-semibold">Top 100 Day</span>
                <span
                  className={`font-extrabold ${
                    weightedChangePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
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
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              title="Refresh Top 100 quotes"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Sector Quick Filter Pills */}
        <div className="mt-4 pt-3 border-t border-slate-200/90 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          <button
            onClick={() => setSelectedSectorFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
              selectedSectorFilter === "ALL"
                ? "treemap-pill-active bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "treemap-pill-inactive bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/80 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 dark:border-transparent"
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
                  ? "treemap-pill-active bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "treemap-pill-inactive bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/80 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 dark:border-transparent"
              }`}
            >
              <span>{sec.sector}</span>
              <span
                className={`text-[10px] font-mono font-extrabold px-1 rounded ${
                  sec.weightedChangePercent >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {sec.weightedChangePercent >= 0 ? "+" : ""}
                {sec.weightedChangePercent.toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Finviz Treemap Canvas Container */}
      <div
        ref={setContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setHoveredCompany(null);
        }}
        onDoubleClick={handleDoubleClick}
        className={`treemap-canvas-container relative w-full max-w-full bg-slate-900/95 dark:bg-slate-950 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl dark:shadow-2xl min-h-[500px] select-none box-border overflow-hidden transition-colors ${
          zoom > 1.001 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
        }`}
        style={{ height: `${dimensions.height}px` }}
      >
        {/* Transform Viewport Layer (Smooth Pan & Zoom Matrix) */}
        <div
          className="w-full h-full relative origin-top-left transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
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
                  className="treemap-sector-box absolute border border-slate-700/60 dark:border-slate-800/70 bg-slate-800/30 dark:bg-slate-900/30 pointer-events-none rounded-md overflow-hidden box-border transition-colors"
                  style={{
                    left: `${r.x}px`,
                    top: `${r.y}px`,
                    width: `${r.w}px`,
                    height: `${r.h}px`,
                  }}
                >
                  {r.h >= 24 && (
                    <div
                      className="treemap-sector-header px-2 text-[10px] font-black uppercase tracking-wider text-slate-200/90 dark:text-slate-400/90 truncate flex items-center justify-between border-b border-slate-700/50 dark:border-slate-800/40 bg-slate-800/95 dark:bg-slate-900/80 leading-none box-border transition-colors"
                      style={{
                        height: `${Math.min(20, Math.max(15, Math.floor(r.h * 0.12)))}px`,
                      }}
                    >
                      <span className="truncate max-w-[70%]">{sector}</span>
                      {secSummary && r.w > 110 && (
                        <span
                          className={`font-mono text-[9px] font-bold ${
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
              const config = getTileContentConfig(rect.w, rect.h);

              return (
                <div
                  key={company.symbol}
                  onClick={() => onSelectStock(company.symbol)}
                  onMouseEnter={() => setHoveredCompany(company)}
                  className={`treemap-tile absolute transition-all duration-150 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-0.5 rounded-sm box-border select-none ${
                    isHovered ? "treemap-tile-hovered z-30 ring-2 ring-white dark:ring-white scale-[1.005] shadow-2xl" : "z-10 hover:z-20"
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
                  {/* Dynamically scaled content fitting tile bounds strictly */}
                  <div className="flex flex-col items-center justify-center w-full h-full p-0.5 overflow-hidden leading-none select-none pointer-events-none text-center">
                    <div
                      className="font-extrabold tracking-tight text-white truncate max-w-full drop-shadow-sm leading-none"
                      style={{ fontSize: `${config.tickerFontSize}px` }}
                    >
                      {company.symbol}
                    </div>

                    {config.showName && (
                      <div className="text-[9px] text-slate-100/90 font-medium truncate max-w-full leading-none mt-0.5 hidden sm:block">
                        {company.name}
                      </div>
                    )}

                    {config.showChange && (
                      <div
                        className="font-black font-mono leading-none mt-0.5 max-w-full truncate drop-shadow-sm"
                        style={{
                          fontSize: `${config.changeFontSize}px`,
                          color: color.text,
                        }}
                      >
                        {company.changesPercentage !== null
                          ? `${company.changesPercentage >= 0 ? "+" : ""}${company.changesPercentage.toFixed(2)}%`
                          : "N/A"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Polished Side-Shifted Floating Hover Tooltip */}
        {hoveredCompany && (
          <div
            className="treemap-tooltip pointer-events-none fixed z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs w-64 space-y-2 animate-in fade-in zoom-in-95 duration-100 text-slate-800 dark:text-slate-100"
            style={{
              left: `${tooltipLeft}px`,
              top: `${tooltipTop}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
              <div>
                <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="truncate max-w-[130px]">{hoveredCompany.name}</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex-shrink-0">
                    {hoveredCompany.symbol}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hoveredCompany.sector}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-sans">Price</span>
                <span className="font-bold text-slate-900 dark:text-white">${hoveredCompany.price.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-sans">Today's Change</span>
                <span
                  className={`font-bold ${
                    hoveredCompany.changesPercentage !== null
                      ? hoveredCompany.changesPercentage >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  {hoveredCompany.changesPercentage !== null
                    ? `${hoveredCompany.changesPercentage >= 0 ? "+" : ""}${hoveredCompany.changesPercentage.toFixed(2)}%`
                    : "N/A"}
                  {hoveredCompany.change !== null
                    ? ` (${hoveredCompany.change >= 0 ? "+" : ""}$${hoveredCompany.change.toFixed(2)})`
                    : ""}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-sans">Industry</span>
                <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px] truncate block">
                  {hoveredCompany.industry}
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-sans">Market Capitalization</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatMarketCap(hoveredCompany.marketCap)}</span>
              </div>
            </div>

            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-sans text-center pt-1 border-t border-slate-200/80 dark:border-slate-800/60 font-semibold">
              Click to analyze {hoveredCompany.symbol} ➔
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const SP500Treemap = Top500Treemap;
