'use client';

import { useState } from 'react';
import { 
  Building2, 
  Users, 
  Package, 
  Clock, 
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Trash2
} from 'lucide-react';
import { BusinessContextData, StaffMember } from '../../business-types/context';

interface ContextManagerProps {
  contextData: BusinessContextData;
  onChange: (data: BusinessContextData) => void;
  completionScore: number;
}

interface ContextSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isRequired: boolean;
}

const contextSections: ContextSection[] = [
  {
    id: 'layout',
    title: 'Butikslayout & Avdelningar',
    description: 'Fysisk layout, avdelningar och specialområden',
    icon: Building2,
    color: 'blue',
    isRequired: true
  },
  {
    id: 'staff',
    title: 'Personal',
    description: 'Personalinformation och roller',
    icon: Users,
    color: 'green',
    isRequired: true
  },
  {
    id: 'products',
    title: 'Produkter & Tjänster',
    description: 'Produktkategorier och specialerbjudanden',
    icon: Package,
    color: 'purple',
    isRequired: true
  },
  {
    id: 'operations',
    title: 'Drift & Öppettider',
    description: 'Öppettider, topptider och utmaningar',
    icon: Clock,
    color: 'orange',
    isRequired: true
  },
  {
    id: 'customerPatterns',
    title: 'Kundmönster',
    description: 'Vanliga frågor och beteendemönster',
    icon: MessageSquare,
    color: 'indigo',
    isRequired: false
  }
];

