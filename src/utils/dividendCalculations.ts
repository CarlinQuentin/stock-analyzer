import { FinancialStatement, DividendMetrics } from "../types";
import { calculateFCF } from "./financialCalculations";

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
 * Extracts and separates regular and special dividends for a specific calendar year.
 */
export function filterDividendsForYear(
  dividendHistory: any[] | null | undefined,
  year: number,
): { regular: any[]; special: any[] } {
  if (!dividendHistory || !Array.isArray(dividendHistory) || dividendHistory.length === 0) {
    return { regular: [], special: [] };
  }

  const regular: any[] = [];
  const special: any[] = [];

  dividendHistory.forEach((d) => {
    if (!d || !d.date) return;
    const yrStr = String(d.date).split("-")[0];
    const yrNum = parseInt(yrStr, 10);
    if (yrNum === year) {
      if (isSpecialDividend(d)) {
        special.push(d);
      } else {
        regular.push(d);
      }
    }
  });

  return { regular, special };
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
  const regularDivs = dividendHistory.filter((d) => !isSpecialDividend(d) && (d.dividend > 0 || d.adjDividend > 0));
  if (regularDivs.length === 0) {
    return "None";
  }

  if (targetYear !== undefined && targetYear !== null) {
    const { regular } = filterDividendsForYear(dividendHistory, targetYear);
    const count = regular.filter((d) => (d.dividend > 0 || d.adjDividend > 0)).length;
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
 * Calculates the total regular dividend paid per share for a specific fiscal/calendar year.
 * Prevents special dividends from inflating annual regular totals.
 */
export function calculateAnnualRegularDPS(
  dividendHistory: any[] | null | undefined,
  year?: number | null,
  cf?: FinancialStatement,
  inc?: FinancialStatement,
  km?: any,
  fr?: any,
): number | null {
  if (dividendHistory && Array.isArray(dividendHistory) && dividendHistory.length > 0 && year !== undefined && year !== null) {
    const { regular } = filterDividendsForYear(dividendHistory, year);
    if (regular.length > 0) {
      const sum = regular.reduce((acc, d) => {
        const val = typeof d.dividend === "number" ? d.dividend : typeof d.adjDividend === "number" ? d.adjDividend : 0;
        return acc + val;
      }, 0);
      return Math.round(sum * 10000) / 10000;
    }
    // If dividend history is active but had 0 payments this year, annual DPS is $0.00
    const allRegular = dividendHistory.filter((d) => !isSpecialDividend(d));
    if (allRegular.length > 0) {
      return 0;
    }
  }

  // Fallback to Statement / Key Metrics data
  if (km?.dividendPerShare !== undefined && km?.dividendPerShare !== null) {
    return km.dividendPerShare;
  }
  if (fr?.dividendPerShare !== undefined && fr?.dividendPerShare !== null) {
    return fr.dividendPerShare;
  }
  if (cf?.dividendsPaid !== undefined && cf.dividendsPaid !== null && cf.dividendsPaid !== 0) {
    const shares = inc?.weightedAverageShsOutDil || inc?.weightedAverageShsOut || inc?.shares;
    if (shares && shares > 0) {
      return Math.abs(cf.dividendsPaid) / shares;
    }
  }

  return null;
}

/**
 * Calculates the latest single regular dividend payment amount per share.
 */
export function calculateSinglePaymentDPS(
  dividendHistory: any[] | null | undefined,
  year?: number | null,
  ratiosTTM?: any,
  dividendMetrics?: DividendMetrics | null,
): number | null {
  if (dividendHistory && Array.isArray(dividendHistory) && dividendHistory.length > 0) {
    if (year !== undefined && year !== null) {
      const { regular } = filterDividendsForYear(dividendHistory, year);
      if (regular.length > 0) {
        // Take the latest regular payment in that year
        const latestInYear = regular.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
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

  // Fallback: if annual DPS is available and quarterly frequency assumed
  if (dividendMetrics?.dividendPerShare !== undefined && dividendMetrics.dividendPerShare !== null) {
    return dividendMetrics.dividendPerShare;
  }
  if (ratiosTTM?.dividendPerShareTTM !== undefined && ratiosTTM.dividendPerShareTTM !== null) {
    return ratiosTTM.dividendPerShareTTM;
  }

  return null;
}

/**
 * Calculates the TTM Annual Regular Dividend Per Share.
 */
export function calculateTTMAnnualDPS(
  dividendHistory: any[] | null | undefined,
  ratiosTTM?: any,
  dividendMetrics?: DividendMetrics | null,
  latestFY_DPS?: number | null,
): number | null {
  if (dividendHistory && Array.isArray(dividendHistory) && dividendHistory.length > 0) {
    const regular = dividendHistory.filter((d) => !isSpecialDividend(d));
    if (regular.length > 0) {
      // Look at payments in the last 365 days from the latest payment date
      const sorted = [...regular].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestDate = new Date(sorted[0].date).getTime();
      const oneYearAgo = latestDate - 365 * 24 * 60 * 60 * 1000;

      const ttmPayments = sorted.filter((d) => new Date(d.date).getTime() >= oneYearAgo);
      if (ttmPayments.length > 0) {
        const sum = ttmPayments.reduce((acc, d) => {
          const val = typeof d.dividend === "number" ? d.dividend : typeof d.adjDividend === "number" ? d.adjDividend : 0;
          return acc + val;
        }, 0);
        return Math.round(sum * 10000) / 10000;
      }
    }
  }

  if (ratiosTTM?.dividendPerShareTTM !== undefined && ratiosTTM.dividendPerShareTTM !== null) {
    return ratiosTTM.dividendPerShareTTM;
  }
  if (dividendMetrics?.dividendPerShare !== undefined && dividendMetrics.dividendPerShare !== null) {
    return dividendMetrics.dividendPerShare;
  }

  return latestFY_DPS ?? null;
}

/**
 * Calculates Dividend Payout Ratio relative to Net Income.
 * Safely returns null when Net Income is zero or negative (preventing misleading negative payout ratios).
 */
export function calculateDividendPayoutRatio(
  dividendsPaid: number | null | undefined,
  netIncome: number | null | undefined,
  fr?: any,
  km?: any,
): number | null {
  if (dividendsPaid === 0) return 0;

  if (dividendsPaid !== undefined && dividendsPaid !== null && netIncome !== undefined && netIncome !== null) {
    if (netIncome <= 0) {
      return null; // Negative or zero net income: payout ratio is invalid / undefined
    }
    return Math.abs(dividendsPaid) / netIncome;
  }

  if (fr?.dividendPayoutRatio !== undefined && fr?.dividendPayoutRatio !== null) {
    return fr.dividendPayoutRatio;
  }
  if (km?.payoutRatio !== undefined && km?.payoutRatio !== null) {
    return km.payoutRatio;
  }
  if (fr?.payoutRatio !== undefined && fr?.payoutRatio !== null) {
    return fr.payoutRatio;
  }

  return null;
}

/**
 * Calculates Dividend / Free Cash Flow Coverage.
 * Safely returns null when Free Cash Flow is zero or negative.
 */
export function calculateDividendFCFCoverage(
  dividendsPaid: number | null | undefined,
  operatingCashFlow: number | null | undefined,
  capitalExpenditure: number | null | undefined,
): number | null {
  if (dividendsPaid === 0) return 0;
  if (dividendsPaid === undefined || dividendsPaid === null) return null;

  const fcf = calculateFCF(
    operatingCashFlow ?? undefined,
    capitalExpenditure ?? undefined,
  );
  if (fcf === null || fcf <= 0) {
    return null; // Negative or zero FCF: dividends not covered by organic cash generation
  }

  return Math.abs(dividendsPaid) / fcf;
}

/**
 * Calculates Special / One-Time Dividend amount per share for a specific year or TTM.
 */
export function calculateSpecialDPS(
  dividendHistory: any[] | null | undefined,
  year?: number | null,
): number | null {
  if (!dividendHistory || !Array.isArray(dividendHistory) || dividendHistory.length === 0) {
    return null;
  }

  if (year !== undefined && year !== null) {
    const { special } = filterDividendsForYear(dividendHistory, year);
    if (special.length === 0) return null;
    const sum = special.reduce((acc, d) => {
      const val = typeof d.dividend === "number" ? d.dividend : typeof d.adjDividend === "number" ? d.adjDividend : 0;
      return acc + val;
    }, 0);
    return Math.round(sum * 10000) / 10000;
  }

  // TTM Special dividends
  const specialAll = dividendHistory.filter((d) => isSpecialDividend(d));
  if (specialAll.length === 0) return null;

  const sorted = [...specialAll].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestDate = new Date(sorted[0].date).getTime();
  const oneYearAgo = latestDate - 365 * 24 * 60 * 60 * 1000;

  const ttmSpecial = sorted.filter((d) => new Date(d.date).getTime() >= oneYearAgo);
  if (ttmSpecial.length === 0) return null;

  const sum = ttmSpecial.reduce((acc, d) => {
    const val = typeof d.dividend === "number" ? d.dividend : typeof d.adjDividend === "number" ? d.adjDividend : 0;
    return acc + val;
  }, 0);
  return Math.round(sum * 10000) / 10000;
}
