import { CompanyProfile, CompetitorProfile, CompetitorData, CompetitorBadgeType } from "../types";
import { fmpService } from "./financialModelingPrep";

// Fallback peer mapping for popular companies if FMP API endpoint returns empty array
const FALLBACK_PEERS: Record<string, { symbol: string; badge: CompetitorBadgeType; reason: string }[]> = {
  AAPL: [
    { symbol: "MSFT", badge: "Primary Competitor", reason: "Competes directly in personal computing operating systems, productivity software, cloud services, and AI hardware." },
    { symbol: "GOOGL", badge: "Direct Competitor", reason: "Major rival in mobile operating systems (Android vs iOS), app ecosystem, digital services, and smart home technology." },
    { symbol: "AMZN", badge: "Global Competitor", reason: "Competes in digital entertainment streaming, consumer smart devices, and e-commerce hardware." },
    { symbol: "HPQ", badge: "Direct Competitor", reason: "Rival in premium consumer and commercial laptop, desktop, and hardware peripherals market." },
    { symbol: "DELL", badge: "Regional Competitor", reason: "Competes in high-performance workstations, enterprise hardware, and consumer personal computers." },
  ],
  MSFT: [
    { symbol: "AAPL", badge: "Primary Competitor", reason: "Rival in desktop operating systems, premium device hardware, and developer ecosystems." },
    { symbol: "GOOGL", badge: "Direct Competitor", reason: "Major competitor in cloud infrastructure (Azure vs Google Cloud), enterprise productivity apps, and AI research." },
    { symbol: "AMZN", badge: "Primary Competitor", reason: "Fierce rivalry in global cloud infrastructure Services (Azure vs AWS) and enterprise IT solutions." },
    { symbol: "ORCL", badge: "Direct Competitor", reason: "Competes in relational database systems, enterprise ERP software, and specialized cloud infrastructure." },
    { symbol: "IBM", badge: "Global Competitor", reason: "Competes in hybrid enterprise cloud consulting, artificial intelligence systems, and corporate IT services." },
  ],
  TSLA: [
    { symbol: "RIVN", badge: "Direct Competitor", reason: "Rival electric vehicle manufacturer focusing on premium consumer EV pickups, SUVs, and commercial vans." },
    { symbol: "LCID", badge: "Emerging Competitor", reason: "Direct rival in luxury electric sedans, powertrain efficiency, and battery technology." },
    { symbol: "F", badge: "Global Competitor", reason: "Legacy automotive giant expanding rapidly into electric trucks and consumer EV vehicle lines." },
    { symbol: "GM", badge: "Global Competitor", reason: "Major automotive competitor launching mass-market electric vehicles and autonomous vehicle technology." },
  ],
  NVDA: [
    { symbol: "AMD", badge: "Primary Competitor", reason: "Direct rival in discrete GPU graphics cards, data center AI accelerators, and high-performance computing chips." },
    { symbol: "INTC", badge: "Direct Competitor", reason: "Major rival in semiconductor manufacturing, data center server processors, and emerging AI graphics hardware." },
    { symbol: "AVGO", badge: "Global Competitor", reason: "Competes in custom data center silicon, networking switches, and enterprise semiconductor solutions." },
    { symbol: "QCOM", badge: "Emerging Competitor", reason: "Rival in mobile processing silicon, edge AI chips, and automotive computing platforms." },
  ],
};

class CompetitorService {
  private cache = new Map<string, CompetitorData>();

