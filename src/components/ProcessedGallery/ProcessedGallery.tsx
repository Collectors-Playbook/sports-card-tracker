import React, { useState, useEffect, useCallback } from 'react';
import { apiService, ExtractedCardData, CompReport } from '../../services/api';
import { Card } from '../../types';
import ImageLightbox from '../HoldingPen/ImageLightbox';
import CardReviewForm from '../CardReviewForm/CardReviewForm';
import CompReportModal from './CompReportModal';
import './ProcessedGallery.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

interface ProcessedFile {
  name: string;
  size: number;
  modified: string;
  type: string;
}

interface CardInfo {
  year: string;
  brand: string;
  set: string;
  player: string;
  cardNumber: string;
}

interface CardPair {
  id: string;
  front: ProcessedFile | null;
  back: ProcessedFile | null;
  label: string;
  modified: string;
  info: CardInfo | null;
}

/**
 * Parse card info from a processed filename.
 * Expected format: {Year}-{Manufacturer}-{Set}-{PlayerName}-{CardNumber}
 * e.g. "2023-Topps-Chrome-Mike-Trout-1"
 */
function parseCardInfo(prefix: string): CardInfo | null {
  // Strip -front / -back suffix if still present
  let name = prefix;
  if (name.endsWith('-front')) name = name.slice(0, -6);
  if (name.endsWith('-back')) name = name.slice(0, -5);

  const parts = name.split('-');
  if (parts.length < 4) return null;

  // First part is year (4 digits)
  const year = parts[0];
  if (!/^\d{4}$/.test(year)) return null;

  // Last part is card number
  const cardNumber = parts[parts.length - 1];

  // Second part is manufacturer/brand
  const brand = parts[1];

  // Need to figure out where set ends and player name begins.
  // Heuristic: set is the part after brand up until the first part that looks
  // like a name (starts with uppercase letter and the following part also
  // starts with uppercase). For simplicity, if there are enough parts, treat
  // parts[2] as set, and the rest (minus last) as player name.
  if (parts.length < 5) {
    // Minimal: year-brand-player-number
    return {
      year,
      brand,
      set: '',
      player: parts.slice(2, parts.length - 1).join(' '),
      cardNumber,
    };
  }

  const set = parts[2];
  const player = parts.slice(3, parts.length - 1).join(' ');

  return { year, brand, set, player, cardNumber };
}

function groupIntoPairs(files: ProcessedFile[]): CardPair[] {
  const pairs: CardPair[] = [];
  const paired = new Set<string>();

  // Only consider image files
  const imageFiles = files.filter(f =>
    /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f.name)
  );

  for (const file of imageFiles) {
    if (paired.has(file.name)) continue;

    const ext = '.' + file.name.split('.').pop();
    const base = file.name.slice(0, file.name.length - ext.length);

    if (base.endsWith('-front')) {
      const prefix = base.slice(0, -6);
      const backName = prefix + '-back' + ext;
      const backFile = imageFiles.find(f => f.name === backName);

      paired.add(file.name);
      if (backFile) paired.add(backFile.name);

      pairs.push({
        id: prefix,
        front: file,
        back: backFile || null,
        label: prefix,
        modified: file.modified,
        info: parseCardInfo(prefix),
      });
    } else if (base.endsWith('-back')) {
      const prefix = base.slice(0, -5);
      const frontName = prefix + '-front' + ext;
      const frontFile = imageFiles.find(f => f.name === frontName);

      if (frontFile) continue; // Will be handled when we encounter the -front file

      paired.add(file.name);
      pairs.push({
        id: prefix,
        front: null,
        back: file,
        label: prefix,
        modified: file.modified,
        info: parseCardInfo(prefix),
      });
    } else {
      // Standalone file
      paired.add(file.name);
      pairs.push({
        id: base,
        front: file,
        back: null,
        label: base,
        modified: file.modified,
        info: parseCardInfo(base),
      });
    }
  }

  pairs.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  return pairs;
}

