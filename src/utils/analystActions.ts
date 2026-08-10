import { AnalystGradeItem } from "../types";

export type AnalystActionType = "UPGRADED" | "DOWNGRADED" | "REITERATED" | "INITIATED";
export type AnalystSentiment = "Bullish" | "Neutral" | "Bearish" | "Unclassified";

export interface ProcessedAnalystAction {
  actionType: AnalystActionType;
  actionLabel: string; // e.g. "Reiterated", "Upgraded", "Downgraded", "Initiated"
  gradingCompany: string;
  dateStr: string;
  formattedDate: string;
  previousGrade?: string;
  newGrade: string;
  sentiment: AnalystSentiment;
  sentimentIcon: string;
  headerText: string; // e.g. "Morgan Stanley — Bullish"
  ratingLine: string; // e.g. "Equal Weight" or "Equal Weight → Overweight"
  displayText: string;
}

export interface OverallAnalystConsensus {
  label: string; // e.g. "Very Bullish", "Moderately Bullish", "Neutral", "Bearish", "Insufficient analyst coverage"
  icon: string; // 🟢, 🟡, 🔴
  bullishCount: number;
  neutralCount: number;
  bearishCount: number;
  summaryText: string; // e.g. "3 Bullish · 5 Neutral · 1 Bearish"
}

/**
 * Maps Wall Street analyst rating terminology to plain-English investor sentiment
 * Bullish: Strong Buy, Buy, Outperform, Overweight, Positive, Accumulate
 * Neutral: Hold, Equal Weight, Neutral, Market Perform, Sector Perform, In Line, Peer Perform
 * Bearish: Sell, Strong Sell, Underperform, Underweight, Reduce, Negative
 */
export function getRatingSentiment(rating?: string): AnalystSentiment {
  if (!rating || typeof rating !== "string") return "Unclassified";
  const norm = rating.toLowerCase().trim();
  if (!norm) return "Unclassified";

  if (
    norm.includes("strong buy") ||
    norm.includes("buy") ||
    norm.includes("outperform") ||
    norm.includes("overweight") ||
    norm.includes("positive") ||
    norm.includes("accumulate")
  ) {
    return "Bullish";
  }

  if (
    norm.includes("hold") ||
    norm.includes("equal") ||
    norm.includes("neutral") ||
    norm.includes("market perform") ||
    norm.includes("peer perform") ||
    norm.includes("sector perform") ||
    norm.includes("in line") ||
    norm.includes("in-line")
  ) {
    return "Neutral";
  }

  if (
    norm.includes("sell") ||
    norm.includes("underperform") ||
    norm.includes("underweight") ||
    norm.includes("reduce") ||
    norm.includes("negative")
  ) {
    return "Bearish";
  }

  return "Unclassified";
}

export function getSentimentIcon(sentiment: AnalystSentiment): string {
  switch (sentiment) {
    case "Bullish":
      return "🟢";
    case "Bearish":
      return "🔴";
    case "Neutral":
    case "Unclassified":
    default:
      return "🟡";
  }
}

/**
 * Standard rating hierarchy ranker for fallback comparison
 */
function getRatingRank(rating: string): number {
  const norm = rating.toLowerCase().trim();
  if (norm.includes("strong buy")) return 5;
  if (norm.includes("buy") || norm.includes("outperform") || norm.includes("overweight") || norm.includes("positive") || norm.includes("accumulate")) return 4;
  if (norm.includes("hold") || norm.includes("equal") || norm.includes("neutral") || norm.includes("market perform") || norm.includes("peer perform") || norm.includes("sector perform") || norm.includes("in-line")) return 3;
  if (norm.includes("underperform") || norm.includes("underweight") || norm.includes("reduce") || norm.includes("weak")) return 2;
  if (norm.includes("sell") || norm.includes("negative")) return 1;
  return 0;
}

/**
 * Formats ISO date string (YYYY-MM-DD) into readable date format (e.g. Jul 22, 2026)
 */
export function formatAnalystDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(Date.UTC(year, month, day));
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }
  return dateStr;
}

/**
 * Categorizes an analyst grade item into UPGRADED, DOWNGRADED, REITERATED, or INITIATED,
 * calculates sentiment, and formats display lines.
 */
