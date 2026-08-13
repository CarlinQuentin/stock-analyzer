import React, { useState, useMemo, useEffect } from "react";
import { HistoricalPricePoint, CompanyProfile, HistoricalPeriod } from "../types";
import { calculateStockPriceCAGR, calculateTotalReturnCAGR } from "../utils/financialCalculations";
import { fmpService } from "../services/financialModelingPrep";

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

  // Sync timeframe with selectedPeriod when global selector changes
  useEffect(() => {
    if (selectedPeriod) {
      setTimeframe(mapPeriodToTimeframe(selectedPeriod));
      setHoveredIndex(null);
    }
  }, [selectedPeriod]);

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
    const latestDate = new Date(latestDateStr);

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

    const filtered = priceHistory.filter((pt) => new Date(pt.date) >= cutoffDate);
    return filtered.length > 0 ? filtered : priceHistory;
  }, [priceHistory, intradayData, timeframe]);

  // Statistics for the selected timeframe
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
      const startMs = new Date(startDateStr).getTime();
      const endMs = new Date(endDateStr).getTime();
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
  const paddingLeft = 15;
  const paddingRight = 65;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const activePoint = hoveredIndex !== null && filteredData[hoveredIndex]
    ? filteredData[hoveredIndex]
    : filteredData[filteredData.length - 1];

  const activeIndex = hoveredIndex !== null && filteredData[hoveredIndex]
    ? hoveredIndex
    : filteredData.length - 1;

  // Active point stats relative to start of period
  const activeChange = activePoint && filteredData.length > 0
    ? activePoint.close - filteredData[0].close
    : 0;
  const activeChangePercent = filteredData.length > 0 && filteredData[0].close > 0
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
      const y = paddingTop + chartHeight - ((d.close - paddedMin) / (paddedMax - paddedMin)) * chartHeight;
      const volY = height - paddingBottom - ((d.volume || 0) / (maxVol || 1)) * (chartHeight * 0.22);
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
        const d = new Date(pt.data.date);
        if (timeframe === "1D") {
          formattedDate = d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
        } else {
          formattedDate = d.toLocaleDateString("en-US", {
            month: "short",
            year: timeframe === "1M" || timeframe === "3M" ? undefined : "2-digit",
            day: timeframe === "1M" || timeframe === "3M" || timeframe === "6M" ? "numeric" : undefined,
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

  // Construct SVG path strings
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`, "");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const firstX = points[0].x.toFixed(2);
    const lastX = points[points.length - 1].x.toFixed(2);
    const bottomY = (paddingTop + chartHeight).toFixed(2);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, points, paddingTop, chartHeight]);

  // Handle Mouse / Touch interactions
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const svgX = (touchX / rect.width) * width;

    // Find nearest point
    let closestIdx = 0;
    let minDistance = Infinity;

    points.forEach((pt, idx) => {
      const dist = Math.abs(pt.x - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const isPositiveTrend = stats.isPositive;
  const strokeColor = isPositiveTrend ? "#10b981" : "#f43f5e"; // Emerald-500 or Rose-500
  const gradientStart = isPositiveTrend ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)";
  const gradientEnd = isPositiveTrend ? "rgba(16, 185, 129, 0.0)" : "rgba(244, 63, 94, 0.0)";

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: num < 10 ? 3 : 2,
      maximumFractionDigits: num < 10 ? 3 : 2,
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-700/60">
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
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(activePoint ? activePoint.close : profile.price || 0)}
            </span>
            <div
              className={`inline-flex items-center gap-1 text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full ${
                (hoveredIndex !== null ? activeChange >= 0 : stats.isPositive)
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50"
              }`}
            >
              <span>
                {(hoveredIndex !== null ? activeChange >= 0 : stats.isPositive) ? "▲" : "▼"}
              </span>
              <span>
                {(hoveredIndex !== null ? activeChange >= 0 : stats.isPositive) ? "+" : ""}
                {formatCurrency(hoveredIndex !== null ? activeChange : stats.change)}
              </span>
              <span>
                (
                {(hoveredIndex !== null ? activeChangePercent >= 0 : stats.isPositive) ? "+" : ""}
                {(hoveredIndex !== null ? activeChangePercent : stats.changePercent).toFixed(2)}%)
              </span>
            </div>

            {stats.priceCAGR !== null && (
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

      {/* Range Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 py-4 my-2 border-b border-slate-100 dark:border-slate-700/60 text-xs">
        <div>
          <span
            title="Stock price appreciation only (excluding dividends)"
            className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium cursor-help"
          >
            Annualized Return ({timeframe})
          </span>
          <span
            className={`font-extrabold text-sm font-mono ${
              stats.priceCAGR === null
                ? "text-slate-500"
                : stats.priceCAGR > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : stats.priceCAGR < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {stats.priceCAGR !== null
              ? `${stats.priceCAGR > 0 ? "+" : ""}${stats.priceCAGR.toFixed(2)}% / yr`
              : "N/A"}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
            Price Only
          </span>
        </div>
        <div>
          <span
            title="Includes dividends with reinvestment using adjusted closing prices"
            className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium cursor-help flex items-center gap-1"
          >
            <span>Total Return</span>
            <span className="text-[10px] text-blue-500 font-bold">ℹ</span>
          </span>
          <span
            className={`font-extrabold text-sm font-mono ${
              stats.totalReturnCAGR === null
                ? "text-slate-400 dark:text-slate-500"
                : stats.totalReturnCAGR > 0
                ? "text-blue-600 dark:text-blue-400"
                : stats.totalReturnCAGR < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {stats.totalReturnCAGR !== null
              ? `${stats.totalReturnCAGR > 0 ? "+" : ""}${stats.totalReturnCAGR.toFixed(2)}% / yr`
              : "N/A"}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
            Incl. Dividends
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">High ({timeframe})</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {formatCurrency(stats.high)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Low ({timeframe})</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {formatCurrency(stats.low)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Avg Volume ({timeframe})</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {formatVolume(stats.avgVolume)}
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block mb-0.5">
            {hoveredIndex !== null ? "Selected Volume" : "Latest Volume"}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            {formatVolume(activePoint?.volume || 0)}
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
        <div className="relative w-full overflow-hidden pt-2">
          {/* Interactive Tooltip Callout */}
          {hoveredIndex !== null && points[activeIndex] && (
            <div
              className="absolute z-20 pointer-events-none bg-slate-900/90 text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700 backdrop-blur-md transition-all duration-75"
              style={{
                left: `${Math.min(Math.max(points[activeIndex].x, 80), width - 140)}px`,
                top: "10px",
                transform: "translateX(-50%)",
              }}
            >
              <div className="font-semibold text-slate-300 mb-1 border-b border-slate-700/80 pb-1">
                {timeframe === "1D"
                  ? new Date(activePoint.date).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : new Date(activePoint.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                <div>
                  <span className="text-slate-400">Close:</span>{" "}
                  <span className="font-bold text-white">{formatCurrency(activePoint.close)}</span>
                </div>
                {activePoint.open && (
                  <div>
                    <span className="text-slate-400">Open:</span>{" "}
                    <span className="font-medium text-slate-200">{formatCurrency(activePoint.open)}</span>
                  </div>
                )}
                {activePoint.high && (
                  <div>
                    <span className="text-slate-400">High:</span>{" "}
                    <span className="font-medium text-emerald-400">{formatCurrency(activePoint.high)}</span>
                  </div>
                )}
                {activePoint.low && (
                  <div>
                    <span className="text-slate-400">Low:</span>{" "}
                    <span className="font-medium text-rose-400">{formatCurrency(activePoint.low)}</span>
                  </div>
                )}
                <div className="col-span-2 pt-1 border-t border-slate-800 flex justify-between">
                  <span className="text-slate-400">Volume:</span>
                  <span className="font-medium text-slate-200">{formatVolume(activePoint.volume || 0)}</span>
                </div>
              </div>
            </div>
          )}

          <svg
            className="w-full h-auto cursor-crosshair touch-none select-none"
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const touchX = e.touches[0].clientX - rect.left;
              const svgX = (touchX / rect.width) * width;
              let closestIdx = 0;
              let minDistance = Infinity;
              points.forEach((pt, idx) => {
                const dist = Math.abs(pt.x - svgX);
                if (dist < minDistance) {
                  minDistance = dist;
                  closestIdx = idx;
                }
              });
              setHoveredIndex(closestIdx);
            }}
            onTouchMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const touchX = e.touches[0].clientX - rect.left;
              const svgX = (touchX / rect.width) * width;
              let closestIdx = 0;
              let minDistance = Infinity;
              points.forEach((pt, idx) => {
                const dist = Math.abs(pt.x - svgX);
                if (dist < minDistance) {
                  minDistance = dist;
                  closestIdx = idx;
                }
              });
              setHoveredIndex(closestIdx);
            }}
          >
            <defs>
              <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} />
                <stop offset="100%" stopColor={gradientEnd} />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1" result="blur" />
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
                  className="text-[10px] font-medium text-slate-400 dark:text-slate-500 fill-current"
                >
                  {formatCurrency(tick.val)}
                </text>
              </g>
            ))}

            {/* Volume Bars at Bottom */}
            {points.map((pt, i) => {
              const barHeight = Math.max(2, (height - paddingBottom) - pt.volY);
              const barWidth = Math.max(1, (chartWidth / points.length) * 0.65);
              const isUpDay = i > 0 ? pt.data.close >= points[i - 1].data.close : true;
              return (
                <rect
                  key={`vol-${i}`}
                  x={pt.x - barWidth / 2}
                  y={pt.volY}
                  width={barWidth}
                  height={barHeight}
                  fill={isUpDay ? "rgba(16, 185, 129, 0.25)" : "rgba(244, 63, 94, 0.25)"}
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

            {/* Price Stroke Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
                className="transition-all duration-300"
              />
            )}

            {/* X Axis Date Labels */}
            {xTicks.map((tick, i) => (
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
                  x={tick.x}
                  y={height - paddingBottom + 20}
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-[10px] font-medium text-slate-400 dark:text-slate-500 fill-current"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Active Hover Crosshair Line & Point */}
            {hoveredIndex !== null && points[activeIndex] && (
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
