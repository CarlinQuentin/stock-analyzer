import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ExecutiveCareerHistoryDetail,
  ExecutiveCareerRole,
  ExecutiveEducation,
} from "./types.js";

// L1 In-Memory Cache (10 minutes in memory for hot lambdas / dev server)
const memoryCache = new Map<
  string,
  { profile: ExecutiveCareerHistoryDetail; timestamp: number }
>();
const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;

// L2 Supabase Cache Lifetime (180 days for found profiles, 60 days for negative matches)
const DB_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

// Nickname mapping table for executive first-name variations
const NICKNAME_MAP: Record<string, string[]> = {
  tim: ["timothy", "tim"],
  timothy: ["tim", "timothy"],
  bob: ["robert", "bobby", "rob", "bob"],
  robert: ["bob", "bobby", "rob", "robert"],
  bill: ["william", "billy", "will", "bill"],
  william: ["bill", "billy", "will", "william"],
  mike: ["michael", "mick", "mike"],
  michael: ["mike", "mick", "michael"],
  jim: ["james", "jimmy", "jim"],
  james: ["jim", "jimmy", "james"],
  dave: ["david", "dave"],
  david: ["dave", "david"],
  dan: ["daniel", "danny", "dan"],
  daniel: ["dan", "danny", "daniel"],
  steve: ["stephen", "steven", "steve"],
  stephen: ["steve", "steven", "stephen"],
  steven: ["steve", "stephen", "steven"],
  chris: ["christopher", "chris"],
  christopher: ["chris", "christopher"],
  tom: ["thomas", "tommy", "tom"],
  thomas: ["tom", "tommy", "thomas"],
  tony: ["anthony", "tony"],
  anthony: ["tony", "anthony"],
  alex: ["alexander", "alex"],
  alexander: ["alex", "alexander"],
  matt: ["matthew", "matt"],
  matthew: ["matt", "matthew"],
  jeff: ["jeffrey", "geoffrey", "jeff"],
  jeffrey: ["jeff", "geoffrey", "jeffrey"],
  andy: ["andrew", "andy", "drew"],
  andrew: ["andy", "drew", "andrew"],
  greg: ["gregory", "greg"],
  gregory: ["greg", "gregory"],
  jensen: ["jen-hsun", "jensen", "jen hsun", "jen"],
  "jen-hsun": ["jensen", "jen-hsun", "jen hsun", "jen"],
  "jen hsun": ["jensen", "jen-hsun", "jen hsun", "jen"],
  jen: ["jensen", "jen-hsun", "jen hsun", "jen"],
  satya: ["satyanarayana", "satya"],
};

/**
 * Normalizes person name for matching: strips honorifics, initials, punctuation, and extra spaces
 */
export function normalizePersonName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|phd|esq|jr|sr|iii|ii|iv|ceo|cfo|coo|cto|president)\b/gi, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .replace(/\b[a-z]\b/g, " ") // remove standalone single letters / initials (e.g. "D.")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes company name for matching: strips common corporate entity suffixes
 */
