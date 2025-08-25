import axios, { AxiosInstance } from 'axios';
import { AIService } from './AIService';
import { cacheService } from './CacheService';
import { performanceMonitor } from './PerformanceMonitor';
import { 
  BusinessContext, 
  QualityScore, 
  ConversationResponse, 
  AIServiceConfig,
  OllamaRequest,
  OllamaResponse,
  AIEvaluationResponse
} from './types';

// Node.js environment globals
declare const console: any;
declare const process: any;

/**
 * Ollama AI service implementation optimized for production performance
 * Uses ultra-fast models (qwen2:0.5b) for real-time feedback evaluation
 * Handles both feedback evaluation and conversational responses with <2s latency
 */
export class OllamaService implements AIService {
  private client: AxiosInstance;
  private config: AIServiceConfig;
  private modelWarmedUp: boolean = false;
  private connectionPool: AxiosInstance[] = [];
  private currentConnectionIndex: number = 0;
  private readonly maxConnections: number;

  constructor(config: Partial<AIServiceConfig> = {}) {
    // Environment-based model selection for optimal performance
    const defaultModel = process.env.NODE_ENV === 'production' 
      ? process.env.OLLAMA_PRODUCTION_MODEL || 'qwen2:0.5b'
      : 'qwen2:0.5b';

    this.maxConnections = parseInt(process.env.AI_MAX_CONCURRENT || '5');

    this.config = {
      provider: 'ollama',
      model: defaultModel,    // Use environment-specific model
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      temperature: 0.3,       // Reduced for faster, more deterministic responses
      maxTokens: 500,         // Reduced for faster generation
      ...config
    };

    // Initialize connection pool
    this.initializeConnectionPool();
  }

  /**
   * Initialize connection pool for concurrent requests
   */
  private initializeConnectionPool(): void {
    for (let i = 0; i < this.maxConnections; i++) {
      const client = axios.create({
        baseURL: this.config.endpoint,
        timeout: parseInt(process.env.AI_RESPONSE_TIMEOUT || '10000'),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      this.connectionPool.push(client);
    }
    
    // Keep the main client for compatibility
    this.client = this.connectionPool[0];
    console.log(`Initialized connection pool with ${this.maxConnections} connections`);
  }

  /**
   * Get next available connection from pool (round-robin)
   */
  private getConnection(): AxiosInstance {
    const connection = this.connectionPool[this.currentConnectionIndex];
    this.currentConnectionIndex = (this.currentConnectionIndex + 1) % this.maxConnections;
    return connection;
  }

  /**
   * Evaluate customer feedback quality using structured prompts
   */
  async evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore> {
    const requestId = performanceMonitor.startRequest();
    let cached = false;
    
    try {
      // Check cache first
      const cachedResult = cacheService.getCachedEvaluation(transcript, businessContext.type);
      if (cachedResult) {
        console.log(`Cache hit for evaluation - saved AI processing time`);
        cached = true;
        performanceMonitor.endRequest(requestId, true, cached);
        return cachedResult;
      }

      const prompt = this.buildEvaluationPrompt(transcript, businessContext, purchaseItems);
      
      const startTime = Date.now();
      
      const response = await this.makeRequest(prompt, { isConversation: false });
      const evaluation = this.parseEvaluationResponse(response.response);
      
      const latency = Date.now() - startTime;
      console.log(`AI evaluation completed in ${latency}ms (model: ${this.config.model})`);

      // Record performance metrics
      performanceMonitor.recordLatency(latency);
      performanceMonitor.endRequest(requestId, true, cached);

      const result: QualityScore = {
        authenticity: evaluation.authenticity,
        concreteness: evaluation.concreteness,
        depth: evaluation.depth,
        total: evaluation.total_score,
        reasoning: evaluation.reasoning,
        categories: evaluation.categories,
        sentiment: evaluation.sentiment
      };

      // Cache the result for similar future requests
      cacheService.cacheEvaluation(transcript, businessContext.type, result);

      return result;
    } catch (error) {
      console.error('AI evaluation failed:', error);
      performanceMonitor.endRequest(requestId, false, cached);
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
    const requestId = performanceMonitor.startRequest();
    let cached = false;
    
    try {
      // Check cache for conversation responses
      const cachedResult = cacheService.getCachedConversation(userInput, conversationHistory.length);
      if (cachedResult) {
        console.log(`Cache hit for conversation - saved AI processing time`);
        cached = true;
        performanceMonitor.endRequest(requestId, true, cached);
        return cachedResult;
      }

      const prompt = this.buildConversationPrompt(userInput, conversationHistory, businessContext);
      const startTime = Date.now();
      
      const response = await this.makeRequest(prompt, { isConversation: true });
      
      const latency = Date.now() - startTime;
      performanceMonitor.recordLatency(latency);
      performanceMonitor.endRequest(requestId, true, cached);
      
      const result: ConversationResponse = {
        response: response.response.trim(),
        shouldContinue: this.shouldContinueConversation(response.response, conversationHistory.length),
        confidence: 0.8 // TODO: Implement confidence scoring
      };

      // Cache conversation responses for common patterns
      cacheService.cacheConversation(userInput, conversationHistory.length, result);

      return result;
    } catch (error) {
      console.error('AI conversation failed:', error);
      performanceMonitor.endRequest(requestId, false, cached);
      
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
   * Make a request to Ollama API with production-optimized parameters
   */
  private async makeRequest(prompt: string, options: { isConversation?: boolean } = {}): Promise<OllamaResponse> {
    // Production-optimized parameters for maximum speed
    const request: OllamaRequest = {
      model: this.config.model,
      prompt,
      stream: false,
      temperature: this.config.temperature,
      // Additional optimization parameters
      options: {
        num_predict: options.isConversation ? 30 : 50, // Shorter responses for conversations
        num_ctx: 1024,        // Reduced context window for speed
        top_k: 10,           // Limit token selection for speed
        top_p: 0.9,          // Focus probability mass
        repeat_penalty: 1.1,  // Prevent loops
        stop: options.isConversation ? ['\n\n', 'KUND:', 'DU:'] : undefined
      }
    };

    // Log performance for monitoring
    console.log(`AI request to ${this.config.model} (${options.isConversation ? 'conversation' : 'evaluation'})`);

    // Use connection pool for load distribution
    const client = this.getConnection();
    const response = await client.post('/api/generate', request);
    return response.data;
  }

  /**
   * Warm up the model by making a test request
   */
  async warmUpModel(): Promise<void> {
    if (this.modelWarmedUp) return;
    
    try {
      console.log(`Warming up model ${this.config.model}...`);
      const startTime = Date.now();
      
      // Simple warm-up request
      const testPrompt = 'Hej';
      await this.makeRequest(testPrompt, { isConversation: true });
      
      const warmUpTime = Date.now() - startTime;
      this.modelWarmedUp = true;
      console.log(`Model ${this.config.model} warmed up in ${warmUpTime}ms`);
    } catch (error) {
      console.error('Model warm-up failed:', error);
      // Don't throw - allow service to continue without warm-up
    }
  }

  /**
   * Initialize service and warm up model
   */
  async initialize(): Promise<void> {
    console.log(`Initializing OllamaService with model ${this.config.model}`);
    
    // Start automatic memory monitoring
    performanceMonitor.startMemoryMonitoring(30000); // Every 30 seconds
    
    await this.warmUpModel();
    
    console.log('OllamaService initialized with performance monitoring enabled');
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats() {
    return performanceMonitor.getStats();
  }

  /**
   * Get formatted performance report
   */
  getPerformanceReport(): string {
    return performanceMonitor.getReport();
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