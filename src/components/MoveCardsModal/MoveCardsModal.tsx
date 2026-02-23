import React, { useState, useEffect } from 'react';
import { Card } from '../../types';
import { Collection } from '../../types/collection';
import { apiService } from '../../services/api';
import './MoveCardsModal.css';

interface MoveCardsModalProps {
  cards: Card[];
  onClose: () => void;
  onMove: (cardIds: string[], targetCollectionId: string) => Promise<void>;
}

const MoveCardsModal: React.FC<MoveCardsModalProps> = ({ cards, onClose, onMove }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const userCollections = await apiService.getCollections();
      setCollections(userCollections);
    } catch (err) {
      setError('Failed to load collections');
      console.error('Error loading collections:', err);
    }
  };

  const handleMove = async () => {
    if (!selectedCollectionId) {
      setError('Please select a collection');
      return;
    }

    setIsMoving(true);
    setError(null);

    try {
      const cardIds = cards.map(card => card.id);
      await onMove(cardIds, selectedCollectionId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move cards');
    } finally {
      setIsMoving(false);
    }
  };

  const currentCollectionId = cards.length > 0 ? cards[0].collectionId : null;
  const currentCollection = collections.find(c => c.id === currentCollectionId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Move Cards to Collection</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="move-info">
            Moving {cards.length} card{cards.length !== 1 ? 's' : ''} 
            {currentCollection && ` from "${currentCollection.name}"`}
          </p>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="targetCollection">Select Target Collection:</label>
            <select
              id="targetCollection"
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              disabled={isMoving}
            >
              <option value="">-- Select a Collection --</option>
              {collections
                .filter(c => c.id !== currentCollectionId)
                .map(collection => (
                  <option key={collection.id} value={collection.id}>
                    {collection.icon} {collection.name} {collection.isDefault ? '(Default)' : ''}
                  </option>
                ))}
            </select>
          </div>

          <div className="selected-cards">
            <h4>Selected Cards:</h4>
            <div className="cards-list">
              {cards.slice(0, 5).map(card => (
                <div key={card.id} className="card-item">
                  <span>{card.year} {card.brand} - {card.player}</span>
                  <span className="card-value">${card.currentValue.toFixed(2)}</span>
                </div>
              ))}
              {cards.length > 5 && (
                <div className="more-cards">...and {cards.length - 5} more</div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-btn" 
            onClick={onClose}
            disabled={isMoving}
          >
            Cancel
          </button>
          <button 
            className="move-btn" 
            onClick={handleMove}
            disabled={isMoving || !selectedCollectionId}
          >
            {isMoving ? 'Moving...' : `Move ${cards.length} Card${cards.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveCardsModal;