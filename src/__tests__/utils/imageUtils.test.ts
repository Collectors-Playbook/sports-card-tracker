import { validateImageFile, createImagePreview, convertFileToBase64 } from '../../utils/imageUtils';

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
