import { describe, it, expect, vi, beforeEach } from "vitest";
import { leadershipService } from "./leadershipService";
import { fmpService } from "./financialModelingPrep";

describe("LeadershipService Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeExecutives", () => {
    it("1. Normalizes raw FMP provider executive data accurately", () => {
      const rawList = [
        {
          name: "Tim Cook",
          title: "Chief Executive Officer & Director",
          biography: "Tim Cook is the CEO of Apple Inc. Former VP of Corporate Materials at Compaq.",
          titleSince: "2011",
          pay: 3000000,
          currencyPay: "USD",
        },
        {
          name: "Luca Maestri",
          title: "Senior Vice President, Chief Financial Officer",
          biography: "Luca Maestri is CFO. Previously CFO at Xerox.",
          titleSince: "2014",
          pay: 1000000,
        },
      ];

      const normalized = leadershipService.normalizeExecutives(rawList);
      expect(normalized.length).toBe(2);

      const ceo = normalized[0];
      expect(ceo.name).toBe("Tim Cook");
      expect(ceo.title).toBe("Chief Executive Officer & Director");
      expect(ceo.isKeyOfficer).toBe(true);
      expect(ceo.tenureStartYear).toBe(2011);
      expect(ceo.pay).toBe(3000000);
      expect(ceo.previousRoles.length).toBeGreaterThanOrEqual(1);

      const cfo = normalized[1];
      expect(cfo.name).toBe("Luca Maestri");
      expect(cfo.isKeyOfficer).toBe(true);
      expect(cfo.tenureStartYear).toBe(2014);
    });

    it("2. Correctly flags key officers (CEO, CFO, COO, CTO, President, Chairman)", () => {
      const rawList = [
        { name: "John Doe", title: "Chief Technology Officer" },
        { name: "Jane Smith", title: "President" },
        { name: "Bob Johnson", title: "Director of Regional Sales" },
      ];

      const normalized = leadershipService.normalizeExecutives(rawList);
      expect(normalized[0].isKeyOfficer).toBe(true);
      expect(normalized[1].isKeyOfficer).toBe(true);
      expect(normalized[2].isKeyOfficer).toBe(false);
    });

    it("3. Handles missing biography and previous employment history safely", () => {
      const rawList = [
        {
          name: "Alice Brown",
          title: "Vice President",
        },
      ];

      const normalized = leadershipService.normalizeExecutives(rawList);
      expect(normalized.length).toBe(1);
      expect(normalized[0].name).toBe("Alice Brown");
      expect(normalized[0].previousRoles).toEqual([]);
      expect(normalized[0].tenureStartYear).toBeUndefined();
    });

    it("4. Returns empty array for null, undefined, or non-array provider responses", () => {
      expect(leadershipService.normalizeExecutives([])).toEqual([]);
      expect(leadershipService.normalizeExecutives(null as any)).toEqual([]);
      expect(leadershipService.normalizeExecutives(undefined as any)).toEqual([]);
    });
  });

  describe("fetchLeadershipProfile", () => {
    it("5. Fetches, sorts key officers first, and formats career summary insights", async () => {
      const mockExecs = [
        { name: "Bob VP", title: "Vice President of Marketing" },
        { name: "Sarah Chief", title: "Chief Executive Officer", titleSince: "2018" },
      ];

      vi.spyOn(fmpService, "getKeyExecutives").mockResolvedValue(mockExecs);

      const profile = await leadershipService.fetchLeadershipProfile("AAPL", "Apple Inc.");

      expect(profile.symbol).toBe("AAPL");
      expect(profile.companyName).toBe("Apple Inc.");
      expect(profile.executives.length).toBe(2);
      // Key Officer (CEO) sorted first
      expect(profile.executives[0].name).toBe("Sarah Chief");
      expect(profile.executives[0].isKeyOfficer).toBe(true);
      expect(profile.careerSummary).toContain("Sarah Chief");
      expect(profile.strengths?.length).toBeGreaterThan(0);
      expect(profile.leadershipScoreSupport).toBeDefined();
    });

    it("6. Handles API/provider failures gracefully without throwing errors", async () => {
      vi.spyOn(fmpService, "getKeyExecutives").mockRejectedValue(new Error("Network Timeout"));

      const profile = await leadershipService.fetchLeadershipProfile("FAIL", "Failure Inc.");

      expect(profile.symbol).toBe("FAIL");
      expect(profile.executives).toEqual([]);
      expect(profile.careerSummary).toContain("currently unavailable");
      expect(profile.leadershipScoreSupport?.executiveExperienceScore).toBeNull();
    });
  });
});
