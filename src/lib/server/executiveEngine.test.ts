import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  normalizePersonName,
  normalizeCompanyName,
  isNameMatch,
  hasCompanyOverlap,
  formatDateLabel,
  extractYear,
  sortCareerRoles,
  fetchFromPdl,
  fetchFromWikidata,
  getExecutiveCareerProfile,
} from "./executiveEngine";
import { ExecutiveCareerRole } from "../../types";

describe("executiveEngine unit & integration tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Name Normalization & Nickname Matching", () => {
    it("1.1 normalizes titles, honorifics, punctuation, and casing", () => {
      expect(normalizePersonName("Dr. Timothy D. Cook, Jr.")).toBe("timothy cook");
      expect(normalizePersonName("Mr. Satya Nadella")).toBe("satya nadella");
      expect(normalizePersonName("Mark Elliot Zuckerberg (CEO)")).toBe("mark elliot zuckerberg");
    });

    it("1.2 matches common executive first-name nicknames and full names with identical last names", () => {
      expect(isNameMatch("Tim Cook", "Timothy Cook")).toBe(true);
      expect(isNameMatch("Timothy Cook", "Tim Cook")).toBe(true);
      expect(isNameMatch("Bob Iger", "Robert Iger")).toBe(true);
      expect(isNameMatch("Bill Gates", "William Gates")).toBe(true);
      expect(isNameMatch("Mike Bloomberg", "Michael Bloomberg")).toBe(true);
      expect(isNameMatch("Jensen Huang", "Jen-Hsun Huang")).toBe(true);
      expect(isNameMatch("Satya Nadella", "Satya Nadella")).toBe(true);
    });

    it("1.3 rejects different persons with same first name but different last name", () => {
      expect(isNameMatch("Tim Cook", "Tim Apple")).toBe(false);
      expect(isNameMatch("Satya Nadella", "Sundar Pichai")).toBe(false);
      expect(isNameMatch("Bob Iger", "Bob Chapek")).toBe(false);
    });

    it("1.4 handles empty, malformed, or missing names gracefully", () => {
      expect(isNameMatch("", "")).toBe(false);
      expect(isNameMatch("Tim Cook", "")).toBe(false);
      expect(isNameMatch("", "Tim Cook")).toBe(false);
    });
  });

  describe("2. Company Name Normalization & Token Overlap", () => {
    it("2.1 strips corporate suffixes and legal identifiers", () => {
      expect(normalizeCompanyName("Apple Inc.")).toBe("apple");
      expect(normalizeCompanyName("Steel Dynamics, Inc.")).toBe("steel dynamics");
      expect(normalizeCompanyName("Microsoft Corporation")).toBe("microsoft");
      expect(normalizeCompanyName("Alphabet Technologies Group PLC")).toBe("alphabet");
    });

    it("2.2 matches companies across legal entity variations", () => {
      expect(hasCompanyOverlap("Apple Inc.", "Apple")).toBe(true);
      expect(hasCompanyOverlap("Steel Dynamics, Inc.", "Steel Dynamics")).toBe(true);
      expect(hasCompanyOverlap("Tesla Motors, Inc.", "Tesla")).toBe(true);
      expect(hasCompanyOverlap("NVIDIA Corporation", "Nvidia")).toBe(true);
    });

    it("2.3 distinguishes unrelated companies", () => {
      expect(hasCompanyOverlap("Apple Inc.", "Microsoft Corp")).toBe(false);
      expect(hasCompanyOverlap("Steel Dynamics", "General Motors")).toBe(false);
    });
  });

  describe("3. Date Formatting, Extraction, and Role Chronology Sorting", () => {
    it("3.1 formats date strings into human-readable labels", () => {
      expect(formatDateLabel("2011-08")).toBe("Aug 2011");
      expect(formatDateLabel("2005-10-15")).toBe("Oct 2005");
      expect(formatDateLabel("2011")).toBe("2011");
      expect(formatDateLabel("Present")).toBe("Present");
      expect(formatDateLabel(null)).toBeUndefined();
    });

    it("3.2 extracts 4-digit years from strings", () => {
      expect(extractYear("2011-08")).toBe(2011);
      expect(extractYear("Aug 2005")).toBe(2005);
      expect(extractYear("1997")).toBe(1997);
      expect(extractYear(undefined)).toBeUndefined();
    });

    it("3.3 sorts roles chronologically with current roles first, then most recent end/start years", () => {
      const roles: ExecutiveCareerRole[] = [
        {
          company: "IBM",
          title: "Director",
          startDate: "1982",
          endDate: "1994",
          startYear: 1982,
          endYear: 1994,
        },
        {
          company: "Apple Inc.",
          title: "Chief Executive Officer",
          startDate: "Aug 2011",
          endDate: "Present",
          startYear: 2011,
          isCurrent: true,
        },
        {
          company: "Apple Inc.",
          title: "Chief Operating Officer",
          startDate: "Oct 2005",
          endDate: "Aug 2011",
          startYear: 2005,
          endYear: 2011,
        },
        {
          company: "Compaq",
          title: "Vice President",
          startDate: "1997",
          endDate: "1998",
          startYear: 1997,
          endYear: 1998,
        },
      ];

      const sorted = sortCareerRoles(roles);
      expect(sorted[0].title).toBe("Chief Executive Officer");
      expect(sorted[0].isCurrent).toBe(true);
      expect(sorted[1].title).toBe("Chief Operating Officer");
      expect(sorted[2].company).toBe("Compaq");
      expect(sorted[3].company).toBe("IBM");
    });
  });

  describe("4. People Data Labs (PDL) Enrichment API & Conservative Matching", () => {
    it("4.1 returns null when PDL_API_KEY is not set or placeholder", async () => {
      delete process.env.PDL_API_KEY;
      const result = await fetchFromPdl("Tim Cook", "Apple Inc.");
      expect(result).toBeNull();
    });

    it("4.2 successfully enriches and normalizes an executive from PDL response", async () => {
      process.env.PDL_API_KEY = "test-pdl-key";

      const mockPdlResponse = {
        status: 200,
        likelihood: 9,
        data: {
          id: "pdl-person-12345",
          full_name: "Timothy Donald Cook",
          job_title: "Chief Executive Officer",
          job_company_name: "Apple",
          linkedin_url: "linkedin.com/in/tim-cook-apple",
          summary: "CEO of Apple Inc.",
          experience: [
            {
              company: { name: "Apple", raw: ["Apple Inc."] },
              title: { name: "Chief Executive Officer" },
              start_date: "2011-08",
              end_date: null,
              is_primary: true,
              location: { name: "Cupertino, CA" },
            },
            {
              company: { name: "Apple", raw: ["Apple Inc."] },
              title: { name: "Chief Operating Officer" },
              start_date: "2005-10",
              end_date: "2011-08",
              is_primary: false,
            },
            {
              company: { name: "Compaq" },
              title: { name: "VP, Corporate Materials" },
              start_date: "1997",
              end_date: "1998",
            },
            {
              company: { name: "IBM" },
              title: { name: "Director, Fulfillment" },
              start_date: "1982",
              end_date: "1994",
            },
          ],
          education: [
            {
              school: { name: "Duke University" },
              degrees: ["MBA"],
              majors: ["Business Administration"],
              start_date: "1988",
              end_date: "1988",
            },
            {
              school: { name: "Auburn University" },
              degrees: ["B.S."],
              majors: ["Industrial Engineering"],
              start_date: "1978",
              end_date: "1982",
            },
          ],
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPdlResponse,
      } as any);

      const result = await fetchFromPdl("Tim Cook", "Apple Inc.", "Chief Executive Officer");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Timothy Donald Cook");
      expect(result?.source).toBe("pdl");
      expect(result?.sourcePersonId).toBe("pdl-person-12345");
      expect(result?.roles.length).toBe(4);
      expect(result?.roles[0].title).toBe("Chief Executive Officer");
      expect(result?.roles[0].endDate).toBe("Present");
      expect(result?.roles[0].isCurrent).toBe(true);
      expect(result?.education?.length).toBe(2);
      expect(result?.education?.[0].school).toBe("Duke University");
    });

    it("4.3 conservative matching rejects candidate when company has zero overlap and low likelihood", async () => {
      process.env.PDL_API_KEY = "test-pdl-key";

      const mismatchedResponse = {
        status: 200,
        likelihood: 6,
        data: {
          id: "pdl-fake-999",
          full_name: "Tim Cook",
          job_title: "Plumber",
          job_company_name: "Cook Plumbing Services",
          experience: [
            {
              company: { name: "Cook Plumbing Services" },
              title: { name: "Plumber" },
              start_date: "2015",
              end_date: null,
            },
          ],
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mismatchedResponse,
      } as any);

      const result = await fetchFromPdl("Tim Cook", "Apple Inc.");
      expect(result).toBeNull();
    });

    it("4.4 handles PDL HTTP 404 cleanly without throwing", async () => {
      process.env.PDL_API_KEY = "test-pdl-key";

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      const result = await fetchFromPdl("Unknown Executive", "Unknown Corp");
      expect(result).toBeNull();
    });
  });

  describe("5. Wikidata Fallback Resolution", () => {
    it("5.1 successfully resolves career history and education from Wikidata entity statements", async () => {
      // 1. Mock search response (Tim Cook Q265)
      const mockSearchResponse = {
        search: [
          {
            id: "Q265",
            label: "Tim Cook",
            description: "American business executive, current CEO of Apple Inc.",
          },
        ],
      };

      // 2. Mock entity claims response
      const mockEntityResponse = {
        entities: {
          Q265: {
            id: "Q265",
            labels: { en: { value: "Tim Cook" } },
            descriptions: { en: { value: "American business executive, current CEO of Apple Inc." } },
            claims: {
              P108: [
                {
                  mainsnak: { datavalue: { value: { id: "Q312" } } }, // Apple
                  qualifiers: {
                    P39: [{ datavalue: { value: { id: "Q484876" } } }], // CEO
                    P580: [{ datavalue: { value: { time: "+2011-08-24T00:00:00Z" } } }],
                  },
                },
                {
                  mainsnak: { datavalue: { value: { id: "Q37156" } } }, // IBM
                  qualifiers: {
                    P580: [{ datavalue: { value: { time: "+1982-01-01T00:00:00Z" } } }],
                    P582: [{ datavalue: { value: { time: "+1994-01-01T00:00:00Z" } } }],
                  },
                },
              ],
              P69: [
                {
                  mainsnak: { datavalue: { value: { id: "Q49210" } } }, // Duke University
                },
              ],
              P18: [
                {
                  mainsnak: { datavalue: { value: "Tim_Cook_2019.jpg" } },
                },
              ],
            },
          },
        },
      };

      // 3. Mock labels response
      const mockLabelsResponse = {
        entities: {
          Q312: { labels: { en: { value: "Apple Inc." } } },
          Q484876: { labels: { en: { value: "Chief Executive Officer" } } },
          Q37156: { labels: { en: { value: "IBM" } } },
          Q49210: { labels: { en: { value: "Duke University" } } },
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockEntityResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockLabelsResponse,
        } as any);

      const result = await fetchFromWikidata("Tim Cook", "Apple Inc.", "Chief Executive Officer");

      expect(result).not.toBeNull();
      expect(result?.source).toBe("wikidata");
      expect(result?.sourcePersonId).toBe("Q265");
      expect(result?.roles.length).toBeGreaterThanOrEqual(2);
      expect(result?.roles[0].company).toBe("Apple Inc.");
      expect(result?.roles[0].title).toBe("Chief Executive Officer");
      expect(result?.photoUrl).toContain("Tim_Cook_2019.jpg");
      expect(result?.education?.[0].school).toBe("Duke University");
    });

    it("5.2 rejects unrelated Wikidata entity with zero company overlap", async () => {
      const mockSearchResponse = {
        search: [
          {
            id: "Q99999",
            label: "Timothy Cook",
            description: "18th century British cricketer and poet",
          },
        ],
      };

      const mockEntityResponse = {
        entities: {
          Q99999: {
            id: "Q99999",
            labels: { en: { value: "Timothy Cook" } },
            descriptions: { en: { value: "18th century British cricketer" } },
            claims: {},
          },
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockEntityResponse,
        } as any);

      const result = await fetchFromWikidata("Tim Cook", "Apple Inc.");
      expect(result).toBeNull();
    });
  });

  describe("6. Unified getExecutiveCareerProfile Orchestration & Caching", () => {
    it("6.1 returns graceful empty profile with source: 'none' when no providers match", async () => {
      // Mock both PDL & Wikidata returning null
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      const profile = await getExecutiveCareerProfile(
        "John Doe",
        "Small Tech Corp",
        "STC",
        "Vice President of Sales",
        true
      );

      expect(profile).toBeDefined();
      expect(profile.name).toBe("John Doe");
      expect(profile.currentCompany).toBe("Small Tech Corp");
      expect(profile.currentTitle).toBe("Vice President of Sales");
      expect(profile.roles).toEqual([]);
      expect(profile.source).toBe("none");
    });

    it("6.2 falls back to Wikidata when PDL is unconfigured", async () => {
      delete process.env.PDL_API_KEY;

      const mockSearchResponse = {
        search: [
          {
            id: "Q265",
            label: "Tim Cook",
            description: "CEO of Apple Inc.",
          },
        ],
      };

      const mockEntityResponse = {
        entities: {
          Q265: {
            id: "Q265",
            labels: { en: { value: "Tim Cook" } },
            descriptions: { en: { value: "CEO of Apple Inc." } },
            claims: {
              P108: [
                {
                  mainsnak: { datavalue: { value: { id: "Q312" } } },
                  qualifiers: {
                    P39: [{ datavalue: { value: { id: "Q484876" } } }],
                  },
                },
              ],
            },
          },
        },
      };

      const mockLabelsResponse = {
        entities: {
          Q312: { labels: { en: { value: "Apple Inc." } } },
          Q484876: { labels: { en: { value: "Chief Executive Officer" } } },
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSearchResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockEntityResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockLabelsResponse,
        } as any);

      const profile = await getExecutiveCareerProfile("Tim Cook", "Apple Inc.", "AAPL", "CEO", true);

      expect(profile.source).toBe("wikidata");
      expect(profile.roles.length).toBeGreaterThan(0);
    });

    it("6.3 prevents repeated API calls by returning cached profile in subsequent requests", async () => {
      // First call: Populate cache
      const profile1 = await getExecutiveCareerProfile("Satya Nadella", "Microsoft Corp", "MSFT", "CEO", true);

      // Second call: Should hit memory cache immediately without calling fetch
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const profile2 = await getExecutiveCareerProfile("Satya Nadella", "Microsoft Corp", "MSFT", "CEO", false);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(profile2.name).toBe(profile1.name);
      expect(profile2.cached).toBe(true);
    });

    it("6.4 throws validation error if required fields are missing", async () => {
      await expect(getExecutiveCareerProfile("", "Apple")).rejects.toThrow("Both executive name and company are required");
      await expect(getExecutiveCareerProfile("Tim Cook", "")).rejects.toThrow("Both executive name and company are required");
    });
  });
});
