import React, { useState, useEffect } from 'react';
import { Collection, CollectionStats } from '../../types/collection';
import { apiService } from '../../services/api';
import CollectionForm from './CollectionForm';
import CollectionCard from './CollectionCard';
import CollectionDiagnostic from '../CollectionDiagnostic/CollectionDiagnostic';
import './Collections.css';

const Collections: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionStats, setCollectionStats] = useState<{ [id: string]: CollectionStats }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const userCollections = await apiService.getCollections();
      setCollections(userCollections);

      // Load stats for each collection
      const stats: { [id: string]: CollectionStats } = {};
      for (const collection of userCollections) {
        const collStats = await apiService.getCollectionStats(collection.id);
        stats[collection.id] = {
          cardCount: collStats.cardCount,
          totalValue: collStats.totalValue,
          totalCost: collStats.totalCost,
          categoryBreakdown: collStats.categoryBreakdown
        };
      }
      setCollectionStats(stats);
    } catch (err) {
      setError('Failed to load collections');
      console.error('Error loading collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (data: Omit<Collection, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      await apiService.createCollection({
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        visibility: data.visibility,
        tags: data.tags,
      });
      setShowForm(false);
      loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    }
  };

  const handleUpdateCollection = async (id: string, data: Partial<Collection>) => {
    try {
      const { isDefault, ...updateData } = data;
      await apiService.updateCollection(id, {
        name: updateData.name,
        description: updateData.description,
        icon: updateData.icon,
        color: updateData.color,
        visibility: updateData.visibility,
        tags: updateData.tags,
      });
      setEditingCollection(null);
      loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update collection');
    }
  };

  const handleDeleteCollection = async (id: string) => {
    const collection = collections.find(c => c.id === id);
    const stats = collectionStats[id];
    
    if (stats && stats.cardCount > 0) {
      setError(`Cannot delete "${collection?.name || 'collection'}" because it contains ${stats.cardCount} card${stats.cardCount > 1 ? 's' : ''}. Move or delete the cards first.`);
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete the collection "${collection?.name || 'this collection'}"?`)) {
      return;
    }

    try {
      await apiService.deleteCollection(id);
      loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete collection');
    }
  };

  const handleSetAsDefault = async (id: string) => {
    try {
      await apiService.setCollectionAsDefault(id);
      loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set collection as default');
    }
  };

  const handleSelectCollection = (collectionId: string) => {
    if (bulkDeleteMode) {
      toggleDeleteSelection(collectionId);
    } else {
      setSelectedCollection(collectionId);
      // Navigate to inventory with collection filter
      window.location.hash = `#inventory?collection=${collectionId}`;
    }
  };

  const toggleDeleteSelection = (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    const stats = collectionStats[collectionId];
    
    // Don't allow selecting default collection or collections with cards
    if (collection?.isDefault || (stats && stats.cardCount > 0)) {
      return;
    }
    
    setSelectedForDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    const selectedCount = selectedForDelete.size;
    if (selectedCount === 0) {
      setError('No collections selected for deletion');
      return;
    }
    
    const selectedNames = Array.from(selectedForDelete)
      .map(id => collections.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    
    if (!window.confirm(`Are you sure you want to delete ${selectedCount} collection${selectedCount > 1 ? 's' : ''}?\n\n${selectedNames}`)) {
      return;
    }
    
    let successCount = 0;
    const errors: string[] = [];
    
    for (const collectionId of selectedForDelete) {
      try {
        await apiService.deleteCollection(collectionId);
        successCount++;
      } catch (err) {
        const collection = collections.find(c => c.id === collectionId);
        errors.push(`${collection?.name || 'Unknown'}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }
    
    if (successCount > 0) {
      await loadCollections();
      setSelectedForDelete(new Set());
    }
    
    if (errors.length > 0) {
      setError(`Failed to delete some collections:\n${errors.join('\n')}`);
    } else {
      setBulkDeleteMode(false);
    }
  };

  const toggleBulkDeleteMode = () => {
    setBulkDeleteMode(!bulkDeleteMode);
    setSelectedForDelete(new Set());
  };

  const selectAllEmpty = () => {
    const emptyCollections = collections.filter(c => 
      !c.isDefault && collectionStats[c.id]?.cardCount === 0
    );
    setSelectedForDelete(new Set(emptyCollections.map(c => c.id)));
  };

  if (loading) {
    return (
      <div className="collections-container">
        <div className="loading">
          <h2>Loading collections...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="collections-container">
      <div className="collections-header">
        <h1>📚 My Collections</h1>
        <div className="header-actions">
          {!bulkDeleteMode ? (
            <>
              <button 
                className="add-collection-btn"
                onClick={() => setShowForm(true)}
              >
                ➕ New Collection
              </button>
              {collections.some(c => !c.isDefault && collectionStats[c.id]?.cardCount === 0) && (
                <button 
                  className="bulk-delete-btn"
                  onClick={toggleBulkDeleteMode}
                >
                  🗑️ Bulk Delete
                </button>
              )}
            </>
          ) : (
            <div className="bulk-delete-controls">
              <span className="selected-count">
                {selectedForDelete.size} selected
              </span>
              <button 
                className="select-all-btn"
                onClick={selectAllEmpty}
              >
                Select All Empty
              </button>
              <button 
                className="delete-selected-btn"
                onClick={handleBulkDelete}
                disabled={selectedForDelete.size === 0}
              >
                Delete Selected
              </button>
              <button 
                className="cancel-btn"
                onClick={toggleBulkDeleteMode}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="dismiss-btn">✕</button>
        </div>
      )}

      {/* Temporary diagnostic button */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setShowDiagnostic(!showDiagnostic)}
          style={{
            padding: '8px 16px',
            background: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {showDiagnostic ? 'Hide' : 'Show'} Collection Diagnostic
        </button>
      </div>

      {showDiagnostic && <CollectionDiagnostic />}

      {showForm && (
        <CollectionForm
          onSubmit={handleCreateCollection}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingCollection && (
        <CollectionForm
          collection={editingCollection}
          onSubmit={(data) => handleUpdateCollection(editingCollection.id, data)}
          onCancel={() => setEditingCollection(null)}
        />
      )}

      <div className="collections-grid">
        {collections.map(collection => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            stats={collectionStats[collection.id] || {
              cardCount: 0,
              totalValue: 0,
              totalCost: 0,
              categoryBreakdown: {}
            }}
            onSelect={() => handleSelectCollection(collection.id)}
            onEdit={() => setEditingCollection(collection)}
            onDelete={() => handleDeleteCollection(collection.id)}
            onSetAsDefault={() => handleSetAsDefault(collection.id)}
            isSelected={selectedForDelete.has(collection.id)}
            isBulkDeleteMode={bulkDeleteMode}
          />
        ))}
      </div>

      {collections.length === 0 && (
        <div className="empty-state">
          <h3>No Collections Yet</h3>
          <p>Create your first collection to organize your cards!</p>
          <button 
            className="create-first-btn"
            onClick={() => setShowForm(true)}
          >
            Create Your First Collection
          </button>
        </div>
      )}
    </div>
  );
};

export default Collections;