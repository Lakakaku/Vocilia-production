/**
 * Business Context Data Types
 * Comprehensive type definitions for business context management
 */

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
}

export interface BusinessHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface BusinessLayoutData {
  departments: string[];
  checkouts: number;
  selfCheckout: boolean;
  specialAreas: string[];
}

export interface StaffData {
  employees: StaffMember[];
}

export interface ProductsData {
  categories: string[];
  seasonal: string[];
  notOffered: string[];
  popularItems: string[];
}

export interface OperationsData {
  hours: Record<string, BusinessHours>;
  peakTimes: string[];
  challenges: string[];
  improvements: string[];
  commonProcedures: string[];
}

export interface CustomerPatternsData {
  commonQuestions: string[];
  frequentComplaints: string[];
  seasonalPatterns: string[];
  positivePatterns: string[];
  customerDemographics: string[];
}

export interface BusinessContextData {
  layout: BusinessLayoutData;
  staff: StaffData;
  products: ProductsData;
  operations: OperationsData;
  customerPatterns: CustomerPatternsData;
  lastUpdated?: string;
  completionScore?: number;
  version?: number;
}

export interface ContextValidationResult {
  isValid: boolean;
  completionScore: number;
  missingFields: string[];
  suggestions: string[];
}

export interface ContextCategory {
  id: keyof BusinessContextData;
  title: string;
  description: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
  fields: ContextField[];
}

export interface ContextField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'array' | 'number' | 'boolean' | 'time' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
  helpText?: string;
  validation?: (value: any) => boolean | string;
}

// Business type specific context templates
export interface BusinessTypeTemplate {
  businessType: string;
  template: Partial<BusinessContextData>;
  requiredFields: string[];
  suggestedFields: string[];
}

// Context conversation for AI-powered assistance
export interface ContextMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  category?: string;
  suggestions?: string[];
}

export interface ContextConversation {
  id: string;
  businessId: string;
  conversationType: 'onboarding' | 'optimization' | 'update';
  status: 'active' | 'completed' | 'paused';
  messages: ContextMessage[];
  contextGapsIdentified: string[];
  questionsAsked: number;
  informationExtracted: Record<string, any>;
  completionScore: number;
  startedAt: string;
  lastMessageAt: string;
}

// Export/Import types
export interface ContextExport {
  businessId: string;
  businessName: string;
  contextData: BusinessContextData;
  exportedAt: string;
  version: string;
}

export interface ContextImport {
  contextData: Partial<BusinessContextData>;
  overwriteExisting: boolean;
  selectedCategories: string[];
}

// API response types
export interface ContextApiResponse {
  success: boolean;
  data?: BusinessContextData;
  error?: string;
  validationResult?: ContextValidationResult;
}

export interface UpdateContextPayload {
  contextData: Partial<BusinessContextData>;
  category?: string;
  incrementalUpdate: boolean;
}