export function ContextManager({ contextData, onChange, completionScore }: ContextManagerProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('layout');
  const [editingStaff, setEditingStaff] = useState<string | null>(null);

  const updateContextData = (section: string, data: any) => {
    onChange({
      ...contextData,
      [section]: {
        ...contextData[section as keyof BusinessContextData],
        ...data
      }
    });
  };

  const addArrayItem = (section: string, field: string, value: string = '') => {
    const currentArray = (contextData[section as keyof BusinessContextData] as any)[field] || [];
    updateContextData(section, {
      [field]: [...currentArray, value]
    });
  };

  const removeArrayItem = (section: string, field: string, index: number) => {
    const currentArray = (contextData[section as keyof BusinessContextData] as any)[field] || [];
    updateContextData(section, {
      [field]: currentArray.filter((_: any, i: number) => i !== index)
    });
  };

  const updateArrayItem = (section: string, field: string, index: number, value: string) => {
    const currentArray = (contextData[section as keyof BusinessContextData] as any)[field] || [];
    updateContextData(section, {
      [field]: currentArray.map((item: string, i: number) => i === index ? value : item)
    });
  };

  const getSectionCompletion = (sectionId: string): number => {
    switch (sectionId) {
      case 'layout':
        const layout = contextData.layout;
        let score = 0;
        if (layout.departments.length > 0) score += 40;
        if (layout.checkouts > 0) score += 20;
        if (layout.specialAreas.length > 0) score += 40;
        return score;

      case 'staff':
        return contextData.staff.employees.length > 0 ? 100 : 0;

      case 'products':
        const products = contextData.products;
        let prodScore = 0;
        if (products.categories.length > 0) prodScore += 50;
        if (products.popularItems.length > 0) prodScore += 30;
        if (products.notOffered.length > 0) prodScore += 20;
        return prodScore;

      case 'operations':
        const ops = contextData.operations;
        let opsScore = 0;
        const hasHours = Object.values(ops.hours).some(h => h.open || h.close);
        if (hasHours) opsScore += 50;
        if (ops.peakTimes.length > 0) opsScore += 30;
        if (ops.challenges.length > 0) opsScore += 20;
        return opsScore;

      case 'customerPatterns':
        const patterns = contextData.customerPatterns;
        let patternScore = 0;
        if (patterns.commonQuestions.length > 0) patternScore += 50;
        if (patterns.frequentComplaints.length > 0) patternScore += 30;
        if (patterns.seasonalPatterns.length > 0) patternScore += 20;
        return patternScore;

      default:
        return 0;
    }
  };

  const renderArrayEditor = (
    section: string, 
    field: string, 
    items: string[], 
    title: string,
    placeholder: string = ''
  ) => (
    <div>
      <h4 className="text-sm font-medium text-gray-900 mb-2">{title}</h4>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={item}
              onChange={(e) => updateArrayItem(section, field, index, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder={placeholder}
            />
            <button
              onClick={() => removeArrayItem(section, field, index)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => addArrayItem(section, field)}
          className="flex items-center space-x-2 px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Lägg till</span>
        </button>
      </div>
    </div>
  );

  const renderLayoutSection = () => (
    <div className="space-y-6">
      {/* Departments */}
      {renderArrayEditor('layout', 'departments', contextData.layout.departments, 'Avdelningar', 'T.ex. Frukt & Grönt')}

      {/* Checkouts */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Antal kassor</h4>
        <input
          type="number"
          min="1"
          value={contextData.layout.checkouts}
          onChange={(e) => updateContextData('layout', { checkouts: parseInt(e.target.value) || 1 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Self-checkout */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={contextData.layout.selfCheckout}
            onChange={(e) => updateContextData('layout', { selfCheckout: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-900">Självscanning/Självkassa</span>
        </label>
      </div>

      {/* Special areas */}
      {renderArrayEditor('layout', 'specialAreas', contextData.layout.specialAreas, 'Specialområden', 'T.ex. Apotek, Deli')}
    </div>
  );

  const renderStaffSection = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-900">Personallista</h4>
        <button
          onClick={() => {
            const newEmployee: StaffMember = {
              id: Date.now().toString(),
              name: '',
              role: '',
              department: ''
            };
            updateContextData('staff', { 
              employees: [...contextData.staff.employees, newEmployee] 
            });
          }}
          className="flex items-center space-x-2 px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Lägg till personal</span>
        </button>
      </div>

      <div className="space-y-4">
        {contextData.staff.employees.map((employee, index) => (
          <div key={employee.id} className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Namn</label>
                <input
                  type="text"
                  value={employee.name}
                  onChange={(e) => {
                    const updatedEmployees = contextData.staff.employees.map((emp, i) =>
                      i === index ? { ...emp, name: e.target.value } : emp
                    );
                    updateContextData('staff', { employees: updatedEmployees });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Förnamn"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Roll</label>
                <input
                  type="text"
                  value={employee.role}
                  onChange={(e) => {
                    const updatedEmployees = contextData.staff.employees.map((emp, i) =>
                      i === index ? { ...emp, role: e.target.value } : emp
                    );
                    updateContextData('staff', { employees: updatedEmployees });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="T.ex. Kassör"
                />
              </div>
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Avdelning</label>
                  <select
                    value={employee.department}
                    onChange={(e) => {
                      const updatedEmployees = contextData.staff.employees.map((emp, i) =>
                        i === index ? { ...emp, department: e.target.value } : emp
                      );
                      updateContextData('staff', { employees: updatedEmployees });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Välj avdelning</option>
                    {contextData.layout.departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    const updatedEmployees = contextData.staff.employees.filter((_, i) => i !== index);
                    updateContextData('staff', { employees: updatedEmployees });
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {contextData.staff.employees.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Inga anställda tillagda ännu</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderProductsSection = () => (
    <div className="space-y-6">
      {renderArrayEditor('products', 'categories', contextData.products.categories, 'Huvudkategorier', 'T.ex. Livsmedel')}
      {renderArrayEditor('products', 'popularItems', contextData.products.popularItems, 'Populära produkter', 'T.ex. Färsk fisk')}
      {renderArrayEditor('products', 'seasonal', contextData.products.seasonal, 'Säsongsprodukter', 'T.ex. Julmat')}
      {renderArrayEditor('products', 'notOffered', contextData.products.notOffered, 'Erbjuds INTE', 'T.ex. Alkohol')}
    </div>
  );

  const renderOperationsSection = () => {
    const days = [
      { key: 'monday', label: 'Måndag' },
      { key: 'tuesday', label: 'Tisdag' },
      { key: 'wednesday', label: 'Onsdag' },
      { key: 'thursday', label: 'Torsdag' },
      { key: 'friday', label: 'Fredag' },
      { key: 'saturday', label: 'Lördag' },
      { key: 'sunday', label: 'Söndag' }
    ];

    return (
      <div className="space-y-6">
        {/* Business hours */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-4">Öppettider</h4>
          <div className="space-y-3">
            {days.map(day => (
              <div key={day.key} className="flex items-center space-x-4">
                <div className="w-20">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={!contextData.operations.hours[day.key]?.closed}
                      onChange={(e) => updateContextData('operations', {
                        hours: {
                          ...contextData.operations.hours,
                          [day.key]: {
                            ...contextData.operations.hours[day.key],
                            closed: !e.target.checked
                          }
                        }
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span className="text-sm text-gray-700">{day.label}</span>
                  </label>
                </div>
                {!contextData.operations.hours[day.key]?.closed && (
                  <>
                    <input
                      type="time"
                      value={contextData.operations.hours[day.key]?.open || ''}
                      onChange={(e) => updateContextData('operations', {
                        hours: {
                          ...contextData.operations.hours,
                          [day.key]: {
                            ...contextData.operations.hours[day.key],
                            open: e.target.value
                          }
                        }
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-gray-500">till</span>
                    <input
                      type="time"
                      value={contextData.operations.hours[day.key]?.close || ''}
                      onChange={(e) => updateContextData('operations', {
                        hours: {
                          ...contextData.operations.hours,
                          [day.key]: {
                            ...contextData.operations.hours[day.key],
                            close: e.target.value
                          }
                        }
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {renderArrayEditor('operations', 'peakTimes', contextData.operations.peakTimes, 'Topptider', 'T.ex. Lunch 12-13')}
        {renderArrayEditor('operations', 'challenges', contextData.operations.challenges, 'Kända utmaningar', 'T.ex. Långa köer på fredag')}
        {renderArrayEditor('operations', 'improvements', contextData.operations.improvements, 'Pågående förbättringar', 'T.ex. Ny kassasystem')}
      </div>
    );
  };

  const renderCustomerPatternsSection = () => (
    <div className="space-y-6">
      {renderArrayEditor('customerPatterns', 'commonQuestions', contextData.customerPatterns.commonQuestions, 'Vanliga frågor', 'T.ex. Var finns mjölken?')}
      {renderArrayEditor('customerPatterns', 'frequentComplaints', contextData.customerPatterns.frequentComplaints, 'Vanliga klagomål', 'T.ex. Långa köer')}
      {renderArrayEditor('customerPatterns', 'seasonalPatterns', contextData.customerPatterns.seasonalPatterns, 'Säsongsmönster', 'T.ex. Mer kött före helger')}
      {renderArrayEditor('customerPatterns', 'positivePatterns', contextData.customerPatterns.positivePatterns, 'Positiva mönster', 'T.ex. Beröm för service')}
    </div>
  );

  return (
    <div className="space-y-4">
      {contextSections.map(section => {
        const isExpanded = expandedSection === section.id;
        const completion = getSectionCompletion(section.id);
        const Icon = section.icon;

        return (
          <div key={section.id} className="border border-gray-200 rounded-lg bg-white">
            <button
              onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-lg bg-${section.color}-100`}>
                  <Icon className={`w-5 h-5 text-${section.color}-600`} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Completion indicator */}
                <div className="flex items-center space-x-2">
                  {completion >= 80 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : completion >= 50 ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                  <span className="text-sm text-gray-600">{completion}%</span>
                </div>
                
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-6 pb-6">
                <hr className="mb-6" />
                {section.id === 'layout' && renderLayoutSection()}
                {section.id === 'staff' && renderStaffSection()}
                {section.id === 'products' && renderProductsSection()}
                {section.id === 'operations' && renderOperationsSection()}
                {section.id === 'customerPatterns' && renderCustomerPatternsSection()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}