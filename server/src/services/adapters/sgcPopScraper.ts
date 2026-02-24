import { PopScraper, PopRequest, PopulationData } from '../../types';

class SgcPopScraper implements PopScraper {
  public readonly company = 'SGC';

  async fetchPopulation(_request: PopRequest): Promise<PopulationData | null> {
    // SGC pop report scraping not yet implemented
    return null;
  }
}

export default SgcPopScraper;
