import { CompAdapter, CompRequest, CompResult, CompSource } from '../../types';

class EbayAdapter implements CompAdapter {
  public readonly source: CompSource = 'eBay';

  async fetchComps(_request: CompRequest): Promise<CompResult> {
    return {
      source: this.source,
      marketValue: null,
      sales: [],
      averagePrice: null,
      low: null,
      high: null,
      error: 'eBay API not yet implemented',
    };
  }
}

export default EbayAdapter;
