import { HistoricalPricePoint } from "../types";
import { calculateStockPriceCAGR } from "./financialCalculations";

export interface RangeSelectionStats {
  startIndex: number;
  endIndex: number;
  startPoint: HistoricalPricePoint;
  endPoint: HistoricalPricePoint;
  startDate: Date;
  endDate: Date;
  startPrice: number;
  endPrice: number;
  dollarChange: number;
  percentChange: number;
  isPositive: boolean;
  durationFormatted: string;
  dateRangeFormatted: string;
  summaryFormatted: string;
  high: number;
  low: number;
  totalVolume: number;
  avgVolume: number;
  pointCount: number;
  cagr: number | null;
}

/**
 * Safely parses date string preventing timezone offset shifts for YYYY-MM-DD dates.
 */
export function parseDateString(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("T") || dateStr.includes(" ")) {
    return new Date(dateStr.replace(" ", "T"));
  }
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  return new Date(dateStr);
}

/**
 * Formats duration between two dates into a clean human-readable string.
 * e.g., "2 hrs 15 mins", "45 mins", "1 day", "44 days", "438 days (~1.2 yrs)"
 */
export function formatDuration(startDate: Date, endDate: Date, isIntraday: boolean = false): string {
  const diffMs = Math.abs(endDate.getTime() - startDate.getTime());

  if (isIntraday || diffMs < 24 * 60 * 60 * 1000) {
    const diffMins = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours === 0) {
      return `${Math.max(1, mins)} min${mins === 1 ? "" : "s"}`;
    }
    if (mins === 0) {
      return `${hours} hr${hours === 1 ? "" : "s"}`;
    }
    return `${hours} hr${hours === 1 ? "" : "s"} ${mins} min${mins === 1 ? "" : "s"}`;
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) {
    return "1 day";
  }
  if (diffDays < 365) {
    return `${diffDays} days`;
  }

  const years = (diffDays / 365.25).toFixed(1);
  return `${diffDays} days (~${years} yrs)`;
}

/**
 * Formats date range between two dates into a clean string matching Google Finance.
 * e.g. "Jan 5 – Feb 18, 2024" or "Nov 12, 2023 – Mar 15, 2024" or "Jan 15, 9:30 AM – 1:45 PM"
 */
export function formatDateRange(startDate: Date, endDate: Date, isIntraday: boolean = false): string {
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return "";
  }

  if (isIntraday) {
    const isSameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate();

    const timeStart = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const timeEnd = endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (isSameDay) {
      const dateStr = startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${dateStr} · ${timeStart} – ${timeEnd}`;
    }

    const startFull = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${timeStart}`;
    const endFull = `${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${timeEnd}`;
    return `${startFull} – ${endFull}`;
  }

  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  if (sameYear) {
    const startStr = startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startStr} – ${endStr}`;
  }

  const startStr = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endStr = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

/**
 * Calculates full statistics for a selected price range.
 * Supports normalization so dragging left-to-right or right-to-left yields consistent chronological results.
 */
export function calculateRangeSelection(
  data: HistoricalPricePoint[],
  idxA: number,
  idxB: number,
  isIntraday: boolean = false
): RangeSelectionStats | null {
  if (!data || data.length === 0) return null;

  // Clamp and normalize indices so startIndex <= endIndex
  const minIdx = Math.max(0, Math.min(Math.min(idxA, idxB), data.length - 1));
  const maxIdx = Math.max(0, Math.min(Math.max(idxA, idxB), data.length - 1));

  const startPoint = data[minIdx];
  const endPoint = data[maxIdx];

  if (!startPoint || !endPoint) return null;

  const startPrice = startPoint.close;
  const endPrice = endPoint.close;
  const dollarChange = endPrice - startPrice;
  const percentChange = startPrice > 0 ? (dollarChange / startPrice) * 100 : 0;
  const isPositive = dollarChange >= 0;

  const startDate = parseDateString(startPoint.date);
  const endDate = parseDateString(endPoint.date);

  const durationFormatted = formatDuration(startDate, endDate, isIntraday);
  const dateRangeFormatted = formatDateRange(startDate, endDate, isIntraday);

  // Range high, low, volume calculations
  const rangeSlice = data.slice(minIdx, maxIdx + 1);
  let high = -Infinity;
  let low = Infinity;
  let totalVolume = 0;

  rangeSlice.forEach((pt) => {
    const h = pt.high ?? pt.close;
    const l = pt.low ?? pt.close;
    if (h > high) high = h;
    if (l < low) low = l;
    totalVolume += pt.volume || 0;
  });

  if (high === -Infinity) high = endPrice;
  if (low === Infinity) low = endPrice;

  const avgVolume = rangeSlice.length > 0 ? totalVolume / rangeSlice.length : 0;

  // CAGR calculation if range is multi-day and >= 30 days
  let cagr: number | null = null;
  const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (!isIntraday && diffDays >= 30) {
    const years = diffDays / 365.25;
    cagr = calculateStockPriceCAGR(startPrice, endPrice, years);
  }

  // Google Finance style summary line: "+$6.30 (+15.00%) · Jan 5 – Feb 18, 2024 · 44 days"
  const sign = isPositive ? "+" : "";
  const formattedDollar = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Math.abs(dollarChange) < 10 ? 2 : 2,
  }).format(dollarChange);

  // When dollar is negative, Intl includes '-' automatically; when positive, prepend '+'
  const dollarWithSign = isPositive ? `+${formattedDollar}` : formattedDollar;
  const percentWithSign = `${sign}${percentChange.toFixed(2)}%`;

  const summaryFormatted = `${dollarWithSign} (${percentWithSign}) · ${dateRangeFormatted} · ${durationFormatted}`;

  return {
    startIndex: minIdx,
    endIndex: maxIdx,
    startPoint,
    endPoint,
    startDate,
    endDate,
    startPrice,
    endPrice,
    dollarChange,
    percentChange,
    isPositive,
    durationFormatted,
    dateRangeFormatted,
    summaryFormatted,
    high,
    low,
    totalVolume,
    avgVolume,
    pointCount: rangeSlice.length,
    cagr,
  };
}