export function normalizeCompanyName(company: string): string {
  if (!company) return "";
  return company
    .toLowerCase()
    .replace(
      /\b(inc|incorporated|corp|corporation|co|company|llc|ltd|limited|group|holdings|plc|lp|sa|nv|ag|technologies|platforms|enterprises)\b/gi,
      ""
    )
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if two person names match with nickname and middle-initial tolerance
 */
export function isNameMatch(nameA: string, nameB: string): boolean {
  const normA = normalizePersonName(nameA);
  const normB = normalizePersonName(nameB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const partsA = normA.split(" ").filter(Boolean);
  const partsB = normB.split(" ").filter(Boolean);

  if (partsA.length === 0 || partsB.length === 0) return false;

  const lastA = partsA[partsA.length - 1];
  const lastB = partsB[partsB.length - 1];

  // Last names must strictly match
  if (lastA !== lastB) return false;

  const firstA = partsA[0];
  const firstB = partsB[0];

  if (firstA === firstB) return true;

  // Check full first name string (without last name)
  const fullFirstA = partsA.slice(0, -1).join(" ");
  const fullFirstB = partsB.slice(0, -1).join(" ");
  if (fullFirstA === fullFirstB) return true;

  // Check nickname equivalence
  const aliasesA = [
    ...(NICKNAME_MAP[firstA] || [firstA]),
    ...(NICKNAME_MAP[fullFirstA] || []),
  ];
  if (aliasesA.includes(firstB) || aliasesA.includes(fullFirstB)) return true;

  const aliasesB = [
    ...(NICKNAME_MAP[firstB] || [firstB]),
    ...(NICKNAME_MAP[fullFirstB] || []),
  ];
  if (aliasesB.includes(firstA) || aliasesB.includes(fullFirstA)) return true;

  return false;
}

/**
 * Checks if two company names have significant token overlap
 */
export function hasCompanyOverlap(compA: string, compB: string): boolean {
  const normA = normalizeCompanyName(compA);
  const normB = normalizeCompanyName(compB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  const tokensA = new Set(normA.split(" ").filter((t) => t.length > 2));
  const tokensB = normB.split(" ").filter((t) => t.length > 2);

  for (const token of tokensB) {
    if (tokensA.has(token)) return true;
  }

  return false;
}

/**
 * Formats date string (YYYY-MM or YYYY) into readable label (e.g. "Aug 2011" or "2011")
 */
export function formatDateLabel(dateStr?: string | null): string | undefined {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;

  // If already "Present", preserve
  if (trimmed.toLowerCase() === "present") return "Present";

  // Match YYYY-MM
  const yyyyMmMatch = trimmed.match(/^(\d{4})-(\d{1,2})/);
  if (yyyyMmMatch) {
    const year = parseInt(yyyyMmMatch[1], 10);
    const month = parseInt(yyyyMmMatch[2], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      return `${monthNames[month - 1]} ${year}`;
    }
  }

  // Match YYYY
  const yyyyMatch = trimmed.match(/^(\d{4})/);
  if (yyyyMatch) {
    return yyyyMatch[1];
  }

  return trimmed;
}

/**
 * Extracts integer year from string
 */
export function extractYear(dateStr?: string | null): number | undefined {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const match = dateStr.match(/\b(\d{4})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Sorts career roles chronologically with current roles first, then most recent endYear / startYear
 */
export function sortCareerRoles(roles: ExecutiveCareerRole[]): ExecutiveCareerRole[] {
  return [...roles].sort((a, b) => {
    // Current roles first
    const aCurrent = a.isCurrent || a.endDate === "Present";
    const bCurrent = b.isCurrent || b.endDate === "Present";
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;

    // Next, compare end year
    const aEndYear = typeof a.endYear === "number" ? a.endYear : extractYear(a.endDate) || 9999;
    const bEndYear = typeof b.endYear === "number" ? b.endYear : extractYear(b.endDate) || 9999;
    if (aEndYear !== bEndYear) {
      return bEndYear - aEndYear;
    }

    // Next, compare start year
    const aStartYear = typeof a.startYear === "number" ? a.startYear : extractYear(a.startDate) || 0;
    const bStartYear = typeof b.startYear === "number" ? b.startYear : extractYear(b.startDate) || 0;
    return bStartYear - aStartYear;
  });
}

/**
 * Server Supabase client instance
 */
let serverSupabase: SupabaseClient | null = null;
function getServerSupabase(): SupabaseClient | null {
  if (serverSupabase) return serverSupabase;

  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (url && key && url.startsWith("http") && !url.includes("placeholder")) {
      serverSupabase = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      return serverSupabase;
    }
  } catch (err) {
    console.error("[Executive Engine Supabase Init Error]:", err);
  }

  return null;
}

/**
 * Looks up cached executive profile in Supabase
 */
async function getCachedProfileFromDb(
  normalizedName: string,
  currentCompany: string
): Promise<ExecutiveCareerHistoryDetail | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("executive_profiles")
      .select("*")
      .eq("normalized_name", normalizedName)
      .eq("current_company", currentCompany)
      .maybeSingle();

    if (error || !data) return null;

    const fetchedAt = new Date(data.fetched_at).getTime();
    const now = Date.now();
    const ttl = data.source === "none" ? NEGATIVE_CACHE_TTL_MS : DB_CACHE_TTL_MS;

    if (now - fetchedAt > ttl) {
      // Expired cache entry
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      normalizedName: data.normalized_name,
      currentCompany: data.current_company,
      currentSymbol: data.current_symbol || undefined,
      currentTitle: data.current_title || undefined,
      photoUrl: data.photo_url || undefined,
      linkedinUrl: data.linkedin_url || undefined,
      summary: data.summary || undefined,
      roles: Array.isArray(data.career_history) ? data.career_history : [],
      education: Array.isArray(data.education) ? data.education : [],
      source: data.source || "none",
      sourcePersonId: data.source_person_id || undefined,
      matchConfidence: data.match_confidence ? parseFloat(data.match_confidence) : 1.0,
      fetchedAt: data.fetched_at,
      cached: true,
    };
  } catch (err) {
    console.warn("[Executive Supabase Cache Read Error]:", err);
    return null;
  }
}

/**
 * Saves or updates executive profile in Supabase
 */
async function saveProfileToDb(profile: ExecutiveCareerHistoryDetail): Promise<void> {
  const supabase = getServerSupabase();
  if (!supabase) return;

  try {
    const record = {
      name: profile.name,
      normalized_name: profile.normalizedName,
      current_company: profile.currentCompany,
      current_symbol: profile.currentSymbol || null,
      current_title: profile.currentTitle || null,
      career_history: profile.roles || [],
      education: profile.education || [],
      photo_url: profile.photoUrl || null,
      linkedin_url: profile.linkedinUrl || null,
      summary: profile.summary || null,
      source: profile.source,
      source_person_id: profile.sourcePersonId || null,
      match_confidence: profile.matchConfidence || 1.0,
      fetched_at: profile.fetchedAt,
      updated_at: new Date().toISOString(),
    };

    await supabase.from("executive_profiles").upsert(record, {
      onConflict: "normalized_name,current_company",
    });
  } catch (err) {
    console.warn("[Executive Supabase Cache Write Error]:", err);
  }
}

/**
 * Queries People Data Labs (PDL) Person Enrichment API
 */
export async function fetchFromPdl(
  name: string,
  company: string,
  title?: string
): Promise<ExecutiveCareerHistoryDetail | null> {
  const apiKey = process.env.PDL_API_KEY;
  if (!apiKey || apiKey.trim().length === 0 || apiKey.includes("placeholder")) {
    return null;
  }

  try {
    const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
    url.searchParams.set("name", name);
    url.searchParams.set("company", company);
    if (title) {
      url.searchParams.set("title", title);
    }
    url.searchParams.set("min_likelihood", "6");
    url.searchParams.set("pretty", "false");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey.trim(),
        Accept: "application/json",
      },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      console.warn(`[PDL Enrichment API Warning]: HTTP ${res.status} for ${name} at ${company}`);
      return null;
    }

    const payload = await res.json();
    const data = payload?.data;
    if (!data) return null;

    // Conservative Identity Matching Safety
    const returnedName = data.full_name || `${data.first_name || ""} ${data.last_name || ""}`.trim();
    if (!isNameMatch(name, returnedName)) {
      console.warn(`[PDL Safety Reject]: Name mismatch between requested "${name}" and returned "${returnedName}"`);
      return null;
    }

    // Verify company overlap
    const experiences: any[] = Array.isArray(data.experience) ? data.experience : [];
    const currentComp = data.job_company_name || "";
    const hasOverlap =
      hasCompanyOverlap(company, currentComp) ||
      experiences.some((exp) => exp.company?.name && hasCompanyOverlap(company, exp.company.name));

    if (!hasOverlap && (payload.likelihood || 0) < 8) {
      console.warn(`[PDL Safety Reject]: No company overlap found for "${name}" with target company "${company}"`);
      return null;
    }

    // Extract roles
    const roles: ExecutiveCareerRole[] = experiences
      .map((exp) => {
        const compName = exp.company?.name || exp.company?.raw?.[0] || "Unknown Organization";
        const roleTitle = exp.title?.name || exp.title?.raw?.[0] || "Executive Role";
        const startDate = formatDateLabel(exp.start_date);
        const isCurrent = exp.is_primary || exp.end_date === null || !exp.end_date;
        const endDate = isCurrent ? "Present" : formatDateLabel(exp.end_date);

        return {
          company: compName,
          title: roleTitle,
          startDate,
          endDate,
          startYear: extractYear(exp.start_date),
          endYear: isCurrent ? "Present" : extractYear(exp.end_date),
          isCurrent,
          description: exp.summary || undefined,
          location: exp.location?.name || undefined,
        };
      })
      .filter((r) => r.company && r.title);

    // Extract education
    const educations: any[] = Array.isArray(data.education) ? data.education : [];
    const education: ExecutiveEducation[] = educations
      .map((edu) => ({
        school: edu.school?.name || edu.school?.raw?.[0] || "University",
        degrees: Array.isArray(edu.degrees) ? edu.degrees : [],
        majors: Array.isArray(edu.majors) ? edu.majors : [],
        startYear: extractYear(edu.start_date),
        endYear: extractYear(edu.end_date),
      }))
      .filter((e) => e.school && e.school !== "University");

    const sortedRoles = sortCareerRoles(roles);

    return {
      name: returnedName || name,
      normalizedName: normalizePersonName(name),
      currentCompany: company,
      currentTitle: title || data.job_title || undefined,
      photoUrl: data.profile_pic_url || data.photo_url || undefined,
      linkedinUrl: data.linkedin_url ? `https://${data.linkedin_url.replace(/^https?:\/\//, "")}` : undefined,
      summary: data.summary || undefined,
      roles: sortedRoles,
      education: education.length > 0 ? education : undefined,
      source: "pdl",
      sourcePersonId: data.id || undefined,
      matchConfidence: Math.min(1.0, (payload.likelihood || 8) / 10),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[PDL Fetch Error for ${name}]:`, err);
    return null;
  }
}

/**
 * Queries Wikidata as an accurate, public fallback for prominent executives
 */
export async function fetchFromWikidata(
  name: string,
  company: string,
  title?: string
): Promise<ExecutiveCareerHistoryDetail | null> {
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      name
    )}&language=en&format=json&type=item&limit=5`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "InvestorsEdge/1.0 (https://www.investorsedge.tech; contact@investorsedge.tech)",
        Accept: "application/json",
      },
    });

    if (!searchRes.ok) return null;

    const searchJson = await searchRes.json();
    const results: any[] = searchJson?.search || [];
    if (results.length === 0) return null;

    // Filter candidate entities: must match name and have business/executive context or mention company
    let targetEntityId: string | null = null;
    for (const item of results) {
      if (!isNameMatch(name, item.label)) continue;

      const desc = (item.description || "").toLowerCase();
      const isBusinessPerson =
        desc.includes("executive") ||
        desc.includes("ceo") ||
        desc.includes("chief") ||
        desc.includes("businessman") ||
        desc.includes("businessperson") ||
        desc.includes("businesswoman") ||
        desc.includes("entrepreneur") ||
        desc.includes("manager") ||
        desc.includes("director") ||
        desc.includes("president") ||
        hasCompanyOverlap(company, desc);

      if (isBusinessPerson) {
        targetEntityId = item.id;
        break;
      }
    }

    if (!targetEntityId) {
      // If no description match, try first exact name match
      const exactMatch = results.find((r) => isNameMatch(name, r.label));
      if (exactMatch) targetEntityId = exactMatch.id;
      else return null;
    }

    if (!targetEntityId) return null;
    const resolvedEntityId: string = targetEntityId;

    // Fetch entity claims
    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${resolvedEntityId}.json`;
    const entityRes = await fetch(entityUrl, {
      headers: {
        "User-Agent": "InvestorsEdge/1.0 (https://www.investorsedge.tech; contact@investorsedge.tech)",
        Accept: "application/json",
      },
    });

    if (!entityRes.ok) return null;

    const entityJson = await entityRes.json();
    const entity = entityJson?.entities?.[resolvedEntityId];
    if (!entity) return null;

    const claims = entity.claims || {};
    const qIdsToResolve = new Set<string>();

    // P108 = employer
    const employerClaims: any[] = claims.P108 || [];
    // P39 = position held
    const positionClaims: any[] = claims.P39 || [];
    // P69 = educated at
    const educationClaims: any[] = claims.P69 || [];

    for (const claim of employerClaims) {
      const qid = claim.mainsnak?.datavalue?.value?.id;
      if (qid) qIdsToResolve.add(qid);
      // Check qualifiers for position held (P39 / P107)
      const posQid = claim.qualifiers?.P39?.[0]?.datavalue?.value?.id;
      if (posQid) qIdsToResolve.add(posQid);
    }

    for (const claim of positionClaims) {
      const qid = claim.mainsnak?.datavalue?.value?.id;
      if (qid) qIdsToResolve.add(qid);
      // Check qualifiers for of / organization (P642 / P108)
      const ofQid =
        claim.qualifiers?.P642?.[0]?.datavalue?.value?.id ||
        claim.qualifiers?.P108?.[0]?.datavalue?.value?.id;
      if (ofQid) qIdsToResolve.add(ofQid);
    }

    for (const claim of educationClaims) {
      const qid = claim.mainsnak?.datavalue?.value?.id;
      if (qid) qIdsToResolve.add(qid);
      // P512 = academic degree
      const degQid = claim.qualifiers?.P512?.[0]?.datavalue?.value?.id;
      if (degQid) qIdsToResolve.add(degQid);
    }

    // Resolve Q-IDs into English labels
    const labelMap = new Map<string, string>();
    if (qIdsToResolve.size > 0) {
      const idsList = Array.from(qIdsToResolve).slice(0, 50);
      const labelsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${idsList.join(
        "|"
      )}&props=labels&languages=en&format=json`;

      try {
        const labelsRes = await fetch(labelsUrl, {
          headers: {
            "User-Agent": "InvestorsEdge/1.0 (https://www.investorsedge.tech; contact@investorsedge.tech)",
            Accept: "application/json",
          },
        });
        if (labelsRes.ok) {
          const labelsJson = await labelsRes.json();
          for (const [qid, val] of Object.entries<any>(labelsJson?.entities || {})) {
            if (val?.labels?.en?.value) {
              labelMap.set(qid, val.labels.en.value);
            }
          }
        }
      } catch {}
    }

    const roles: ExecutiveCareerRole[] = [];

    // Helper to parse date from Wikidata time value (+2011-08-24T00:00:00Z)
    const parseWikiDate = (timeObj?: any): string | undefined => {
      if (!timeObj?.time) return undefined;
      const t = timeObj.time.replace(/^\+/, "");
      return formatDateLabel(t);
    };

    // 1. Parse P108 (Employer) claims
    for (const claim of employerClaims) {
      const empQid = claim.mainsnak?.datavalue?.value?.id;
      const empName = empQid ? labelMap.get(empQid) || empQid : null;
      if (!empName) continue;

      const posQid = claim.qualifiers?.P39?.[0]?.datavalue?.value?.id;
      const roleTitle = posQid ? labelMap.get(posQid) || title || "Executive Officer" : title || "Executive Officer";

      const startTime = claim.qualifiers?.P580?.[0]?.datavalue?.value;
      const endTime = claim.qualifiers?.P582?.[0]?.datavalue?.value;
      const startDate = parseWikiDate(startTime);
      const isCurrent = !endTime;
      const endDate = isCurrent ? "Present" : parseWikiDate(endTime);

      roles.push({
        company: empName,
        title: roleTitle,
        startDate,
        endDate,
        startYear: extractYear(startDate),
        endYear: isCurrent ? "Present" : extractYear(endDate),
        isCurrent,
      });
    }

    // 2. Parse P39 (Position held) claims
    for (const claim of positionClaims) {
      const posQid = claim.mainsnak?.datavalue?.value?.id;
      const roleTitle = posQid ? labelMap.get(posQid) || "Executive Officer" : "Executive Officer";

      const orgQid =
        claim.qualifiers?.P642?.[0]?.datavalue?.value?.id ||
        claim.qualifiers?.P108?.[0]?.datavalue?.value?.id;
      const orgName = orgQid ? labelMap.get(orgQid) || company : company;

      const startTime = claim.qualifiers?.P580?.[0]?.datavalue?.value;
      const endTime = claim.qualifiers?.P582?.[0]?.datavalue?.value;
      const startDate = parseWikiDate(startTime);
      const isCurrent = !endTime;
      const endDate = isCurrent ? "Present" : parseWikiDate(endTime);

      // Check if already captured via P108
      const alreadyExists = roles.some(
        (r) =>
          hasCompanyOverlap(r.company, orgName) &&
          r.startDate === startDate &&
          r.endDate === endDate
      );

      if (!alreadyExists) {
        roles.push({
          company: orgName,
          title: roleTitle,
          startDate,
          endDate,
          startYear: extractYear(startDate),
          endYear: isCurrent ? "Present" : extractYear(endDate),
          isCurrent,
        });
      }
    }

    // If roles array has no current position for this company, synthesize current company role
    const hasCurrentTargetRole = roles.some(
      (r) => hasCompanyOverlap(r.company, company) && r.isCurrent
    );
    if (!hasCurrentTargetRole && title) {
      roles.unshift({
        company,
        title,
        startDate: undefined,
        endDate: "Present",
        isCurrent: true,
      });
    }

    // Extract education
    const education: ExecutiveEducation[] = [];
    for (const claim of educationClaims) {
      const schoolQid = claim.mainsnak?.datavalue?.value?.id;
      const schoolName = schoolQid ? labelMap.get(schoolQid) || schoolQid : null;
      if (!schoolName) continue;

      const degQid = claim.qualifiers?.P512?.[0]?.datavalue?.value?.id;
      const degreeName = degQid ? labelMap.get(degQid) || undefined : undefined;

      const startTime = claim.qualifiers?.P580?.[0]?.datavalue?.value;
      const endTime = claim.qualifiers?.P582?.[0]?.datavalue?.value;

      education.push({
        school: schoolName,
        degrees: degreeName ? [degreeName] : [],
        startYear: extractYear(parseWikiDate(startTime)),
        endYear: extractYear(parseWikiDate(endTime)),
      });
    }

    // Photo from Wikidata P18 (Wikimedia Commons)
    let photoUrl: string | undefined = undefined;
    const p18Claim = claims.P18?.[0]?.mainsnak?.datavalue?.value;
    if (p18Claim && typeof p18Claim === "string") {
      photoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
        p18Claim
      )}?width=400`;
    }

    // Validate that Wikidata candidate connects to company or is valid
    const hasConnectionToCompany =
      hasCompanyOverlap(company, entity.descriptions?.en?.value || "") ||
      roles.some((r) => hasCompanyOverlap(r.company, company));

    if (!hasConnectionToCompany) {
      console.warn(`[Wikidata Safety Reject]: Entity ${targetEntityId} (${name}) has no verified connection to ${company}`);
      return null;
    }

    const sortedRoles = sortCareerRoles(roles);

    return {
      name: entity.labels?.en?.value || name,
      normalizedName: normalizePersonName(name),
      currentCompany: company,
      currentTitle: title,
      photoUrl,
      summary: entity.descriptions?.en?.value || undefined,
      roles: sortedRoles,
      education: education.length > 0 ? education : undefined,
      source: "wikidata",
      sourcePersonId: resolvedEntityId,
      matchConfidence: 0.85,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[Wikidata Fetch Error for ${name}]:`, err);
    return null;
  }
}