  /**
   * Helper to format human-readable concise competitor description
   */
  private formatConciseDescription(rawDesc?: string, companyName?: string, industry?: string): string {
    if (!rawDesc || typeof rawDesc !== "string") {
      return `${companyName || "This company"} is a leading market competitor operating in the ${industry || "technology"} sector.`;
    }
    // Clean up long boilerplate paragraphs to 1-2 concise sentences
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
   * Generate an informative reason for competition based on sector & industry matching
   */
  private generateCompetitionReason(
    targetProfile: CompanyProfile,
    peerProfile: Partial<CompanyProfile>,
    fallbackReason?: string
  ): string {
    if (fallbackReason) return fallbackReason;

    if (peerProfile.industry === targetProfile.industry) {
      return `Operates in the same ${targetProfile.industry} industry, competing directly for market share, customer accounts, and technological innovation.`;
    }
    if (peerProfile.sector === targetProfile.sector) {
      return `Major rival within the ${targetProfile.sector} sector, competing for enterprise customers, capital investment, and industry talent.`;
    }
    return `Publicly recognized market peer competing in overlapping product categories, commercial services, and digital solutions.`;
  }

  /**
   * Assign appropriate competitor badge
   */
  private assignBadge(idx: number, marketCapRatio: number): CompetitorBadgeType {
    if (idx === 0) return "Primary Competitor";
    if (marketCapRatio >= 0.8 && marketCapRatio <= 1.25) return "Direct Competitor";
    if (marketCapRatio > 1.25) return "Global Competitor";
    if (marketCapRatio < 0.3) return "Emerging Competitor";
    return "Regional Competitor";
  }

  /**
   * Main function to fetch and build competitor data
   */
  async fetchCompetitors(
    targetSymbol: string,
    targetProfile: CompanyProfile
  ): Promise<CompetitorData> {
    const symbol = targetSymbol.toUpperCase().trim();
    if (this.cache.has(symbol)) {
      return this.cache.get(symbol)!;
    }

    const fallbackPeersForSymbol = FALLBACK_PEERS[symbol] || [];
    let peerSymbols: string[] = [];

    try {
      const fetchedPeers = await fmpService.getStockPeers(symbol);
      if (Array.isArray(fetchedPeers) && fetchedPeers.length > 0) {
        // Filter out target symbol itself
        peerSymbols = fetchedPeers
          .filter((s) => typeof s === "string" && s.toUpperCase() !== symbol)
          .slice(0, 6);
      }
    } catch (err) {
      console.warn(`Error fetching FMP stock peers for ${symbol}:`, err);
    }

    // Merge fallback peers if fetched list is small or empty
    if (peerSymbols.length < 3 && fallbackPeersForSymbol.length > 0) {
      const fallbackSyms = fallbackPeersForSymbol.map((f) => f.symbol);
      peerSymbols = Array.from(new Set([...peerSymbols, ...fallbackSyms])).slice(0, 6);
    }

    // Default fallback symbols if none returned
    if (peerSymbols.length === 0) {
      peerSymbols = ["MSFT", "GOOGL", "AMZN", "AAPL", "NVDA"].filter((s) => s !== symbol).slice(0, 4);
    }

    // Fetch profile data for all competitor symbols concurrently
    const competitorProfiles: CompetitorProfile[] = [];

    await Promise.all(
      peerSymbols.map(async (peerSym, idx) => {
        try {
          const profile = await fmpService.getCompanyProfile(peerSym);
          if (!profile) return;

          const fallbackInfo = fallbackPeersForSymbol.find(
            (f) => f.symbol.toUpperCase() === peerSym.toUpperCase()
          );

          const targetCap = targetProfile.mktCap || 1;
          const peerCap = profile.mktCap || 0;
          const capRatio = peerCap / targetCap;

          const badge = fallbackInfo ? fallbackInfo.badge : this.assignBadge(idx, capRatio);
          const reason = this.generateCompetitionReason(targetProfile, profile, fallbackInfo?.reason);
          const conciseDesc = this.formatConciseDescription(profile.description, profile.companyName, profile.industry);

          competitorProfiles.push({
            symbol: profile.symbol,
            companyName: profile.companyName,
            industry: profile.industry || targetProfile.industry || "Technology",
            sector: profile.sector || targetProfile.sector,
            description: conciseDesc,
            marketCap: peerCap,
            price: profile.price,
            logo: profile.image,
            website: profile.website,
            reasonForCompetition: reason,
            badge,
            marketCapComparisonRatio: capRatio,
          });
        } catch (err) {
          console.warn(`Could not load competitor profile for ${peerSym}:`, err);
        }
      })
    );

    // Sort competitors so Primary & Direct competitors appear first
    competitorProfiles.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

    const resultData: CompetitorData = {
      targetSymbol: symbol,
      targetCompanyName: targetProfile.companyName,
      targetMarketCap: targetProfile.mktCap || 0,
      competitors: competitorProfiles.slice(0, 6),
      source: "Financial Modeling Prep (FMP) / Stock Peers & Market Profiles",
      lastUpdated: new Date().toISOString(),
    };

    this.cache.set(symbol, resultData);
    return resultData;
  }
}

export const competitorService = new CompetitorService();
