import { describe, it, expect } from "vitest";
import {
  processAnalystAction,
  getRatingSentiment,
  calculateOverallAnalystConsensus,
} from "./analystActions";
import { AnalystGradeItem } from "../types";

describe("Analyst Sentiment & Rating Mapping", () => {
  it("1. Rating Sentiment Classification: correctly classifies Wall Street terminology", () => {
    expect(getRatingSentiment("Strong Buy")).toBe("Bullish");
    expect(getRatingSentiment("Buy")).toBe("Bullish");
    expect(getRatingSentiment("Outperform")).toBe("Bullish");
    expect(getRatingSentiment("Overweight")).toBe("Bullish");

    expect(getRatingSentiment("Hold")).toBe("Neutral");
    expect(getRatingSentiment("Equal Weight")).toBe("Neutral");
    expect(getRatingSentiment("Equal-Weight")).toBe("Neutral");
    expect(getRatingSentiment("Neutral")).toBe("Neutral");
    expect(getRatingSentiment("Market Perform")).toBe("Neutral");
    expect(getRatingSentiment("Sector Perform")).toBe("Neutral");

    expect(getRatingSentiment("Sell")).toBe("Bearish");
    expect(getRatingSentiment("Underperform")).toBe("Bearish");
    expect(getRatingSentiment("Underweight")).toBe("Bearish");
    expect(getRatingSentiment("Negative")).toBe("Bearish");

    expect(getRatingSentiment("Unusual WallSt Rating XYZ")).toBe("Unclassified");
  });

  it("2. Item Formatting: formats unchanged rating entries cleanly with sentiment header", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Morgan Stanley",
      previousGrade: "Equal Weight",
      newGrade: "Equal Weight",
      action: "maintains",
    };

    const processed = processAnalystAction(item);

    expect(processed.sentiment).toBe("Neutral");
    expect(processed.sentimentIcon).toBe("🟡");
    expect(processed.headerText).toBe("Morgan Stanley — Neutral");
    expect(processed.displayText).toBe("Equal Weight · Reiterated · Jul 22, 2026");
    expect(processed.displayText).not.toContain("→");
  });

  it("3. Upgrade Formatting: formats upgrades with sentiment and rating transition", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Morgan Stanley",
      previousGrade: "Equal Weight",
      newGrade: "Overweight",
      action: "upgrade",
    };

    const processed = processAnalystAction(item);

    expect(processed.sentiment).toBe("Bullish");
    expect(processed.sentimentIcon).toBe("🟢");
    expect(processed.headerText).toBe("Morgan Stanley — Bullish");
    expect(processed.displayText).toBe("Equal Weight → Overweight · Upgraded · Jul 22, 2026");
  });

  it("4. Downgrade Formatting: formats downgrades with sentiment and rating transition", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Bank XYZ",
      previousGrade: "Overweight",
      newGrade: "Underweight",
      action: "downgrade",
    };

    const processed = processAnalystAction(item);

    expect(processed.sentiment).toBe("Bearish");
    expect(processed.sentimentIcon).toBe("🔴");
    expect(processed.headerText).toBe("Bank XYZ — Bearish");
    expect(processed.displayText).toBe("Overweight → Underweight · Downgraded · Jul 22, 2026");
  });

  it("5. Initiation Formatting: formats initiation entries without previous rating arrow", () => {
    const item: AnalystGradeItem = {
      date: "2026-07-22",
      gradingCompany: "Barclays",
      previousGrade: "",
      newGrade: "Overweight",
      action: "initiate",
    };

    const processed = processAnalystAction(item);

    expect(processed.sentiment).toBe("Bullish");
    expect(processed.sentimentIcon).toBe("🟢");
    expect(processed.headerText).toBe("Barclays — Bullish");
    expect(processed.displayText).toBe("Overweight · Initiated · Jul 22, 2026");
  });

  it("6. Consensus Calculation: computes aggregate sentiment label and breakdown text", () => {
    const items: AnalystGradeItem[] = [
      { date: "2026-07-22", gradingCompany: "A", newGrade: "Overweight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "B", newGrade: "Buy", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "C", newGrade: "Buy", action: "upgrade" },
      { date: "2026-07-22", gradingCompany: "D", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "E", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "F", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "G", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "H", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "I", newGrade: "Underweight", action: "downgrade" },
    ];

    const processed = items.map(processAnalystAction);
    const consensus = calculateOverallAnalystConsensus(processed);

    expect(consensus.bullishCount).toBe(3);
    expect(consensus.neutralCount).toBe(5);
    expect(consensus.bearishCount).toBe(1);
    expect(consensus.summaryText).toBe("3 Bullish · 5 Neutral · 1 Bearish");
    expect(consensus.label).toBe("Neutral");

    // Test Moderately Bullish (5 Bullish out of 9 total)
    const bullishItems: AnalystGradeItem[] = [
      { date: "2026-07-22", gradingCompany: "A", newGrade: "Buy", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "B", newGrade: "Buy", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "C", newGrade: "Buy", action: "upgrade" },
      { date: "2026-07-22", gradingCompany: "D", newGrade: "Overweight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "E", newGrade: "Overweight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "F", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "G", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "H", newGrade: "Equal Weight", action: "reiterate" },
      { date: "2026-07-22", gradingCompany: "I", newGrade: "Underweight", action: "downgrade" },
    ];
    const modBullishConsensus = calculateOverallAnalystConsensus(bullishItems.map(processAnalystAction));
    expect(modBullishConsensus.label).toBe("Moderately Bullish");
    expect(modBullishConsensus.summaryText).toBe("5 Bullish · 3 Neutral · 1 Bearish");
  });

  it("7. Coverage Safeguard: returns 'Insufficient analyst coverage' when no items present", () => {
    const consensus = calculateOverallAnalystConsensus([]);
    expect(consensus.label).toBe("Insufficient analyst coverage");
    expect(consensus.icon).toBe("⚪");
  });
});
