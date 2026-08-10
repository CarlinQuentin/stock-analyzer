import { describe, it, expect } from "vitest";
import {
  processAnalystAction,
  getAnalystActionSummary,
  formatAnalystDate,
} from "./analystActions";
import { AnalystGradeItem } from "../types";

describe("Analyst Actions Processing & Categorization", () => {
  it("1. REITERATED: correctly categorizes unchanged ratings without misleading arrows", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Morgan Stanley",
      previousGrade: "Equal Weight",
      newGrade: "Equal Weight",
      action: "maintains",
    };

    const processed = processAnalystAction(item);

    expect(processed.actionType).toBe("REITERATED");
    expect(processed.gradingCompany).toBe("Morgan Stanley");
    expect(processed.formattedDate).toBe("Jul 22, 2026");
    expect(processed.displayText).toBe("REITERATED — Equal Weight");
    expect(processed.displayText).not.toContain("→");
  });

  it("2. UPGRADED: correctly categorizes rating upgrades with clear arrow progression", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Morgan Stanley",
      previousGrade: "Equal Weight",
      newGrade: "Overweight",
      action: "upgrade",
    };

    const processed = processAnalystAction(item);

    expect(processed.actionType).toBe("UPGRADED");
    expect(processed.displayText).toBe("UPGRADED — Equal Weight → Overweight");
  });

  it("3. DOWNGRADED: correctly categorizes rating downgrades", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Morgan Stanley",
      previousGrade: "Overweight",
      newGrade: "Equal Weight",
      action: "downgrade",
    };

    const processed = processAnalystAction(item);

    expect(processed.actionType).toBe("DOWNGRADED");
    expect(processed.displayText).toBe("DOWNGRADED — Overweight → Equal Weight");
  });

  it("4. INITIATED: correctly handles new coverage initiation with no previous rating", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Barclays",
      previousGrade: "",
      newGrade: "Overweight",
      action: "initiate",
    };

    const processed = processAnalystAction(item);

    expect(processed.actionType).toBe("INITIATED");
    expect(processed.displayText).toBe("INITIATED — Overweight");
    expect(processed.displayText).not.toContain("→");
  });

  it("5. Hierarchy Fallback: categorizes upgrades and downgrades when API action string is missing", () => {
    const upgradeItem: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "JPMorgan",
      previousGrade: "Neutral",
      newGrade: "Overweight",
      action: "",
    };

    const downgradeItem: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "JPMorgan",
      previousGrade: "Overweight",
      newGrade: "Neutral",
      action: "",
    };

    expect(processAnalystAction(upgradeItem).actionType).toBe("UPGRADED");
    expect(processAnalystAction(downgradeItem).actionType).toBe("DOWNGRADED");
  });

  it("6. Summary Generator: builds concise summary pill string with non-zero categories", () => {
    const items: AnalystGradeItem[] = [
      { date: "2026-07-22", gradingCompany: "A", previousGrade: "Neutral", newGrade: "Buy", action: "upgrade" },
      { date: "2026-07-22", gradingCompany: "B", previousGrade: "Neutral", newGrade: "Buy", action: "upgrade" },
      { date: "2026-07-22", gradingCompany: "C", previousGrade: "Buy", newGrade: "Neutral", action: "downgrade" },
      { date: "2026-07-22", gradingCompany: "D", previousGrade: "Hold", newGrade: "Hold", action: "maintains" },
      { date: "2026-07-22", gradingCompany: "E", previousGrade: "Hold", newGrade: "Hold", action: "maintains" },
      { date: "2026-07-22", gradingCompany: "F", previousGrade: "Hold", newGrade: "Hold", action: "maintains" },
    ];

    const processed = items.map(processAnalystAction);
    const summary = getAnalystActionSummary(processed);

    expect(summary).toBe("2 Upgrades · 1 Downgrade · 3 Reiterations");
    expect(summary).not.toContain("Initiation");
  });

  it("7. Date Formatter: formats YYYY-MM-DD reliably without timezone shift", () => {
    expect(formatAnalystDate("2026-07-22")).toBe("Jul 22, 2026");
  });
});
