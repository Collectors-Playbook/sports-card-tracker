import React, { useState, useCallback } from 'react';
import { useCards } from '../../context/DexieCardContext';
import { Card } from '../../types/index';
import { cardDetectionService } from '../../services/cardDetectionService';
import { ExtractedCardData } from '../../types/detection';
import './PhotoCardForm.css';

interface PhotoCardFormProps {
  onSuccess?: () => void;
}

const PhotoCardForm: React.FC<PhotoCardFormProps> = ({ onSuccess }) => {
  const { addCard } = useCards();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCardData | null>(null);
  const [editedData, setEditedData] = useState<Partial<Card>>({});
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);
  const [useRealOCR, setUseRealOCR] = useState(localStorage.getItem('useRealOCR') === 'true');

  // Handle file processing
  const processFile = useCallback((file: File, side: 'front' | 'back') => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      setError('Image size must be less than 100MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      if (side === 'front') {
        setFrontImage(imageUrl);
      } else {
        setBackImage(imageUrl);
      }
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle image upload from input
  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file, side);
  }, [processFile]);

  // Handle drag and drop
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>, side: 'front' | 'back') => {
    event.preventDefault();
    event.stopPropagation();
    if (side === 'front') {
      setIsDraggingFront(true);
    } else {
      setIsDraggingBack(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>, side: 'front' | 'back') => {
    event.preventDefault();
    event.stopPropagation();
    if (side === 'front') {
      setIsDraggingFront(false);
    } else {
      setIsDraggingBack(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>, side: 'front' | 'back') => {
    event.preventDefault();
    event.stopPropagation();
    
    if (side === 'front') {
      setIsDraggingFront(false);
    } else {
      setIsDraggingBack(false);
    }

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0], side);
    }
  }, [processFile]);

  // Process images and extract card data
  const processImages = async () => {
    if (!frontImage) {
      setError('Please upload at least the front image');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const extracted = await cardDetectionService.detectCard(frontImage, backImage);
      setExtractedData(extracted);
      
      // Convert extracted data to card format
      const cardData: Partial<Card> = {
        player: extracted.player || '',
        year: extracted.year ? parseInt(extracted.year, 10) : new Date().getFullYear(),
        brand: extracted.brand || '',
        cardNumber: extracted.cardNumber || '',
        team: extracted.team || '',
        category: extracted.category || 'Other',
        condition: extracted.condition || 'Near Mint',
        notes: extracted.confidence ? `Detected with ${extracted.confidence.score}% confidence` : '',
        images: frontImage ? [frontImage] : [],
        parallel: extracted.parallel,
        gradingCompany: extracted.gradingCompany
      };

      // Add special features to notes
      if (extracted.features) {
        const features: string[] = [];
        if (extracted.features.isRookie) features.push('Rookie Card');
        if (extracted.features.isAutograph) features.push('Autographed');
        if (extracted.features.isRelic) features.push('Relic/Patch');
        if (extracted.features.isNumbered) features.push(`Numbered ${extracted.serialNumber || ''}`);
        if (extracted.features.isGraded) features.push(`${extracted.gradingCompany} ${extracted.grade}`);
        
        if (features.length > 0) {
          cardData.notes = `${cardData.notes}\nSpecial Features: ${features.join(', ')}`;
        }
      }

      setEditedData(cardData);
      setShowReview(true);
    } catch (err) {
      setError('Failed to process images. Please try again.');
      console.error('Image processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle form field changes
  const handleFieldChange = (field: keyof Card, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Submit the card
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editedData.player || !editedData.year || !editedData.brand) {
      setError('Please fill in all required fields');
      return;
    }

    const newCard: Card = {
      id: Date.now().toString(),
      userId: '', // Will be set by the database
      player: editedData.player as string,
      year: editedData.year as number,
      brand: editedData.brand as string,
      cardNumber: editedData.cardNumber || '',
      parallel: editedData.parallel,
      team: editedData.team || '',
      category: editedData.category || 'Other',
      condition: editedData.condition || 'Near Mint',
      purchasePrice: editedData.purchasePrice || 0,
      currentValue: editedData.currentValue || 0,
      purchaseDate: editedData.purchaseDate ? new Date(editedData.purchaseDate) : new Date(),
      notes: editedData.notes || '',
      images: frontImage ? (backImage ? [frontImage, backImage] : [frontImage]) : [],
      gradingCompany: editedData.gradingCompany,
      collectionType: 'Inventory',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    addCard(newCard).then(() => {
      if (onSuccess) {
        onSuccess();
      }
    }).catch((error) => {
      setError('Failed to save card. Please try again.');
      console.error('Error saving card:', error);
    });
  };

  // Reset form
  const resetForm = () => {
    setFrontImage(null);
    setBackImage(null);
    setExtractedData(null);
    setEditedData({});
    setShowReview(false);
    setError(null);
  };

  return (
    <div className="photo-card-form">
      <div className="form-header">
        <h2>📸 Add Card from Photos</h2>
        <p>Upload photos of your card and we'll extract the information automatically</p>
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={useRealOCR}
              onChange={(e) => {
                const checked = e.target.checked;
                setUseRealOCR(checked);
                localStorage.setItem('useRealOCR', checked.toString());
              }}
              style={{ cursor: 'pointer' }}
            />
            <span>Use Real OCR (Tesseract.js)</span>
          </label>
        </div>
        <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
          {useRealOCR 
            ? 'Using Tesseract.js for real text extraction (may take longer)'
            : 'Using simulated OCR for demo purposes'
          }
        </p>
      </div>

      {!showReview ? (
        <div className="upload-section">
          {/* Front Image Upload */}
          <div className="image-upload-container">
            <h3>Card Front (Required)</h3>
            <div 
              className={`image-upload-box ${frontImage ? 'has-image' : ''} ${isDraggingFront ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, 'front')}
              onDragLeave={(e) => handleDragLeave(e, 'front')}
              onDrop={(e) => handleDrop(e, 'front')}
            >
              {frontImage ? (
                <div className="image-preview">
                  <img src={frontImage} alt="Card front" />
                  <button 
                    className="remove-image"
                    onClick={() => setFrontImage(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="upload-label">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'front')}
                    className="file-input"
                  />
                  <div className="upload-prompt">
                    <span className="upload-icon">📷</span>
                    <span className="upload-text">Click or drag to upload front image</span>
                    <span className="upload-hint">JPEG, PNG, GIF up to 100MB</span>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Back Image Upload */}
          <div className="image-upload-container">
            <h3>Card Back (Optional)</h3>
            <div 
              className={`image-upload-box ${backImage ? 'has-image' : ''} ${isDraggingBack ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, 'back')}
              onDragLeave={(e) => handleDragLeave(e, 'back')}
              onDrop={(e) => handleDrop(e, 'back')}
            >
              {backImage ? (
                <div className="image-preview">
                  <img src={backImage} alt="Card back" />
                  <button 
                    className="remove-image"
                    onClick={() => setBackImage(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="upload-label">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'back')}
                    className="file-input"
                  />
                  <div className="upload-prompt">
                    <span className="upload-icon">📷</span>
                    <span className="upload-text">Click or drag to upload back image</span>
                    <span className="upload-hint">Helps identify card number and details</span>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Process Button */}
          <div className="action-buttons">
            <button 
              className="process-button"
              onClick={processImages}
              disabled={!frontImage || isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="spinner">⏳</span>
                  Processing Images...
                </>
              ) : (
                <>
                  <span className="button-icon">🔍</span>
                  Extract Card Information
                </>
              )}
            </button>
          </div>

          {/* Tips Section */}
          <div className="tips-section">
            <h4>📌 Tips for Best Results:</h4>
            <ul>
              <li>Use good lighting without glare</li>
              <li>Ensure the entire card is visible</li>
              <li>Keep the card flat and straight</li>
              <li>Higher resolution images work better</li>
              <li>Include the back for card number detection</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="review-section">
          <div className="extraction-header">
            <h3>✅ Information Extracted</h3>
            {extractedData?.confidence && (
              <span className={`confidence-badge ${extractedData.confidence.level}`}>
                {extractedData.confidence.score}% Confidence
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="review-form">
            {/* Image Previews */}
            <div className="image-thumbnails">
              {frontImage && (
                <div className="thumbnail">
                  <img src={frontImage} alt="Front" />
                  <span>Front</span>
                </div>
              )}
              {backImage && (
                <div className="thumbnail">
                  <img src={backImage} alt="Back" />
                  <span>Back</span>
                </div>
              )}
            </div>

            {/* Detection Details */}
            {extractedData?.confidence && (
              <div className="detection-details">
                <h4>📊 Detection Analysis:</h4>
                <div className="detection-stats">
                  <div className="stat-item">
                    <span className="stat-label">Fields Detected:</span>
                    <span className="stat-value">{extractedData.confidence.detectedFields}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Confidence Level:</span>
                    <span className={`stat-value ${extractedData.confidence.level}`}>
                      {extractedData.confidence.level.toUpperCase()}
                    </span>
                  </div>
                  {extractedData.setName && (
                    <div className="stat-item full-width">
                      <span className="stat-label">Set:</span>
                      <span className="stat-value">{extractedData.setName}</span>
                    </div>
                  )}
                </div>
                
                {/* Warnings */}
                {extractedData.confidence.warnings && (
                  <div className="detection-warnings">
                    {extractedData.confidence.warnings.map((warning, idx) => (
                      <div key={idx} className="warning-item">
                        <span className="warning-icon">⚠️</span>
                        <span className="warning-text">{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Missing Fields */}
                {extractedData.confidence.missingFields && (
                  <div className="missing-fields">
                    <span className="missing-label">Missing fields:</span>
                    <span className="missing-list">
                      {extractedData.confidence.missingFields.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Data Fields */}
            <div className="form-grid">
              <div className="form-group required">
                <label>Player Name</label>
                <input
                  type="text"
                  value={editedData.player || ''}
                  onChange={(e) => handleFieldChange('player', e.target.value)}
                  required
                />
              </div>

              <div className="form-group required">
                <label>Year</label>
                <input
                  type="number"
                  value={editedData.year || ''}
                  onChange={(e) => handleFieldChange('year', parseInt(e.target.value, 10))}
                  required
                />
              </div>

              <div className="form-group required">
                <label>Brand</label>
                <input
                  type="text"
                  value={editedData.brand || ''}
                  onChange={(e) => handleFieldChange('brand', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Card Number</label>
                <input
                  type="text"
                  value={editedData.cardNumber || ''}
                  onChange={(e) => handleFieldChange('cardNumber', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Team</label>
                <input
                  type="text"
                  value={editedData.team || ''}
                  onChange={(e) => handleFieldChange('team', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={editedData.category || 'Other'}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                >
                  <option value="Baseball">Baseball</option>
                  <option value="Basketball">Basketball</option>
                  <option value="Football">Football</option>
                  <option value="Pokemon">Pokemon</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Condition</label>
                <select
                  value={editedData.condition || 'Near Mint'}
                  onChange={(e) => handleFieldChange('condition', e.target.value)}
                >
                  <option value="Gem Mint">Gem Mint</option>
                  <option value="Mint">Mint</option>
                  <option value="Near Mint">Near Mint</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>

              <div className="form-group">
                <label>Purchase Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editedData.purchasePrice || ''}
                  onChange={(e) => handleFieldChange('purchasePrice', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Current Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={editedData.currentValue || ''}
                  onChange={(e) => handleFieldChange('currentValue', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Purchase Date</label>
                <input
                  type="date"
                  value={editedData.purchaseDate 
                    ? (typeof editedData.purchaseDate === 'string' 
                        ? editedData.purchaseDate 
                        : new Date(editedData.purchaseDate).toISOString().split('T')[0])
                    : ''}
                  onChange={(e) => handleFieldChange('purchaseDate', e.target.value)}
                />
              </div>
            </div>

            {/* Special Features Detected */}
            {extractedData?.features && (
              <div className="detected-features">
                <h4>🌟 Special Features Detected:</h4>
                <div className="feature-badges">
                  {extractedData.features.isRookie && <span className="feature-badge rookie">Rookie Card</span>}
                  {extractedData.features.isAutograph && <span className="feature-badge auto">Autograph</span>}
                  {extractedData.features.isRelic && <span className="feature-badge relic">Relic/Patch</span>}
                  {extractedData.features.isNumbered && <span className="feature-badge numbered">Numbered {extractedData.serialNumber}</span>}
                  {extractedData.features.isParallel && <span className="feature-badge parallel">{extractedData.parallel || 'Parallel'}</span>}
                  {extractedData.features.isGraded && <span className="feature-badge graded">{extractedData.gradingCompany} {extractedData.grade}</span>}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="form-group full-width">
              <label>Notes</label>
              <textarea
                value={editedData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={3}
              />
            </div>

            {/* Advanced Detection Info */}
            {extractedData?.rawText && (
              <div className="advanced-section">
                <button 
                  type="button" 
                  className="toggle-advanced"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? '🔽' : '▶️'} Advanced Detection Info
                </button>
                {showAdvanced && (
                  <div className="raw-text">
                    <h5>Raw Detected Text:</h5>
                    <pre>{extractedData.rawText}</pre>
                    
                    {extractedData.extractionErrors && (
                      <div className="extraction-errors">
                        <h5>Validation Errors:</h5>
                        <ul>
                          {extractedData.extractionErrors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={resetForm}>
                <span className="button-icon">🔄</span>
                Start Over
              </button>
              <button type="submit" className="primary-button">
                <span className="button-icon">✅</span>
                Add Card to Collection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PhotoCardForm;