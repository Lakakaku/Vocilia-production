// Node.js environment globals
declare const console: any;

/**
 * Simple in-memory cache service for AI responses
 * Optimized for development - can be extended to use Redis in production
 */
export class CacheService {
  private evaluationCache = new Map<string, any>();
  private conversationCache = new Map<string, any>();
  private readonly maxCacheSize = 1000;
  private readonly cacheTimeout = 60 * 60 * 1000; // 1 hour

  /**
   * Generate cache key for evaluation requests
   */
  private generateEvaluationKey(transcript: string, businessType: string): string {
    // Simple hash based on content and type
    const normalized = transcript.toLowerCase().trim();
    const hash = this.simpleHash(`${normalized}-${businessType}`);
    return `eval:${hash}`;
  }

  /**
   * Generate cache key for conversation requests
   */
  private generateConversationKey(userInput: string, historyLength: number): string {
    const normalized = userInput.toLowerCase().trim();
    const hash = this.simpleHash(`${normalized}-${historyLength}`);
    return `conv:${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if cache needs cleanup
   */
  private cleanupIfNeeded(): void {
    if (this.evaluationCache.size > this.maxCacheSize) {
      const keys = Array.from(this.evaluationCache.keys());
      // Remove oldest 20% of entries
      const toRemove = Math.floor(keys.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.evaluationCache.delete(keys[i]);
      }
    }

    if (this.conversationCache.size > this.maxCacheSize) {
      const keys = Array.from(this.conversationCache.keys());
      const toRemove = Math.floor(keys.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.conversationCache.delete(keys[i]);
      }
    }
  }

  /**
   * Cache evaluation response
   */
  cacheEvaluation(
    transcript: string, 
    businessType: string, 
    response: any
  ): void {
    const key = this.generateEvaluationKey(transcript, businessType);
    this.evaluationCache.set(key, {
      response,
      timestamp: Date.now()
    });
    this.cleanupIfNeeded();
  }

  /**
   * Get cached evaluation response
   */
  getCachedEvaluation(transcript: string, businessType: string): any | null {
    const key = this.generateEvaluationKey(transcript, businessType);
    const cached = this.evaluationCache.get(key);
    
    if (!cached) return null;
    
    // Check if cache has expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.evaluationCache.delete(key);
      return null;
    }
    
    console.log(`Cache hit for evaluation: ${key}`);
    return cached.response;
  }

  /**
   * Cache conversation response
   */
  cacheConversation(
    userInput: string,
    historyLength: number,
    response: any
  ): void {
    const key = this.generateConversationKey(userInput, historyLength);
    this.conversationCache.set(key, {
      response,
      timestamp: Date.now()
    });
    this.cleanupIfNeeded();
  }

  /**
   * Get cached conversation response
   */
  getCachedConversation(userInput: string, historyLength: number): any | null {
    const key = this.generateConversationKey(userInput, historyLength);
    const cached = this.conversationCache.get(key);
    
    if (!cached) return null;
    
    // Check if cache has expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.conversationCache.delete(key);
      return null;
    }
    
    console.log(`Cache hit for conversation: ${key}`);
    return cached.response;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    evaluationCacheSize: number;
    conversationCacheSize: number;
    hitRate: number;
  } {
    return {
      evaluationCacheSize: this.evaluationCache.size,
      conversationCacheSize: this.conversationCache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.evaluationCache.clear();
    this.conversationCache.clear();
    console.log('Cache cleared');
  }
}

// Export singleton instance
export const cacheService = new CacheService();