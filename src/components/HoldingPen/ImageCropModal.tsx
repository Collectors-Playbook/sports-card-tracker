import React, { useRef, useState, useEffect, useCallback } from 'react';

interface ImageCropModalProps {
  imageUrl: string;
  filename: string;
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageUrl, filename, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState(1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (crop) {
      // Dim outside crop area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, crop.y);
      ctx.fillRect(0, crop.y, crop.x, crop.h);
      ctx.fillRect(crop.x + crop.w, crop.y, canvas.width - crop.x - crop.w, crop.h);
      ctx.fillRect(0, crop.y + crop.h, canvas.width, canvas.height - crop.y - crop.h);

      // Draw crop border
      ctx.strokeStyle = 'var(--brand-gold, #f5a623)';
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    }
  }, [crop]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Fit image within max dimensions
      const maxW = 800;
      const maxH = 600;
      const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      setScale(s);
      canvas.width = img.naturalWidth * s;
      canvas.height = img.naturalHeight * s;
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    setStartPos(pos);
    setDragging(true);
    setCrop(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !startPos) return;
    const pos = getCanvasPos(e);
    setCrop({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      w: Math.abs(pos.x - startPos.x),
      h: Math.abs(pos.y - startPos.y),
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleSave = async () => {
    if (!crop || !imgRef.current) return;
    setSaving(true);

    try {
      // Crop from original image coordinates
      const offscreen = document.createElement('canvas');
      const srcX = crop.x / scale;
      const srcY = crop.y / scale;
      const srcW = crop.w / scale;
      const srcH = crop.h / scale;

      offscreen.width = srcW;
      offscreen.height = srcH;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      offscreen.toBlob(async (blob) => {
        if (!blob) {
          setSaving(false);
          return;
        }
        try {
          await onSave(blob);
        } finally {
          setSaving(false);
        }
      }, mimeType, 0.92);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="crop-modal" onClick={e => e.stopPropagation()}>
        <div className="crop-modal-header">
          <h3>Crop Image: {filename}</h3>
          <button className="lightbox-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="crop-canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: dragging ? 'crosshair' : 'crosshair' }}
          />
        </div>
        <div className="crop-modal-footer">
          <p className="crop-hint">Click and drag to select the crop area</p>
          <div className="crop-actions">
            <button className="crop-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              className="crop-save-btn"
              onClick={handleSave}
              disabled={!crop || crop.w < 10 || crop.h < 10 || saving}
            >
              {saving ? 'Saving...' : 'Save Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
