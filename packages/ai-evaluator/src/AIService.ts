import { BusinessContext, QualityScore, ConversationResponse } from './types';

/**
 * Abstract AI service interface for feedback evaluation and conversation
 * Supports both Ollama and OpenAI providers
 */
export interface AIService {
  /**
   * Evaluate customer feedback quality with detailed scoring
   */
  evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore>;
  
  /**
   * Generate conversational response during feedback session
   */
  generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<ConversationResponse>;

  /**
   * Health check for the AI service
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get service configuration and status
   */
  getStatus(): Promise<{
    provider: string;
    model: string;
    available: boolean;
    latency?: number;
  }>;
}