import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useCards } from '../../context/ApiCardContext';
import { Card, CardFormData, CollectionType, CONDITIONS, CATEGORIES, GRADING_COMPANIES, COLLECTION_TYPES } from '../../types';
import { apiService, CompReport, CompResult, PopRarityTier } from '../../services/api';
import ImageUpload from '../ImageUpload/ImageUpload';
import { logDebug, logInfo, logWarn, logError } from '../../utils/logger';
import './CardForm.css';

function resolveCondition(condition?: string, grade?: string): string {
  if (condition === 'Raw') return 'RAW';
  if (condition === 'Graded' && grade) {
    const match = CONDITIONS.find(c => c.startsWith(grade.trim() + ':'));
    if (match) return match;
  }
  return condition || CONDITIONS[0];
}

function formatCompPrice(value: number | null): string {
  if (value === null) return '--';
  return '$' + value.toFixed(2);
}

function formatCompDate(dateStr: string): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCompDateTime(dateStr: string): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getCompRarityClass(tier: PopRarityTier): string {
  switch (tier) {
    case 'ultra-low':
    case 'low':
      return 'comp-rarity-low';
    case 'medium':
      return 'comp-rarity-medium';
    case 'high':
    case 'very-high':
      return 'comp-rarity-high';
  }
}

const CompSourceRow: React.FC<{ result: CompResult }> = ({ result }) => {
  if (result.error) {
    return (
      <div className="comp-source">
        <div className="comp-source-header">
          <span className="comp-source-name">{result.source}</span>
          <span className="comp-source-error">Error</span>
        </div>
        <p className="comp-source-error-msg">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="comp-source">
      <div className="comp-source-header">
        <span className="comp-source-name">{result.source}</span>
        {result.marketValue !== null && (
          <span className="comp-source-market-value">{formatCompPrice(result.marketValue)}</span>
        )}
      </div>
      <div className="comp-source-stats">
        <span>Avg: {formatCompPrice(result.averagePrice)}</span>
        <span>Low: {formatCompPrice(result.low)}</span>
        <span>High: {formatCompPrice(result.high)}</span>
      </div>
      {result.sales.length > 0 && (
        <div className="comp-sales">
          <div className="comp-sales-header">Recent Sales</div>
          {result.sales.slice(0, 5).map((sale, i) => (
            <div key={i} className="comp-sale-row">
              <span className="comp-sale-date">{formatCompDate(sale.date)}</span>
              <span className="comp-sale-venue">{sale.venue}</span>
              {sale.grade && <span className="comp-sale-grade">{sale.grade}</span>}
              <span className="comp-sale-price">{formatCompPrice(sale.price)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CardFormProps {
  card?: Card;
  onSuccess?: () => void;
  onCancel?: () => void;
}


const CardForm: React.FC<CardFormProps> = ({ card, onSuccess, onCancel }) => {
  const { addCard, updateCard } = useCards();
  const isEditing = !!card;
  const [images, setImages] = useState<string[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [compReport, setCompReport] = useState<CompReport | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compExpanded, setCompExpanded] = useState(true);

  logDebug('CardForm', 'Component initialized', { isEditing, cardId: card?.id });

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
    watch,
    setValue
  } = useForm<CardFormData>({
    defaultValues: {
      player: '',
      team: '',
      year: new Date().getFullYear(),
      brand: '',
      category: '',
      cardNumber: '',
      parallel: '',
      condition: CONDITIONS[0],
      gradingCompany: '',
      purchasePrice: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      sellPrice: undefined,
      sellDate: '',
      currentValue: 0,
      notes: '',
      collectionId: '',
      collectionType: 'Inventory'
    }
  });

  const sellPrice = watch('sellPrice');
  const sellDate = watch('sellDate');

  // Load collections
  useEffect(() => {
    const loadCollections = async () => {
      try {
        const userCollections = await apiService.getCollections();
        setCollections(userCollections);
      } catch (error) {
        console.error('Error loading collections:', error);
      }
    };
    loadCollections();
  }, []);

  // Load comp data when editing
  useEffect(() => {
    if (!card?.id) {
      setCompReport(null);
      return;
    }
    const loadComps = async () => {
      setCompLoading(true);
      try {
        const report = await apiService.getStoredComps(card.id);
        setCompReport(report);
      } catch {
        setCompReport(null);
      } finally {
        setCompLoading(false);
      }
    };
    loadComps();
  }, [card?.id]);

  const resetForm = useCallback((cardData?: Card) => {
    logDebug('CardForm', 'resetForm called', { hasCardData: !!cardData, cardId: cardData?.id });
    
    if (cardData) {
      try {
        // Safely handle date conversion
        const purchaseDate = cardData.purchaseDate instanceof Date 
          ? cardData.purchaseDate.toISOString().split('T')[0]
          : new Date(cardData.purchaseDate).toISOString().split('T')[0];
          
        const sellDate = cardData.sellDate 
          ? (cardData.sellDate instanceof Date 
              ? cardData.sellDate.toISOString().split('T')[0]
              : new Date(cardData.sellDate).toISOString().split('T')[0])
          : '';
        
        logDebug('CardForm', 'Date conversion successful', { purchaseDate, sellDate });

        const formData = {
          player: cardData.player || '',
          team: cardData.team || '',
          year: cardData.year || new Date().getFullYear(),
          brand: cardData.brand || '',
          category: cardData.category || '',
          cardNumber: cardData.cardNumber || '',
          parallel: cardData.parallel || '',
          condition: resolveCondition(cardData.condition, cardData.grade),
          gradingCompany: cardData.gradingCompany || '',
          purchasePrice: Math.round((cardData.purchasePrice || 0) * 100) / 100,
          purchaseDate: purchaseDate,
          sellPrice: cardData.sellPrice ? Math.round(cardData.sellPrice * 100) / 100 : undefined,
          sellDate: sellDate,
          currentValue: Math.round((cardData.currentValue || 0) * 100) / 100,
          notes: cardData.notes || '',
          collectionId: cardData.collectionId || '',
          collectionType: cardData.collectionType || 'Inventory'
        };
        
        reset(formData);
        setImages(cardData.images || []);
        logInfo('CardForm', 'Form reset with card data', formData);
      } catch (error) {
        logError('CardForm', 'Error processing card data', error as Error, cardData);
        // Fallback to default values if there's an error
        reset({
          player: '',
          team: '',
          year: new Date().getFullYear(),
          brand: '',
          category: '',
          cardNumber: '',
          parallel: '',
          condition: CONDITIONS[0],
          gradingCompany: '',
          purchasePrice: 0,
          purchaseDate: new Date().toISOString().split('T')[0],
          sellPrice: undefined,
          sellDate: '',
          currentValue: 0,
          notes: '',
          collectionId: '',
          collectionType: 'Inventory'
        });
        setImages([]);
      }
    } else {
      reset({
        player: '',
        team: '',
        year: new Date().getFullYear(),
        brand: '',
        category: '',
        cardNumber: '',
        parallel: '',
        condition: CONDITIONS[0],
        gradingCompany: '',
        purchasePrice: 0,
        purchaseDate: new Date().toISOString().split('T')[0],
        sellPrice: undefined,
        sellDate: '',
        currentValue: 0,
        notes: '',
        collectionId: '',
        collectionType: 'Inventory'
      });
      setImages([]);
    }
  }, [reset]);

  useEffect(() => {
    resetForm(card);
  }, [card, resetForm]);

  useEffect(() => {
    if (sellPrice && !sellDate) {
      setValue('sellDate', new Date().toISOString().split('T')[0]);
    } else if (!sellPrice && sellDate) {
      setValue('sellDate', '');
    }
  }, [sellPrice, sellDate, setValue]);

  const onSubmit = async (data: CardFormData) => {
    logInfo('CardForm', 'Form submitted', data);
    
    try {
      // Validate required fields
      if (!data.player || !data.team || !data.brand || !data.category || !data.cardNumber) {
        const missingFields = [];
        if (!data.player) missingFields.push('player');
        if (!data.team) missingFields.push('team');
        if (!data.brand) missingFields.push('brand');
        if (!data.category) missingFields.push('category');
        if (!data.cardNumber) missingFields.push('cardNumber');
        
        logWarn('CardForm', 'Required fields missing', { missingFields });
        throw new Error(`Required fields are missing: ${missingFields.join(', ')}`);
      }

      // Safely parse numbers and dates
      const year = Number(data.year);
      const purchasePrice = Number(data.purchasePrice);
      const currentValue = Number(data.currentValue);
      const sellPrice = data.sellPrice ? Number(data.sellPrice) : undefined;
      
      if (isNaN(year) || isNaN(purchasePrice) || isNaN(currentValue)) {
        logWarn('CardForm', 'Invalid numeric values', { year, purchasePrice, currentValue });
        throw new Error('Invalid numeric values provided');
      }

      const purchaseDate = new Date(data.purchaseDate);
      const sellDate = data.sellDate ? new Date(data.sellDate) : undefined;
      
      if (isNaN(purchaseDate.getTime())) {
        logWarn('CardForm', 'Invalid purchase date', { purchaseDate: data.purchaseDate });
        throw new Error('Invalid purchase date');
      }

      if (sellDate && isNaN(sellDate.getTime())) {
        logWarn('CardForm', 'Invalid sell date', { sellDate: data.sellDate });
        throw new Error('Invalid sell date');
      }
      
      const cardData: Card = {
        id: card?.id || `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: card?.userId || '', // Will be set by the database
        collectionId: data.collectionId || undefined, // Will use default if not specified
        collectionType: (data.collectionType as CollectionType) || 'Inventory',
        player: data.player.trim(),
        team: data.team.trim(),
        year: year,
        brand: data.brand.trim(),
        category: data.category.trim(),
        cardNumber: data.cardNumber.trim(),
        parallel: data.parallel?.trim() || undefined,
        condition: data.condition,
        gradingCompany: data.gradingCompany?.trim() || undefined,
        purchasePrice: purchasePrice,
        purchaseDate: purchaseDate,
        sellPrice: sellPrice,
        sellDate: sellDate,
        currentValue: currentValue,
        images: Array.isArray(images) ? images : [],
        notes: data.notes?.trim() || '',
        createdAt: card?.createdAt || new Date(),
        updatedAt: new Date()
      };

      logDebug('CardForm', 'Card data prepared', cardData);
      
      if (isEditing && card) {
        logInfo('CardForm', 'Updating existing card', { id: cardData.id });
        await updateCard(cardData);
      } else {
        logInfo('CardForm', 'Adding new card', { player: cardData.player });
        await addCard(cardData);
      }

      logInfo('CardForm', 'Card operation successful', { isEditing, id: cardData.id });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      logError('CardForm', 'Error saving card', error as Error, data);
      alert(`Error saving card: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefreshComps = async () => {
    if (!card?.id || compLoading) return;
    setCompLoading(true);
    try {
      const report = await apiService.refreshComps(card.id);
      setCompReport(report);
    } catch {
      // keep existing report
    } finally {
      setCompLoading(false);
    }
  };

  return (
    <div className="card-form-container">
      <div className="card-form">
        <div className="form-header">
          <h2>{isEditing ? 'Edit Card' : 'Add New Card'}</h2>
          <p>
            {isEditing 
              ? 'Update the details of your sports card below'
              : 'Enter the details of your sports card to add it to your collection'
            }
          </p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="player">Player Name *</label>
              <input
                id="player"
                type="text"
                {...register('player', { required: true })}
                placeholder="Enter player name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="team">Team *</label>
              <input
                id="team"
                type="text"
                {...register('team', { required: true })}
                placeholder="Enter team name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <input
                id="year"
                type="number"
                {...register('year', { required: true })}
                placeholder="Enter year"
              />
            </div>

            <div className="form-group">
              <label htmlFor="brand">Brand *</label>
              <input
                id="brand"
                type="text"
                {...register('brand', { required: true })}
                placeholder="Enter brand (e.g., Topps, Panini)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                {...register('category', { required: true })}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="cardNumber">Card Number *</label>
              <input
                id="cardNumber"
                type="text"
                {...register('cardNumber', { required: true })}
                placeholder="Enter card number"
              />
            </div>

            <div className="form-group">
              <label htmlFor="gradingCompany">Grading Company</label>
              <select
                id="gradingCompany"
                {...register('gradingCompany')}
              >
                <option value="">No grading</option>
                {GRADING_COMPANIES.map(company => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="condition">Condition *</label>
              <select
                id="condition"
                {...register('condition', { required: true })}
              >
                {CONDITIONS.map(condition => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="collectionId">Collection</label>
              <select
                id="collectionId"
                {...register('collectionId')}
              >
                <option value="">Default Collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.icon} {collection.name} {collection.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="collectionType">Type</label>
              <select
                id="collectionType"
                {...register('collectionType')}
              >
                {COLLECTION_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="parallel">Parallel/Insert</label>
              <input
                id="parallel"
                type="text"
                {...register('parallel')}
                placeholder="Enter parallel type (optional)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="purchasePrice">Purchase Price *</label>
              <input
                id="purchasePrice"
                type="number"
                step="0.01"
                {...register('purchasePrice', { required: true })}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="purchaseDate">Purchase Date *</label>
              <input
                id="purchaseDate"
                type="date"
                {...register('purchaseDate', { required: true })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="currentValue">Current Value *</label>
              <input
                id="currentValue"
                type="number"
                step="0.01"
                {...register('currentValue', { required: true })}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sellPrice">Sell Price</label>
              <input
                id="sellPrice"
                type="number"
                step="0.01"
                {...register('sellPrice')}
                placeholder="0.00 (optional)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sellDate">Sell Date</label>
              <input
                id="sellDate"
                type="date"
                {...register('sellDate')}
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Card Images</label>
            <ImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={5}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={4}
              placeholder="Enter any additional notes about this card..."
            />
          </div>

          {isEditing && (
            <div className="comp-section full-width">
              <div className="comp-section-header" onClick={() => setCompExpanded(!compExpanded)}>
                <h3>Comp Data {compExpanded ? '\u25B2' : '\u25BC'}</h3>
                <div className="comp-section-actions">
                  <button
                    type="button"
                    className="comp-refresh-btn"
                    onClick={(e) => { e.stopPropagation(); handleRefreshComps(); }}
                    disabled={compLoading}
                  >
                    {compLoading ? 'Loading...' : compReport ? 'Refresh Comps' : 'Generate Comps'}
                  </button>
                </div>
              </div>

              {compExpanded && (
                <div className="comp-section-body">
                  {compLoading && !compReport && (
                    <p className="comp-loading">Loading comp data...</p>
                  )}

                  {!compLoading && !compReport && (
                    <p className="comp-empty">No comp data available. Click "Generate Comps" to fetch pricing data.</p>
                  )}

                  {compReport && (
                    <>
                      <div className="comp-aggregate">
                        <div className="comp-aggregate-item">
                          <span className="comp-aggregate-label">Average</span>
                          <span className="comp-aggregate-value">{formatCompPrice(compReport.aggregateAverage)}</span>
                        </div>
                        <div className="comp-aggregate-item">
                          <span className="comp-aggregate-label">Low</span>
                          <span className="comp-aggregate-value">{formatCompPrice(compReport.aggregateLow)}</span>
                        </div>
                        <div className="comp-aggregate-item">
                          <span className="comp-aggregate-label">High</span>
                          <span className="comp-aggregate-value">{formatCompPrice(compReport.aggregateHigh)}</span>
                        </div>
                      </div>

                      {compReport.popData && (
                        <div className="comp-pop-section">
                          <div className="comp-pop-header">
                            <span className="comp-pop-title">Population Report</span>
                            <span className={`comp-pop-badge ${getCompRarityClass(compReport.popData.rarityTier)}`}>
                              {compReport.popData.rarityTier}
                            </span>
                          </div>
                          <div className="comp-pop-stats">
                            <span>{compReport.popData.gradingCompany} {compReport.popData.targetGrade} Pop: {compReport.popData.targetGradePop}</span>
                            <span>Total Graded: {compReport.popData.totalGraded}</span>
                            <span>Top {compReport.popData.percentile}%</span>
                          </div>
                          {compReport.popAdjustedAverage != null && compReport.popMultiplier != null && (
                            <div className="comp-pop-adjusted">
                              Pop-Adjusted: {formatCompPrice(compReport.popAdjustedAverage)}
                              <span className="comp-pop-multiplier">
                                ({compReport.popMultiplier >= 1 ? '+' : ''}{Math.round((compReport.popMultiplier - 1) * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="comp-sources">
                        {compReport.sources.map(source => (
                          <CompSourceRow key={source.source} result={source} />
                        ))}
                      </div>

                      <div className="comp-generated-at">
                        Generated {formatCompDateTime(compReport.generatedAt)}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-btn"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update Card' : 'Add Card')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CardForm;