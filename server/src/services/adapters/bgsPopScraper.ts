import { PopScraper, PopRequest, PopulationData } from '../../types';

class BgsPopScraper implements PopScraper {
  public readonly company = 'BGS';

  async fetchPopulation(_request: PopRequest): Promise<PopulationData | null> {
    // BGS pop report scraping not yet implemented
    return null;
  }
}

export default BgsPopScraper;
