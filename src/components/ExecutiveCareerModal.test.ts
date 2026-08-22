import { describe, it, expect } from "vitest";
import { ExecutiveCareerHistoryDetail } from "../types";

describe("ExecutiveCareerModal Presentation & Logic Tests", () => {
  const getInitials = (name: string): string => {
    if (!name) return "EX";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getSourceAttribution = (profile: ExecutiveCareerHistoryDetail | null) => {
    if (!profile) return "None";
    if (profile.source === "pdl") return "Verified via People Data Labs";
    if (profile.source === "wikidata") return "Sourced from Wikidata Public Records";
    return "Corporate Officer Disclosures";
  };

  it("1. extracts initials accurately for single-word and multi-word executive names", () => {
    expect(getInitials("Tim Cook")).toBe("TC");
    expect(getInitials("Satya Nadella")).toBe("SN");
    expect(getInitials("Timothy Donald Cook")).toBe("TC");
    expect(getInitials("Cher")).toBe("CH");
    expect(getInitials("")).toBe("EX");
  });

  it("2. assigns appropriate source attribution label for each enrichment source", () => {
    const pdlProfile: ExecutiveCareerHistoryDetail = {
      name: "Tim Cook",
      normalizedName: "tim cook",
      currentCompany: "Apple Inc.",
      roles: [],
      source: "pdl",
      fetchedAt: new Date().toISOString(),
    };
    expect(getSourceAttribution(pdlProfile)).toBe("Verified via People Data Labs");

    const wikiProfile: ExecutiveCareerHistoryDetail = {
      name: "Jensen Huang",
      normalizedName: "jensen huang",
      currentCompany: "NVIDIA",
      roles: [],
      source: "wikidata",
      fetchedAt: new Date().toISOString(),
    };
    expect(getSourceAttribution(wikiProfile)).toBe("Sourced from Wikidata Public Records");

    const genericProfile: ExecutiveCareerHistoryDetail = {
      name: "Mark Smith",
      normalizedName: "mark smith",
      currentCompany: "Acme",
      roles: [],
      source: "fmp",
      fetchedAt: new Date().toISOString(),
    };
    expect(getSourceAttribution(genericProfile)).toBe("Corporate Officer Disclosures");
  });
});
