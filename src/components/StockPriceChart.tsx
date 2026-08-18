import React, { useState, useMemo, useEffect } from "react";
import { HistoricalPricePoint, CompanyProfile, HistoricalPeriod } from "../types";
import { calculateStockPriceCAGR, calculateTotalReturnCAGR } from "../utils/financialCalculations";
import { fmpService } from "../services/financialModelingPrep";
import {
  calculateRangeSelection,
  RangeSelectionStats,
  parseDateString,
} from "../utils/chartRangeSelection";

interface StockPriceChartProps {
  priceHistory: HistoricalPricePoint[];
  profile: CompanyProfile;
  selectedPeriod?: HistoricalPeriod;
}

type Timeframe = "1D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y";

const mapPeriodToTimeframe = (p?: HistoricalPeriod): Timeframe => {
  if (p === "3Y") return "3Y";
  return "5Y"; // 5Y is maximum available for stock price data
};

export const StockPriceChart: React.FC<StockPriceChartProps> = ({
  priceHistory,
  profile,
  selectedPeriod,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>(mapPeriodToTimeframe(selectedPeriod));
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [intradayData, setIntradayData] = useState<HistoricalPricePoint[]>([]);
  const [isLoadingIntraday, setIsLoadingIntraday] = useState<boolean>(false);

  // Range Selection States
  const [selection, setSelection] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragCurrentIndex, setDragCurrentIndex] = useState<number | null>(null);

  // Sync timeframe with selectedPeriod when global selector changes
  useEffect(() => {
    if (selectedPeriod) {
      setTimeframe(mapPeriodToTimeframe(selectedPeriod));
      setHoveredIndex(null);
      setSelection(null);
    }
  }, [selectedPeriod]);

  // Reset range selection and hover on timeframe or symbol change
  useEffect(() => {
    setSelection(null);
    setIsDragging(false);
    setDragStartIndex(null);
    setDragCurrentIndex(null);
    setHoveredIndex(null);
  }, [timeframe, profile.symbol]);

  // Clear selection on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setIsDragging(false);
        setDragStartIndex(null);
        setDragCurrentIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch 1D 5-minute intraday prices when 1D timeframe is selected
  useEffect(() => {
    if (timeframe === "1D" && profile.symbol) {
      setIsLoadingIntraday(true);
      fmpService
        .getIntradayPrices(profile.symbol)
        .then((pts) => {
          setIntradayData(pts);
        })
        .catch((err) => {
          console.warn("Failed to load 1D intraday price data:", err);
        })
        .finally(() => {
          setIsLoadingIntraday(false);
        });
    }
  }, [timeframe, profile.symbol]);

  // Filter historical or intraday data based on selected timeframe
  const filteredData = useMemo(() => {
    if (timeframe === "1D") {
      return intradayData;
    }

    if (!priceHistory || priceHistory.length === 0) return [];

    const latestDateStr = priceHistory[priceHistory.length - 1].date;
    const latestDate = parseDateString(latestDateStr);

    let cutoffDate = new Date(latestDate);

    switch (timeframe) {
      case "1M":
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
      case "3M":
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        break;
      case "6M":
        cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        break;
      case "YTD":
        cutoffDate = new Date(latestDate.getFullYear(), 0, 1);
        break;
      case "1Y":
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        break;
      case "3Y":
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 3);
        break;
      case "5Y":
      default:
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
        break;
    }

    const filtered = priceHistory.filter((pt) => parseDateString(pt.date) >= cutoffDate);
    return filtered.length > 0 ? filtered : priceHistory;
  }, [priceHistory, intradayData, timeframe]);

  // Statistics for the full selected timeframe
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      const currentPrice = profile.price || 0;
      return {
        startPrice: currentPrice,
        endPrice: currentPrice,
        change: 0,
        changePercent: 0,
        priceCAGR: null,
        totalReturnCAGR: null,
        annualCAGR: null,
        high: currentPrice,
        low: currentPrice,
        avgVolume: 0,
        isPositive: true,
      };
    }

    const startPrice = filteredData[0].close;
    const startAdjClose = filteredData[0].adjClose;
    const startDateStr = filteredData[0].date;
    const endPoint = filteredData[filteredData.length - 1];
    const endPrice = endPoint.close;
    const endAdjClose = endPoint.adjClose;
    const endDateStr = endPoint.date;

    const change = endPrice - startPrice;
    const changePercent = startPrice > 0 ? (change / startPrice) * 100 : 0;

    let years = 0;
    if (startDateStr && endDateStr) {
      const startMs = parseDateString(startDateStr).getTime();
      const endMs = parseDateString(endDateStr).getTime();
      const diffMs = endMs - startMs;
      years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    }

    if (years <= 0.1) {
      if (timeframe === "5Y") years = 5;
      else if (timeframe === "3Y") years = 3;
      else if (timeframe === "1Y") years = 1;
      else if (timeframe === "6M") years = 0.5;
      else if (timeframe === "3M") years = 0.25;
      else if (timeframe === "1M") years = 1 / 12;
    }

    const priceCAGR = calculateStockPriceCAGR(startPrice, endPrice, years);
    const totalReturnCAGR = calculateTotalReturnCAGR(startAdjClose, endAdjClose, years);

    let high = -Infinity;
    let low = Infinity;
    let totalVolume = 0;

    filteredData.forEach((pt) => {
      const h = pt.high ?? pt.close;
      const l = pt.low ?? pt.close;
      if (h > high) high = h;
      if (l < low) low = l;
      totalVolume += pt.volume || 0;
    });

    const avgVolume = totalVolume / filteredData.length;

    return {
      startPrice,
      endPrice,
      change,
      changePercent,
      priceCAGR,
      totalReturnCAGR,
      annualCAGR: priceCAGR,
      high: high === -Infinity ? endPrice : high,
      low: low === Infinity ? endPrice : low,
      avgVolume,
      isPositive: change >= 0,
    };
  }, [filteredData, profile, timeframe]);

  // Chart dimensions & scaling
  const width = 800;
  const height = 300;
  const paddingLeft = 28;
  const paddingRight = 72;
  const paddingTop = 25;
  const paddingBottom = 42;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Active hover point (when not dragging)
  const activePoint =
    hoveredIndex !== null && filteredData[hoveredIndex]
      ? filteredData[hoveredIndex]
      : filteredData[filteredData.length - 1];

  const activeIndex =
    hoveredIndex !== null && filteredData[hoveredIndex]
      ? hoveredIndex
      : filteredData.length - 1;

  // Active point stats relative to start of period
  const activeChange =
    activePoint && filteredData.length > 0 ? activePoint.close - filteredData[0].close : 0;
  const activeChangePercent =
    filteredData.length > 0 && filteredData[0].close > 0
      ? (activeChange / filteredData[0].close) * 100
      : 0;

  // Min and Max prices for scaling Y axis
  const { yTicks, xTicks, points } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minPrice: 0, maxPrice: 100, yTicks: [], xTicks: [], points: [], maxVolume: 1 };
    }

    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    filteredData.forEach((d) => {
      if (d.close < min) min = d.close;
      if (d.close > max) max = d.close;
      if ((d.volume || 0) > maxVol) maxVol = d.volume || 0;
    });

    // Add padding to Y-axis min/max
    const range = max - min || max * 0.1 || 1;
    const paddedMin = Math.max(0, min - range * 0.08);
    const paddedMax = max + range * 0.08;

    // Map points to SVG coordinates
    const pts = filteredData.map((d, index) => {
      const x = paddingLeft + (index / (filteredData.length - 1 || 1)) * chartWidth;
      const y =
        paddingTop + chartHeight - ((d.close - paddedMin) / (paddedMax - paddedMin)) * chartHeight;
      const volY =
        height - paddingBottom - ((d.volume || 0) / (maxVol || 1)) * (chartHeight * 0.22);
      return { x, y, volY, data: d, index };
    });

    // Y axis ticks (5 ticks)
    const yTickCount = 5;
    const yTks = Array.from({ length: yTickCount }).map((_, i) => {
      const val = paddedMin + (i / (yTickCount - 1)) * (paddedMax - paddedMin);
      const y = paddingTop + chartHeight - (i / (yTickCount - 1)) * chartHeight;
      return { val, y };
    });

    // X axis ticks (approx 6 ticks)
    const xTickCount = Math.min(6, filteredData.length);
    const xTks = Array.from({ length: xTickCount }).map((_, i) => {
      const idx = Math.round((i / (xTickCount - 1)) * (filteredData.length - 1));
      const pt = pts[idx];
      let formattedDate = "";
      if (pt && pt.data.date) {
        const d = parseDateString(pt.data.date);
        if (timeframe === "1D") {
          formattedDate = d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
        } else {
          formattedDate = d.toLocaleDateString("en-US", {
            month: "short",
            year: timeframe === "1M" || timeframe === "3M" ? undefined : "2-digit",
            day:
              timeframe === "1M" || timeframe === "3M" || timeframe === "6M"
                ? "numeric"
                : undefined,
          });
        }
      }
      return { label: formattedDate, x: pt ? pt.x : 0 };
    });

    return {
      minPrice: paddedMin,
      maxPrice: paddedMax,
      yTicks: yTks,
      xTicks: xTks,
      points: pts,
      maxVolume: maxVol,
    };
  }, [filteredData, chartWidth, chartHeight, paddingLeft, paddingTop, paddingBottom, height, timeframe]);

  // Real-time Range Selection calculation (during drag or when selection is active)
  const rangeStats: RangeSelectionStats | null = useMemo(() => {
    if (filteredData.length === 0) return null;

    if (isDragging && dragStartIndex !== null && dragCurrentIndex !== null) {
      if (dragStartIndex === dragCurrentIndex) return null;
      return calculateRangeSelection(
        filteredData,
        dragStartIndex,
        dragCurrentIndex,
        timeframe === "1D"
      );
    }

    if (selection !== null) {
      return calculateRangeSelection(
        filteredData,
        selection.startIndex,
        selection.endIndex,
        timeframe === "1D"
      );
    }

    return null;
  }, [filteredData, isDragging, dragStartIndex, dragCurrentIndex, selection, timeframe]);

  // Construct SVG path strings
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`,
      ""
    );
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const firstX = points[0].x.toFixed(2);
    const lastX = points[points.length - 1].x.toFixed(2);
    const bottomY = (paddingTop + chartHeight).toFixed(2);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, points, paddingTop, chartHeight]);

  // Highlighted path segment for the selected range
  const rangeSegmentPath = useMemo(() => {
    if (!rangeStats || points.length === 0) return "";
    const slice = points.slice(rangeStats.startIndex, rangeStats.endIndex + 1);
    if (slice.length === 0) return "";
    return slice.reduce(
      (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`,
      ""
    );
  }, [points, rangeStats]);

  // Helper to find closest data point index from clientX coordinate
  const getNearestPointIndex = (clientX: number, target: SVGSVGElement): number => {
    if (points.length === 0) return 0;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const touchX = clientX - rect.left;
    const svgX = (touchX / rect.width) * width;

    let closestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    return closestIdx;
  };

  // Pointer event handlers (unified for mouse and touch gestures)
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const idx = getNearestPointIndex(e.clientX, e.currentTarget);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is not supported
    }

    setIsDragging(true);
    setDragStartIndex(idx);
    setDragCurrentIndex(idx);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const idx = getNearestPointIndex(e.clientX, e.currentTarget);

    if (isDragging && dragStartIndex !== null) {
      setDragCurrentIndex(idx);
    } else {
      setHoveredIndex(idx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (
      dragStartIndex !== null &&
      dragCurrentIndex !== null &&
      dragStartIndex !== dragCurrentIndex
    ) {
      // Valid range selected!
      setSelection({
        startIndex: Math.min(dragStartIndex, dragCurrentIndex),
        endIndex: Math.max(dragStartIndex, dragCurrentIndex),
      });
    } else if (dragStartIndex === dragCurrentIndex) {
      // Single click without drag: clear existing range selection if any
      if (selection !== null) {
        setSelection(null);
      }
      setHoveredIndex(dragStartIndex);
    }

    setIsDragging(false);
    setDragStartIndex(null);
    setDragCurrentIndex(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    setIsDragging(false);
    setDragStartIndex(null);
    setDragCurrentIndex(null);
  };

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoveredIndex(null);
    }
  };

  const clearSelection = () => {
    setSelection(null);
    setIsDragging(false);
    setDragStartIndex(null);
    setDragCurrentIndex(null);
  };

  const isPositiveTrend = rangeStats ? rangeStats.isPositive : stats.isPositive;
  const strokeColor = stats.isPositive ? "#10b981" : "#f43f5e"; // Emerald-500 or Rose-500
  const rangeStrokeColor = isPositiveTrend ? "#10b981" : "#f43f5e";
  const gradientStart = stats.isPositive ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)";
  const gradientEnd = stats.isPositive ? "rgba(16, 185, 129, 0.0)" : "rgba(244, 63, 94, 0.0)";

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: Math.abs(num) < 10 ? 3 : 2,
      maximumFractionDigits: Math.abs(num) < 10 ? 3 : 2,
    }).format(num);
  };

  const formatVolume = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const timeframes: Timeframe[] = ["1D", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"];

  return (
    <div className="w-full bg-white dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300 mb-8">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Stock Price Chart</span>
              <span className="text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {profile.symbol}
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
            {/* Main Price Display */}
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {rangeStats
                ? formatCurrency(rangeStats.endPrice)
                : formatCurrency(activePoint ? activePoint.close : profile.price || 0)}
            </span>

            {/* Change Badge */}
            <div
              className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full ${
                (rangeStats
                  ? rangeStats.isPositive
                  : hoveredIndex !== null
                  ? activeChange >= 0
                  : stats.isPositive)
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50"
              }`}
            >
              <span>
                {(rangeStats
                  ? rangeStats.isPositive
                  : hoveredIndex !== null
                  ? activeChange >= 0
                  : stats.isPositive)
                  ? "▲"
                  : "▼"}
              </span>
              <span>
                {(rangeStats
                  ? rangeStats.isPositive
                  : hoveredIndex !== null
                  ? activeChange >= 0
                  : stats.isPositive)
                  ? "+"
                  : ""}
                {formatCurrency(
                  rangeStats
                    ? rangeStats.dollarChange
                    : hoveredIndex !== null
                    ? activeChange
                    : stats.change
                )}
              </span>
              <span>
                (
                {(rangeStats
                  ? rangeStats.isPositive
                  : hoveredIndex !== null
                  ? activeChangePercent >= 0
                  : stats.isPositive)
                  ? "+"
                  : ""}
                {(rangeStats
                  ? rangeStats.percentChange
                  : hoveredIndex !== null
                  ? activeChangePercent
                  : stats.changePercent
                ).toFixed(2)}
                %)
              </span>
            </div>

            {/* Annualized Return / Duration Tag */}
            {rangeStats ? (
              <span className="text-xs sm:text-sm font-bold font-mono px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Selected Period: {rangeStats.durationFormatted}
              </span>
            ) : (
              stats.priceCAGR !== null && (
                <span
                  title="Stock price appreciation only (excluding dividends)"
                  className={`text-xs sm:text-sm font-extrabold font-mono px-2.5 py-1 rounded-full border ${
                    stats.priceCAGR > 0
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                      : stats.priceCAGR < 0
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-300 dark:border-rose-800"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
                  }`}
                >
                  Annualized Return: {stats.priceCAGR > 0 ? "+" : ""}
                  {stats.priceCAGR.toFixed(2)}% / yr
                </span>
              )
            )}
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/50 overflow-x-auto scrollbar-none">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => {
                setTimeframe(tf);
                clearSelection();
                setHoveredIndex(null);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 min-h-[36px] flex items-center justify-center ${
                timeframe === tf
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md scale-105 border border-slate-200/50 dark:border-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Google Finance Interactive Range Selection Banner */}
      {rangeStats ? (
        <div className="my-3 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 dark:from-slate-800/90 dark:via-indigo-950/30 dark:to-slate-800/90 border border-blue-200/80 dark:border-blue-700/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isDragging ? "bg-amber-500 animate-ping" : "bg-blue-600 dark:bg-blue-400"
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                {isDragging ? "Selecting Range" : "Selected Range"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span
                className={`font-extrabold ${
                  rangeStats.isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {rangeStats.isPositive ? "+" : ""}
                {formatCurrency(rangeStats.dollarChange)} (
                {rangeStats.isPositive ? "+" : ""}
                {rangeStats.percentChange.toFixed(2)}%)
              </span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span className="text-slate-700 dark:text-slate-200">
                {rangeStats.dateRangeFormatted}
              </span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span className="text-slate-600 dark:text-slate-300 font-mono">
                {rangeStats.durationFormatted}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="text-right hidden md:block">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatCurrency(rangeStats.startPrice)} → {formatCurrency(rangeStats.endPrice)}
              </div>
            </div>

            <button
              onClick={clearSelection}
              aria-label="Clear range selection"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <span>✕</span>
              <span>Clear Selection</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between my-2 text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 text-blue-500/80 dark:text-blue-400/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <span>Click &amp; drag anywhere across chart to measure price changes &amp; date ranges</span>
          </div>
          {hoveredIndex !== null && (
            <span className="hidden sm:inline font-mono">
              {filteredData[activeIndex]?.date} · {formatCurrency(filteredData[activeIndex]?.close || 0)}
            </span>
          )}
        </div>
      )}

      {/* Range Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 py-3 my-1 border-y border-slate-100 dark:border-slate-700/60 text-xs">
        <div>
          <span
            title="Starting price for the active period"
            className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium cursor-help"
          >
            {rangeStats ? "Start Price" : `Annualized Return (${timeframe})`}
          </span>
          <span
            className={`font-extrabold text-sm font-mono ${
              rangeStats
                ? "text-slate-800 dark:text-slate-200"
                : stats.priceCAGR === null
                ? "text-slate-500"
                : stats.priceCAGR > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : stats.priceCAGR < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {rangeStats
              ? formatCurrency(rangeStats.startPrice)
              : stats.priceCAGR !== null
              ? `${stats.priceCAGR > 0 ? "+" : ""}${stats.priceCAGR.toFixed(2)}% / yr`
              : "N/A"}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
            {rangeStats ? rangeStats.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Price Only"}
          </span>
        </div>

        <div>
          <span
            title="Ending price for the active period"
            className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium cursor-help"
          >
            {rangeStats ? "End Price" : "Total Return"}
          </span>
          <span
            className={`font-extrabold text-sm font-mono ${
              rangeStats
                ? rangeStats.isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
                : stats.totalReturnCAGR === null
                ? "text-slate-400 dark:text-slate-500"
                : stats.totalReturnCAGR > 0
                ? "text-blue-600 dark:text-blue-400"
                : stats.totalReturnCAGR < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {rangeStats
              ? formatCurrency(rangeStats.endPrice)
              : stats.totalReturnCAGR !== null
              ? `${stats.totalReturnCAGR > 0 ? "+" : ""}${stats.totalReturnCAGR.toFixed(2)}% / yr`
              : "N/A"}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
            {rangeStats ? rangeStats.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Incl. Dividends"}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">
            {rangeStats ? "Range High" : `High (${timeframe})`}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm font-mono">
            {formatCurrency(rangeStats ? rangeStats.high : stats.high)}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">
            {rangeStats ? "Range Low" : `Low (${timeframe})`}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm font-mono">
            {formatCurrency(rangeStats ? rangeStats.low : stats.low)}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">
            {rangeStats ? "Range Volume" : `Avg Volume (${timeframe})`}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm font-mono">
            {formatVolume(rangeStats ? rangeStats.totalVolume : stats.avgVolume)}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">
            {rangeStats
              ? rangeStats.cagr !== null
                ? "Range CAGR"
                : "Range Data Points"
              : hoveredIndex !== null
              ? "Selected Volume"
              : "Latest Volume"}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm font-mono">
            {rangeStats
              ? rangeStats.cagr !== null
                ? `${rangeStats.cagr > 0 ? "+" : ""}${rangeStats.cagr.toFixed(2)}% / yr`
                : `${rangeStats.pointCount} points`
              : formatVolume(activePoint?.volume || 0)}
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      {isLoadingIntraday ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold">Loading 1D intraday market data...</span>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
          Price data unavailable for this timeframe.
        </div>
      ) : (
        <div className="relative w-full pt-2 select-none">
          {/* Tooltip Callout when hovering (and not selecting range) */}
          {!rangeStats && hoveredIndex !== null && points[activeIndex] && (() => {
            const leftPercent = (points[activeIndex].x / width) * 100;
            let leftStyle: string = `${leftPercent}%`;
            let rightStyle: string = "auto";
            let transformStyle: string = "translateX(-50%)";

            if (leftPercent < 22) {
              leftStyle = "8px";
              rightStyle = "auto";
              transformStyle = "none";
            } else if (leftPercent > 78) {
              leftStyle = "auto";
              rightStyle = "8px";
              transformStyle = "none";
            }

            return (
              <div
                className="absolute z-30 pointer-events-none bg-slate-900/95 dark:bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/80 backdrop-blur-md transition-all duration-75 min-w-[180px] max-w-[280px]"
                style={{
                  left: leftStyle,
                  right: rightStyle,
                  top: "10px",
                  transform: transformStyle,
                }}
              >
                <div className="font-semibold text-slate-200 text-xs mb-1.5 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-2">
                  <span>
                    {timeframe === "1D"
                      ? parseDateString(activePoint.date).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : parseDateString(activePoint.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs">
                  <div>
                    <span className="text-slate-400">Close:</span>{" "}
                    <span className="font-bold text-white font-mono whitespace-nowrap">
                      {formatCurrency(activePoint.close)}
                    </span>
                  </div>
                  {activePoint.open !== undefined && activePoint.open !== null && (
                    <div>
                      <span className="text-slate-400">Open:</span>{" "}
                      <span className="font-medium text-slate-200 font-mono whitespace-nowrap">
                        {formatCurrency(activePoint.open)}
                      </span>
                    </div>
                  )}
                  {activePoint.high !== undefined && activePoint.high !== null && (
                    <div>
                      <span className="text-slate-400">High:</span>{" "}
                      <span className="font-medium text-emerald-400 font-mono whitespace-nowrap">
                        {formatCurrency(activePoint.high)}
                      </span>
                    </div>
                  )}
                  {activePoint.low !== undefined && activePoint.low !== null && (
                    <div>
                      <span className="text-slate-400">Low:</span>{" "}
                      <span className="font-medium text-rose-400 font-mono whitespace-nowrap">
                        {formatCurrency(activePoint.low)}
                      </span>
                    </div>
                  )}
                  <div className="col-span-2 pt-1 border-t border-slate-800 flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Volume:</span>
                    <span className="font-medium text-slate-200 font-mono whitespace-nowrap">
                      {formatVolume(activePoint.volume || 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <svg
            className="w-full h-auto cursor-crosshair touch-none select-none"
            viewBox={`0 0 ${width} ${height}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
          >
            <defs>
              <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} />
                <stop offset="100%" stopColor={gradientEnd} />
              </linearGradient>
              <linearGradient id="rangeGainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(16, 185, 129, 0.28)" />
                <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
              </linearGradient>
              <linearGradient id="rangeLossGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(244, 63, 94, 0.28)" />
                <stop offset="100%" stopColor="rgba(244, 63, 94, 0.05)" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="rangeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid Y Lines & Axis Ticks */}
            {yTicks.map((tick, i) => (
              <g key={`y-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={width - paddingRight}
                  y2={tick.y}
                  stroke="currentColor"
                  className="text-slate-200/70 dark:text-slate-700/50"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={width - paddingRight + 8}
                  y={tick.y + 4}
                  fill="currentColor"
                  className="text-[10px] font-medium text-slate-400 dark:text-slate-500 fill-current font-mono"
                >
                  {formatCurrency(tick.val)}
                </text>
              </g>
            ))}

            {/* Volume Bars at Bottom */}
            {points.map((pt, i) => {
              const barHeight = Math.max(2, height - paddingBottom - pt.volY);
              const barWidth = Math.max(1, (chartWidth / points.length) * 0.65);
              const isUpDay = i > 0 ? pt.data.close >= points[i - 1].data.close : true;
              const isInRange =
                rangeStats &&
                i >= rangeStats.startIndex &&
                i <= rangeStats.endIndex;

              return (
                <rect
                  key={`vol-${i}`}
                  x={pt.x - barWidth / 2}
                  y={pt.volY}
                  width={barWidth}
                  height={barHeight}
                  fill={
                    isInRange
                      ? rangeStats.isPositive
                        ? "rgba(16, 185, 129, 0.6)"
                        : "rgba(244, 63, 94, 0.6)"
                      : isUpDay
                      ? "rgba(16, 185, 129, 0.25)"
                      : "rgba(244, 63, 94, 0.25)"
                  }
                  rx="0.5"
                />
              );
            })}

            {/* Gradient Area Fill under price line */}
            {areaPath && (
              <path
                d={areaPath}
                fill="url(#priceAreaGradient)"
                className="transition-all duration-300"
              />
            )}

            {/* Base Price Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={rangeStats ? "1.2" : "1.5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={rangeStats ? 0.45 : 1}
                filter={rangeStats ? undefined : "url(#glow)"}
                className="transition-all duration-200"
              />
            )}

            {/* Selected Range Visual Region */}
            {rangeStats && points[rangeStats.startIndex] && points[rangeStats.endIndex] && (
              <g>
                {/* Highlighted Shaded Region */}
                <rect
                  x={points[rangeStats.startIndex].x}
                  y={paddingTop}
                  width={Math.max(
                    2,
                    points[rangeStats.endIndex].x - points[rangeStats.startIndex].x
                  )}
                  height={chartHeight}
                  fill={
                    rangeStats.isPositive
                      ? "url(#rangeGainGradient)"
                      : "url(#rangeLossGradient)"
                  }
                  className="transition-all duration-150"
                />

                {/* Highlighted Curve Segment within selected range */}
                {rangeSegmentPath && (
                  <path
                    d={rangeSegmentPath}
                    fill="none"
                    stroke={rangeStrokeColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#rangeGlow)"
                  />
                )}

                {/* Left (Start) Boundary Line */}
                <line
                  x1={points[rangeStats.startIndex].x}
                  y1={paddingTop}
                  x2={points[rangeStats.startIndex].x}
                  y2={height - paddingBottom}
                  stroke={rangeStrokeColor}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.9"
                />

                {/* Right (End) Boundary Line */}
                <line
                  x1={points[rangeStats.endIndex].x}
                  y1={paddingTop}
                  x2={points[rangeStats.endIndex].x}
                  y2={height - paddingBottom}
                  stroke={rangeStrokeColor}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.9"
                />

                {/* Start Point Marker on Curve */}
                <circle
                  cx={points[rangeStats.startIndex].x}
                  cy={points[rangeStats.startIndex].y}
                  r="6"
                  fill={rangeStrokeColor}
                  opacity="0.35"
                />
                <circle
                  cx={points[rangeStats.startIndex].x}
                  cy={points[rangeStats.startIndex].y}
                  r="3.5"
                  fill="#ffffff"
                  stroke={rangeStrokeColor}
                  strokeWidth="2"
                />

                {/* End Point Marker on Curve */}
                <circle
                  cx={points[rangeStats.endIndex].x}
                  cy={points[rangeStats.endIndex].y}
                  r="6"
                  fill={rangeStrokeColor}
                  opacity="0.35"
                />
                <circle
                  cx={points[rangeStats.endIndex].x}
                  cy={points[rangeStats.endIndex].y}
                  r="3.5"
                  fill="#ffffff"
                  stroke={rangeStrokeColor}
                  strokeWidth="2"
                />
              </g>
            )}

            {/* X Axis Date Labels */}
            {xTicks.map((tick, i) => {
              let textAnchor: "start" | "middle" | "end" = "middle";
              let xPos = tick.x;
              if (i === 0) {
                textAnchor = "start";
                xPos = Math.max(paddingLeft, tick.x);
              } else if (i === xTicks.length - 1) {
                textAnchor = "end";
                xPos = Math.min(width - paddingRight, tick.x);
              }

              return (
                <g key={`x-${i}`}>
                  <line
                    x1={tick.x}
                    y1={height - paddingBottom}
                    x2={tick.x}
                    y2={height - paddingBottom + 5}
                    stroke="currentColor"
                    className="text-slate-300 dark:text-slate-600"
                    strokeWidth="1"
                  />
                  <text
                    x={xPos}
                    y={height - paddingBottom + 20}
                    textAnchor={textAnchor}
                    fill="currentColor"
                    className="text-[10px] font-medium text-slate-400 dark:text-slate-500 fill-current font-mono"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Active Hover Crosshair Line & Point (when not range selecting) */}
            {!rangeStats && hoveredIndex !== null && points[activeIndex] && (
              <g>
                {/* Vertical Crosshair Line */}
                <line
                  x1={points[activeIndex].x}
                  y1={paddingTop}
                  x2={points[activeIndex].x}
                  y2={height - paddingBottom}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                {/* Horizontal Crosshair Line */}
                <line
                  x1={paddingLeft}
                  y1={points[activeIndex].y}
                  x2={width - paddingRight}
                  y2={points[activeIndex].y}
                  stroke={strokeColor}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
                {/* Glowing Outer Dot */}
                <circle
                  cx={points[activeIndex].x}
                  cy={points[activeIndex].y}
                  r="5"
                  fill={strokeColor}
                  opacity="0.3"
                />
                {/* Inner Dot */}
                <circle
                  cx={points[activeIndex].x}
                  cy={points[activeIndex].y}
                  r="3"
                  fill="#ffffff"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                />
              </g>
            )}
          </svg>
        </div>
      )}
    </div>
  );
};
