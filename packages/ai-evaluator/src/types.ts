// AI Service Types
export interface BusinessContext {
  type: 'grocery_store' | 'cafe' | 'restaurant' | 'retail';
  layout?: {
    departments: string[];
    checkouts: number;
    selfCheckout: boolean;
  };
  staff?: Array<{
    name: string;
    role: string;
    department: string;
  }>;
  currentPromotions?: string[];
  knownIssues?: string[];
  strengths?: string[];
}

export interface QualityScore {
  authenticity: number;    // 0-100, weighted 40%
  concreteness: number;   // 0-100, weighted 30%  
  depth: number;         // 0-100, weighted 30%
  total: number;         // Overall score 0-100
  reasoning: string;     // AI explanation
  categories: string[];  // Feedback categories
  sentiment: number;     // -1 to 1
  confidence?: number;   // Optional confidence score 0-1
}

export interface RewardTier {
  min: number;
  max: number;
  rewardPercentage: [number, number]; // [min%, max%]
}

export interface AIEvaluationResponse {
  authenticity: number;
  concreteness: number;
  depth: number;
  total_score: number;
  reasoning: string;
  categories: string[];
  sentiment: number;
}

export interface ConversationResponse {
  response: string;
  shouldContinue: boolean;
  confidence: number;
}

export interface AIServiceConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  model: string;
  endpoint?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackProvider?: 'ollama' | 'openai' | 'anthropic';
  fallbackModel?: string;
}

// Ollama specific types
export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  options?: {
    num_predict?: number;
    num_ctx?: number;
    top_k?: number;
    top_p?: number;
    repeat_penalty?: number;
    stop?: string[];
  };
}

export interface OllamaResponse {
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}