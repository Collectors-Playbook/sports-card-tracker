import React, { useState, useRef, useCallback, memo } from 'react';
import { validateImageFile, compressImage } from '../../utils/imageUtils';
import './ImageUpload.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

function imageSrc(image: string): string {
  // Data URLs and absolute URLs are already displayable
  if (image.startsWith('data:') || image.startsWith('http') || image.startsWith('/')) {
    return image;
  }
  // Bare filenames need the API prefix
  return `${API_BASE_URL}/files/processed/${encodeURIComponent(image)}`;
}

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  images, 
  onImagesChange, 
  maxImages = 5,
  disabled = false 
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File): Promise<string> => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const compressedImage = await compressImage(file, 800, 0.8);
    return compressedImage;
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    if (disabled) return;
    
    setError(null);
    setUploading(true);
    
    try {
      const fileArray = Array.from(files);
      const remainingSlots = maxImages - images.length;
      const filesToProcess = fileArray.slice(0, remainingSlots);
      
      if (fileArray.length > remainingSlots) {
        setError(`Only ${remainingSlots} more image(s) can be added`);
      }
      
      const processedImages = await Promise.all(
        filesToProcess.map(file => processImage(file))
      );
      
      onImagesChange([...images, ...processedImages]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }, [images, maxImages, disabled, onImagesChange, processImage]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input value to allow same file to be selected again
    e.target.value = '';
  }, [handleFiles]);

  const handleRemoveImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  }, [images, onImagesChange]);

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const canAddMore = images.length < maxImages && !disabled;

  return (
    <div className="image-upload-container">
      <div className="uploaded-images">
        {images.length === 0 && (
          <div className="generic-image-preview">
            <img src="/generic.png" alt="Card placeholder" />
            <div className="generic-image-overlay">
              <span>No image uploaded</span>
            </div>
          </div>
        )}
        
        {images.map((image, index) => (
          <div key={index} className="uploaded-image">
            <img src={imageSrc(image)} alt={`Card ${index + 1}`} />
            <button
              type="button"
              onClick={() => handleRemoveImage(index)}
              className="remove-image-btn"
              disabled={disabled}
            >
              ×
            </button>
          </div>
        ))}
        
        {canAddMore && (
          <div
            className={`upload-area ${dragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            {uploading ? (
              <div className="upload-spinner">
                <div className="spinner"></div>
                <p>Processing image...</p>
              </div>
            ) : (
              <div className="upload-content">
                <div className="upload-icon">📷</div>
                <p>Click to upload or drag & drop</p>
                <p className="upload-hint">PNG, JPG, WebP up to 100MB</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}
      
      <div className="upload-info">
        {images.length} of {maxImages} images uploaded
      </div>
    </div>
  );
};

export default memo(ImageUpload);