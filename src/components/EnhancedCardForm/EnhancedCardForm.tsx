import React, { useState, useEffect } from 'react';
import { EnhancedCard, PRINTING_TECHNOLOGIES, CARD_ERAS, PURCHASE_VENUES, STORAGE_METHODS, COLLECTION_CATEGORIES } from '../../types/card-enhanced';
import { CATEGORIES, CONDITIONS, GRADING_COMPANIES, COLLECTION_TYPES } from '../../types';
import './EnhancedCardForm.css';

interface Props {
  card?: Partial<EnhancedCard>;
  onSave: (card: Partial<EnhancedCard>) => void;
  onCancel: () => void;
}

const EnhancedCardForm: React.FC<Props> = ({ card, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [collections, setCollections] = useState<any[]>([]);
  const [formData, setFormData] = useState<Partial<EnhancedCard>>({
    ...card,
    collectionType: card?.collectionType || 'Inventory',
    notes: card?.notes || '', // Ensure notes field is initialized
    identification: card?.identification || undefined,
    playerMetadata: card?.playerMetadata || { isRookie: false },
    specialFeatures: card?.specialFeatures || { hasAutograph: false, hasMemorabilia: false },
    marketData: card?.marketData || { purchaseVenue: 'Private Sale', priceHistory: [], lastSaleComps: [] },
    storage: card?.storage || { storageLocation: '', storageMethod: 'Toploader', collectionCategory: 'PC', displayStatus: 'Stored' },
    transaction: card?.transaction || { insuredValue: 0, acquisitionType: 'Purchase' },
    authentication: card?.authentication || undefined,
    physicalAttributes: card?.physicalAttributes || undefined,
    analytics: card?.analytics || undefined,
    collectionMeta: card?.collectionMeta || undefined
  });

  // Load collections
  useEffect(() => {
    const loadCollections = async () => {
      try {
        const { apiService } = await import('../../services/api');
        const userCollections = await apiService.getCollections();
        setCollections(userCollections);
      } catch (error) {
        console.error('Error loading collections:', error);
      }
    };
    loadCollections();
  }, []);

  const tabs = [
    { id: 'basic', label: '📋 Basic Info', icon: '📋' },
    { id: 'identification', label: '🏷️ Identification', icon: '🏷️' },
    { id: 'player', label: '⭐ Player Data', icon: '⭐' },
    { id: 'features', label: '✨ Special Features', icon: '✨' },
    { id: 'authentication', label: '🏆 Grading', icon: '🏆' },
    { id: 'market', label: '💹 Market Data', icon: '💹' },
    { id: 'physical', label: '📐 Physical', icon: '📐' },
    { id: 'storage', label: '📦 Storage', icon: '📦' },
    { id: 'transaction', label: '💼 Transaction', icon: '💼' },
    { id: 'collection', label: '🎯 Collection', icon: '🎯' }
  ];

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof EnhancedCard] as any || {}),
        [field]: value
      }
    }));
  };

  const handleBasicChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const renderBasicInfo = () => (
    <div className="form-section">
      <h3>Basic Information</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Player Name*</label>
          <input
            type="text"
            value={formData.player || ''}
            onChange={(e) => handleBasicChange('player', e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Team*</label>
          <input
            type="text"
            value={formData.team || ''}
            onChange={(e) => handleBasicChange('team', e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Year*</label>
          <input
            type="number"
            value={formData.year || ''}
            onChange={(e) => handleBasicChange('year', parseInt(e.target.value))}
            min="1850"
            max={new Date().getFullYear() + 1}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Brand*</label>
          <input
            type="text"
            value={formData.brand || ''}
            onChange={(e) => handleBasicChange('brand', e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Category*</label>
          <select
            value={formData.category || ''}
            onChange={(e) => handleBasicChange('category', e.target.value)}
            required
          >
            <option value="">Select Category</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Card Number*</label>
          <input
            type="text"
            value={formData.cardNumber || ''}
            onChange={(e) => handleBasicChange('cardNumber', e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Parallel/Variation</label>
          <input
            type="text"
            value={formData.parallel || ''}
            onChange={(e) => handleBasicChange('parallel', e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label>Condition*</label>
          <select
            value={formData.condition || ''}
            onChange={(e) => handleBasicChange('condition', e.target.value)}
            required
          >
            <option value="">Select Condition</option>
            {CONDITIONS.map(cond => (
              <option key={cond} value={cond}>{cond}</option>
            ))}
          </select>
        </div>
        
        {formData.condition !== 'RAW' && (
          <div className="form-group">
            <label>Grading Company</label>
            <select
              value={formData.gradingCompany || ''}
              onChange={(e) => handleBasicChange('gradingCompany', e.target.value)}
            >
              <option value="">Select Company</option>
              {GRADING_COMPANIES.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="form-group">
          <label>Type</label>
          <select
            value={formData.collectionType || 'Inventory'}
            onChange={(e) => handleBasicChange('collectionType', e.target.value)}
          >
            {COLLECTION_TYPES.map(ct => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group full-width">
          <label>Notes</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => handleBasicChange('notes', e.target.value)}
            rows={3}
            placeholder="Additional notes about this card"
          />
        </div>
      </div>
    </div>
  );

  const renderIdentification = () => (
    <div className="form-section">
      <h3>Card Identification</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Manufacturer</label>
          <input
            type="text"
            value={formData.identification?.manufacturer || ''}
            onChange={(e) => handleInputChange('identification', 'manufacturer', e.target.value)}
            placeholder="e.g., Panini America"
          />
        </div>
        
        <div className="form-group">
          <label>Product Line</label>
          <input
            type="text"
            value={formData.identification?.productLine || ''}
            onChange={(e) => handleInputChange('identification', 'productLine', e.target.value)}
            placeholder="e.g., Prizm Basketball"
          />
        </div>
        
        <div className="form-group">
          <label>Set Name</label>
          <input
            type="text"
            value={formData.identification?.setName || ''}
            onChange={(e) => handleInputChange('identification', 'setName', e.target.value)}
            placeholder="e.g., 2023-24 Prizm Basketball"
          />
        </div>
        
        <div className="form-group">
          <label>Subset</label>
          <input
            type="text"
            value={formData.identification?.subset || ''}
            onChange={(e) => handleInputChange('identification', 'subset', e.target.value)}
            placeholder="e.g., Rookie Penmanship"
          />
        </div>
        
        <div className="form-group">
          <label>Insert Set</label>
          <input
            type="text"
            value={formData.identification?.insert || ''}
            onChange={(e) => handleInputChange('identification', 'insert', e.target.value)}
            placeholder="e.g., Kaboom!"
          />
        </div>
        
        <div className="form-group">
          <label>Serial Number</label>
          <input
            type="text"
            value={formData.identification?.serialNumber || ''}
            onChange={(e) => handleInputChange('identification', 'serialNumber', e.target.value)}
            placeholder="e.g., 23/99"
          />
        </div>
        
        <div className="form-group">
          <label>Print Run</label>
          <input
            type="number"
            value={formData.identification?.printRun || ''}
            onChange={(e) => handleInputChange('identification', 'printRun', parseInt(e.target.value))}
            placeholder="Total printed"
          />
        </div>
        
        <div className="form-group">
          <label>Printing Technology</label>
          <select
            value={formData.identification?.printingTechnology || ''}
            onChange={(e) => handleInputChange('identification', 'printingTechnology', e.target.value)}
          >
            <option value="">Select Technology</option>
            {PRINTING_TECHNOLOGIES.map(tech => (
              <option key={tech} value={tech}>{tech}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Era</label>
          <select
            value={formData.identification?.era || ''}
            onChange={(e) => handleInputChange('identification', 'era', e.target.value)}
          >
            <option value="">Select Era</option>
            {CARD_ERAS.map(era => (
              <option key={era} value={era}>{era}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderPlayerData = () => (
    <div className="form-section">
      <h3>Player Information</h3>
      <div className="form-grid">
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.playerMetadata?.isRookie || false}
              onChange={(e) => handleInputChange('playerMetadata', 'isRookie', e.target.checked)}
            />
            Rookie Card
          </label>
        </div>
        
        {formData.playerMetadata?.isRookie && (
          <div className="form-group">
            <label>Rookie Year</label>
            <input
              type="number"
              value={formData.playerMetadata?.rookieYear || ''}
              onChange={(e) => handleInputChange('playerMetadata', 'rookieYear', parseInt(e.target.value))}
            />
          </div>
        )}
        
        <div className="form-group">
          <label>Jersey Number</label>
          <input
            type="text"
            value={formData.playerMetadata?.jerseyNumber || ''}
            onChange={(e) => handleInputChange('playerMetadata', 'jerseyNumber', e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label>Position</label>
          <input
            type="text"
            value={formData.playerMetadata?.position || ''}
            onChange={(e) => handleInputChange('playerMetadata', 'position', e.target.value)}
          />
        </div>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.playerMetadata?.isHallOfFame || false}
              onChange={(e) => handleInputChange('playerMetadata', 'isHallOfFame', e.target.checked)}
            />
            Hall of Fame
          </label>
        </div>
        
        <div className="form-group">
          <label>Championships</label>
          <input
            type="number"
            value={formData.playerMetadata?.championships || ''}
            onChange={(e) => handleInputChange('playerMetadata', 'championships', parseInt(e.target.value))}
            min="0"
          />
        </div>
        
        <div className="form-group">
          <label>All-Star Appearances</label>
          <input
            type="number"
            value={formData.playerMetadata?.allStarAppearances || ''}
            onChange={(e) => handleInputChange('playerMetadata', 'allStarAppearances', parseInt(e.target.value))}
            min="0"
          />
        </div>
        
        <div className="form-group">
          <label>Special Event</label>
          <input
            type="text"
            value={formData.playerMetadata?.specialEvent || ''}
            onChange={(e) => handleInputChange('playerMetadata', 'specialEvent', e.target.value)}
            placeholder="e.g., World Series, All-Star Game"
          />
        </div>
      </div>
    </div>
  );

  const renderSpecialFeatures = () => (
    <div className="form-section">
      <h3>Special Features</h3>
      
      <div className="feature-section">
        <h4>Autograph</h4>
        <div className="form-grid">
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.specialFeatures?.hasAutograph || false}
                onChange={(e) => handleInputChange('specialFeatures', 'hasAutograph', e.target.checked)}
              />
              Has Autograph
            </label>
          </div>
          
          {formData.specialFeatures?.hasAutograph && (
            <>
              <div className="form-group">
                <label>Autograph Type</label>
                <select
                  value={formData.specialFeatures?.autographType || ''}
                  onChange={(e) => handleInputChange('specialFeatures', 'autographType', e.target.value)}
                >
                  <option value="">Select Type</option>
                  <option value="On-Card">On-Card</option>
                  <option value="Sticker">Sticker</option>
                  <option value="Cut">Cut Signature</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Autograph Color</label>
                <input
                  type="text"
                  value={formData.specialFeatures?.autographColor || ''}
                  onChange={(e) => handleInputChange('specialFeatures', 'autographColor', e.target.value)}
                  placeholder="e.g., Blue, Black"
                />
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="feature-section">
        <h4>Memorabilia</h4>
        <div className="form-grid">
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.specialFeatures?.hasMemorabilia || false}
                onChange={(e) => handleInputChange('specialFeatures', 'hasMemorabilia', e.target.checked)}
              />
              Has Memorabilia
            </label>
          </div>
          
          {formData.specialFeatures?.hasMemorabilia && (
            <>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.specialFeatures?.isPatch || false}
                    onChange={(e) => handleInputChange('specialFeatures', 'isPatch', e.target.checked)}
                  />
                  Is Patch
                </label>
              </div>
              
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.specialFeatures?.isGameUsed || false}
                    onChange={(e) => handleInputChange('specialFeatures', 'isGameUsed', e.target.checked)}
                  />
                  Game Used
                </label>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={formData.specialFeatures?.is1of1 || false}
            onChange={(e) => handleInputChange('specialFeatures', 'is1of1', e.target.checked)}
          />
          1 of 1 Card
        </label>
      </div>
    </div>
  );

  const renderMarketData = () => (
    <div className="form-section">
      <h3>Market & Pricing</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Purchase Price*</label>
          <input
            type="number"
            value={formData.purchasePrice || ''}
            onChange={(e) => handleBasicChange('purchasePrice', parseFloat(e.target.value))}
            min="0"
            step="0.01"
            required
          />
        </div>
        
        <div className="form-group">
          <label>Current Value*</label>
          <input
            type="number"
            value={formData.currentValue || ''}
            onChange={(e) => handleBasicChange('currentValue', parseFloat(e.target.value))}
            min="0"
            step="0.01"
            required
          />
        </div>
        
        <div className="form-group">
          <label>Purchase Venue</label>
          <select
            value={formData.marketData?.purchaseVenue || ''}
            onChange={(e) => handleInputChange('marketData', 'purchaseVenue', e.target.value)}
          >
            <option value="">Select Venue</option>
            {PURCHASE_VENUES.map(venue => (
              <option key={venue} value={venue}>{venue}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Seller</label>
          <input
            type="text"
            value={formData.marketData?.seller || ''}
            onChange={(e) => handleInputChange('marketData', 'seller', e.target.value)}
            placeholder="Seller name or username"
          />
        </div>
        
        <div className="form-group">
          <label>Market Trend</label>
          <select
            value={formData.marketData?.trendDirection || ''}
            onChange={(e) => handleInputChange('marketData', 'trendDirection', e.target.value)}
          >
            <option value="">Select Trend</option>
            <option value="Rising">Rising</option>
            <option value="Stable">Stable</option>
            <option value="Falling">Falling</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Demand Level</label>
          <select
            value={formData.marketData?.demandLevel || ''}
            onChange={(e) => handleInputChange('marketData', 'demandLevel', e.target.value)}
          >
            <option value="">Select Demand</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStorage = () => (
    <div className="form-section">
      <h3>Storage & Organization</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Storage Location*</label>
          <input
            type="text"
            value={formData.storage?.storageLocation || ''}
            onChange={(e) => handleInputChange('storage', 'storageLocation', e.target.value)}
            placeholder="e.g., Safe, Display Case A"
            required
          />
        </div>
        
        <div className="form-group">
          <label>Storage Method</label>
          <select
            value={formData.storage?.storageMethod || ''}
            onChange={(e) => handleInputChange('storage', 'storageMethod', e.target.value)}
          >
            <option value="">Select Method</option>
            {STORAGE_METHODS.map(method => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Collection Category</label>
          <select
            value={formData.storage?.collectionCategory || ''}
            onChange={(e) => handleInputChange('storage', 'collectionCategory', e.target.value)}
          >
            <option value="">Select Category</option>
            {COLLECTION_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Box/Binder Number</label>
          <input
            type="text"
            value={formData.storage?.boxNumber || ''}
            onChange={(e) => handleInputChange('storage', 'boxNumber', e.target.value)}
            placeholder="e.g., Box 1, Binder A"
          />
        </div>
      </div>
    </div>
  );

  const renderAuthentication = () => (
    <div className="form-section">
      <h3>Grading & Authentication</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Certification Number</label>
          <input
            type="text"
            value={formData.authentication?.certificationNumber || ''}
            onChange={(e) => handleInputChange('authentication', 'certificationNumber', e.target.value)}
            placeholder="e.g., 12345678"
          />
        </div>
        
        <div className="form-group">
          <label>Grading Date</label>
          <input
            type="date"
            value={formData.authentication?.gradingDate ? new Date(formData.authentication.gradingDate).toISOString().split('T')[0] : ''}
            onChange={(e) => handleInputChange('authentication', 'gradingDate', new Date(e.target.value))}
          />
        </div>
        
        <div className="form-group">
          <label>Grading Cost</label>
          <input
            type="number"
            value={formData.authentication?.gradingCost || ''}
            onChange={(e) => handleInputChange('authentication', 'gradingCost', parseFloat(e.target.value))}
            min="0"
            step="0.01"
          />
        </div>
      </div>
      
      {(formData.gradingCompany === 'BGS' || formData.gradingCompany === 'SGC') && (
        <>
          <h4>Subgrades</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Centering</label>
              <input
                type="number"
                value={formData.authentication?.subgrades?.centering || ''}
                onChange={(e) => handleInputChange('authentication', 'subgrades', {
                  ...formData.authentication?.subgrades,
                  centering: parseFloat(e.target.value)
                })}
                min="0"
                max="10"
                step="0.5"
              />
            </div>
            
            <div className="form-group">
              <label>Corners</label>
              <input
                type="number"
                value={formData.authentication?.subgrades?.corners || ''}
                onChange={(e) => handleInputChange('authentication', 'subgrades', {
                  ...formData.authentication?.subgrades,
                  corners: parseFloat(e.target.value)
                })}
                min="0"
                max="10"
                step="0.5"
              />
            </div>
            
            <div className="form-group">
              <label>Edges</label>
              <input
                type="number"
                value={formData.authentication?.subgrades?.edges || ''}
                onChange={(e) => handleInputChange('authentication', 'subgrades', {
                  ...formData.authentication?.subgrades,
                  edges: parseFloat(e.target.value)
                })}
                min="0"
                max="10"
                step="0.5"
              />
            </div>
            
            <div className="form-group">
              <label>Surface</label>
              <input
                type="number"
                value={formData.authentication?.subgrades?.surface || ''}
                onChange={(e) => handleInputChange('authentication', 'subgrades', {
                  ...formData.authentication?.subgrades,
                  surface: parseFloat(e.target.value)
                })}
                min="0"
                max="10"
                step="0.5"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderPhysical = () => (
    <div className="form-section">
      <h3>Physical Attributes</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Card Size</label>
          <select
            value={formData.physicalAttributes?.cardSize || ''}
            onChange={(e) => handleInputChange('physicalAttributes', 'cardSize', e.target.value)}
          >
            <option value="">Select Size</option>
            <option value="Standard">Standard (2.5" x 3.5")</option>
            <option value="Tobacco">Tobacco Size</option>
            <option value="Oversized">Oversized</option>
            <option value="Mini">Mini</option>
            <option value="Booklet">Booklet</option>
          </select>
        </div>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.physicalAttributes?.isRefractor || false}
              onChange={(e) => handleInputChange('physicalAttributes', 'isRefractor', e.target.checked)}
            />
            Refractor/Prizm
          </label>
        </div>
        
        <div className="form-group">
          <label>Stock Weight</label>
          <select
            value={formData.physicalAttributes?.stockWeight || ''}
            onChange={(e) => handleInputChange('physicalAttributes', 'stockWeight', e.target.value)}
          >
            <option value="">Select Weight</option>
            <option value="Standard">Standard</option>
            <option value="Thick">Thick (55pt-130pt)</option>
            <option value="Super Thick">Super Thick (130pt+)</option>
          </select>
        </div>
      </div>
      
      <h4>Condition Notes</h4>
      <div className="form-grid">
        <div className="form-group">
          <label>Centering</label>
          <input
            type="text"
            value={formData.physicalAttributes?.conditionNotes?.centering || ''}
            onChange={(e) => handleInputChange('physicalAttributes', 'conditionNotes', {
              ...formData.physicalAttributes?.conditionNotes,
              centering: e.target.value
            })}
            placeholder="e.g., 60/40 L/R, 55/45 T/B"
          />
        </div>
      </div>
    </div>
  );

  const renderTransaction = () => (
    <div className="form-section">
      <h3>Transaction & Insurance</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Insured Value</label>
          <input
            type="number"
            value={formData.transaction?.insuredValue || ''}
            onChange={(e) => handleInputChange('transaction', 'insuredValue', parseFloat(e.target.value))}
            min="0"
            step="0.01"
          />
        </div>
        
        <div className="form-group">
          <label>Acquisition Type</label>
          <select
            value={formData.transaction?.acquisitionType || ''}
            onChange={(e) => handleInputChange('transaction', 'acquisitionType', e.target.value)}
          >
            <option value="">Select Type</option>
            <option value="Purchase">Purchase</option>
            <option value="Gift">Gift</option>
            <option value="Inheritance">Inheritance</option>
            <option value="Trade">Trade</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Tax Basis</label>
          <input
            type="number"
            value={formData.transaction?.taxBasis || ''}
            onChange={(e) => handleInputChange('transaction', 'taxBasis', parseFloat(e.target.value))}
            min="0"
            step="0.01"
          />
        </div>
        
        <div className="form-group">
          <label>Insurance Company</label>
          <input
            type="text"
            value={formData.transaction?.insuranceCompany || ''}
            onChange={(e) => handleInputChange('transaction', 'insuranceCompany', e.target.value)}
            placeholder="e.g., State Farm, USAA"
          />
        </div>
        
        <div className="form-group">
          <label>Policy Number</label>
          <input
            type="text"
            value={formData.transaction?.policyNumber || ''}
            onChange={(e) => handleInputChange('transaction', 'policyNumber', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderCollection = () => (
    <div className="form-section">
      <h3>Collection Metadata</h3>
      <div className="form-grid">
        <div className="form-group full-width">
          <label>Collection*</label>
          <select
            value={formData.collectionId || ''}
            onChange={(e) => handleBasicChange('collectionId', e.target.value)}
            required
          >
            <option value="">Select a Collection</option>
            {collections.map(collection => (
              <option key={collection.id} value={collection.id}>
                {collection.icon} {collection.name} {collection.isDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>
          <small className="form-hint">Assign this card to a specific collection</small>
        </div>
        
        <div className="form-group">
          <label>Personal Grade (1-10)</label>
          <input
            type="number"
            value={formData.collectionMeta?.personalGrade || ''}
            onChange={(e) => handleInputChange('collectionMeta', 'personalGrade', parseInt(e.target.value))}
            min="1"
            max="10"
          />
        </div>
        
        <div className="form-group">
          <label>Sentimental Value</label>
          <select
            value={formData.collectionMeta?.sentimentalValue || ''}
            onChange={(e) => handleInputChange('collectionMeta', 'sentimentalValue', e.target.value)}
          >
            <option value="">Select Value</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.collectionMeta?.willingToTrade || false}
              onChange={(e) => handleInputChange('collectionMeta', 'willingToTrade', e.target.checked)}
            />
            Willing to Trade
          </label>
        </div>
        
        {formData.collectionMeta?.willingToTrade && (
          <div className="form-group">
            <label>Trade Value</label>
            <input
              type="number"
              value={formData.collectionMeta?.tradeValue || ''}
              onChange={(e) => handleInputChange('collectionMeta', 'tradeValue', parseFloat(e.target.value))}
              min="0"
              step="0.01"
            />
          </div>
        )}
      </div>
      
      <div className="form-group full-width">
        <label>Personal Story</label>
        <textarea
          value={formData.collectionMeta?.personalStory || ''}
          onChange={(e) => handleInputChange('collectionMeta', 'personalStory', e.target.value)}
          rows={3}
          placeholder="Any special meaning or story about this card?"
        />
      </div>
      
      <div className="form-group full-width">
        <label>Acquisition Story</label>
        <textarea
          value={formData.collectionMeta?.acquisitionStory || ''}
          onChange={(e) => handleInputChange('collectionMeta', 'acquisitionStory', e.target.value)}
          rows={3}
          placeholder="How did you acquire this card?"
        />
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return renderBasicInfo();
      case 'identification':
        return renderIdentification();
      case 'player':
        return renderPlayerData();
      case 'features':
        return renderSpecialFeatures();
      case 'market':
        return renderMarketData();
      case 'storage':
        return renderStorage();
      case 'authentication':
        return renderAuthentication();
      case 'physical':
        return renderPhysical();
      case 'transaction':
        return renderTransaction();
      case 'collection':
        return renderCollection();
      default:
        return renderBasicInfo();
    }
  };

  return (
    <div className="enhanced-card-form">
      <div className="form-header">
        <h2>{card ? 'Edit Enhanced Card' : 'Add Enhanced Card'}</h2>
        <p>Fill in as much detail as you'd like. Only basic fields are required.</p>
      </div>
      
      <div className="form-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="enhanced-form">
        <div className="form-content">
          {renderTabContent()}
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {card ? 'Update Card' : 'Add Card'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EnhancedCardForm;