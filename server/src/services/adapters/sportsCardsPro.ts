import { CompAdapter, CompRequest, CompResult, CompSource } from '../../types';

class SportsCardsProAdapter implements CompAdapter {
  public readonly source: CompSource = 'SportsCardsPro';

  async fetchComps(_request: CompRequest): Promise<CompResult> {
    return {
      source: this.source,
      marketValue: null,
      sales: [],
      averagePrice: null,
      low: null,
      high: null,
      error: 'SportsCardsPro API not yet implemented',
    };
  }
}

export default SportsCardsProAdapter;
