import { CompanyProfile, CompetitorData } from "../types";
import { competitorDiscoveryService } from "./competitorDiscoveryService";

class CompetitorService {
  /**
   * Main entry point delegating to CompetitorDiscoveryService dynamic scoring engine
   */
  async fetchCompetitors(
    targetSymbol: string,
    targetProfile: CompanyProfile
  ): Promise<CompetitorData> {
    return competitorDiscoveryService.discoverCompetitors(targetSymbol, targetProfile);
  }
}

export const competitorService = new CompetitorService();
