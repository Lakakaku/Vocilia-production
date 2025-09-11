import { BusinessContextData, ContextApiResponse, UpdateContextPayload, ContextImport } from '../business-types/context';

class ContextService {
  private baseUrl = '/api/business/context';

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('ai-feedback-access-token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getContext(): Promise<ContextApiResponse> {
    try {
      // Get business ID from localStorage for now (temporary solution)
      const businessId = localStorage.getItem('business-id') || 'bus_1757623745176_hv6t2vn9x';
      const url = `${this.baseUrl}?business_id=${encodeURIComponent(businessId)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch context data');
      }

      return data;
    } catch (error) {
      console.error('Failed to get context:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async updateContext(payload: UpdateContextPayload): Promise<ContextApiResponse> {
    try {
      // Get business ID from localStorage for now (temporary solution)
      const businessId = localStorage.getItem('business-id') || 'bus_1757623745176_hv6t2vn9x';
      const url = `${this.baseUrl}?business_id=${encodeURIComponent(businessId)}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update context data');
      }

      return data;
    } catch (error) {
      console.error('Failed to update context:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async saveContext(contextData: BusinessContextData): Promise<ContextApiResponse> {
    return this.updateContext({
      contextData,
      incrementalUpdate: false
    });
  }

  async saveContextIncremental(contextData: Partial<BusinessContextData>, category?: string): Promise<ContextApiResponse> {
    return this.updateContext({
      contextData,
      category,
      incrementalUpdate: true
    });
  }

  async validateContext(contextData: Partial<BusinessContextData>): Promise<ContextApiResponse> {
    try {
      // Get business ID from localStorage for now (temporary solution)
      const businessId = localStorage.getItem('business-id') || 'bus_1757623745176_hv6t2vn9x';
      const url = `${this.baseUrl}?business_id=${encodeURIComponent(businessId)}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: 'validate',
          data: contextData
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate context data');
      }

      return data;
    } catch (error) {
      console.error('Failed to validate context:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async importContext(importData: ContextImport): Promise<ContextApiResponse> {
    try {
      // Get business ID from localStorage for now (temporary solution)
      const businessId = localStorage.getItem('business-id') || 'bus_1757623745176_hv6t2vn9x';
      const url = `${this.baseUrl}?business_id=${encodeURIComponent(businessId)}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: 'import',
          data: importData
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import context data');
      }

      return data;
    } catch (error) {
      console.error('Failed to import context:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Client-side only functions
  exportContextAsJson(contextData: BusinessContextData, businessName: string = 'Business'): string {
    const exportData = {
      businessId: 'exported',
      businessName,
      contextData,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  downloadContextAsFile(contextData: BusinessContextData, businessName: string = 'Business'): void {
    const jsonData = this.exportContextAsJson(contextData, businessName);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-context-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  parseImportFile(fileContent: string): { contextData: BusinessContextData; metadata: any } | null {
    try {
      const parsed = JSON.parse(fileContent);
      
      if (!parsed.contextData) {
        throw new Error('Invalid file format: missing contextData');
      }

      return {
        contextData: parsed.contextData,
        metadata: {
          businessName: parsed.businessName,
          exportedAt: parsed.exportedAt,
          version: parsed.version
        }
      };
    } catch (error) {
      console.error('Failed to parse import file:', error);
      return null;
    }
  }

  // Local storage functions for drafts
  saveDraft(contextData: Partial<BusinessContextData>): void {
    try {
      localStorage.setItem('context-draft', JSON.stringify({
        data: contextData,
        savedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }

  loadDraft(): { data: Partial<BusinessContextData>; savedAt: string } | null {
    try {
      const draft = localStorage.getItem('context-draft');
      return draft ? JSON.parse(draft) : null;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }

  clearDraft(): void {
    try {
      localStorage.removeItem('context-draft');
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }

  // Auto-save functionality
  private autoSaveTimer: NodeJS.Timeout | null = null;

  startAutoSave(contextData: BusinessContextData, onSave: (success: boolean) => void, interval: number = 30000): void {
    this.stopAutoSave(); // Clear any existing timer

    this.autoSaveTimer = setInterval(async () => {
      try {
        const result = await this.saveContext(contextData);
        onSave(result.success);
      } catch (error) {
        console.error('Auto-save failed:', error);
        onSave(false);
      }
    }, interval);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
}

// Export singleton instance
export const contextService = new ContextService();

// Named export for the class if needed
export { ContextService };