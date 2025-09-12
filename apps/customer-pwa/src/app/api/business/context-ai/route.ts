import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase client only if env vars are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ContextSuggestion {
  type: 'add' | 'remove' | 'modify';
  field: string;
  value: any;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface AIRequest {
  message: string;
  contextData: any;
  businessId: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// In-memory conversation storage (should be replaced with database in production)
const conversationMemory = new Map<string, Array<{ role: string; content: string }>>();

export async function POST(request: NextRequest) {
  try {
    const { message, contextData, businessId, conversationHistory } = await request.json() as AIRequest;

    // Verify authentication
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or initialize conversation memory for this business
    let memory = conversationMemory.get(businessId) || [];
    
    // Add conversation history if provided (for session continuity)
    if (conversationHistory && conversationHistory.length > 0) {
      memory = conversationHistory;
    }

    // Analyze context to identify gaps and generate suggestions
    const contextAnalysis = analyzeBusinessContext(contextData);
    const suggestions = contextAnalysis.suggestions;
    
    // Build system prompt with business context understanding
    const systemPrompt = buildSystemPrompt(contextData, contextAnalysis);
    
    // Prepare messages for OpenAI
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      // Include conversation history for context
      ...memory.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call OpenAI GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "text" }
    });

    const aiResponse = completion.choices[0].message.content || 'Jag kunde inte generera ett svar just nu.';

    // Update conversation memory
    memory.push({ role: 'user', content: message });
    memory.push({ role: 'assistant', content: aiResponse });
    
    // Keep only last 50 messages in memory
    if (memory.length > 50) {
      memory = memory.slice(-50);
    }
    
    conversationMemory.set(businessId, memory);

    // Save context state to database if significant suggestions were made
    if (suggestions.length > 0 && supabase) {
      await saveContextState(businessId, contextData, suggestions);
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      suggestions: suggestions
    });
  } catch (error) {
    console.error('Context AI error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(contextData: any, analysis: any): string {
  const { completionScore, missingCritical, missingImportant } = analysis;
  
  return `Du är en AI-assistent specialiserad på att hjälpa svenska företag att optimera sin kontextdata för bättre kundinsikter och AI-analys. Du kommunicerar på svenska och är vänlig, professionell och hjälpsam.

## Din roll:
- Analysera och förbättra företagskontextdata
- Identifiera luckor och föreslå förbättringar
- Ge konkreta, handlingsbara råd
- Hjälpa företag förstå värdet av komplett kontextdata
- Validera att information är korrekt och konsistent

## Aktuell kontextstatus:
- Komplettering: ${completionScore}%
- Kritiska fält som saknas: ${missingCritical.join(', ') || 'Inga'}
- Viktiga fält som saknas: ${missingImportant.join(', ') || 'Inga'}

## Företagets nuvarande kontext:
${JSON.stringify(contextData, null, 2)}

## Dina uppgifter:
1. **Identifiera luckor**: Hitta vad som saknas eller kan förbättras
2. **Ge specifika förslag**: Föreslå konkreta värden och exempel
3. **Förklara värdet**: Hjälp företaget förstå varför varje del är viktig
4. **Validera konsistens**: Kontrollera att information är logisk och sammanhängande
5. **Anpassa till bransch**: Ge branschspecifika råd baserat på företagstyp

## Svarsformat:
- Var konkret och specifik
- Använd exempel från svensk detaljhandel
- Förklara hur förbättringar påverkar kundanalys
- Prioritera de viktigaste förbättringarna först
- Använd emojis sparsamt för att göra texten mer lättläst

## Viktiga principer:
- Personalnamn ska bara vara förnamn (GDPR)
- Öppettider ska vara realistiska för svensk handel
- Produktkategorier ska vara relevanta för företagstypen
- Vanliga frågor ska reflektera verkliga kundinteraktioner`;
}

interface ContextAnalysis {
  completionScore: number;
  missingCritical: string[];
  missingImportant: string[];
  suggestions: ContextSuggestion[];
}

function analyzeBusinessContext(contextData: any): ContextAnalysis {
  const suggestions: ContextSuggestion[] = [];
  const missingCritical: string[] = [];
  const missingImportant: string[] = [];
  let totalFields = 0;
  let completedFields = 0;

  // Critical: Layout and departments
  if (!contextData.layout || !contextData.layout.departments || contextData.layout.departments.length === 0) {
    missingCritical.push('Avdelningar');
    suggestions.push({
      type: 'add',
      field: 'layout.departments',
      value: detectDepartmentsByBusinessType(contextData),
      reason: 'Avdelningar är kritiska för att AI:n ska förstå butikens struktur och kunna analysera avdelningsspecifik feedback',
      priority: 'high'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Critical: Staff information
  if (!contextData.staff || !contextData.staff.employees || contextData.staff.employees.length === 0) {
    missingCritical.push('Personal');
    suggestions.push({
      type: 'add',
      field: 'staff.employees',
      value: [
        { name: 'Anna', role: 'Butikschef', department: 'Ledning' },
        { name: 'Erik', role: 'Säljare', department: 'Butik' },
        { name: 'Maria', role: 'Kassör', department: 'Kassa' }
      ],
      reason: 'Personalinformation hjälper AI:n validera äkta feedback och analysera servicekvalitet',
      priority: 'high'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Critical: Product categories
  if (!contextData.products || !contextData.products.categories || contextData.products.categories.length === 0) {
    missingCritical.push('Produktkategorier');
    suggestions.push({
      type: 'add',
      field: 'products.categories',
      value: detectProductCategoriesByBusinessType(contextData),
      reason: 'Produktkategorier är nödvändiga för att kategorisera och analysera produktrelaterad feedback',
      priority: 'high'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Critical: Opening hours
  const hasNoHours = !contextData.operations || !contextData.operations.hours || 
    Object.values(contextData.operations.hours || {}).every((h: any) => !h.open && !h.close);
  
  if (hasNoHours) {
    missingCritical.push('Öppettider');
    suggestions.push({
      type: 'add',
      field: 'operations.hours',
      value: generateDefaultHours(),
      reason: 'Öppettider är kritiska för att validera när feedback ges och analysera tidsmönster',
      priority: 'high'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Important: Peak times
  if (!contextData.operations || !contextData.operations.peakTimes || contextData.operations.peakTimes.length === 0) {
    missingImportant.push('Rusningstider');
    suggestions.push({
      type: 'add',
      field: 'operations.peakTimes',
      value: ['08:00-09:00', '12:00-13:00', '16:00-18:00'],
      reason: 'Rusningstider hjälper att förstå när mest personal behövs och när köer uppstår',
      priority: 'medium'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Important: Common questions
  if (!contextData.customerPatterns || !contextData.customerPatterns.commonQuestions || 
      contextData.customerPatterns.commonQuestions.length === 0) {
    missingImportant.push('Vanliga frågor');
    suggestions.push({
      type: 'add',
      field: 'customerPatterns.commonQuestions',
      value: [
        'Var hittar jag...?',
        'Har ni... i lager?',
        'När får ni in...?',
        'Kan jag returnera...?'
      ],
      reason: 'Vanliga frågor tränar AI:n att bättre förstå och kategorisera kundfeedback',
      priority: 'medium'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Important: Popular items
  if (!contextData.products || !contextData.products.popularItems || contextData.products.popularItems.length === 0) {
    missingImportant.push('Populära produkter');
    suggestions.push({
      type: 'add',
      field: 'products.popularItems',
      value: detectPopularItemsByBusinessType(contextData),
      reason: 'Populära produkter hjälper AI:n identifiera viktiga produkter i feedback',
      priority: 'medium'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Important: Checkout configuration
  if (!contextData.layout || !contextData.layout.checkouts || contextData.layout.checkouts < 1) {
    missingImportant.push('Antal kassor');
    suggestions.push({
      type: 'modify',
      field: 'layout.checkouts',
      value: 3,
      reason: 'Antal kassor påverkar köanalyser och personalplanering',
      priority: 'medium'
    });
  } else {
    completedFields++;
  }
  totalFields++;

  // Calculate completion score
  const completionScore = Math.round((completedFields / totalFields) * 100);

  // Advanced suggestions based on existing data
  if (contextData.staff?.employees?.length > 0 && contextData.staff.employees.length < 3) {
    suggestions.push({
      type: 'add',
      field: 'staff.employees',
      value: { name: 'Ny medarbetare', role: 'Deltidsanställd', department: 'Butik' },
      reason: 'Fler medarbetare ger bättre förståelse för personalrotation och schemaläggning',
      priority: 'low'
    });
  }

  // Check for seasonal products if none exist
  if (contextData.products && (!contextData.products.seasonal || contextData.products.seasonal.length === 0)) {
    suggestions.push({
      type: 'add',
      field: 'products.seasonal',
      value: ['Jordgubbar (sommar)', 'Julmust (vinter)', 'Semlor (februari-mars)', 'Kräftor (augusti)'],
      reason: 'Säsongsvaror hjälper AI:n förstå säsongsbetonade köpmönster',
      priority: 'low'
    });
  }

  return {
    completionScore,
    missingCritical,
    missingImportant,
    suggestions
  };
}

function detectDepartmentsByBusinessType(contextData: any): string[] {
  // Try to infer business type from existing data
  const hasFood = contextData.products?.categories?.some((c: string) => 
    c.toLowerCase().includes('livsmedel') || c.toLowerCase().includes('mat'));
  
  if (hasFood) {
    return ['Frukt & Grönt', 'Mejeri', 'Kött & Fisk', 'Bröd', 'Torrvaror', 'Frysvaror'];
  }
  
  // Default departments for general retail
  return ['Entré', 'Huvudavdelning', 'Kampanjyta', 'Kassa', 'Lager'];
}

function detectProductCategoriesByBusinessType(contextData: any): string[] {
  // Check if it's a grocery store based on departments
  const hasGroceryDepts = contextData.layout?.departments?.some((d: string) => 
    d.toLowerCase().includes('frukt') || d.toLowerCase().includes('mejeri'));
  
  if (hasGroceryDepts) {
    return ['Livsmedel', 'Färskvaror', 'Frysvaror', 'Drycker', 'Hushållsprodukter', 'Hygienartiklar'];
  }
  
  // Default categories for general retail
  return ['Huvudprodukter', 'Tillbehör', 'Kampanjvaror', 'Säsongsvaror', 'Tjänster'];
}

function detectPopularItemsByBusinessType(contextData: any): string[] {
  // Check product categories to determine business type
  const categories = contextData.products?.categories || [];
  const hasFood = categories.some((c: string) => 
    c.toLowerCase().includes('livsmedel') || c.toLowerCase().includes('mat'));
  
  if (hasFood) {
    return ['Mjölk', 'Bröd', 'Ägg', 'Bananer', 'Kaffe'];
  }
  
  // Default popular items
  return ['Toppssäljare 1', 'Toppssäljare 2', 'Toppssäljare 3'];
}

function generateDefaultHours() {
  return {
    monday: { open: '09:00', close: '20:00', closed: false },
    tuesday: { open: '09:00', close: '20:00', closed: false },
    wednesday: { open: '09:00', close: '20:00', closed: false },
    thursday: { open: '09:00', close: '20:00', closed: false },
    friday: { open: '09:00', close: '21:00', closed: false },
    saturday: { open: '09:00', close: '18:00', closed: false },
    sunday: { open: '11:00', close: '17:00', closed: false }
  };
}

async function saveContextState(businessId: string, contextData: any, suggestions: ContextSuggestion[]) {
  if (!supabase) return;
  
  try {
    // Save context state for analytics and improvement tracking
    await supabase.from('business_context_states').upsert({
      business_id: businessId,
      context_data: contextData,
      suggestions_made: suggestions,
      completion_score: calculateCompletionScore(contextData),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save context state:', error);
  }
}

function calculateCompletionScore(contextData: any): number {
  let totalFields = 0;
  let completedFields = 0;

  // Count layout fields
  totalFields += 4;
  if (contextData.layout?.departments?.length > 0) completedFields++;
  if (contextData.layout?.checkouts > 0) completedFields++;
  if (contextData.layout?.specialAreas?.length > 0) completedFields++;
  if (contextData.layout?.selfCheckout !== undefined) completedFields++;

  // Count staff fields
  totalFields += 1;
  if (contextData.staff?.employees?.length > 0) completedFields++;

  // Count products fields
  totalFields += 4;
  if (contextData.products?.categories?.length > 0) completedFields++;
  if (contextData.products?.popularItems?.length > 0) completedFields++;
  if (contextData.products?.seasonal?.length > 0) completedFields++;
  if (contextData.products?.notOffered?.length > 0) completedFields++;

  // Count operations fields
  totalFields += 3;
  const hasHours = contextData.operations?.hours && 
    Object.values(contextData.operations.hours).some((h: any) => h.open || h.close);
  if (hasHours) completedFields++;
  if (contextData.operations?.peakTimes?.length > 0) completedFields++;
  if (contextData.operations?.challenges?.length > 0) completedFields++;

  // Count customer patterns fields
  totalFields += 2;
  if (contextData.customerPatterns?.commonQuestions?.length > 0) completedFields++;
  if (contextData.customerPatterns?.frequentComplaints?.length > 0) completedFields++;

  return Math.round((completedFields / totalFields) * 100);
}