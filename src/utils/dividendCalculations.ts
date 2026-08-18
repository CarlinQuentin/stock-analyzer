import { DividendMetrics } from "../types";

/**
 * Checks if a dividend record is classified as a Special or One-time dividend.
 */
export function isSpecialDividend(divEvent: any): boolean {
  if (!divEvent) return false;
  const label = String(divEvent.label || divEvent.description || divEvent.type || "").toLowerCase();
  const freq = String(divEvent.frequency || "").toLowerCase();
  return (
    label.includes("special") ||
    label.includes("extra") ||
    label.includes("one-time") ||
    label.includes("bonus") ||
    label.includes("return of capital") ||
    freq.includes("special") ||
    freq.includes("extra")
  );
}

/**
 * Extracts regular dividend payments for a specific calendar year.
 */
export function filterDividendsForYear(
  dividendHistory: any[] | null | undefined,
  year: number,
): any[] {
  if (!dividendHistory || !Array.isArray(dividendHistory) || dividendHistory.length === 0) {
    return [];
  }

  const regular: any[] = [];

  dividendHistory.forEach((d) => {
    if (!d || !d.date) return;
    const yrStr = String(d.date).split("-")[0];
    const yrNum = parseInt(yrStr, 10);
    if (yrNum === year) {
      if (!isSpecialDividend(d)) {
        regular.push(d);
      }
    }
  });

  return regular;
}

/**
 * Determines the company's regular dividend payment frequency based on actual payment counts.
 * Returns: "Quarterly" | "Monthly" | "Semi-Annual" | "Annual" | "Irregular" | "None"
 */
export function determineDividendFrequency(
  dividendHistory: any[] | null | undefined,
  targetYear?: number | null,
  fallbackFreq?: string,
): string {
  if (!dividendHistory || !Array.isArray(dividendHistory) || dividendHistory.length === 0) {
    return fallbackFreq || "None";
  }

  // Filter out special dividends for frequency detection
  const regularDivs = dividendHistory.filter(
    (d) => !isSpecialDividend(d) && (d.dividend > 0 || d.adjDividend > 0),
  );
  if (regularDivs.length === 0) {
    return "None";
  }

  if (targetYear !== undefined && targetYear !== null) {
    const regular = filterDividendsForYear(dividendHistory, targetYear);
    const count = regular.filter((d) => d.dividend > 0 || d.adjDividend > 0).length;
    if (count === 0) {
      return "None";
    }
    if (count >= 10 && count <= 13) return "Monthly";
    if (count >= 3 && count <= 5) return "Quarterly";
    if (count === 2) return "Semi-Annual";
    if (count === 1) return "Annual";
    return "Irregular";
  }

  // Overall TTM frequency: evaluate recent year distributions (last 1-2 years with payments)
  const yearCounts = new Map<number, number>();
  regularDivs.forEach((d) => {
    const yrStr = String(d.date).split("-")[0];
    const yr = parseInt(yrStr, 10);
    if (!isNaN(yr)) {
      yearCounts.set(yr, (yearCounts.get(yr) || 0) + 1);
    }
  });

  const sortedYears = Array.from(yearCounts.keys()).sort((a, b) => b - a);
  if (sortedYears.length === 0) return "None";

  // Take the most recent full years
  const recentCounts = sortedYears.slice(0, 3).map((y) => yearCounts.get(y) || 0);
  const avgCount = recentCounts.reduce((a, b) => a + b, 0) / recentCounts.length;

  if (avgCount >= 10.5) return "Monthly";
  if (avgCount >= 3.2 && avgCount <= 5.2) return "Quarterly";
  if (avgCount >= 1.6 && avgCount <= 2.4) return "Semi-Annual";
  if (avgCount >= 0.8 && avgCount <= 1.2) return "Annual";

  // Check if latest item explicitly declares frequency
  const latest = regularDivs[0];
  if (latest && latest.dividendFrequency) {
    const f = String(latest.dividendFrequency).toLowerCase();
    if (f.includes("quarter")) return "Quarterly";
    if (f.includes("month")) return "Monthly";
    if (f.includes("semi")) return "Semi-Annual";
    if (f.includes("annual")) return "Annual";
  }

  return "Irregular";
}