function processedFileUrl(filename: string): string {
  return `${API_BASE_URL}/files/processed/${encodeURIComponent(filename)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const ProcessedGallery: React.FC = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [pairs, setPairs] = useState<CardPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<CardPair | null>(null);
  const [editTarget, setEditTarget] = useState<{
    pair: CardPair;
    card: Card;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [compLoadingId, setCompLoadingId] = useState<string | null>(null);
  const [compReport, setCompReport] = useState<CompReport | null>(null);
  const [bulkCompLoading, setBulkCompLoading] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      setError(null);
      const processedFiles = await apiService.getProcessedFiles();
      setFiles(processedFiles);
      setPairs(groupIntoPairs(processedFiles));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (pair: CardPair) => {
    const filenames = [pair.front?.name, pair.back?.name].filter(Boolean) as string[];
    const confirmMsg = filenames.length > 1
      ? `Delete both ${filenames.join(' and ')}?`
      : `Delete ${filenames[0]}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await Promise.all(filenames.map(f => apiService.deleteProcessedFile(f)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(pair.id);
        return next;
      });
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    const selectedPairs = pairs.filter(p => selectedIds.has(p.id));
    const allFilenames = selectedPairs.flatMap(p =>
      [p.front?.name, p.back?.name].filter(Boolean) as string[]
    );
    if (allFilenames.length === 0) return;

    if (!window.confirm(`Delete ${allFilenames.length} file(s) from ${selectedPairs.length} card(s)?`)) return;

    try {
      await Promise.all(allFilenames.map(f => apiService.deleteProcessedFile(f)));
      setSelectedIds(new Set());
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  };

  const handleEdit = async (pair: CardPair) => {
    // Look up card record by image filename
    const filename = pair.front?.name || pair.back?.name;
    if (!filename) return;
    try {
      const card = await apiService.getCardByImage(filename);
      setEditTarget({ pair, card });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load card data');
    }
  };

  const handleEditSave = async (data: ExtractedCardData) => {
    if (!editTarget) return;
    const { card } = editTarget;
    setEditSaving(true);
    try {
      await apiService.updateCard({
        ...card,
        player: data.player || card.player,
        team: data.team || card.team,
        year: data.year ? parseInt(data.year) : card.year,
        brand: data.brand || card.brand,
        category: data.category || card.category,
        cardNumber: data.cardNumber || card.cardNumber,
        parallel: data.parallel,
        setName: data.setName,
        serialNumber: data.serialNumber,
        gradingCompany: data.gradingCompany,
        grade: data.grade,
        isRookie: data.features?.isRookie ?? false,
        isAutograph: data.features?.isAutograph ?? false,
        isRelic: data.features?.isRelic ?? false,
        isNumbered: data.features?.isNumbered ?? false,
        isGraded: data.features?.isGraded ?? false,
      });
      setEditTarget(null);
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  const handleGenerateComps = async (pair: CardPair) => {
    const filename = pair.front?.name || pair.back?.name;
    if (!filename) return;
    setCompLoadingId(pair.id);
    try {
      const card = await apiService.getCardByImage(filename);
      const report = await apiService.generateComps(card.id);
      setCompReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate comps');
    } finally {
      setCompLoadingId(null);
    }
  };

  const handleBulkComps = async () => {
    const selectedPairs = pairs.filter(p => selectedIds.has(p.id));
    if (selectedPairs.length === 0) return;
    setBulkCompLoading(true);
    try {
      const cardIds: string[] = [];
      for (const pair of selectedPairs) {
        const filename = pair.front?.name || pair.back?.name;
        if (!filename) continue;
        const card = await apiService.getCardByImage(filename);
        cardIds.push(card.id);
      }
      if (cardIds.length === 0) {
        setError('No card records found for selected files');
        return;
      }
      await apiService.generateBulkComps(cardIds);
      setError(null);
      alert(`Comp generation job created for ${cardIds.length} card(s). Check back shortly for results.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bulk comp generation');
    } finally {
      setBulkCompLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pairs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pairs.map(p => p.id)));
    }
  };

  if (loading) {
    return (
      <div className="processed-gallery-container">
        <div className="processed-gallery-loading">Loading processed files...</div>
      </div>
    );
  }

  return (
    <div className="processed-gallery-container">
      <div className="processed-gallery-header">
        <h2>Processed Cards</h2>
        <p className="processed-gallery-subtitle">
          {pairs.length} card{pairs.length !== 1 ? 's' : ''} ({files.filter(f => /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f.name)).length} image{files.filter(f => /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f.name)).length !== 1 ? 's' : ''}) identified and ready
        </p>
      </div>

      {error && (
        <div className="processed-gallery-error">
          {error}
          <button onClick={() => setError(null)} className="processed-gallery-error-dismiss">&times;</button>
        </div>
      )}

      {/* Bulk actions toolbar */}
      {pairs.length > 0 && (
        <div className="processed-gallery-toolbar">
          <label className="processed-gallery-select-all">
            <input
              type="checkbox"
              checked={selectedIds.size === pairs.length && pairs.length > 0}
              onChange={toggleSelectAll}
            />
            Select All
          </label>
          {selectedIds.size > 0 && (
            <div className="processed-gallery-bulk-actions">
              <span className="processed-gallery-selection-count">{selectedIds.size} selected</span>
              <button className="processed-gallery-bulk-btn delete" onClick={handleBulkDelete}>
                Delete Selected
              </button>
              <button
                className="processed-gallery-bulk-btn comps"
                disabled={bulkCompLoading}
                onClick={handleBulkComps}
              >
                {bulkCompLoading ? 'Generating...' : 'Generate Comps'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Card grid */}
      {pairs.length === 0 ? (
        <div className="processed-gallery-empty">
          No processed cards found. Process raw images from the Holding Pen to see them here.
        </div>
      ) : (
        <div className="processed-gallery-grid">
          {pairs.map(pair => (
            <div
              key={pair.id}
              className={`processed-gallery-card ${selectedIds.has(pair.id) ? 'selected' : ''}`}
            >
              <div className="processed-gallery-card-select">
                <input
                  type="checkbox"
                  checked={selectedIds.has(pair.id)}
                  onChange={() => toggleSelect(pair.id)}
                />
              </div>

              <div className="processed-gallery-card-images">
                {pair.front && (
                  <div className="processed-gallery-thumb-container">
                    <img
                      src={processedFileUrl(pair.front.name)}
                      alt={`${pair.label} front`}
                      className="processed-gallery-thumb"
                      loading="lazy"
                      onClick={() => setLightbox(pair)}
                    />
                    <span className="processed-gallery-thumb-label">Front</span>
                  </div>
                )}
                {pair.back && (
                  <div className="processed-gallery-thumb-container">
                    <img
                      src={processedFileUrl(pair.back.name)}
                      alt={`${pair.label} back`}
                      className="processed-gallery-thumb"
                      loading="lazy"
                      onClick={() => setLightbox(pair)}
                    />
                    <span className="processed-gallery-thumb-label">Back</span>
                  </div>
                )}
              </div>

              <div className="processed-gallery-card-info">
                {pair.info ? (
                  <>
                    <div className="processed-gallery-card-player" title={pair.info.player}>
                      {pair.info.player}
                    </div>
                    <div className="processed-gallery-card-details">
                      <span className="processed-gallery-card-year">{pair.info.year}</span>
                      <span className="processed-gallery-card-brand">{pair.info.brand}{pair.info.set ? ` ${pair.info.set}` : ''}</span>
                      <span className="processed-gallery-card-number">#{pair.info.cardNumber}</span>
                    </div>
                  </>
                ) : (
                  <div className="processed-gallery-card-label" title={pair.label}>{pair.label}</div>
                )}
                <div className="processed-gallery-card-meta">
                  {[pair.front, pair.back].filter(Boolean).map(f => (
                    <span key={f!.name} className="processed-gallery-file-size">{formatFileSize(f!.size)}</span>
                  ))}
                </div>
              </div>

              <div className="processed-gallery-card-actions">
                <button
                  className="processed-gallery-action-btn view"
                  title="View"
                  onClick={() => setLightbox(pair)}
                >
                  View
                </button>
                <button
                  className="processed-gallery-action-btn edit"
                  title="Edit"
                  onClick={() => handleEdit(pair)}
                >
                  Edit
                </button>
                <button
                  className="processed-gallery-action-btn comps"
                  title="Generate Comps"
                  disabled={compLoadingId === pair.id}
                  onClick={() => handleGenerateComps(pair)}
                >
                  {compLoadingId === pair.id ? 'Loading...' : 'Comps'}
                </button>
                <button
                  className="processed-gallery-action-btn delete"
                  title="Delete"
                  onClick={() => handleDelete(pair)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          frontUrl={lightbox.front ? processedFileUrl(lightbox.front.name) : null}
          backUrl={lightbox.back ? processedFileUrl(lightbox.back.name) : null}
          label={lightbox.info ? `${lightbox.info.player} - ${lightbox.info.year} ${lightbox.info.brand}${lightbox.info.set ? ' ' + lightbox.info.set : ''} #${lightbox.info.cardNumber}` : lightbox.label}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Edit form */}
      {editTarget && (
        <CardReviewForm
          initialData={{
            player: editTarget.card.player,
            year: String(editTarget.card.year),
            brand: editTarget.card.brand,
            setName: editTarget.card.setName,
            cardNumber: editTarget.card.cardNumber,
            team: editTarget.card.team,
            category: editTarget.card.category,
            parallel: editTarget.card.parallel,
            serialNumber: editTarget.card.serialNumber,
            gradingCompany: editTarget.card.gradingCompany,
            grade: editTarget.card.grade,
            features: {
              isRookie: editTarget.card.isRookie ?? false,
              isAutograph: editTarget.card.isAutograph ?? false,
              isRelic: editTarget.card.isRelic ?? false,
              isNumbered: editTarget.card.isNumbered ?? false,
              isGraded: editTarget.card.isGraded ?? false,
              isParallel: !!editTarget.card.parallel,
            },
          }}
          imageUrls={{
            front: editTarget.pair.front ? processedFileUrl(editTarget.pair.front.name) : undefined,
            back: editTarget.pair.back ? processedFileUrl(editTarget.pair.back.name) : undefined,
          }}
          mode="edit"
          cardId={editTarget.card.id}
          saving={editSaving}
          onSave={handleEditSave}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Comp Report Modal */}
      {compReport && (
        <CompReportModal
          report={compReport}
          onClose={() => setCompReport(null)}
          onRefresh={async (cardId) => {
            const updated = await apiService.refreshComps(cardId);
            setCompReport(updated);
            return updated;
          }}
        />
      )}
    </div>
  );
};

export default ProcessedGallery;
