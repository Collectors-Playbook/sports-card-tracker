import { CompAdapter, CompRequest, CompResult, CompSource } from '../../types';

class CardLadderAdapter implements CompAdapter {
  public readonly source: CompSource = 'CardLadder';

  async fetchComps(_request: CompRequest): Promise<CompResult> {
    return {
      source: this.source,
      marketValue: null,
      sales: [],
      averagePrice: null,
      low: null,
      high: null,
      error: 'CardLadder API not yet implemented',
    };
  }
}

export default CardLadderAdapter;
