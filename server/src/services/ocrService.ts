import { createWorker } from 'tesseract.js';

class OCRService {
  async extractText(filePath: string): Promise<string> {
    const worker = await createWorker('eng');

    try {
      const { data: { text } } = await worker.recognize(filePath);
      return text;
    } finally {
      await worker.terminate();
    }
  }
}

export default OCRService;
