import { 
  BusinessContextData, 
  ContextValidationResult, 
  BusinessLayoutData,
  StaffData,
  ProductsData,
  OperationsData,
  CustomerPatternsData
} from '../business-types/context';

export interface ValidationRule {
  field: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  validator?: (value: any) => boolean | string;
  message?: string;
}

export interface CategoryValidation {
  category: string;
  title: string;
  weight: number; // Weight in overall completion score
  rules: ValidationRule[];
}

const VALIDATION_RULES: CategoryValidation[] = [
  {
    category: 'layout',
    title: 'Butikslayout & Avdelningar',
    weight: 25,
    rules: [
      {
        field: 'departments',
        required: true,
        minLength: 1,
        message: 'Lägg till åtminstone en avdelning'
      },
      {
        field: 'checkouts',
        required: true,
        validator: (value: number) => value >= 1,
        message: 'Antal kassor måste vara minst 1'
      },
      {
        field: 'specialAreas',
        required: false,
        message: 'Specialområden hjälper till att verifiera autentisk feedback'
      }
    ]
  },
  {
    category: 'staff',
    title: 'Personal',
    weight: 25,
    rules: [
      {
        field: 'employees',
        required: true,
        minLength: 1,
        validator: (employees: any[]) => {
          return employees.every(emp => emp.name && emp.name.trim().length > 0);
        },
        message: 'Lägg till åtminstone en anställd med namn'
      }
    ]
  },
  {
    category: 'products',
    title: 'Produkter & Tjänster',
    weight: 20,
    rules: [
      {
        field: 'categories',
        required: true,
        minLength: 1,
        message: 'Lägg till åtminstone en produktkategori'
      },
      {
        field: 'popularItems',
        required: false,
        message: 'Populära produkter hjälper AI:n att förstå relevant feedback'
      },
      {
        field: 'notOffered',
        required: false,
        message: 'Produkter som INTE erbjuds hjälper till att upptäcka falsk feedback'
      }
    ]
  },
  {
    category: 'operations',
    title: 'Drift & Öppettider',
    weight: 20,
    rules: [
      {
        field: 'hours',
        required: true,
        validator: (hours: Record<string, any>) => {
          return Object.values(hours).some(h => h.open || h.close);
        },
        message: 'Ange öppettider för åtminstone en dag'
      },
      {
        field: 'peakTimes',
        required: false,
        message: 'Topptider hjälper till att validera feedback-timing'
      },
      {
        field: 'challenges',
        required: false,
        message: 'Kända utmaningar hjälper AI:n att förstå legitima klagomål'
      }
    ]
  },
  {
    category: 'customerPatterns',
    title: 'Kundmönster',
    weight: 10,
    rules: [
      {
        field: 'commonQuestions',
        required: false,
        message: 'Vanliga frågor hjälper till att verifiera autentiska interaktioner'
      },
      {
        field: 'frequentComplaints',
        required: false,
        message: 'Vanliga klagomål hjälper AI:n att identifiera legitima problem'
      }
    ]
  }
];

export function validateContextCategory(
  categoryData: any,
  categoryValidation: CategoryValidation
): { isValid: boolean; score: number; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let maxScore = 0;

  for (const rule of categoryValidation.rules) {
    maxScore++;
    const value = categoryData?.[rule.field];

    // Check if required field is missing
    if (rule.required) {
      if (value === undefined || value === null || value === '') {
        errors.push(rule.message || `${rule.field} är obligatoriskt`);
        continue;
      }

      if (Array.isArray(value) && value.length === 0) {
        errors.push(rule.message || `${rule.field} får inte vara tom`);
        continue;
      }
    }

    // Check minimum length for arrays and strings
    if (rule.minLength && value) {
      const length = Array.isArray(value) ? value.length : value.toString().length;
      if (length < rule.minLength) {
        errors.push(rule.message || `${rule.field} måste ha minst ${rule.minLength} element/tecken`);
        continue;
      }
    }

    // Check maximum length for arrays and strings
    if (rule.maxLength && value) {
      const length = Array.isArray(value) ? value.length : value.toString().length;
      if (length > rule.maxLength) {
        errors.push(`${rule.field} får inte ha mer än ${rule.maxLength} element/tecken`);
        continue;
      }
    }

    // Run custom validator
    if (rule.validator && value !== undefined && value !== null) {
      const result = rule.validator(value);
      if (result === false) {
        errors.push(rule.message || `${rule.field} är ogiltigt`);
        continue;
      } else if (typeof result === 'string') {
        errors.push(result);
        continue;
      }
    }

    // Field is valid
    if (value !== undefined && value !== null && 
        (Array.isArray(value) ? value.length > 0 : value.toString().trim().length > 0)) {
      score++;
    } else if (!rule.required && rule.message) {
      // Optional field with helpful message
      warnings.push(rule.message);
    }
  }

  return {
    isValid: errors.length === 0,
    score: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    errors,
    warnings
  };
}

