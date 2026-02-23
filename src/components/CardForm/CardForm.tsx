import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useCards } from '../../context/DexieCardContext';
import { Card, CardFormData, CONDITIONS, CATEGORIES, GRADING_COMPANIES, COLLECTION_TYPES } from '../../types';
import ImageUpload from '../ImageUpload/ImageUpload';
import { logDebug, logInfo, logWarn, logError } from '../../utils/logger';
import './CardForm.css';

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
        const { collectionsDatabase } = await import('../../db/collectionsDatabase');
        const userCollections = await collectionsDatabase.getUserCollections();
        setCollections(userCollections);
      } catch (error) {
        console.error('Error loading collections:', error);
      }
    };
    loadCollections();
  }, []);

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
          condition: cardData.condition || CONDITIONS[0],
          gradingCompany: cardData.gradingCompany || '',
          purchasePrice: cardData.purchasePrice || 0,
          purchaseDate: purchaseDate,
          sellPrice: cardData.sellPrice || undefined,
          sellDate: sellDate,
          currentValue: cardData.currentValue || 0,
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