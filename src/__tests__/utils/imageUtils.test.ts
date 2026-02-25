import { validateImageFile, createImagePreview, convertFileToBase64, compressImage, createThumbnail } from '../../utils/imageUtils';

describe('validateImageFile', () => {
  const createMockFile = (type: string, size: number, name = 'test.jpg'): File => {
    const blob = new Blob(['x'.repeat(size)], { type });
    return new File([blob], name, { type });
  };

  it('accepts JPEG files', () => {
    const file = createMockFile('image/jpeg', 1024);
    expect(validateImageFile(file).isValid).toBe(true);
  });

  it('accepts PNG files', () => {
    const file = createMockFile('image/png', 1024);
    expect(validateImageFile(file).isValid).toBe(true);
  });

  it('accepts WebP files', () => {
    const file = createMockFile('image/webp', 1024);
    expect(validateImageFile(file).isValid).toBe(true);
  });

  it('rejects GIF files', () => {
    const file = createMockFile('image/gif', 1024);
    const result = validateImageFile(file);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('valid image file');
  });

  it('rejects files over 100MB', () => {
    const file = createMockFile('image/jpeg', 101 * 1024 * 1024);
    const result = validateImageFile(file);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('100MB');
  });

  it('accepts files exactly at 100MB', () => {
    const file = createMockFile('image/jpeg', 100 * 1024 * 1024);
    expect(validateImageFile(file).isValid).toBe(true);
  });
});

describe('createImagePreview', () => {
  it('returns ImageFile with preview URL', () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const result = createImagePreview(file);
    expect(result.file).toBe(file);
    expect(result.preview).toBe('blob:mock-url');
    expect(result.id).toMatch(/^img-/);
  });

  it('generates unique IDs', () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const result1 = createImagePreview(file);
    const result2 = createImagePreview(file);
    expect(result1.id).not.toBe(result2.id);
  });
});

describe('convertFileToBase64', () => {
  it('resolves with base64 string', async () => {
    // Create a mock FileReader
    const mockResult = 'data:image/jpeg;base64,abc123';
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onload: null as any,
      onerror: null as any,
      result: mockResult,
    };
    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const promise = convertFileToBase64(file);

    // Trigger the onload callback
    mockFileReader.onload!({ target: { result: mockResult } } as any);

    const result = await promise;
    expect(result).toBe(mockResult);
  });

  it('rejects when FileReader fails', async () => {
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onload: null as any,
      onerror: null as any,
      result: null,
    };
    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const promise = convertFileToBase64(file);

    mockFileReader.onerror!(new Error('read error'));

    await expect(promise).rejects.toBeTruthy();
  });
});

describe('compressImage', () => {
  beforeEach(() => {
    // Re-set canvas mock since CRA resetMocks clears the jest.fn() from setupTests
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      clearRect: jest.fn(),
    })) as any;
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');
  });

  it('resolves with compressed data URL', async () => {
    const mockImage = {
      width: 1600,
      height: 1200,
      onload: null as any,
      onerror: null as any,
      src: '',
    };
    jest.spyOn(global, 'Image').mockImplementation(() => mockImage as any);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file, 800, 0.8);

    // Trigger image load
    mockImage.onload!();

    const result = await promise;
    // Canvas toDataURL is mocked in setupTests to return 'data:image/png;base64,mock'
    expect(result).toBe('data:image/png;base64,mock');
  });

  it('rejects when image fails to load', async () => {
    const mockImage = {
      width: 800,
      height: 600,
      onload: null as any,
      onerror: null as any,
      src: '',
    };
    jest.spyOn(global, 'Image').mockImplementation(() => mockImage as any);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    mockImage.onerror!();

    await expect(promise).rejects.toThrow('Failed to load image');
  });

  it('rejects when canvas context is null', async () => {
    const mockImage = {
      width: 800,
      height: 600,
      onload: null as any,
      onerror: null as any,
      src: '',
    };
    jest.spyOn(global, 'Image').mockImplementation(() => mockImage as any);

    // Override getContext to return null for this test
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as any;

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const promise = compressImage(file);

    mockImage.onload!();

    await expect(promise).rejects.toThrow('Failed to get canvas context');

    // Restore
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });
});

describe('createThumbnail', () => {
  beforeEach(() => {
    // Re-set canvas mock since CRA resetMocks clears the jest.fn() from setupTests
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      clearRect: jest.fn(),
    })) as any;
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');
  });

  it('resolves with thumbnail data URL', async () => {
    const mockImage = {
      width: 400,
      height: 300,
      onload: null as any,
      onerror: null as any,
      src: '',
    };
    jest.spyOn(global, 'Image').mockImplementation(() => mockImage as any);

    const promise = createThumbnail('data:image/jpeg;base64,abc', 150);

    mockImage.onload!();

    const result = await promise;
    expect(result).toBe('data:image/png;base64,mock');
  });

  it('rejects when image fails to load', async () => {
    const mockImage = {
      width: 400,
      height: 300,
      onload: null as any,
      onerror: null as any,
      src: '',
    };
    jest.spyOn(global, 'Image').mockImplementation(() => mockImage as any);

    const promise = createThumbnail('data:image/jpeg;base64,abc');

    mockImage.onerror!();

    await expect(promise).rejects.toThrow('Failed to load image');
  });

  it('rejects when canvas context is null', async () => {
    const mockImage = {
      width: 400,
      height: 300,
      onload: null as any,
      onerror: null as any,
      src: '',
    };
    jest.spyOn(global, 'Image').mockImplementation(() => mockImage as any);

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as any;

    const promise = createThumbnail('data:image/jpeg;base64,abc');

    mockImage.onload!();

    await expect(promise).rejects.toThrow('Failed to get canvas context');

    HTMLCanvasElement.prototype.getContext = origGetContext;
  });
});
