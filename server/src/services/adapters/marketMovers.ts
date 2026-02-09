import { CompAdapter, CompRequest, CompResult, CompSource } from '../../types';

class MarketMoversAdapter implements CompAdapter {
  public readonly source: CompSource = 'MarketMovers';

  async fetchComps(_request: CompRequest): Promise<CompResult> {
    return {
      source: this.source,
      marketValue: null,
      sales: [],
      averagePrice: null,
      low: null,
      high: null,
      error: 'MarketMovers API not yet implemented',
    };
  }
}

export default MarketMoversAdapter;