export function processAnalystAction(item: AnalystGradeItem): ProcessedAnalystAction {
  const gradingCompany = item.gradingCompany || "Analyst";
  const dateStr = item.date || "";
  const formattedDate = formatAnalystDate(dateStr);
  const prev = (item.previousGrade || "").trim();
  const curr = (item.newGrade || "").trim();
  const actionRaw = (item.action || "").toLowerCase().trim();

  const prevNorm = prev.toLowerCase();
  const currNorm = curr.toLowerCase();

  let actionType: AnalystActionType = "REITERATED";

  // 1. Explicit Reiteration
  if (
    (prevNorm !== "" && prevNorm === currNorm) ||
    actionRaw.includes("maintains") ||
    actionRaw.includes("maintain") ||
    actionRaw.includes("reiterate") ||
    actionRaw.includes("reiterated") ||
    actionRaw.includes("flat") ||
    actionRaw.includes("equal")
  ) {
    actionType = "REITERATED";
  }
  // 2. Explicit Initiation
  else if (
    actionRaw.includes("initiat") ||
    actionRaw.includes("new") ||
    actionRaw.includes("resume") ||
    (!prev && curr !== "")
  ) {
    actionType = "INITIATED";
  }
  // 3. Explicit Upgrade / Downgrade from API action field
  else if (actionRaw.includes("upgrade") || actionRaw.includes("up")) {
    actionType = "UPGRADED";
  } else if (actionRaw.includes("downgrade") || actionRaw.includes("down")) {
    actionType = "DOWNGRADED";
  }
  // 4. Rating Hierarchy Fallback
  else if (prev !== "" && curr !== "") {
    const prevRank = getRatingRank(prev);
    const currRank = getRatingRank(curr);

    if (currRank > prevRank) {
      actionType = "UPGRADED";
    } else if (currRank < prevRank) {
      actionType = "DOWNGRADED";
    } else {
      actionType = "REITERATED";
    }
  } else if (curr !== "") {
    actionType = "INITIATED";
  }

  // Derive plain-English sentiment for current grade
  const targetGradeForSentiment = curr || prev;
  const sentiment = getRatingSentiment(targetGradeForSentiment);
  const sentimentIcon = getSentimentIcon(sentiment);

  // Friendly action label string
  let actionLabel = "Reiterated";
  if (actionType === "UPGRADED") actionLabel = "Upgraded";
  else if (actionType === "DOWNGRADED") actionLabel = "Downgraded";
  else if (actionType === "INITIATED") actionLabel = "Initiated";

  // Build ratingLine (e.g. "Overweight" vs "Equal Weight → Overweight")
  let ratingLine = curr || prev || "Rating";
  if ((actionType === "UPGRADED" || actionType === "DOWNGRADED") && prev && curr && prevNorm !== currNorm) {
    ratingLine = `${prev} → ${curr}`;
  }

  const headerText = `${gradingCompany} — ${sentiment}`;
  const displayText = `${ratingLine} · ${actionLabel} · ${formattedDate}`;

  return {
    actionType,
    actionLabel,
    gradingCompany,
    dateStr,
    formattedDate,
    previousGrade: prev || undefined,
    newGrade: curr || "N/A",
    sentiment,
    sentimentIcon,
    headerText,
    ratingLine,
    displayText,
  };
}

/**
 * Calculates overall aggregate analyst consensus from current analyst ratings
 */
export function calculateOverallAnalystConsensus(
  actions: ProcessedAnalystAction[]
): OverallAnalystConsensus {
  if (!actions || actions.length === 0) {
    return {
      label: "Insufficient analyst coverage",
      icon: "⚪",
      bullishCount: 0,
      neutralCount: 0,
      bearishCount: 0,
      summaryText: "No recent ratings available",
    };
  }

  let bullishCount = 0;
  let neutralCount = 0;
  let bearishCount = 0;

  actions.forEach((a) => {
    if (a.sentiment === "Bullish") bullishCount++;
    else if (a.sentiment === "Bearish") bearishCount++;
    else neutralCount++;
  });

  const total = bullishCount + neutralCount + bearishCount;

  if (total === 0) {
    return {
      label: "Insufficient analyst coverage",
      icon: "⚪",
      bullishCount: 0,
      neutralCount: 0,
      bearishCount: 0,
      summaryText: "No recent ratings available",
    };
  }

  const bullPct = bullishCount / total;
  const bearPct = bearishCount / total;

  let label = "Neutral";
  let icon = "🟡";

  if (bullPct >= 0.65) {
    label = "Very Bullish";
    icon = "🟢";
  } else if (bullPct >= 0.50 || (bullishCount > bearishCount && bullPct >= 0.40)) {
    label = "Moderately Bullish";
    icon = "🟢";
  } else if (bearPct >= 0.50) {
    label = "Bearish";
    icon = "🔴";
  } else if (bearPct >= 0.35 && bearPct > bullPct) {
    label = "Moderately Bearish";
    icon = "🔴";
  } else {
    label = "Neutral";
    icon = "🟡";
  }

  const parts: string[] = [];
  if (bullishCount > 0) parts.push(`${bullishCount} Bullish`);
  if (neutralCount > 0) parts.push(`${neutralCount} Neutral`);
  if (bearishCount > 0) parts.push(`${bearishCount} Bearish`);

  return {
    label,
    icon,
    bullishCount,
    neutralCount,
    bearishCount,
    summaryText: parts.join(" · "),
  };
}

/**
 * Builds top summary counts string (e.g. "2 Upgrades · 1 Downgrade · 7 Reiterations")
 */
export function getAnalystActionSummary(processedActions: ProcessedAnalystAction[]): string {
  const counts = {
    UPGRADED: 0,
    DOWNGRADED: 0,
    REITERATED: 0,
    INITIATED: 0,
  };

  processedActions.forEach((item) => {
    counts[item.actionType]++;
  });

  const categories: string[] = [];

  if (counts.UPGRADED > 0) {
    categories.push(`${counts.UPGRADED} ${counts.UPGRADED === 1 ? "Upgrade" : "Upgrades"}`);
  }
  if (counts.DOWNGRADED > 0) {
    categories.push(`${counts.DOWNGRADED} ${counts.DOWNGRADED === 1 ? "Downgrade" : "Downgrades"}`);
  }
  if (counts.REITERATED > 0) {
    categories.push(`${counts.REITERATED} ${counts.REITERATED === 1 ? "Reiteration" : "Reiterations"}`);
  }
  if (counts.INITIATED > 0) {
    categories.push(`${counts.INITIATED} ${counts.INITIATED === 1 ? "Initiation" : "Initiations"}`);
  }

  return categories.join(" · ");
}