/**
 * Main Entry Point: Fetches executive career history with full caching and fallback hierarchy
 * Architecture: Request -> Validate -> Check Memory L1 -> Check Supabase L2 -> PDL -> Wikidata Fallback -> Cache -> Return
 */
export async function getExecutiveCareerProfile(
  name: string,
  company: string,
  symbol?: string,
  title?: string,
  forceRefresh = false
): Promise<ExecutiveCareerHistoryDetail> {
  const cleanName = (name || "").trim();
  const cleanCompany = (company || "").trim();
  const cleanSymbol = (symbol || "").trim().toUpperCase();
  const cleanTitle = (title || "").trim();

  if (!cleanName || !cleanCompany) {
    throw new Error("Both executive name and company are required");
  }

  const normalizedName = normalizePersonName(cleanName);
  const cacheKey = `${normalizedName}::${normalizeCompanyName(cleanCompany)}`;

  // 1. Check L1 Memory Cache (unless forced refresh)
  if (!forceRefresh && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < MEMORY_CACHE_TTL_MS) {
      return { ...cached.profile, cached: true };
    }
  }

  // 2. Check L2 Supabase Cache (unless forced refresh)
  if (!forceRefresh) {
    const dbProfile = await getCachedProfileFromDb(normalizedName, cleanCompany);
    if (dbProfile) {
      memoryCache.set(cacheKey, { profile: dbProfile, timestamp: Date.now() });
      return dbProfile;
    }
  }

  // 3. Attempt People Data Labs (PDL) Person Enrichment
  let enrichedProfile = await fetchFromPdl(cleanName, cleanCompany, cleanTitle);

  // 4. If PDL returns no confident match or is not configured, attempt Wikidata Fallback
  if (!enrichedProfile || enrichedProfile.roles.length === 0) {
    const wikiProfile = await fetchFromWikidata(cleanName, cleanCompany, cleanTitle);
    if (wikiProfile && wikiProfile.roles.length > 0) {
      enrichedProfile = wikiProfile;
    }
  }

  // 5. If neither provider returned history, construct a graceful empty response
  if (!enrichedProfile) {
    enrichedProfile = {
      name: cleanName,
      normalizedName,
      currentCompany: cleanCompany,
      currentSymbol: cleanSymbol || undefined,
      currentTitle: cleanTitle || undefined,
      roles: [],
      source: "none",
      fetchedAt: new Date().toISOString(),
      cached: false,
    };
  } else {
    enrichedProfile.currentSymbol = cleanSymbol || undefined;
    enrichedProfile.currentTitle = cleanTitle || enrichedProfile.currentTitle;
  }

  // 6. Save to Supabase L2 Cache and Memory L1 Cache
  await saveProfileToDb(enrichedProfile);
  memoryCache.set(cacheKey, { profile: enrichedProfile, timestamp: Date.now() });

  return enrichedProfile;
}
