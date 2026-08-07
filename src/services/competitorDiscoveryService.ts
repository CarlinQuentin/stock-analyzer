import { CompanyProfile, CompetitorProfile, CompetitorData, CompetitorBadgeType } from "../types";
import { fmpService } from "./financialModelingPrep";

export interface ScoredCompetitorCandidate {
  profile: CompanyProfile & {
    city?: string;
    state?: string;
    country?: string;
    fullTimeEmployees?: string | number;
    revenue?: number;
  };
  totalScore: number; // 0 - 100
  factors: {
    fmpPeerMatchScore: number; // Max 30
    industryScore: number; // Max 30
    descriptionSimilarityScore: number; // Max 20
    marketCapScore: number; // Max 10
    revenueScore: number; // Max 5
    geoScore: number; // Max 5
  };
  badge: CompetitorBadgeType;
  matchReasonText: string;
}

const CACHE_KEY_PREFIX = "stock_competitors_v2_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

class CompetitorDiscoveryService {
  private inMemoryCache = new Map<string, { data: CompetitorData; timestamp: number }>();

  /**
   * Helper to format human-readable concise competitor description (1-2 sentences)
   */
  public formatConciseDescription(rawDesc?: string, companyName?: string, industry?: string): string {
    if (!rawDesc || typeof rawDesc !== "string") {
      return `${companyName || "This company"} is a market competitor operating in the ${industry || "general"} sector.`;
    }
    const sentences = rawDesc
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?])\s+/);
    
    if (sentences.length <= 2) {
      return sentences.join(" ");
    }
    return `${sentences[0]} ${sentences[1]}`;
  }

  /**
   * Tokenize text and extract key domain words (excluding common English stop words)
   */
  private extractKeywords(text?: string): Set<string> {
    if (!text || typeof text !== "string") return new Set();
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
      "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were",
      "be", "been", "being", "have", "has", "had", "do", "does", "did", "company", "inc",
      "corp", "corporation", "ltd", "limited", "co", "its", "it", "this", "that", "these",
      "those", "provides", "offers", "operates", "manufactures", "designs", "markets", "sells",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    return new Set(words);
  }

  /**
   * Calculate Jaccard similarity score between two business descriptions (0 to 20 points)
   */
  private calculateDescriptionSimilarity(targetDesc?: string, candidateDesc?: string): number {
    const targetSet = this.extractKeywords(targetDesc);
    const candidateSet = this.extractKeywords(candidateDesc);

    if (targetSet.size === 0 || candidateSet.size === 0) return 5; // Default neutral baseline

    let intersectionCount = 0;
    targetSet.forEach((word) => {
      if (candidateSet.has(word)) intersectionCount++;
    });

    const unionSize = new Set([...targetSet, ...candidateSet]).size;
    if (unionSize === 0) return 5;

    const jaccard = intersectionCount / unionSize;
    // Scale 0-1 Jaccard to 0-20 points
    return Math.min(20, Math.round(jaccard * 100 * 0.4));
  }

  /**
   * Calculate market cap similarity score (0 to 10 points)
   */
  private calculateCapSimilarity(targetCap?: number, candidateCap?: number): number {
    if (!targetCap || !candidateCap || targetCap <= 0 || candidateCap <= 0) return 3;
    const ratio = Math.min(targetCap, candidateCap) / Math.max(targetCap, candidateCap);
    return Math.min(10, Math.round(ratio * 10 * 10) / 10);
  }

  /**
   * Calculate revenue scale similarity score (0 to 5 points)
   */
  private calculateRevenueSimilarity(targetRev?: number, candidateRev?: number): number {
    if (!targetRev || !candidateRev || targetRev <= 0 || candidateRev <= 0) return 2;
    const ratio = Math.min(targetRev, candidateRev) / Math.max(targetRev, candidateRev);
    return Math.min(5, Math.round(ratio * 5 * 10) / 10);
  }

  /**
   * Assign competitor badge based on total score and market cap ratio
   */
  private assignBadge(
    rankIdx: number,
    totalScore: number,
    capRatio: number,
    isFmpPeer: boolean
  ): CompetitorBadgeType {
    if (rankIdx === 0 && totalScore >= 70) return "Primary Competitor";
    if (isFmpPeer || (totalScore >= 65 && capRatio >= 0.5 && capRatio <= 2.0)) {
      return "Direct Competitor";
    }
    if (capRatio > 2.0) return "Global Competitor";
    if (capRatio < 0.3) return "Emerging Competitor";
    return "Regional Competitor";
  }

  /**
   * Build human-readable match reason text explaining why each competitor was selected
   */
  private buildMatchReason(
    targetProfile: CompanyProfile,
    candidate: CompanyProfile,
    factors: ScoredCompetitorCandidate["factors"]
  ): string {
    const reasons: string[] = [];

    if (candidate.industry && candidate.industry === targetProfile.industry) {
      reasons.push(`Same ${candidate.industry} industry`);
    } else if (candidate.sector && candidate.sector === targetProfile.sector) {
      reasons.push(`Same ${candidate.sector} sector`);
    }

    if (factors.fmpPeerMatchScore > 0) {
      reasons.push("FMP verified market peer");
    }

    if (factors.descriptionSimilarityScore >= 8) {
      reasons.push("Highly similar business model & product lines");
    }

    if (factors.marketCapScore >= 6) {
      reasons.push("Comparable market capitalization");
    }

    if (reasons.length === 0) {
      reasons.push("Overlapping commercial market operations");
    }

    return reasons.join(" • ");
  }

  /**
   * Score a single candidate company against the target company profile
   */
  public scoreCandidate(
    targetProfile: CompanyProfile,
    candidate: any,
    isFmpPeer: boolean
  ): ScoredCompetitorCandidate {
    const fmpPeerMatchScore = isFmpPeer ? 30 : 0;

    let industryScore = 0;
    if (candidate.industry && candidate.industry === targetProfile.industry) {
      industryScore = 30;
    } else if (candidate.sector && candidate.sector === targetProfile.sector) {
      industryScore = 15;
    }

    const descriptionSimilarityScore = this.calculateDescriptionSimilarity(
      targetProfile.description,
      candidate.description
    );

    const marketCapScore = this.calculateCapSimilarity(
      targetProfile.mktCap,
      candidate.mktCap || candidate.marketCap
    );

    const revenueScore = this.calculateRevenueSimilarity(
      (targetProfile as any).revenue,
      candidate.revenue
    );

    let geoScore = 0;
    if (candidate.country && (targetProfile as any).country && candidate.country === (targetProfile as any).country) {
      geoScore = 5;
    }

    let rawTotal =
      fmpPeerMatchScore +
      industryScore +
      descriptionSimilarityScore +
      marketCapScore +
      revenueScore +
      geoScore;

    // Cross-sector penalty if candidate is neither an official FMP peer nor in same sector
    if (
      !isFmpPeer &&
      candidate.sector &&
      targetProfile.sector &&
      candidate.sector !== targetProfile.sector
    ) {
      rawTotal = Math.max(0, rawTotal - 35);
    }

    const totalScore = Math.min(100, Math.round(rawTotal));

    const factors = {
      fmpPeerMatchScore,
      industryScore,
      descriptionSimilarityScore,
      marketCapScore,
      revenueScore,
      geoScore,
    };

    const matchReasonText = this.buildMatchReason(targetProfile, candidate, factors);

    return {
      profile: {
        symbol: candidate.symbol,
        companyName: candidate.companyName || candidate.name || candidate.symbol,
        sector: candidate.sector || targetProfile.sector,
        industry: candidate.industry || targetProfile.industry || "General",
        description: this.formatConciseDescription(
          candidate.description,
          candidate.companyName || candidate.name || candidate.symbol,
          candidate.industry || targetProfile.industry
        ),
        mktCap: candidate.mktCap || candidate.marketCap || 0,
        price: candidate.price || 0,
        image: candidate.image || candidate.logo,
        website: candidate.website,
        city: candidate.city,
        state: candidate.state,
        country: candidate.country,
        fullTimeEmployees: candidate.fullTimeEmployees,
      },
      totalScore,
      factors,
      badge: "Direct Competitor", // Will be re-assigned after ranking
      matchReasonText,
    };
  }

  /**
   * Main Dynamic Competitor Discovery Engine
   */
  async discoverCompetitors(
    targetSymbol: string,
    targetProfile: CompanyProfile
  ): Promise<CompetitorData> {
    const symbol = targetSymbol.toUpperCase().trim();

    // 1. Check in-memory cache
    if (this.inMemoryCache.has(symbol)) {
      const cached = this.inMemoryCache.get(symbol)!;
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 2. Check localStorage cache
    try {
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        const localStr = localStorage.getItem(CACHE_KEY_PREFIX + symbol);
        if (localStr) {
          const parsed = JSON.parse(localStr);
          if (parsed && parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
            this.inMemoryCache.set(symbol, parsed);
            return parsed.data;
          }
        }
      }
    } catch (e) {
      // Ignore storage errors
    }

    // 3. Perform FMP API Discovery
    const fmpPeerSymbols = new Set<string>();
    try {
      const peers = await fmpService.getStockPeers(symbol);
      peers.forEach((p) => {
        if (p && typeof p === "string" && p.toUpperCase() !== symbol) {
          fmpPeerSymbols.add(p.toUpperCase());
        }
      });
    } catch (e) {
      console.warn(`FMP stock peers fetch failed for ${symbol}:`, e);
    }

    // 4. Also screen for industry peers using stock-screener
    const candidateSymbols = new Set<string>(fmpPeerSymbols);
    try {
      const screenerPeers = await fmpService.getIndustryPeers(
        targetProfile.industry,
        targetProfile.sector
      );
      screenerPeers.forEach((item) => {
        if (item.symbol && item.symbol.toUpperCase() !== symbol) {
          candidateSymbols.add(item.symbol.toUpperCase());
        }
      });
    } catch (e) {
      console.warn(`FMP industry screener fetch failed for ${symbol}:`, e);
    }

    // Curated default peer fallbacks for common tickers if API discovery returned < 2 peers
    const FALLBACK_SEEDS: Record<string, string[]> = {
      AAPL: ["MSFT", "GOOGL", "AMZN", "HPQ", "DELL"],
      MSFT: ["AAPL", "GOOGL", "AMZN", "ORCL", "IBM"],
      TSLA: ["RIVN", "LCID", "F", "GM", "BYDDF"],
      NVDA: ["AMD", "INTC", "AVGO", "QCOM", "TXN"],
      STLD: ["NUE", "CMC", "CLF", "MT", "X"],
    };

    if (candidateSymbols.size < 2 && FALLBACK_SEEDS[symbol]) {
      FALLBACK_SEEDS[symbol].forEach((s) => candidateSymbols.add(s));
    }

    // Convert candidates to list and limit concurrency
    const candidateList = Array.from(candidateSymbols).slice(0, 12);

    const scoredCandidates: ScoredCompetitorCandidate[] = [];

    await Promise.all(
      candidateList.map(async (candidateSym) => {
        try {
          const profile = await fmpService.getCompanyProfile(candidateSym);
          if (!profile || !profile.companyName) return;

          const isFmpPeer = fmpPeerSymbols.has(candidateSym);
          const scored = this.scoreCandidate(targetProfile, profile, isFmpPeer);
          scoredCandidates.push(scored);
        } catch (e) {
          console.warn(`Could not load profile for competitor candidate ${candidateSym}:`, e);
        }
      })
    );

    // Sort descending by totalScore
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    const topCandidates = scoredCandidates
      .filter((c) => c.totalScore >= 15)
      .slice(0, 5);

    // Map to normalized CompetitorProfile[]
    const finalCompetitors: CompetitorProfile[] = topCandidates.map((c, idx) => {
      const targetCap = targetProfile.mktCap || 1;
      const peerCap = c.profile.mktCap || 0;
      const capRatio = peerCap / targetCap;

      const isFmpPeer = fmpPeerSymbols.has(c.profile.symbol);
      const badge = this.assignBadge(idx, c.totalScore, capRatio, isFmpPeer);

      let hq = "";
      if (c.profile.city && c.profile.state) hq = `${c.profile.city}, ${c.profile.state}`;
      else if (c.profile.city && c.profile.country) hq = `${c.profile.city}, ${c.profile.country}`;
      else if (c.profile.country) hq = c.profile.country;

      return {
        symbol: c.profile.symbol,
        companyName: c.profile.companyName,
        industry: c.profile.industry || targetProfile.industry || "General",
        sector: c.profile.sector || targetProfile.sector,
        description: c.profile.description || `${c.profile.companyName} is an industry competitor operating in the ${c.profile.industry || "market"} sector.`,
        marketCap: c.profile.mktCap || 0,
        price: c.profile.price,
        headquarters: hq || undefined,
        logo: c.profile.image,
        website: c.profile.website,
        reasonForCompetition: `${c.matchReasonText} (${c.totalScore}% Match Score)`,
        badge,
        marketCapComparisonRatio: capRatio,
        employeeCount: c.profile.fullTimeEmployees || undefined,
      };
    });

    const competitorData: CompetitorData = {
      targetSymbol: symbol,
      targetCompanyName: targetProfile.companyName,
      targetMarketCap: targetProfile.mktCap || 0,
      competitors: finalCompetitors,
      source: "Financial Modeling Prep (FMP) / Dynamic Competitor Discovery Engine",
      lastUpdated: new Date().toISOString(),
    };

    // Store in cache
    const cachePayload = { data: competitorData, timestamp: Date.now() };
    this.inMemoryCache.set(symbol, cachePayload);
    try {
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        localStorage.setItem(CACHE_KEY_PREFIX + symbol, JSON.stringify(cachePayload));
      }
    } catch (e) {
      // Storage full
    }

    return competitorData;
  }
}

export const competitorDiscoveryService = new CompetitorDiscoveryService();