export function validateBusinessContext(contextData: Partial<BusinessContextData>): ContextValidationResult {
  const missingFields: string[] = [];
  const suggestions: string[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  const categoryResults: Record<string, any> = {};

  for (const categoryValidation of VALIDATION_RULES) {
    const categoryData = contextData[categoryValidation.category as keyof BusinessContextData];
    const result = validateContextCategory(categoryData, categoryValidation);
    
    categoryResults[categoryValidation.category] = result;
    totalWeightedScore += result.score * categoryValidation.weight;
    totalWeight += categoryValidation.weight * 100; // 100 is max score per category

    // Collect missing required fields
    if (result.errors.length > 0) {
      missingFields.push(...result.errors.map(error => `${categoryValidation.category}: ${error}`));
    }

    // Collect warnings as suggestions
    if (result.warnings.length > 0) {
      suggestions.push(...result.warnings);
    }
  }

  const completionScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

  return {
    isValid: missingFields.length === 0,
    completionScore,
    missingFields,
    suggestions,
    // @ts-ignore - Adding extra data for detailed analysis
    categoryResults
  };
}

export function getContextCompletionSuggestions(
  contextData: Partial<BusinessContextData>
): string[] {
  const suggestions: string[] = [];

  // Layout suggestions
  if (!contextData.layout?.departments || contextData.layout.departments.length === 0) {
    suggestions.push('🏪 Lägg till butikens avdelningar (t.ex. "Frukt & Grönt", "Mejeri", "Kött & Fisk")');
  }
  
  if (!contextData.layout?.specialAreas || contextData.layout.specialAreas.length === 0) {
    suggestions.push('⭐ Lägg till eventuella specialområden (t.ex. "Apotek", "Post", "Återvinning")');
  }

  // Staff suggestions
  if (!contextData.staff?.employees || contextData.staff.employees.length === 0) {
    suggestions.push('👥 Lägg till personalnamn för att kunna verifiera autentiska kundinteraktioner');
  } else {
    const employeesWithoutDepartment = contextData.staff.employees.filter(emp => !emp.department);
    if (employeesWithoutDepartment.length > 0) {
      suggestions.push('📋 Tilldela avdelningar till all personal för bättre kontext');
    }
  }

  // Products suggestions
  if (!contextData.products?.categories || contextData.products.categories.length === 0) {
    suggestions.push('📦 Lägg till produktkategorier för bättre feedback-kategorisering');
  }
  
  if (!contextData.products?.notOffered || contextData.products.notOffered.length === 0) {
    suggestions.push('❌ Lägg till produkter/tjänster ni INTE erbjuder för att upptäcka falsk feedback');
  }

  // Operations suggestions
  const hasValidHours = contextData.operations?.hours && 
    Object.values(contextData.operations.hours).some(hours => hours.open || hours.close);
  
  if (!hasValidHours) {
    suggestions.push('🕐 Ange öppettider för tidsmässig validering av feedback');
  }
  
  if (!contextData.operations?.peakTimes || contextData.operations.peakTimes.length === 0) {
    suggestions.push('⏰ Lägg till information om topptider (t.ex. "Lunch 11:30-13:00", "Efter jobbet 16-18")');
  }

  // Customer patterns suggestions
  if (!contextData.customerPatterns?.commonQuestions || contextData.customerPatterns.commonQuestions.length === 0) {
    suggestions.push('❓ Lägg till vanliga kundfrågor för att verifiera autentiska interaktioner');
  }

  return suggestions;
}

export function generateContextTemplate(businessType: string): Partial<BusinessContextData> {
  const templates: Record<string, Partial<BusinessContextData>> = {
    'grocery_store': {
      layout: {
        departments: ['Frukt & Grönt', 'Mejeri', 'Kött & Fisk', 'Bageri', 'Torrvaror', 'Fryst'],
        checkouts: 3,
        selfCheckout: true,
        specialAreas: ['Apotek', 'Post', 'Återvinning']
      },
      products: {
        categories: ['Färskvaror', 'Dagligvaror', 'Hushållsprodukter', 'Drycker'],
        popularItems: ['Mjölk', 'Bröd', 'Ägg', 'Bananer'],
        notOffered: ['Tobak', 'Alkohol över 3.5%'],
        seasonal: ['Julmat', 'Påskmust', 'Grillkol']
      }
    },
    'cafe_restaurant': {
      layout: {
        departments: ['Kök', 'Servering', 'Bar', 'Utomhusservering'],
        checkouts: 1,
        selfCheckout: false,
        specialAreas: ['Terrass', 'Privatrum']
      },
      products: {
        categories: ['Kaffe', 'Te', 'Smörgåsar', 'Sallader', 'Desserter'],
        popularItems: ['Cappuccino', 'Macka med skinka', 'Kladdkaka'],
        notOffered: ['Alkohol', 'Varm mat efter 15:00'],
        seasonal: ['Glögg', 'Is', 'Uteservering']
      }
    },
    'retail_store': {
      layout: {
        departments: ['Herr', 'Dam', 'Barn', 'Skor', 'Accessoarer'],
        checkouts: 2,
        selfCheckout: false,
        specialAreas: ['Provrum', 'Kundservice']
      },
      products: {
        categories: ['Kläder', 'Skor', 'Accessoarer'],
        popularItems: ['Jeans', 'T-shirts', 'Sneakers'],
        notOffered: ['Underkläder', 'Badkläder'],
        seasonal: ['Vinterjackor', 'Sommartoppar', 'Skolkläder']
      }
    }
  };

  return templates[businessType] || templates['retail_store'];
}

export function getContextQualityScore(contextData: BusinessContextData): {
  overall: number;
  categories: Record<string, number>;
  recommendations: string[];
} {
  const validation = validateBusinessContext(contextData);
  const recommendations = getContextCompletionSuggestions(contextData);

  return {
    overall: validation.completionScore,
    categories: validation.categoryResults ? 
      Object.fromEntries(
        Object.entries(validation.categoryResults).map(([key, result]) => [key, result.score])
      ) : {},
    recommendations
  };
}