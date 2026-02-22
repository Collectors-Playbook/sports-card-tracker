import { Card, User } from '../types';
import { logDebug, logInfo, logError } from '../utils/logger';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export interface ExtractedCardData {
  player?: string;
  year?: string;
  brand?: string;
  setName?: string;
  cardNumber?: string;
  team?: string;
  category?: string;
  parallel?: string;
  serialNumber?: string;
  gradingCompany?: string;
  grade?: string;
  features?: {
    isRookie: boolean;
    isAutograph: boolean;
    isRelic: boolean;
    isNumbered: boolean;
    isGraded: boolean;
    isParallel: boolean;
  };
  confidence?: {
    score: number;
    level: 'high' | 'medium' | 'low';
    detectedFields: number;
    missingFields?: string[];
  };
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface CardInput {
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  cardNumber: string;
  parallel?: string;
  condition: string;
  gradingCompany?: string;
  setName?: string;
  serialNumber?: string;
  grade?: string;
  isRookie?: boolean;
  isAutograph?: boolean;
  isRelic?: boolean;
  isNumbered?: boolean;
  isGraded?: boolean;
  purchasePrice: number;
  purchaseDate: string;
  sellPrice?: number;
  sellDate?: string;
  currentValue: number;
  images: string[];
  notes: string;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    logDebug('ApiService', `Making request to ${url}`, { method: options.method || 'GET' });
    
    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        logError('ApiService', `HTTP Error for ${url}`, new Error(errorMessage));
        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return {} as T; // No content response
      }

      const data = await response.json();
      logDebug('ApiService', `Response received from ${url}`, data);
      return data;
    } catch (error) {
      // Enhanced error logging
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new Error(`Network error: Unable to connect to ${url}. Make sure the server is running.`);
        logError('ApiService', `Network error for ${url}`, networkError);
        throw networkError;
      }
      
      logError('ApiService', `Request failed for ${url}`, error as Error);
      throw error;
    }
  }

  public async getAllCards(): Promise<Card[]> {
    try {
      logInfo('ApiService', 'Fetching all cards');
      const cards = await this.request<Card[]>('/cards');
      
      // Convert date strings back to Date objects
      const processedCards = cards.map(card => ({
        ...card,
        purchaseDate: new Date(card.purchaseDate),
        sellDate: card.sellDate ? new Date(card.sellDate) : undefined,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt)
      }));
      
      logInfo('ApiService', `Fetched ${processedCards.length} cards`);
      return processedCards;
    } catch (error) {
      logError('ApiService', 'Failed to fetch cards', error as Error);
      throw error;
    }
  }

  public async getCard(id: string): Promise<Card> {
    try {
      logInfo('ApiService', `Fetching card ${id}`);
      const card = await this.request<Card>(`/cards/${id}`);
      
      // Convert date strings back to Date objects
      return {
        ...card,
        purchaseDate: new Date(card.purchaseDate),
        sellDate: card.sellDate ? new Date(card.sellDate) : undefined,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt)
      };
    } catch (error) {
      logError('ApiService', `Failed to fetch card ${id}`, error as Error);
      throw error;
    }
  }

  public async createCard(cardData: Card): Promise<Card> {
    try {
      logInfo('ApiService', 'Creating new card', { player: cardData.player });
      
      const cardInput: CardInput = {
        player: cardData.player,
        team: cardData.team,
        year: cardData.year,
        brand: cardData.brand,
        category: cardData.category,
        cardNumber: cardData.cardNumber,
        parallel: cardData.parallel,
        condition: cardData.condition,
        gradingCompany: cardData.gradingCompany,
        setName: cardData.setName,
        serialNumber: cardData.serialNumber,
        grade: cardData.grade,
        isRookie: cardData.isRookie,
        isAutograph: cardData.isAutograph,
        isRelic: cardData.isRelic,
        isNumbered: cardData.isNumbered,
        isGraded: cardData.isGraded,
        purchasePrice: cardData.purchasePrice,
        purchaseDate: cardData.purchaseDate.toISOString(),
        sellPrice: cardData.sellPrice,
        sellDate: cardData.sellDate?.toISOString(),
        currentValue: cardData.currentValue,
        images: cardData.images,
        notes: cardData.notes
      };

      const card = await this.request<Card>('/cards', {
        method: 'POST',
        body: JSON.stringify(cardInput),
      });

      // Convert date strings back to Date objects
      return {
        ...card,
        purchaseDate: new Date(card.purchaseDate),
        sellDate: card.sellDate ? new Date(card.sellDate) : undefined,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt)
      };
    } catch (error) {
      logError('ApiService', 'Failed to create card', error as Error, cardData);
      throw error;
    }
  }

  public async updateCard(cardData: Card): Promise<Card> {
    try {
      logInfo('ApiService', `Updating card ${cardData.id}`, { player: cardData.player });
      
      const cardInput: CardInput = {
        player: cardData.player,
        team: cardData.team,
        year: cardData.year,
        brand: cardData.brand,
        category: cardData.category,
        cardNumber: cardData.cardNumber,
        parallel: cardData.parallel,
        condition: cardData.condition,
        gradingCompany: cardData.gradingCompany,
        setName: cardData.setName,
        serialNumber: cardData.serialNumber,
        grade: cardData.grade,
        isRookie: cardData.isRookie,
        isAutograph: cardData.isAutograph,
        isRelic: cardData.isRelic,
        isNumbered: cardData.isNumbered,
        isGraded: cardData.isGraded,
        purchasePrice: cardData.purchasePrice,
        purchaseDate: cardData.purchaseDate.toISOString(),
        sellPrice: cardData.sellPrice,
        sellDate: cardData.sellDate?.toISOString(),
        currentValue: cardData.currentValue,
        images: cardData.images,
        notes: cardData.notes
      };

      const card = await this.request<Card>(`/cards/${cardData.id}`, {
        method: 'PUT',
        body: JSON.stringify(cardInput),
      });

      // Convert date strings back to Date objects
      return {
        ...card,
        purchaseDate: new Date(card.purchaseDate),
        sellDate: card.sellDate ? new Date(card.sellDate) : undefined,
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt)
      };
    } catch (error) {
      logError('ApiService', `Failed to update card ${cardData.id}`, error as Error, cardData);
      throw error;
    }
  }

  public async deleteCard(id: string): Promise<void> {
    try {
      logInfo('ApiService', `Deleting card ${id}`);
      await this.request<void>(`/cards/${id}`, {
        method: 'DELETE',
      });
      logInfo('ApiService', `Card ${id} deleted successfully`);
    } catch (error) {
      logError('ApiService', `Failed to delete card ${id}`, error as Error);
      throw error;
    }
  }

  public async login(email: string, password: string): Promise<{ user: User; token: string }> {
    return this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  public async register(username: string, email: string, password: string): Promise<{ user: User; token: string }> {
    return this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  public async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  public async updateProfile(data: {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    profilePhoto?: string | null;
  }): Promise<User> {
    return this.request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ─── eBay Export ──────────────────────────────────────────────────────────

  public async generateEbayCsv(options: {
    priceMultiplier: number;
    shippingCost: number;
    duration?: string;
    location?: string;
    dispatchTime?: number;
    cardIds?: string[];
  }): Promise<{
    filename: string;
    totalCards: number;
    skippedPcCards: number;
    totalListingValue: number;
    generatedAt: string;
  }> {
    return this.request('/ebay/generate', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  public async generateEbayCsvAsync(options: {
    priceMultiplier: number;
    shippingCost: number;
    duration?: string;
    location?: string;
    dispatchTime?: number;
    cardIds?: string[];
  }): Promise<{ id: string; type: string; status: string }> {
    return this.request('/ebay/generate-async', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  public async downloadEbayCsv(): Promise<Blob> {
    const url = `${API_BASE_URL}/ebay/download`;
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.statusText}`);
    }
    return response.blob();
  }

  public async getEbayExportStatus(): Promise<{
    templateExists: boolean;
    outputExists: boolean;
  }> {
    return this.request('/ebay/status');
  }

  // ─── Processed Files ────────────────────────────────────────────────────

  public async getProcessedFiles(): Promise<{ name: string; size: number; modified: string; type: string }[]> {
    return this.request('/files/processed');
  }

  public async deleteProcessedFile(filename: string): Promise<void> {
    await this.request<void>(`/files/processed/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  }

  // ─── Raw Files (Holding Pen) ────────────────────────────────────────────

  public async getRawFiles(): Promise<{ name: string; size: number; modified: string; type: string }[]> {
    return this.request('/files/raw');
  }

  public async deleteRawFile(filename: string): Promise<void> {
    await this.request<void>(`/files/raw/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  }

  public async uploadRawFiles(files: File[]): Promise<{ uploaded: { name: string; size: number; originalName: string }[]; count: number }> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const url = `${API_BASE_URL}/files/raw/upload`;
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  public async replaceRawFile(filename: string, blob: Blob): Promise<void> {
    const formData = new FormData();
    formData.append('file', blob, filename);

    const url = `${API_BASE_URL}/files/raw/${encodeURIComponent(filename)}`;
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Replace failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
  }

  public async processRawImages(filenames: string[]): Promise<{ processed: number; failed: number; skipped: number; duplicates: number }> {
    return this.request('/image-processing/process', {
      method: 'POST',
      body: JSON.stringify({ filenames }),
    });
  }

  public async identifyCard(filename: string, backFile?: string): Promise<ExtractedCardData> {
    return this.request('/image-processing/identify', {
      method: 'POST',
      body: JSON.stringify({ filename, backFile }),
    });
  }

  public async confirmCard(
    filename: string,
    cardData: ExtractedCardData,
    backFile?: string
  ): Promise<{ filename: string; status: string; processedFilename?: string; cardId?: string; confidence?: number; error?: string }> {
    return this.request('/image-processing/confirm', {
      method: 'POST',
      body: JSON.stringify({ filename, backFile, cardData }),
    });
  }

  public async getCardByImage(imageFilename: string): Promise<Card> {
    const card = await this.request<Card>(`/cards?image=${encodeURIComponent(imageFilename)}`);
    return {
      ...card,
      purchaseDate: new Date(card.purchaseDate),
      sellDate: card.sellDate ? new Date(card.sellDate) : undefined,
      createdAt: new Date(card.createdAt),
      updatedAt: new Date(card.updatedAt),
    };
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  public async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      logDebug('ApiService', 'Performing health check');
      return await this.request<{ status: string; message: string }>('/health');
    } catch (error) {
      logError('ApiService', 'Health check failed', error as Error);
      throw error;
    }
  }

  // ─── Audit Logs (Admin) ──────────────────────────────────────────────────

  public async getAuditLogs(params: {
    userId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, String(value));
    });
    return this.request(`/audit-logs?${query.toString()}`);
  }

  public async getAuditLogActions(): Promise<string[]> {
    return this.request('/audit-logs/actions');
  }
}

export const apiService = new ApiService();
export default apiService;