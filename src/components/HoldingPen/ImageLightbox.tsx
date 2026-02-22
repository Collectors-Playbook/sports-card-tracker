import React, { useEffect, useCallback } from 'react';

interface ImageLightboxProps {
  frontUrl: string | null;
  backUrl: string | null;
  label: string;
  onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ frontUrl, backUrl, label, onClose }) => {
  const [showBack, setShowBack] = React.useState(false);

  const currentUrl = showBack && backUrl ? backUrl : frontUrl;
  const hasBothSides = !!(frontUrl && backUrl);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (hasBothSides) setShowBack(prev => !prev);
    }
  }, [onClose, hasBothSides]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="Close">&times;</button>
        <div className="lightbox-label">{label} {hasBothSides ? (showBack ? '(Back)' : '(Front)') : ''}</div>
        {currentUrl && (
          <img src={currentUrl} alt={label} className="lightbox-image" />
        )}
        {hasBothSides && (
          <div className="lightbox-nav">
            <button
              className={`lightbox-nav-btn ${!showBack ? 'active' : ''}`}
              onClick={() => setShowBack(false)}
            >
              Front
            </button>
            <button
              className={`lightbox-nav-btn ${showBack ? 'active' : ''}`}
              onClick={() => setShowBack(true)}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageLightbox;
