import OCRService from '../../services/ocrService';

// Mock tesseract.js
const mockRecognize = jest.fn();
const mockTerminate = jest.fn();

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(() => Promise.resolve({
    recognize: mockRecognize,
    terminate: mockTerminate,
  })),
}));

describe('OCRService', () => {
  let service: OCRService;

  beforeEach(() => {
    service = new OCRService();
    mockRecognize.mockReset();
    mockTerminate.mockReset();
    mockTerminate.mockResolvedValue(undefined);
  });

  it('extracts text from a file path', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'Mike Trout\n2023 Topps Chrome\n#1' } });

    const text = await service.extractText('/path/to/card.jpg');
    expect(text).toBe('Mike Trout\n2023 Topps Chrome\n#1');
    expect(mockRecognize).toHaveBeenCalledWith('/path/to/card.jpg');
  });

  it('terminates worker after successful extraction', async () => {
    mockRecognize.mockResolvedValue({ data: { text: 'some text' } });

    await service.extractText('/path/to/card.jpg');
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('terminates worker on error', async () => {
    mockRecognize.mockRejectedValue(new Error('OCR failed'));

    await expect(service.extractText('/path/to/card.jpg')).rejects.toThrow('OCR failed');
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('returns empty string when OCR produces no text', async () => {
    mockRecognize.mockResolvedValue({ data: { text: '' } });

    const text = await service.extractText('/path/to/blank.jpg');
    expect(text).toBe('');
  });

  it('handles whitespace-only OCR results', async () => {
    mockRecognize.mockResolvedValue({ data: { text: '   \n  \n  ' } });

    const text = await service.extractText('/path/to/card.jpg');
    expect(text).toBe('   \n  \n  ');
  });
});
