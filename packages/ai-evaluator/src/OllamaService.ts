import axios, { AxiosInstance } from 'axios';
import { AIService } from './AIService';
import { 
  BusinessContext, 
  QualityScore, 
  ConversationResponse, 
  AIServiceConfig,
  OllamaRequest,
  OllamaResponse,
  AIEvaluationResponse
} from './types';

/**
 * Ollama AI service implementation for local Llama 3.2 processing
 * Handles both feedback evaluation and conversational responses
 */
export class OllamaService implements AIService {
  private client: AxiosInstance;
  private config: AIServiceConfig;

  constructor(config: Partial<AIServiceConfig> = {}) {
    this.config = {
      provider: 'ollama',
      model: 'llama3.2',
      endpoint: 'http://localhost:11434',
      temperature: 0.7,
      maxTokens: 1000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.endpoint,
      timeout: 30000, // 30s timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Evaluate customer feedback quality using structured prompts
   */
  async evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore> {
    const prompt = this.buildEvaluationPrompt(transcript, businessContext, purchaseItems);
    
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest(prompt);
      const evaluation = this.parseEvaluationResponse(response.response);
      
      const latency = Date.now() - startTime;
      console.log(`AI evaluation completed in ${latency}ms`);

      return {
        authenticity: evaluation.authenticity,
        concreteness: evaluation.concreteness,
        depth: evaluation.depth,
        total: evaluation.total_score,
        reasoning: evaluation.reasoning,
        categories: evaluation.categories,
        sentiment: evaluation.sentiment
      };
    } catch (error) {
      console.error('AI evaluation failed:', error);
      throw new Error(`AI evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate conversational response during feedback collection
   */
  async generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<ConversationResponse> {
    const prompt = this.buildConversationPrompt(userInput, conversationHistory, businessContext);
    
    try {
      const response = await this.makeRequest(prompt);
      
      return {
        response: response.response.trim(),
        shouldContinue: this.shouldContinueConversation(response.response, conversationHistory.length),
        confidence: 0.8 // TODO: Implement confidence scoring
      };
    } catch (error) {
      console.error('AI conversation failed:', error);
      
      // Fallback response
      return {
        response: "Tack för din feedback. Kan du berätta mer?",
        shouldContinue: true,
        confidence: 0.1
      };
    }
  }

  /**
   * Health check to verify Ollama service availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data?.models || [];
      return models.some((model: any) => model.name.includes(this.config.model));
    } catch (error) {
      console.error('Ollama health check failed:', error);
      return false;
    }
  }

  /**
   * Get service status and configuration
   */
  async getStatus(): Promise<{
    provider: string;
    model: string;
    available: boolean;
    latency?: number;
  }> {
    const startTime = Date.now();
    const available = await this.healthCheck();
    const latency = available ? Date.now() - startTime : undefined;

    return {
      provider: this.config.provider,
      model: this.config.model,
      available,
      latency
    };
  }

  /**
   * Make a request to Ollama API
   */
  private async makeRequest(prompt: string): Promise<OllamaResponse> {
    const request: OllamaRequest = {
      model: this.config.model,
      prompt,
      stream: false,
      temperature: this.config.temperature
    };

    const response = await this.client.post('/api/generate', request);
    return response.data;
  }

  /**
   * Build evaluation prompt with structured format for quality scoring
   */
  private buildEvaluationPrompt(
    transcript: string,
    businessContext: BusinessContext,
    purchaseItems: string[]
  ): string {
    return `Du är en expert på att utvärdera kundåterrapportering för svenska företag. Betygsätt denna feedback på en skala 0-100 baserat på följande kriterier:

KRITERIER (med viktning):
1. Autenticitet (40%): Stämmer feedbacken överens med företagskontexten?
2. Konkrethet (30%): Specifika, handlingsbara observationer
3. Djup (30%): Detaljerade, genomtänkta insikter

FÖRETAGSKONTEXT:
Typ: ${businessContext.type}
${businessContext.layout ? `Layout: ${JSON.stringify(businessContext.layout)}` : ''}
${businessContext.currentPromotions ? `Aktuella kampanjer: ${businessContext.currentPromotions.join(', ')}` : ''}
${businessContext.knownIssues ? `Kända problem: ${businessContext.knownIssues.join(', ')}` : ''}
${businessContext.strengths ? `Styrkor: ${businessContext.strengths.join(', ')}` : ''}

KÖPTA PRODUKTER: ${purchaseItems.join(', ')}

KUNDFEEDBACK: "${transcript}"

Svara med ENDAST JSON i detta exakta format (utan markdown):
{
  "authenticity": number,
  "concreteness": number,
  "depth": number,
  "total_score": number,
  "reasoning": "string",
  "categories": ["string"],
  "sentiment": number
}

Sentiment ska vara -1 (negativ) till 1 (positiv). Kategorier ska vara svenska ord som "service", "kvalitet", "miljö", etc.`;
  }

  /**
   * Build conversation prompt for natural dialogue
   */
  private buildConversationPrompt(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): string {
    const context = conversationHistory.length > 0 
      ? `\n\nTidigare konversation:\n${conversationHistory.join('\n')}`
      : '';

    return `Du är en vänlig AI-assistent som samlar feedback från kunder i svenska butiker. Du pratar svenska naturligt och ställer följdfrågor för att få detaljerad feedback.

FÖRETAGSTYP: ${businessContext.type}
DITT MÅL: Få kunden att dela specifika, användbara observationer om deras upplevelse.

RIKTLINJER:
- Håll svaren korta (max 2 meningar)
- Ställ specifika följdfrågor
- Var varm och vänlig
- Uppmuntra detaljer utan att vara påträngande
- Avsluta efter 3-4 utbyten eller när du fått tillräckligt med information${context}

KUND: "${userInput}"

DU:`;
  }

  /**
   * Parse AI evaluation response from JSON
   */
  private parseEvaluationResponse(responseText: string): AIEvaluationResponse {
    try {
      // Remove any markdown formatting and extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const required = ['authenticity', 'concreteness', 'depth', 'total_score', 'reasoning'];
      for (const field of required) {
        if (parsed[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Ensure arrays exist
      parsed.categories = parsed.categories || [];
      parsed.sentiment = parsed.sentiment || 0;

      return parsed;
    } catch (error) {
      console.error('Failed to parse evaluation response:', responseText);
      console.error('Parse error:', error);
      
      // Return default scores if parsing fails
      return {
        authenticity: 50,
        concreteness: 50,
        depth: 50,
        total_score: 50,
        reasoning: 'Kunde inte analysera feedback - teknisk error',
        categories: ['teknisk_error'],
        sentiment: 0
      };
    }
  }

  /**
   * Determine if conversation should continue based on response and history length
   */
  private shouldContinueConversation(response: string, historyLength: number): boolean {
    // Continue if less than 4 exchanges and response doesn't indicate completion
    if (historyLength >= 6) return false; // Max 3 exchanges (6 messages)
    
    const completionIndicators = [
      'tack för din feedback',
      'det var allt',
      'ha en bra dag',
      'vi uppskattar',
      'det räcker'
    ];
    
    const responseLower = response.toLowerCase();
    return !completionIndicators.some(indicator => responseLower.includes(indicator));
  }
}