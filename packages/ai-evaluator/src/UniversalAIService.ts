import axios, { AxiosInstance } from 'axios';
import { 
  AIService, 
  AIServiceConfig, 
  BusinessContext, 
  QualityScore, 
  ConversationResponse,
  AIEvaluationResponse
} from './types';
import { ScoringEngine } from './ScoringEngine';

export class UniversalAIService implements AIService {
  private primaryService: AIServiceProvider;
  private fallbackService?: AIServiceProvider;
  private config: AIServiceConfig;
  private scoringEngine: ScoringEngine;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.scoringEngine = new ScoringEngine();
    this.primaryService = this.createProvider(config.provider, config);
    
    if (config.fallbackProvider) {
      const fallbackConfig = {
        ...config,
        provider: config.fallbackProvider,
        model: config.fallbackModel || config.model
      };
      this.fallbackService = this.createProvider(config.fallbackProvider, fallbackConfig);
    }
  }

  private createProvider(provider: string, config: AIServiceConfig): AIServiceProvider {
    switch (provider) {
      case 'ollama':
        return new OllamaProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  async evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore> {
    try {
      return await this.primaryService.evaluateFeedback(transcript, businessContext, purchaseItems);
    } catch (error) {
      console.warn(`Primary AI provider (${this.config.provider}) failed:`, error);
      
      if (this.fallbackService) {
        try {
          console.log(`Attempting fallback to ${this.config.fallbackProvider}`);
          return await this.fallbackService.evaluateFeedback(transcript, businessContext, purchaseItems);
        } catch (fallbackError) {
          console.error(`Fallback AI provider also failed:`, fallbackError);
        }
      }
      
      // Return default scoring if all providers fail
      return this.getDefaultQualityScore(transcript, "Both primary and fallback AI services failed");
    }
  }

  async generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<ConversationResponse> {
    try {
      return await this.primaryService.generateResponse(userInput, conversationHistory, businessContext);
    } catch (error) {
      console.warn(`Primary AI provider failed for conversation:`, error);
      
      if (this.fallbackService) {
        try {
          return await this.fallbackService.generateResponse(userInput, conversationHistory, businessContext);
        } catch (fallbackError) {
          console.error(`Fallback AI provider also failed:`, fallbackError);
        }
      }
      
      // Return fallback conversation response
      return {
        response: "Tack för din feedback. Kan du berätta mer om din upplevelse?",
        shouldContinue: conversationHistory.length < 4,
        confidence: 0.1
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    const primaryHealth = await this.primaryService.healthCheck();
    
    if (primaryHealth) {
      return true;
    }
    
    if (this.fallbackService) {
      return await this.fallbackService.healthCheck();
    }
    
    return false;
  }

  async getStatus(): Promise<{
    provider: string;
    model: string;
    available: boolean;
    latency?: number;
  }> {
    const primaryStatus = await this.primaryService.getStatus();
    
    if (primaryStatus.available) {
      return primaryStatus;
    }
    
    if (this.fallbackService) {
      const fallbackStatus = await this.fallbackService.getStatus();
      return {
        ...fallbackStatus,
        provider: `${primaryStatus.provider}(failed)->${fallbackStatus.provider}`
      };
    }
    
    return primaryStatus;
  }

  private getDefaultQualityScore(transcript: string, reason: string): QualityScore {
    // Basic heuristic scoring when AI fails
    const wordCount = transcript.split(/\s+/).length;
    const hasSpecificDetails = /\d+|krona|kr|tid|timme|minut|personal|service|kvalitet|bra|dålig|problem/i.test(transcript);
    
    const baseScore = Math.min(60, 30 + wordCount * 2);
    const specificityBonus = hasSpecificDetails ? 10 : 0;
    const score = Math.min(75, baseScore + specificityBonus);
    
    return {
      authenticity: score,
      concreteness: score - 5,
      depth: score - 10,
      total: score - 5,
      reasoning: `${reason}. Automatisk bedömning baserad på textanalys.`,
      categories: this.extractBasicCategories(transcript),
      sentiment: this.extractBasicSentiment(transcript)
    };
  }

  private extractBasicCategories(transcript: string): string[] {
    const categories: string[] = [];
    const text = transcript.toLowerCase();
    
    if (text.includes('personal') || text.includes('service') || text.includes('bemötande')) {
      categories.push('service');
    }
    if (text.includes('kvalitet') || text.includes('produkt') || text.includes('vara')) {
      categories.push('kvalitet');
    }
    if (text.includes('miljö') || text.includes('lokal') || text.includes('atmosfär')) {
      categories.push('miljö');
    }
    if (text.includes('pris') || text.includes('kostnad') || text.includes('billig') || text.includes('dyr')) {
      categories.push('pris');
    }
    if (text.includes('vänta') || text.includes('tid') || text.includes('snabb') || text.includes('långsam')) {
      categories.push('tid');
    }
    
    return categories.length > 0 ? categories : ['allmänt'];
  }

  private extractBasicSentiment(transcript: string): number {
    const text = transcript.toLowerCase();
    let sentiment = 0;
    
    const positive = ['bra', 'bättre', 'utmärkt', 'fantastisk', 'nöjd', 'glad', 'trevlig', 'vänlig'];
    const negative = ['dålig', 'sämre', 'hemskt', 'otrevlig', 'arg', 'besviken', 'problem', 'fel'];
    
    for (const word of positive) {
      if (text.includes(word)) sentiment += 0.2;
    }
    
    for (const word of negative) {
      if (text.includes(word)) sentiment -= 0.2;
    }
    
    return Math.max(-1, Math.min(1, sentiment));
  }
}

// Abstract base class for AI providers
abstract class AIServiceProvider implements AIService {
  protected config: AIServiceConfig;
  protected scoringEngine: ScoringEngine;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.scoringEngine = new ScoringEngine();
  }

  abstract evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore>;

  abstract generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<ConversationResponse>;

  abstract healthCheck(): Promise<boolean>;

  abstract getStatus(): Promise<{
    provider: string;
    model: string;
    available: boolean;
    latency?: number;
  }>;
}

// Ollama provider implementation
class OllamaProvider extends AIServiceProvider {
  private client: AxiosInstance;

  constructor(config: AIServiceConfig) {
    super(config);
    this.client = axios.create({
      baseURL: config.endpoint || 'http://localhost:11434',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore> {
    const prompt = this.scoringEngine.generateEvaluationPrompt(transcript, businessContext, purchaseItems);
    
    try {
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt,
        stream: false,
        temperature: this.config.temperature || 0.7
      });

      const evaluation = this.parseEvaluationResponse(response.data.response);
      
      const qualityScore: QualityScore = {
        authenticity: evaluation.authenticity,
        concreteness: evaluation.concreteness,
        depth: evaluation.depth,
        total: evaluation.total_score,
        reasoning: evaluation.reasoning,
        categories: evaluation.categories,
        sentiment: evaluation.sentiment
      };

      // Validate and adjust score for consistency
      return this.scoringEngine.validateAndAdjustScore(qualityScore);
    } catch (error) {
      throw new Error(`Ollama evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<ConversationResponse> {
    const prompt = this.scoringEngine.generateConversationPrompt(userInput, conversationHistory, businessContext);
    
    try {
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt,
        stream: false,
        temperature: 0.8
      });
      
      return {
        response: response.data.response.trim(),
        shouldContinue: this.shouldContinueConversation(response.data.response, conversationHistory.length),
        confidence: 0.8
      };
    } catch (error) {
      throw new Error(`Ollama conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data?.models || [];
      return models.some((model: any) => model.name.includes(this.config.model));
    } catch {
      return false;
    }
  }

  async getStatus() {
    const startTime = Date.now();
    const available = await this.healthCheck();
    const latency = available ? Date.now() - startTime : undefined;

    return {
      provider: 'ollama',
      model: this.config.model,
      available,
      latency
    };
  }


  private parseEvaluationResponse(responseText: string): AIEvaluationResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const required = ['authenticity', 'concreteness', 'depth', 'total_score', 'reasoning'];
      for (const field of required) {
        if (parsed[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      parsed.categories = parsed.categories || [];
      parsed.sentiment = parsed.sentiment || 0;

      return parsed;
    } catch (error) {
      console.error('Failed to parse evaluation response:', responseText);
      
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

  private shouldContinueConversation(response: string, historyLength: number): boolean {
    if (historyLength >= 6) return false;
    
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

// OpenAI provider implementation
class OpenAIProvider extends AIServiceProvider {
  private client: AxiosInstance;

  constructor(config: AIServiceConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore> {
    const prompt = this.scoringEngine.generateEvaluationPrompt(transcript, businessContext, purchaseItems);
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.data.choices[0].message.content;
      const evaluation = this.parseEvaluationResponse(content);
      
      const qualityScore: QualityScore = {
        authenticity: evaluation.authenticity,
        concreteness: evaluation.concreteness,
        depth: evaluation.depth,
        total: evaluation.total_score,
        reasoning: evaluation.reasoning,
        categories: evaluation.categories,
        sentiment: evaluation.sentiment
      };

      // Validate and adjust score for consistency
      return this.scoringEngine.validateAndAdjustScore(qualityScore);
    } catch (error) {
      throw new Error(`OpenAI evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<ConversationResponse> {
    const prompt = this.scoringEngine.generateConversationPrompt(userInput, conversationHistory, businessContext);
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 150
      });
      
      const responseText = response.data.choices[0].message.content.trim();
      
      return {
        response: responseText,
        shouldContinue: this.shouldContinueConversation(responseText, conversationHistory.length),
        confidence: 0.9
      };
    } catch (error) {
      throw new Error(`OpenAI conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private parseEvaluationResponse(responseText: string): AIEvaluationResponse {
    try {
      const parsed = JSON.parse(responseText);
      
      const required = ['authenticity', 'concreteness', 'depth', 'total_score', 'reasoning'];
      for (const field of required) {
        if (parsed[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      parsed.categories = parsed.categories || [];
      parsed.sentiment = parsed.sentiment || 0;

      return parsed;
    } catch (error) {
      console.error('Failed to parse OpenAI evaluation response:', responseText);
      
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

  private shouldContinueConversation(response: string, historyLength: number): boolean {
    if (historyLength >= 6) return false;
    
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

  async getStatus() {
    const startTime = Date.now();
    const available = await this.healthCheck();
    const latency = available ? Date.now() - startTime : undefined;

    return {
      provider: 'openai',
      model: this.config.model,
      available,
      latency
    };
  }
}

// Anthropic provider implementation
class AnthropicProvider extends AIServiceProvider {
  constructor(config: AIServiceConfig) {
    super(config);
    // TODO: Implement Anthropic provider
  }

  async evaluateFeedback(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): Promise<QualityScore> {
    throw new Error('Anthropic evaluation not yet implemented');
  }

  async generateResponse(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): Promise<ConversationResponse> {
    throw new Error('Anthropic conversation not yet implemented');
  }

  async healthCheck(): Promise<boolean> {
    return false; // TODO: Implement
  }

  async getStatus() {
    return {
      provider: 'anthropic',
      model: this.config.model,
      available: false,
      latency: undefined
    };
  }
}