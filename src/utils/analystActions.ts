import { AnalystGradeItem } from "../types";

export type AnalystActionType = "UPGRADED" | "DOWNGRADED" | "REITERATED" | "INITIATED";

export interface ProcessedAnalystAction {
  actionType: AnalystActionType;
  gradingCompany: string;
  dateStr: string;
  formattedDate: string;
  previousGrade?: string;
  newGrade: string;
  displayText: string;
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
  // Split manually for timezone independence (YYYY-MM-DD)
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
 * Categorizes an analyst grade item into UPGRADED, DOWNGRADED, REITERATED, or INITIATED
 * and formats the action label cleanly.
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

  // Build clean display text
  let displayText = "";
  if (actionType === "REITERATED") {
    displayText = `REITERATED — ${curr || prev || "Rating"}`;
  } else if (actionType === "INITIATED") {
    displayText = `INITIATED — ${curr || "Rating"}`;
  } else if (actionType === "UPGRADED") {
    displayText = prev && curr && prevNorm !== currNorm
      ? `UPGRADED — ${prev} → ${curr}`
      : `UPGRADED — ${curr || "Rating"}`;
  } else if (actionType === "DOWNGRADED") {
    displayText = prev && curr && prevNorm !== currNorm
      ? `DOWNGRADED — ${prev} → ${curr}`
      : `DOWNGRADED — ${curr || "Rating"}`;
  }

  return {
    actionType,
    gradingCompany,
    dateStr,
    formattedDate,
    previousGrade: prev || undefined,
    newGrade: curr || "N/A",
    displayText,
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