/**
 * Calculates the regular dividend distribution amount paid per share per payment.
 * e.g. $0.52 for a quarterly payer.
 */
export function calculateSinglePaymentDPS(
  dividendHistory: any[] | null | undefined,
  year?: number | null,
  ratiosTTM?: any,
  dividendMetrics?: DividendMetrics | null,
): number | null {
  if (dividendHistory && Array.isArray(dividendHistory) && dividendHistory.length > 0) {
    if (year !== undefined && year !== null) {
      const regular = filterDividendsForYear(dividendHistory, year);
      if (regular.length > 0) {
        // Take the latest regular payment in that year
        const latestInYear = regular.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )[0];
        const val = typeof latestInYear.dividend === "number" ? latestInYear.dividend : latestInYear.adjDividend;
        return val !== undefined ? val : null;
      }
      return null;
    }

    // TTM: Latest regular payment overall
    const regularAll = dividendHistory
      .filter((d) => !isSpecialDividend(d) && (d.dividend > 0 || d.adjDividend > 0))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (regularAll.length > 0) {
      const latest = regularAll[0];
      const val = typeof latest.dividend === "number" ? latest.dividend : latest.adjDividend;
      return val !== undefined ? val : null;
    }
  }

  // Fallback: if single per-share amount is provided in metrics
  if (dividendMetrics?.dividendPerShare !== undefined && dividendMetrics.dividendPerShare !== null) {
    return dividendMetrics.dividendPerShare;
  }
  if (ratiosTTM?.dividendPerShareTTM !== undefined && ratiosTTM.dividendPerShareTTM !== null) {
    return ratiosTTM.dividendPerShareTTM;
  }

  return null;
}

/**
 * Returns annual multiplier for payment frequency (Quarterly: 4, Monthly: 12, Semi-Annual: 2, Annual: 1).
 */
export function getAnnualMultiplierForFrequency(frequency: string): number {
  const f = frequency.toLowerCase();
  if (f.includes("month")) return 12;
  if (f.includes("quarter")) return 4;
  if (f.includes("semi")) return 2;
  if (f.includes("annual") && !f.includes("semi")) return 1;
  return 4; // default to quarterly multiplier
}

/**
 * Calculates current regular annual dividend yield relative to current stock price.
 * Annualizes the regular per-payment dividend based on frequency (e.g. Quarterly x 4, Monthly x 12).
 */
export function calculateRegularDividendYield(
  dividendAmountPerPayment: number | null | undefined,
  frequency: string,
  price: number | null | undefined,
  fallbackYield?: number | null,
): number | null {
  if (frequency === "None" || dividendAmountPerPayment === 0) {
    return 0;
  }

  if (
    dividendAmountPerPayment !== null &&
    dividendAmountPerPayment !== undefined &&
    dividendAmountPerPayment > 0 &&
    price !== null &&
    price !== undefined &&
    price > 0
  ) {
    const multiplier = getAnnualMultiplierForFrequency(frequency);
    const annualizedDPS = dividendAmountPerPayment * multiplier;
    return annualizedDPS / price;
  }

  if (fallbackYield !== undefined && fallbackYield !== null) {
    return fallbackYield;
  }

  return null;
}

/**
 * Formats per-share dividend amount per payment cleanly.
 * e.g. "$0.52 / share", "$0.17 / share", "$2.00 / share"
 */
export function formatDividendAmount(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  if (val === 0) return "$0.00 / share";
  const isNeg = val < 0;
  const abs = Math.abs(val);
  return `${isNeg ? "-$" : "$"}${abs.toFixed(2)} / share`;
}
